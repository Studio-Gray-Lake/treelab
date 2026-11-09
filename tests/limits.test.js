import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TREE_KINDS, TREE_SHAPES, buildTree, variantSeed } from '@workshop/treeShapes.js';
import { LIMITS, WORKSHOP_LIMITS, limitsFor, sliderKind } from '../src/limits.js';
import { PRESETS, presetOf, presetShape } from '../src/presets.js';

// TreeLab's sliders reach past the workshop's, for outlying trees. These
// grow every kind at both ends of every slider, and every ready-made shape,
// and check the generator copes: no failure, no broken numbers, nothing
// absurdly big or heavy.

const SEEDS = [1, 2, 3, 4, 5, 6].map((v) => variantSeed(7, 'x', v));
const triangles = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const finite = (g) => g.attributes.position.array.every(Number.isFinite);

function grows(kind, shape, label) {
  for (const seed of SEEDS) {
    let tree;
    assert.doesNotThrow(() => (tree = buildTree(kind, seed, shape)), `${label}: the generator failed`);
    assert.ok(finite(tree.wood) && finite(tree.foliage), `${label}: broken numbers`);
    const n = triangles(tree.wood) + triangles(tree.foliage);
    assert.ok(n > 50 && n < 8000, `${label}: ${n} triangles`);
    assert.ok(tree.height > 1 && tree.height < 40, `${label}: ${tree.height.toFixed(1)} m tall`);
    assert.ok(tree.reach < 15, `${label}: reaches ${tree.reach.toFixed(1)} m`);
  }
}

test('TreeLab\'s sliders take in all of the workshop\'s', () => {
  for (const [key, [lo, hi]] of Object.entries(WORKSHOP_LIMITS)) {
    assert.ok(LIMITS[key][0] <= lo && LIMITS[key][1] >= hi, key);
  }
});

test('every kind grows at both ends of every slider', () => {
  for (const kind of TREE_KINDS) {
    for (const [key, value] of Object.entries(TREE_SHAPES[kind])) {
      const [lo, hi] = limitsFor(key, value);
      for (const v of [lo, hi]) grows(kind, { ...TREE_SHAPES[kind], [key]: Array.isArray(value) ? [v, v] : v }, `${kind} ${key} = ${v}`);
    }
  }
});

test('every count at its most still makes a tree of reasonable weight', () => {
  for (const kind of TREE_KINDS) {
    const shape = structuredClone(TREE_SHAPES[kind]);
    for (const key of ['branches', 'clumps', 'tiers', 'points', 'stubs', 'clumpSize', 'length', 'height', 'radius']) {
      if (!(key in shape)) continue;
      const hi = limitsFor(key, shape[key])[1];
      shape[key] = Array.isArray(shape[key]) ? [hi, hi] : hi;
    }
    grows(kind, shape, `${kind} at its most`);
  }
});

test('every ready-made shape fits the sliders and grows', () => {
  for (const kind of TREE_KINDS) {
    assert.ok(PRESETS[kind].workshop, `${kind} has no "workshop" to start from`);
    for (const [name, changes] of Object.entries(PRESETS[kind])) {
      for (const [key, value] of Object.entries(changes)) {
        assert.ok(key in TREE_SHAPES[kind], `${kind} "${name}": the generator has no ${key}`);
        assert.equal(sliderKind(value), sliderKind(TREE_SHAPES[kind][key]), `${kind} "${name}" ${key}`);
        const [lo, hi] = limitsFor(key, TREE_SHAPES[kind][key]);
        for (const v of [value].flat()) assert.ok(v >= lo && v <= hi, `${kind} "${name}" ${key} = ${v} outside ${lo}–${hi}`);
      }
      const shape = presetShape(kind, name);
      grows(kind, shape, `${kind} "${name}"`);
      assert.equal(presetOf(kind, shape), name);
    }
    assert.deepEqual(presetShape(kind, 'workshop'), TREE_SHAPES[kind]);
  }
});

test('a ready-made shape leaves out what the generator no longer has', () => {
  assert.equal(presetOf('fir', { ...TREE_SHAPES.fir, height: [3, 3] }), 'custom');
  assert.deepEqual(Object.keys(presetShape('broadleaf', 'oak')), Object.keys(TREE_SHAPES.broadleaf));
});
