import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TREE_KINDS, TREE_SHAPES, buildTree, variantSeed } from '@workshop/treeShapes.js';
import { GREENS, createPlanter, defaultShapes, resetShape } from '../src/tree.js';

// One tree planted at the middle: its group and its grown tree.
function grow({ kind, seed, variant, shape, tint = 0.5 }) {
  const planter = createPlanter();
  const group = new THREE.Group();
  const shapes = { ...TREE_SHAPES, ...(shape ? { [kind]: shape } : {}) };
  const numbers = planter.plant(group, [{ x: 0, y: 0, z: 0, size: 1, turn: 0, tint, kind, seed, variant }], shapes);
  const { tree } = planter.model(kind, seed, variant, shapes[kind]);
  return { group, numbers, stats: { height: tree.height, reach: tree.reach, triangles: numbers.triangles } };
}
import { LIMITS, limitsFor, sliderKind } from '../src/limits.js';

// These checks guard what TreeLab relies on from the workshop's
// treeShapes.js. If the workshop renames or reshapes an export, they fail
// here before the page breaks.

test('the workshop still gives the three kinds TreeLab knows', () => {
  assert.deepEqual([...TREE_KINDS].sort(), Object.keys(GREENS).sort());
  for (const kind of TREE_KINDS) assert.ok(TREE_SHAPES[kind], `TREE_SHAPES has no ${kind}`);
});

test('every kind grows into wood and foliage, using the same three.js as TreeLab', () => {
  for (const kind of TREE_KINDS) {
    const { group, stats } = grow({ kind, seed: 7, variant: 0 });
    const [wood, foliage] = group.children;
    const { materials } = group.userData;
    assert.ok(wood.geometry instanceof THREE.BufferGeometry, `${kind}: the wood isn't TreeLab's three.js`);
    assert.equal(wood.material, materials.bark);
    assert.equal(foliage.material, kind === 'broadleaf' ? materials.leaves : materials.needles);
    assert.ok(foliage.geometry.attributes.color, `${kind}: no vertex colours`);
    assert.ok(foliage.isInstancedMesh && foliage.instanceColor, `${kind}: the foliage isn't tinted per tree, as in the workshop`);
    const { species } = group.userData;
    assert.deepEqual(species[kind].variants[0].meshes, [wood, foliage], `${kind}: not planted as src/trees.js plants`);
    assert.ok(stats.height > 2 && stats.height < 15, `${kind}: height ${stats.height}`);
    assert.ok(stats.reach > 0.3, `${kind}: reach ${stats.reach}`);
    assert.ok(stats.triangles > 100, `${kind}: ${stats.triangles} triangles`);
  }
});

test('seed and variant pick the same tree the workshop does', () => {
  for (const kind of TREE_KINDS) {
    const ours = grow({ kind, seed: 7, variant: 3 }).group.children[0].geometry;
    const theirs = buildTree(kind, variantSeed(7, kind, 3)).wood;
    assert.deepEqual(Array.from(ours.attributes.position.array), Array.from(theirs.attributes.position.array), kind);
  }
});

test('a different seed grows a different tree', () => {
  for (const kind of TREE_KINDS) {
    const a = grow({ kind, seed: 7, variant: 0 }).stats;
    const b = grow({ kind, seed: 8, variant: 0 }).stats;
    assert.notEqual(a.height, b.height, kind);
  }
});

test('the sliders change the tree, and reset puts the workshop\'s settings back', () => {
  const shapes = defaultShapes();
  const before = grow({ kind: 'fir', seed: 7, variant: 0, shape: shapes.fir }).stats;
  shapes.fir.height[0] = shapes.fir.height[1] = 4;
  const after = grow({ kind: 'fir', seed: 7, variant: 0, shape: shapes.fir }).stats;
  assert.ok(after.height < before.height - 1, `${after.height} vs ${before.height}`);
  assert.notEqual(TREE_SHAPES.fir.height[0], 4, 'changing TreeLab\'s copy changed the workshop\'s defaults');

  const range = shapes.fir.height; // the slider's bound array
  resetShape(shapes, 'fir');
  assert.equal(shapes.fir.height, range, 'reset swapped the array, unbinding its sliders');
  assert.deepEqual(shapes.fir, TREE_SHAPES.fir);
});

test('every shape setting has a slider that takes in its default', () => {
  for (const kind of TREE_KINDS) {
    for (const [key, value] of Object.entries(TREE_SHAPES[kind])) {
      const [lo, hi, step] = limitsFor(key, value);
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) assert.ok(v >= lo && v <= hi, `${kind}.${key} = ${v} outside [${lo}, ${hi}]`);
      assert.ok(step > 0, `${kind}.${key}: step ${step}`);
    }
  }
});

test('TreeLab\'s slider table knows every setting the workshop has (new ones get a guessed slider)', () => {
  const unknown = TREE_KINDS.flatMap((kind) => Object.keys(TREE_SHAPES[kind]).filter((key) => !LIMITS[key]).map((key) => `${kind}.${key}`));
  assert.deepEqual(unknown, [], 'add these to src/limits.js, copying the workshop\'s src/labs/trees.js LIMITS');
});

// The tripwire for a reshaped generator: when the workshop gives TREE_SHAPES
// a setting of a new kind (an age, a switch), this fails and names what
// TreeLab can't slide yet. The page keeps working and lists them under "no slider yet".
test('every workshop setting is a number or a [least, most] range, as TreeLab expects', () => {
  const odd = TREE_KINDS.flatMap((kind) => Object.entries(TREE_SHAPES[kind]).filter(([, v]) => !sliderKind(v)).map(([key]) => `${kind}.${key}`));
  assert.deepEqual(odd, [], 'TreeLab needs controls for these');
});

test('a setting of a new shape gets no slider rather than breaking the panel', () => {
  assert.equal(sliderKind(0.3), 'number');
  assert.equal(sliderKind([1, 2]), 'range');
  for (const v of [true, 'old', { sapling: 1, old: 3 }, [[1, 2], [3, 4]], [1, 2, 3], NaN, null]) {
    assert.equal(sliderKind(v), null, JSON.stringify(v));
  }
});

test('a setting TreeLab has never seen still gets a sensible slider', () => {
  assert.deepEqual(limitsFor('newThing', 4), [0, 12, 1]);
  assert.deepEqual(limitsFor('newRange', [0.5, 2]), [0, 6, 0.01]);
});

test('trees sharing a kind, seed and variant share one grown tree, instanced', () => {
  const planter = createPlanter();
  const group = new THREE.Group();
  const at = (x, kind, variant) => ({ x, y: 0, z: 0, size: 1, turn: 0, tint: 0.5, kind, seed: 7, variant });
  const records = [at(0, 'fir', 0), at(5, 'fir', 0), at(10, 'fir', 1), at(15, 'pine', 0)];
  const numbers = planter.plant(group, records, TREE_SHAPES);
  assert.equal(numbers.trees, 4);
  assert.equal(numbers.models, 3);
  assert.equal(group.children.length, 6, 'two meshes (wood, foliage) per grown tree');
  const fir0 = group.userData.species.fir.variants.find((v) => v.model.variant === 0);
  assert.equal(fir0.meshes[0].count, 2);
  assert.deepEqual(fir0.meshes[0].userData.trees.map((t) => t.x), [0, 5]);
  assert.equal(group.userData.trees.length, 4);
  assert.ok(group.userData.trees.every((t) => t.crown > 0), 'every tree has a crown for the wind');
});

test('planting again grows only what changed, and drops what is no longer planted', () => {
  const planter = createPlanter();
  const group = new THREE.Group();
  const shapes = defaultShapes();
  const at = (x, kind) => ({ x, y: 0, z: 0, size: 1, turn: 0, tint: 0.5, kind, seed: 7, variant: 0 });
  // (Read from the planting: asking the planter for a tree keeps it.)
  const firWood = () => group.userData.species.fir.variants[0].model.tree.wood;
  assert.equal(planter.plant(group, [at(0, 'fir'), at(5, 'pine')], shapes).grown, 2);
  const wood = firWood();
  assert.equal(planter.plant(group, [at(1, 'fir'), at(6, 'pine')], shapes).grown, 0, 'moved trees grew again');
  shapes.pine.height[1] += 1;
  assert.equal(planter.plant(group, [at(1, 'fir'), at(6, 'pine')], shapes).grown, 1, 'only the pine changed');
  assert.equal(firWood(), wood);
  planter.plant(group, [at(6, 'pine')], shapes);
  assert.equal(planter.plant(group, [at(1, 'fir'), at(6, 'pine')], shapes).grown, 1, 'the fir, no longer planted, was kept');
  assert.notEqual(firWood(), wood);
});

test('each planting has its own materials, the last ones thrown away', () => {
  const planter = createPlanter();
  const group = new THREE.Group();
  const record = { x: 0, y: 0, z: 0, size: 1, turn: 0, tint: 0.5, kind: 'broadleaf', seed: 7, variant: 0 };
  planter.plant(group, [record], TREE_SHAPES);
  const old = group.userData.materials.leaves;
  let disposed = false;
  old.addEventListener('dispose', () => (disposed = true));
  planter.plant(group, [{ ...record }], TREE_SHAPES);
  assert.ok(disposed);
  assert.notEqual(group.userData.materials.leaves, old);
});
