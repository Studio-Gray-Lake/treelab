import * as THREE from 'three';
import { TREE_SHAPES, buildTree, variantSeed } from '@workshop/treeShapes.js';

// Trees grown by the workshop's own generator (src/treeShapes.js) and
// planted as the workshop's forest plants them (src/trees.js, plantTrees):
// instanced meshes of white materials coloured by the vertices, the foliage
// tinted per tree by kind, and the group's userData shaped the same, so the
// workshop's sway (src/treeSway.js) and wind (src/wind.js) can use it.

// The foliage's greens per kind, least and most tinted (src/trees.js).
export const GREENS = {
  fir: [0x2a5034, 0x426a3c],
  pine: [0x23402f, 0x355238],
  broadleaf: [0x58763a, 0x86963f],
};

// Every kind's shape settings, a copy of the workshop's defaults that the
// sliders can change.
export const defaultShapes = () => structuredClone(TREE_SHAPES);

// Put one kind's settings back to the workshop's defaults, in place, so the
// sliders bound to them stay bound.
export function resetShape(shapes, kind) {
  for (const [key, value] of Object.entries(TREE_SHAPES[kind])) {
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

export const triangles = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

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

  // A grown tree: { kind, seed, variant, tree (buildTree's), ms }.
  function model(kind, seed, variant, shape = TREE_SHAPES[kind]) {
    const key = `${kind}|${seed}|${variant}`;
    const stamp = JSON.stringify(shape);
    let m = models.get(key);
    if (m && m.stamp !== stamp) {
      forget(m);
      m = null;
    }
    if (!m) {
      const start = performance.now();
      const tree = buildTree(kind, variantSeed(seed, kind, variant), shape);
      m = { key, kind, seed, variant, tree, stamp, ms: performance.now() - start, grown: round, mottle: 0 };
      // (Its foliage's own colours, kept for mottle().)
      m.base = tree.foliage.attributes.color.array.slice();
      models.set(key, m);
    }
    m.used = round;
    return m;
  }

  function forget(m) {
    m.tree.wood.dispose();
    m.tree.foliage.dispose();
    models.delete(m.key);
  }

  // The records into the group, with the workshop's userData. Returns the
  // planting's numbers. colorOf(record): a tree's foliage colour (by
  // default its kind's greens, by its tint); mottle(kind): how much its
  // limbs differ (0 to 1, see mottleModel).
  function plant(group, records, shapes = TREE_SHAPES, { colorOf = greenOf, mottle = () => 0 } = {}) {
    clear(group);
    const materials = createMaterials();
    const foliageOf = { fir: materials.needles, pine: materials.needles, broadleaf: materials.leaves };
    const byModel = new Map();
    for (const t of records) {
      const m = model(t.kind, t.seed, t.variant, shapes[t.kind]);
      if (!byModel.has(m)) byModel.set(m, []);
      byModel.get(m).push(t);
    }

    const species = {};
    let drawn = 0;
    for (const [m, trees] of byModel) {
      const { tree, kind } = m;
      mottleModel(m, mottle(kind));
      const meshes = [
        instanced(tree.wood, materials.bark, trees, null),
        instanced(tree.foliage, foliageOf[kind], trees, colorOf),
      ];
      for (const t of trees) t.crown = tree.crown * t.size;
      const entry = (species[kind] ??= { trees: [], meshes: [], height: 0, variants: [] });
      entry.variants.push({ trees, meshes, height: tree.height, crown: tree.crown, model: m });
      entry.trees.push(...trees);
      entry.meshes.push(...meshes);
      entry.height = Math.max(entry.height, tree.height);
      group.add(...meshes);
      drawn += trees.length * (triangles(tree.wood) + triangles(tree.foliage));
    }

    const all = Object.values(species).flatMap((s) => s.trees);
    group.userData = {
      species,
      materials,
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
    return { trees: all.length, models: byModel.size, triangles: drawn, grown, ms };
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
// geometry stays with the planter).
function clear(group) {
  for (const mesh of [...group.children]) {
    group.remove(mesh);
    mesh.dispose();
  }
  for (const material of Object.values(group.userData.materials ?? {})) material.dispose();
  group.userData = {};
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
