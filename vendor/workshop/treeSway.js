import * as THREE from 'three';
import { Spring } from './spring.js';
import { shown } from './windView.js';

// The trees sway in the wind.
//
// Each tree is a spring (src/spring.js, the same as the hips' cushion and the
// arms): its crown's bend, in x and in z. The wind at its crown (from
// src/wind.js) pushes on it by drag, the square of the wind's speed, and the
// spring follows with a tree's own frequency (bigger trees slower) and
// little damping, so a gust bends a tree over and it rocks back a few times.
// The springs step with the simulation (walk.afterUpdate) on its time, so P
// freezes them. On a jump (a replay starting, a "go to") they can't know how
// they were swinging, so each starts at rest as long before as its swing can
// remember (RING_DOWNS of its own ring-down times, at most WARM_UP seconds:
// about 11 s for a stiff fir, the whole 20 for a loose broadleaf) and steps
// up to now through the wind, which is a pure function of time: by then its
// swing matches a run that never jumped, so a replay sways as the original
// did.
//
// On the GPU, each tree's bend is a per-instance attribute ("sway": the bend
// at its top, in its own turned and sized frame, and 1 / its height). The
// shader bends every vertex by it, growing with the square of its height, so
// the base stays put and the top moves most. On top, the needles and leaves
// flutter, fast and small, as strongly as the wind at that spot blows (the
// wind texture, src/windView.js), but always at the same pace: a pace taken
// from a wind that changes would drift further out of step the longer the
// page runs, and the crowns would turn to shimmer. Stiffly for firs, loosely
// for broadleaves, the outer and higher parts most. Between the two, each
// limb (a branch and its clumps, a fir's tier) bobs on its own, slower than
// the flutter, as far as its "branch" attribute says (src/treeShapes.js:
// nothing at the trunk, most at the tip) times the wind at the tree, in its
// own phase. The shadow pass bends them the same way, so the shadows, and
// the god rays that read them, move with the crowns.

// Per kind: drag (m of bend at the top per (m/s)² of wind), the springs'
// frequency for the smallest and the biggest (Hz), damping, and how much its
// foliage flutters (local m per m/s; pines share the firs' needles, and
// their flutter).
const KINDS = {
  fir: { drag: 0.006, frequency: [0.65, 0.4], damping: 0.2, flutter: 0.004 },
  pine: { drag: 0.007, frequency: [0.55, 0.32], damping: 0.18 },
  broadleaf: { drag: 0.01, frequency: [0.55, 0.3], damping: 0.15, flutter: 0.012 },
};
const SIZES = [0.75, 1.35];   // the trees' sizes run between these (src/trees.js)
// The limbs' bob and the foliage's flutter as shares of their tuning, as
// every tree starts (the tree lab's sliders turn them): no flutter to start
// with.
export const SWAY_SHARES = { branch: 1, flutter: 0 };
const CROWN_SHARE = 0.75;     // where on the tree the wind is sampled, as a share of its height
const MOST = 0.15;            // the most a tree bends, as a share of its height
const BOB_MOST = 0.04;        // the most a limb bobs (before its two waves add), as a share of the tree's height
const WARM_UP = 20;           // s: on a jump, the springs start at rest at most this long before
const RING_DOWNS = 9;         // or this many of a spring's ring-down times (1 / (ζ ω)), if sooner: e^-9, a hundredth of a percent of its swing left (6 drifted up to three times further on some jumps)
const WARM_STEP = 1 / 60;     // s: and step up to now in steps this long (measured: 0.06 cm off a run that never jumped; 1/30 s was 0.6 cm)

// warmUp: how long before a jump the springs start at rest (s; 0 to start
// them at rest at the jump, for comparison). listen: step with the walk and
// settle on its jumps by itself (false: the caller calls step and settle,
// as the tree lab does for a line-up it rebuilds; the walk can't forget a
// listener).
export function createTreeSway({ trees, wind, windView, walk, warmUp = WARM_UP, ringDowns = RING_DOWNS, warmStep = WARM_STEP, listen = true }) {
  let kinds = [];
  let all = []; // every spring, by how long it warms up (longest first)
  let probe = null; // the wind at every spring's crown, in that order (wind.probe)
  let winds = null; // and what it last gave: three numbers a spring
  let depths = []; // the shadow pass's materials, made by bind()

  // One set of springs per variant (its meshes share their instances), and
  // the trees' materials patched to bend: on creation, and again when the
  // trees are replanted.
  function bind() {
    const { species, materials } = trees.userData;
    kinds = [];
    for (const [name, kind] of Object.entries(species)) {
      const tuning = KINDS[name];
      for (const variant of kind.variants) {
        const n = variant.trees.length;
        const sway = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < n; i++) sway.setZ(i, 1 / variant.height);
        for (const mesh of variant.meshes) mesh.geometry.setAttribute('sway', sway);
        const springs = variant.trees.map((t) => {
          const big = (t.size - SIZES[0]) / (SIZES[1] - SIZES[0]);
          const frequency = tuning.frequency[0] + (tuning.frequency[1] - tuning.frequency[0]) * big;
          // (A swing dies away as e^-ζωt only while ζ < 1: a critically or
          // over-damped spring creeps back slower, so it gets the whole
          // warm-up.)
          const remembers = tuning.damping < 1 ? ringDowns / (tuning.damping * 2 * Math.PI * frequency) : warmUp;
          return {
            tree: t,
            tuning,
            x: new Spring(0),
            z: new Spring(0),
            frequency,
            crown: variant.height * t.size * CROWN_SHARE, // m above the ground
            most: variant.height * t.size * MOST,
            warmSteps: Math.ceil(Math.min(warmUp, remembers) / warmStep - 1e-9), // how many steps before a jump it starts
          };
        });
        kinds.push({ tuning, sway, springs });
      }
    }
    // Every spring, the longest to warm up first, and the wind at their
    // crowns asked in one call (exactly windAbove's, cheaper).
    all = kinds.flatMap((k) => k.springs).sort((a, b) => b.warmSteps - a.warmSteps);
    probe = wind.probe(all.map((s) => ({ x: s.tree.x, z: s.tree.z, h: s.crown })));
    winds = new Float64Array(all.length * 3);
    for (const depth of depths) depth.dispose();
    const depthOf = new Map();
    for (const [material, flutter, key] of [
      [materials.bark, 0, 'tree-bark'],
      [materials.needles, KINDS.fir.flutter, 'tree-needles'], // (firs and pines)
      [materials.leaves, KINDS.broadleaf.flutter, 'tree-leaves'],
    ]) {
      patch(material, flutter, key);
      const depth = new THREE.MeshDepthMaterial();
      patch(depth, flutter, `${key}-depth`);
      depthOf.set(material, depth);
    }
    depths = [...depthOf.values()];
    for (const kind of Object.values(species)) {
      for (const mesh of kind.meshes) mesh.customDepthMaterial = depthOf.get(mesh.material);
    }
  }

  // Where the wind would hold spring i's top: drag, the square of the wind
  // at its crown (winds, as the probe last gave it), up to the most it
  // bends. Into aim ([x, z], m).
  const aim = [0, 0];
  function target(s, i) {
    const wx = winds[i * 3], wz = winds[i * 3 + 2];
    const speed = Math.hypot(wx, wz);
    const bend = Math.min(speed * speed * s.tuning.drag, s.most);
    aim[0] = speed > 0 ? (wx / speed) * bend : 0;
    aim[1] = speed > 0 ? (wz / speed) * bend : 0;
    return aim;
  }

  // Spring i dt seconds on, the wind in winds pushing it.
  function advance(s, i, dt) {
    const [bx, bz] = target(s, i);
    s.x.update(bx, dt, s.frequency, s.tuning.damping);
    s.z.update(bz, dt, s.frequency, s.tuning.damping);
  }

  function step(dt, t) {
    probe.at(t, winds);
    for (let i = 0; i < all.length; i++) advance(all[i], i, dt);
    writeAll();
  }

  // As the trees would be swinging at time t (on a jump, and to start):
  // each at rest, bent as the wind then held it, its own warmSteps steps
  // before t, then stepped through the wind up to t. The steps are counted
  // back from t, so every spring steps at the same times, and those already
  // warming up (the first of all) ask the wind at once.
  // (stats: the last warm-up's time, ms, and its springs' steps, all told)
  const stats = { warmUpMs: 0, warmUpSteps: 0 };
  function settle(t) {
    const started = performance.now();
    stats.warmUpSteps = 0;
    let warming = 0;
    for (let n = all.length ? all[0].warmSteps : 0; n >= 0; n--) {
      while (warming < all.length && all[warming].warmSteps >= n) warming++;
      const now = t - n * warmStep;
      probe.at(now, winds, warming);
      for (let i = 0; i < warming; i++) {
        const s = all[i];
        if (s.warmSteps > n) {
          advance(s, i, warmStep);
          stats.warmUpSteps++;
        } else {
          // (starting now)
          const [bx, bz] = target(s, i);
          s.x.value = bx;
          s.z.value = bz;
          s.x.velocity = s.z.velocity = 0;
        }
      }
    }
    writeAll();
    stats.warmUpMs = performance.now() - started;
  }

  // The bends into the per-instance attribute, in each tree's own frame
  // (none while the sway is off).
  const local = [0, 0];
  function writeAll() {
    for (const { sway, springs } of kinds) {
      springs.forEach((s, i) => {
        if (on) toLocal(s.x.value, s.z.value, s.tree.turn, s.tree.size, local);
        else local[0] = local[1] = 0;
        sway.setX(i, local[0]);
        sway.setY(i, local[1]);
      });
      sway.needsUpdate = true;
    }
  }

  // --- The shaders ------------------------------------------------------------

  // The flutter and the bob read the wind texture: it's filled in a frame
  // the trees will be drawn swaying (off, the shader ignores it).
  const unread = windView.addReader(() => on && shown(trees));
  // The limbs' bob and the flutter, as shares of their tuning (1: as tuned;
  // the tree lab turns them; SWAY_SHARES to start), and whether the sway is
  // on (1) or off (0).
  const uniforms = { treeBranch: { value: SWAY_SHARES.branch }, treeFlutter: { value: SWAY_SHARES.flutter }, treeSwayOn: { value: 1 } };

  // On or off (the labs' tree-sway chip). Off, the trees stand straight and
  // still, in their shadows too: no bend (the attribute holds none), no bob
  // and no flutter (the uniform). The springs keep stepping meanwhile, so
  // switched back on, the trees sway as if they had never stopped.
  let on = true;
  const settings = {
    get on() { return on; },
    set on(value) {
      on = !!value;
      uniforms.treeSwayOn.value = on ? 1 : 0;
      writeAll();
    },
  };
  const shared = { ...windView.uniforms, ...uniforms };
  const patch = (material, flutter, key) => {
    material.customProgramCacheKey = () => key;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shared);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${SWAY_GLSL}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed = treeSway(transformed, ${flutter.toFixed(4)});`);
    };
    material.needsUpdate = true;
  };

  bind();
  settle(walk.sim.time);
  if (listen) {
    walk.afterUpdate((dt, sim) => step(dt, sim.time));
    walk.onJump((sim) => settle(sim.time));
  }

  // The trees replanted in their group (the tree lab's "use in the
  // forest"): their new meshes and materials take the sway, and the springs
  // start as they would be swinging now.
  function replant() {
    bind();
    settle(walk.sim.time);
  }

  // Done with (a line-up the tree lab rebuilt): the wind texture is one
  // reader fewer, and the shadow pass's materials go.
  function dispose() {
    unread();
    for (const depth of depths) depth.dispose();
    depths = [];
  }

  return { step, settle, replant, dispose, stats, uniforms, settings };
}

// A bend at a tree's top in the world (x, z, m) in the tree's own frame:
// turned back by its turn about the vertical and divided by its size, since
// the shader bends the tree before the instance turns, sizes and places it.
// Into out ([x, z]).
export function toLocal(bx, bz, turn, size, out = [0, 0]) {
  const c = Math.cos(turn), s = Math.sin(turn);
  out[0] = (bx * c - bz * s) / size;
  out[1] = (bx * s + bz * c) / size;
  return out;
}

// The bend, the limbs' bob and the flutter, on a vertex in the tree's own
// frame (before the instance's turn and size). sway.xy: the bend at the top;
// sway.z: 1 / the tree's height. branch: the limb's phase, how far this
// vertex bobs (local m per m/s of wind) and the limb's heading (radians).
// flutter: local m per m/s of wind (0: none, the bark).
const SWAY_GLSL = /* glsl */ `
  attribute vec3 sway;
  attribute vec3 branch;
  uniform sampler2D windMap;
  uniform float windHalf;
  uniform float windTime;
  uniform float treeBranch;
  uniform float treeFlutter;
  uniform float treeSwayOn;
  vec3 treeSway(vec3 p, float flutter) {
    float up = clamp(p.y * sway.z, 0.0, 1.2);
    float k = up * up;
    vec3 bent = p;
    bent.xz += sway.xy * k;
    bent.y -= 0.5 * dot(sway.xy, sway.xy) * sway.z * k; // (keeps the tree its length)
    float reach = branch.y * treeBranch * treeSwayOn;
    if (reach > 0.0) {
      // The wind at the tree's foot, so a limb and its clumps move as one,
      // and the tree's place in the phase, so the trees sharing a variant
      // don't bob together. A fixed pace (about 0.43 and 0.68 Hz), mostly up
      // and down, a little along the limb's heading.
      #ifdef USE_INSTANCING
        vec4 root = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      #else
        vec4 root = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      #endif
      float speed = length(texture2D(windMap, (root.xz + windHalf) / (2.0 * windHalf)).rg);
      float phase = branch.x + dot(root.xz, vec2(0.37, 0.61));
      float bob = sin(windTime * 2.7 + phase) + 0.35 * sin(windTime * 4.3 + phase * 1.9);
      // Capped like the bend, so a gale (or the lab's slider) can't fling it.
      float drive = min(reach * speed, ${BOB_MOST.toFixed(3)} / sway.z);
      bent += vec3(cos(branch.z) * 0.4, 1.0, sin(branch.z) * 0.4) * bob * drive;
    }
    flutter *= treeFlutter * treeSwayOn;
    if (flutter > 0.0) {
      // Where this vertex stands at rest: its phase and the wind it feels
      // (not where the bend has put it, which would shift its phase as the
      // tree swings).
      #ifdef USE_INSTANCING
        vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
      #else
        vec4 world = modelMatrix * vec4(p, 1.0);
      #endif
      vec4 w = texture2D(windMap, (world.xz + windHalf) / (2.0 * windHalf));
      float speed = length(w.rg);
      float reach = clamp(length(p.xz) * 0.6, 0.0, 1.0) * up; // the outer, higher parts most
      float phase = dot(world.xyz, vec3(1.7, 2.3, 1.1));
      // A fixed pace (about 1.4 and 2.2 Hz): the wind sets only how far.
      float wave = sin(windTime * 9.0 + phase) + 0.5 * sin(windTime * 14.0 + phase * 1.7);
      bent += vec3(0.6, 0.3, 0.6) * wave * flutter * speed * reach;
    }
    return bent;
  }`;
