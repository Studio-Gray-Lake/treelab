import * as THREE from 'three';
import { DEFAULT_SHAPES, growKind, leafy, swayKind } from './kinds.js';
import { shadeCrown } from './crownShade.js';
import { rootsOf } from './oak/oakMesh.js';

// Trees grown by the workshop's own generator (src/treeShapes.js) and
// planted as the workshop's forest plants them (src/trees.js, plantTrees):
// instanced meshes of white materials coloured by the vertices, the foliage
// tinted per tree by kind, and the group's userData shaped the same, so the
// workshop's sway (src/treeSway.js) and wind (src/wind.js) can use it.

// The foliage's greens per kind, least and most tinted (src/trees.js).
export const GREENS = {
  oak: [0x4a6a2a, 0x6c8c3a],
  beech: [0x3f6b2e, 0x629440],        // a clearer green than the oak's olive
  hawthorn: [0x3c5c26, 0x587833],     // dark
  hazel: [0x4f7a2e, 0x71963a],        // lighter than an oak's, soft
  holly: [0x1f4024, 0x325a30],        // very dark, glossy
  ash: [0x4a7232, 0x6e9844],          // a fresh mid green
  birch: [0x5a8a36, 0x86ae4a],        // light
  linden: [0x3d6a2c, 0x5c8a3a],       // dark, a little bluer than an oak's
  fir: [0x2a5034, 0x426a3c],
  pine: [0x23402f, 0x355238],
  broadleaf: [0x58763a, 0x86963f],
};

// Every kind's shape settings, a copy of the workshop's defaults that the
// sliders can change.
export const defaultShapes = () => structuredClone(DEFAULT_SHAPES);

// Put one kind's settings back to the workshop's defaults, in place, so the
// sliders bound to them stay bound.
export function resetShape(shapes, kind) {
  for (const [key, value] of Object.entries(DEFAULT_SHAPES[kind])) {
    if (Array.isArray(value)) shapes[kind][key].splice(0, Infinity, ...value);
    else shapes[kind][key] = structuredClone(value);
  }
}

// The materials of src/trees.js.
export function createMaterials() {
  return {
    bark: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, flatShading: true }),
    needles: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, flatShading: true }),
    leaves: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, flatShading: true }),
  };
}

export const triangles = (g) => Math.min(g.index ? g.index.count : g.attributes.position.count, g.drawRange.count) / 3;

// --- Roots on the ground they stand on ---------------------------------------------------
//
// TreeLab's own kinds are grown with their roots on level ground (./oak/
// oakMesh.js). Planted on hills (plant's `ground`), each tree is drawn
// without them, and its roots are drawn again for it alone, over the ground
// under it: one tree's roots can't be part of a model that many trees share.
// And each such tree stands on the ground, sunk just so far that the
// downhill side of its foot is in the ground, and no further.
//
// The roots of every tree go into one mesh, in the world's own measures.
// They don't sway: a root in the ground stays put.
//
// Said plainly: there is a limit. Roots are drawn for the trees nearest the
// middle first, until ROOTS_MOST triangles; the trees further out stand
// without them. And, as rootsOf says, the ground only drapes a root: it
// doesn't turn it.
export const ROOTS_BARE = 0.5;     // how much the slope has a say in which roots show, uphill covered and downhill bare (rootsOf's "bare"): half, so a slope's uphill roots aren't lost
export const ROOTS_MOST = 600000;  // triangles of roots at most, in a planting: about 1,400 oaks' worth, or 500 ancient oaks' (each 100,000 is 14 MB, and as much again on the graphics card)
const FOOT_SIDES = 12;             // places round a trunk's foot where the ground is looked at, for how far to sink it

// How far a grown tree of TreeLab's own stands sunk at its record's place
// (m): its foot is as wide as its trunk spreads toward the ground, and the
// ground round the foot falls this far below the ground at its middle, at
// most. On level ground, not at all.
export function sunk(tree, t, heightAt) {
  const w = tree.layout.wood;
  const r = w.girth * (1 + 0.7 * w.flare) * t.size;
  const middle = heightAt(t.x, t.z);
  let low = middle;
  for (let k = 0; k < FOOT_SIDES; k++) {
    const a = (k / FOOT_SIDES) * Math.PI * 2;
    low = Math.min(low, heightAt(t.x + Math.cos(a) * r, t.z + Math.sin(a) * r));
  }
  return middle - low;
}
// (Whether a grown tree's roots can be drawn apart: TreeLab's own kinds, when they have roots.)
const rootedApart = (tree) => tree.rootsFrom !== undefined && tree.rootsFrom < tree.wood.attributes.position.count;

// Plants trees into a group that stays in the scene, again and again, each
// time throwing the last planting away.
//
// A record: { x, y, z, size, turn, tint, kind, seed, variant } (y: the
// foot, m; size: 1 as grown, the workshop's run 0.75 to 1.35; turn: radians
// about the vertical; tint: 0 to 1 between the kind's greens). Records
// sharing a kind, seed and variant share one grown tree ("model"), drawn
// as one instanced mesh for the wood and one for the foliage. seed and
// variant are as the workshop draws them (variantSeed), so seed 7, variant 0
// is the tree the workshop's forest and garden show for seed 7, variant 0.
//
// Grown trees are kept while they're planted, so planting again with the
// same shapes (moving trees, changing the mix) grows nothing new.
export function createPlanter() {
  const models = new Map();
  let round = 0;

  // A grown tree: { kind, seed, variant, tree (buildTree's), ms }. (A
  // shape that can't be grown throws before the tree it would replace is
  // let go: that one stays.)
  function model(kind, seed, variant, shape = DEFAULT_SHAPES[kind]) {
    const key = `${kind}|${seed}|${variant}`;
    const stamp = JSON.stringify(shape);
    let m = models.get(key);
    if (!m || m.stamp !== stamp) {
      const start = performance.now();
      const tree = growKind(kind, seed, variant, shape);
      shadeCrown(tree); // (darker deep in the crown: src/crownShade.js)
      if (m) forget(m);
      m = { key, kind, seed, variant, tree, stamp, ms: performance.now() - start, grown: round, mottle: 0 };
      // (Its foliage's own colours, kept for mottle().)
      m.base = tree.foliage.attributes.color.array.slice();
      models.set(key, m);
    }
    m.used = round;
    return m;
  }

  // A grown tree's wood without its roots: the same corners, drawn up to
  // where its roots begin (made once, when first asked for).
  function rootless(m) {
    if (!m.rootless) {
      const g = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(m.tree.wood.attributes)) g.setAttribute(name, attribute);
      g.setDrawRange(0, m.tree.rootsFrom);
      g.computeBoundingSphere();
      m.rootless = g;
    }
    return m.rootless;
  }

  function forget(m) {
    m.rootless?.dispose();
    m.tree.wood.dispose();
    m.tree.foliage.dispose();
    models.delete(m.key);
  }

  // The records into the group, with the workshop's userData. Returns the
  // planting's numbers. colorOf(record): a tree's foliage colour (by
  // default its kind's greens, by its tint); mottle(kind): how much its
  // limbs differ (0 to 1, see mottleModel).
  // shapeOf(kind, variant): the shape that one of a kind's trees is grown
  // from (by default the kind's own: with several ages, each its own).
  // ground: the hills the trees stand on ({ heightAt(x, z) }), if they
  // aren't on level ground: then each tree of TreeLab's own kinds is set on
  // it, sunk as its slope asks (its record's y is set), and given roots of
  // its own over it (see above). With none, every tree is drawn as grown, at
  // its record's y. rootsMost: how many triangles of roots at most
  // (ROOTS_MOST unless said).
  function plant(group, records, shapes = DEFAULT_SHAPES, { colorOf = greenOf, mottle = () => 0, shapeOf = (kind) => shapes[kind], ground = null, rootsMost = ROOTS_MOST } = {}) {
    // Every tree grown before the last planting is taken down: should one
    // fail to grow, the last trees are left standing.
    const byModel = new Map();
    for (const t of records) {
      const m = model(t.kind, t.seed, t.variant, shapeOf(t.kind, t.variant));
      if (!byModel.has(m)) byModel.set(m, []);
      byModel.get(m).push(t);
    }
    clear(group);
    const materials = createMaterials();

    const species = {};
    const rooted = []; // ({ t: a record, m: its grown tree }: the trees whose roots are drawn apart)
    let drawn = 0;
    for (const [m, trees] of byModel) {
      const { tree, kind } = m;
      mottleModel(m, mottle(kind));
      const apart = ground && rootedApart(tree);
      if (apart) for (const t of trees) t.y = ground.heightAt(t.x, t.z) - sunk(tree, t, ground.heightAt);
      const wood = apart ? rootless(m) : tree.wood;
      const meshes = [
        instanced(wood, materials.bark, trees, null),
        instanced(tree.foliage, leafy(kind) ? materials.leaves : materials.needles, trees, colorOf),
      ];
      for (const t of trees) t.crown = tree.crown * t.size;
      // (Under the kind the workshop's sway tunes it by: an oak is a broadleaf there.)
      const entry = (species[swayKind(kind)] ??= { trees: [], meshes: [], height: 0, variants: [] });
      entry.variants.push({ trees, meshes, height: tree.height, crown: tree.crown, model: m });
      entry.trees.push(...trees);
      entry.meshes.push(...meshes);
      entry.height = Math.max(entry.height, tree.height);
      group.add(...meshes);
      drawn += trees.length * (triangles(wood) + triangles(tree.foliage));
      if (apart) rooted.push(...trees.map((t) => ({ t, m })));
    }
    const roots = rooted.length ? rootsMesh(rooted, ground.heightAt, materials.bark, rootsMost) : null;
    if (roots) {
      group.add(roots.mesh);
      drawn += roots.triangles;
    }

    const all = Object.values(species).flatMap((s) => s.trees);
    group.userData = {
      species,
      materials,
      roots: roots ? { mesh: roots.mesh, trees: roots.trees, left: roots.left } : null,
      count: all.length,
      // Where they stand and how wide their crowns are, for the wind.
      trees: all.map((t) => ({ x: t.x, z: t.z, crown: t.crown })),
    };

    // Grown trees no longer planted go.
    let grown = 0, ms = 0;
    for (const m of [...models.values()]) {
      if (m.used !== round) forget(m);
      else if (m.grown === round) {
        grown++;
        ms += m.ms;
      }
    }
    round++;
    return { trees: all.length, models: byModel.size, triangles: drawn, grown, ms, roots: roots ? { trees: roots.trees.length, left: roots.left } : null };
  }

  // Everything planted, and every grown tree, thrown away.
  function dispose(group) {
    if (group) clear(group);
    for (const m of [...models.values()]) forget(m);
  }

  // Every grown tree's limbs mottled anew (mottle(kind): 0 to 1).
  function mottleAll(mottle) {
    for (const m of models.values()) mottleModel(m, mottle(m.kind));
  }

  return { model, plant, dispose, mottle: mottleAll };
}

// A kind's two greens, by a tree's tint.
const greens = Object.fromEntries(Object.entries(GREENS).map(([kind, [a, b]]) => [kind, [new THREE.Color(a), new THREE.Color(b)]]));
export const greenOf = (t, out = new THREE.Color()) => out.copy(greens[t.kind][0]).lerp(greens[t.kind][1], t.tint);

// A grown tree's foliage, limb by limb a little warmer or cooler, darker or
// lighter, by `k` (0: its own colours): autumn reaching some limbs first.
// Each limb is told apart by its sway phase (the "branch" attribute).
function mottleModel(m, k) {
  if (m.mottle === k) return;
  m.mottle = k;
  const color = m.tree.foliage.attributes.color;
  const branch = m.tree.foliage.attributes.branch;
  const base = m.base;
  for (let i = 0; i < color.count; i++) {
    const phase = branch ? branch.getX(i) : 0;
    const f = fract(Math.sin(phase * 12.9898 + 78.233) * 43758.5453);
    const g = fract(Math.sin(phase * 39.346 + 11.135) * 24634.6345);
    const light = 1 + k * 0.25 * (g - 0.5);
    color.setXYZ(i, base[i * 3] * light, base[i * 3 + 1] * (1 - k * 0.35 * f) * light, base[i * 3 + 2] * (1 - k * 0.6 * f) * light);
  }
  color.needsUpdate = true;
}
const fract = (v) => v - Math.floor(v);

// A grown tree's trunk: its radius about knee high (m). The oak's is what
// it was grown with; another kind's is measured from its wood there (so
// low branches make it a little wide).
export function trunkRadius(tree) {
  if (tree.layout?.wood?.girth > 0) return tree.layout.wood.girth;
  const p = tree.wood.attributes.position;
  let n = 0, cx = 0, cz = 0;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < 0.3 || p.getY(i) > 1) continue;
    cx += p.getX(i);
    cz += p.getZ(i);
    n++;
  }
  if (!n) return 0.15;
  let r = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) >= 0.3 && p.getY(i) <= 1) r = Math.max(r, Math.hypot(p.getX(i) - cx / n, p.getZ(i) - cz / n));
  return Math.min(1.5, r);
}

// Where a planted group's trunks stand and how thick they are, for whoever
// walks among them: [{ x, z, r }] (m).
export function trunksOf(group) {
  const trunks = [];
  for (const species of Object.values(group.userData.species ?? {})) {
    for (const variant of species.variants) {
      const r = trunkRadius(variant.model.tree);
      for (const t of variant.trees) trunks.push({ x: t.x, z: t.z, r: r * t.size });
    }
  }
  return trunks;
}

// How high a planted group's trees reach above `base` (m): each tree's foot
// (on the hills, where it stands) plus its height as planted.
export function treetops(group, base = 0) {
  let top = 0;
  for (const species of Object.values(group.userData.species ?? {})) {
    for (const variant of species.variants) {
      for (const t of variant.trees) top = Math.max(top, t.y - base + variant.height * t.size);
    }
  }
  return top;
}

// The foliage of a planted group coloured anew (no regrowing).
export function recolor(group, colorOf) {
  const c = new THREE.Color();
  for (const species of Object.values(group.userData.species ?? {})) {
    for (const variant of species.variants) {
      const foliage = variant.meshes[1];
      variant.trees.forEach((t, i) => foliage.setColorAt(i, colorOf(t, c)));
      foliage.instanceColor.needsUpdate = true;
    }
  }
}

// The group emptied: its meshes and materials go (the grown trees'
// geometry stays with the planter; the roots' was the planting's own).
function clear(group) {
  for (const mesh of [...group.children]) {
    group.remove(mesh);
    if (mesh === group.userData.roots?.mesh) mesh.geometry.dispose();
    mesh.dispose();
  }
  for (const material of Object.values(group.userData.materials ?? {})) material.dispose();
  group.userData = {};
}

// The roots of the trees in `rooted` ([{ t: a record, m: its grown tree }],
// each already set on the ground), each over the ground under it, nearest
// the middle first, until `most` triangles, as one mesh: { mesh, trees
// (those given roots), left (how many were not), triangles }. A click on a
// root picks its tree: the mesh's userData.treeOf(the triangle hit).
function rootsMesh(rooted, heightAt, material, most) {
  const near = [...rooted].sort((a, b) => Math.hypot(a.t.x, a.t.z) - Math.hypot(b.t.x, b.t.z));
  // (A tree's roots have as many corners on any ground as on level ground: only their heights differ.)
  const corners = (m) => m.tree.wood.attributes.position.count - m.tree.rootsFrom;
  const kept = [];
  let total = 0;
  for (const r of near) {
    if ((total + corners(r.m)) / 3 > most) break;
    kept.push(r);
    total += corners(r.m);
  }
  const position = new Float32Array(total * 3), normal = new Float32Array(total * 3), color = new Float32Array(total * 3), branch = new Float32Array(total * 3);
  const starts = []; // (each tree's first triangle)
  let at = 0;
  for (const { t, m } of kept) {
    const c = Math.cos(t.turn), s = Math.sin(t.turn);
    // (The ground in the tree's own measures: from its foot, turned back and sized back.)
    const ground = (x, z) => (heightAt(t.x + (x * c + z * s) * t.size, t.z + (-x * s + z * c) * t.size) - t.y) / t.size;
    const g = rootsOf(m.tree.layout, ground, { bare: ROOTS_BARE });
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    starts.push(at / 9);
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      position[at + i] = t.x + (x * c + z * s) * t.size;
      position[at + i + 1] = t.y + y * t.size;
      position[at + i + 2] = t.z + (-x * s + z * c) * t.size;
      normal[at + i] = n[i] * c + n[i + 2] * s;
      normal[at + i + 1] = n[i + 1];
      normal[at + i + 2] = -n[i] * s + n[i + 2] * c;
    }
    color.set(g.attributes.color.array, at);
    branch.set(g.attributes.branch.array, at);
    at += p.length;
    g.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geometry.setAttribute('branch', new THREE.BufferAttribute(branch, 3));
  // (The bark's material sways what it draws, src/swayRig.js: the roots are given no bend.)
  geometry.setAttribute('sway', new THREE.InstancedBufferAttribute(new Float32Array(3), 3));
  geometry.computeBoundingSphere();
  // (One instance, where it is: so it is drawn by the same materials, the same ways, as the trees' wood.)
  const mesh = new THREE.InstancedMesh(geometry, material, 1);
  mesh.name = 'roots';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  const trees = kept.map((r) => r.t);
  mesh.userData.treeOf = (face) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= face) lo = mid;
      else hi = mid - 1;
    }
    return trees[lo] ?? null;
  };
  return { mesh, trees, left: rooted.length - kept.length, triangles: total / 3 };
}

// One instanced mesh of `geometry` per tree, turned, sized and placed.
const up = new THREE.Vector3(0, 1, 0);
function instanced(geometry, material, trees, colorOf) {
  const mesh = new THREE.InstancedMesh(geometry, material, trees.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3(), s = new THREE.Vector3();
  trees.forEach((t, i) => {
    q.setFromAxisAngle(up, t.turn);
    mesh.setMatrixAt(i, m.compose(p.set(t.x, t.y, t.z), q, s.setScalar(t.size)));
    const color = colorOf?.(t);
    if (color) mesh.setColorAt(i, color);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  mesh.userData.trees = trees; // (by instance: what a click on it picks)
  return mesh;
}
