import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGES, ageKeys, agesOf, applyAge, atAge, hasAges, reAged } from '../src/age.js';
import { KINDS } from '../src/kinds.js';
import { limitsFor } from '../src/limits.js';
import { OAK_LIMITS, OAK_SHAPE, OUTLINE, buildOak } from '../src/oak/oak.js';
import { presetOf, presetShape } from '../src/presets.js';
import { ROWS } from '../src/sections.js';

// The age slider (src/age.js): it sets the other settings to an oak's of
// that age, between its stages (young, grown, ancient), and grows nothing
// itself.

const AGED = [10, 12, 15, 22, 30, 50, 80, 110, 150, 200, 300, 400, 500, 650, 800];

test('the oak has an age, first in its panel; the workshop\'s trees have none', () => {
  assert.equal(OAK_SHAPE.age, 150);
  assert.deepEqual(OAK_LIMITS.age, [10, 800, 1]);
  assert.equal(Object.keys(ROWS.oak.size)[0], 'age');
  assert.ok(hasAges('oak'));
  for (const kind of KINDS.filter((k) => k !== 'oak')) assert.ok(!hasAges(kind) && ageKeys(kind).length === 0, kind);
  assert.deepEqual(AGES.oak.map((stage) => stage.preset), ['young', 'open-grown', 'ancient']);
  for (const { age, preset } of AGES.oak) assert.equal(presetShape('oak', preset).age, age, `"${preset}" isn't at its stage's age`);
});

test('the age moves what its stages differ in, and nothing else', () => {
  const keys = ageKeys('oak');
  for (const key of ['height', 'spread', 'trunk', 'girth', 'limbs', 'gnarl', 'burrs', 'hollows', 'flare', 'roots', 'clumpSize', ...OUTLINE]) assert.ok(keys.includes(key), `the age doesn't move ${key}`);
  for (const key of ['age', 'crowded', 'bends', 'marksHigh', 'sway', 'masses', 'merge', 'noise', 'noiseType', 'squash', 'rough']) assert.ok(!keys.includes(key), `the age moves ${key}`);
  const shape = { ...structuredClone(OAK_SHAPE), crowded: 0.7, bends: 1.2, noise: 80, sway: 0.1 };
  const height = shape.height;
  applyAge('oak', shape, 60);
  assert.equal(shape.age, 60);
  assert.equal(shape.height, height, 'a range is another array: the panel\'s row would lose it');
  assert.notDeepEqual(shape.height, OAK_SHAPE.height);
  assert.deepEqual([shape.crowded, shape.bends, shape.noise, shape.sway], [0.7, 1.2, 80, 0.1]);
});

test('at a stage\'s age the oak is that stage\'s ready-made oak', () => {
  for (const { age, preset } of AGES.oak) {
    const shape = applyAge('oak', presetShape('oak', 'forest-grown'), age);
    const ready = presetShape('oak', preset);
    for (const key of ageKeys('oak')) assert.deepEqual(shape[key], ready[key], `${age} years: ${key}`);
    // (From the open-grown oak, it's the ready-made one whole: "start from" names it.)
    assert.equal(presetOf('oak', applyAge('oak', presetShape('oak', 'open-grown'), age)), preset);
  }
});

test('every age gives settings on their sliders, ranges the right way round, whole numbers where they\'re counts', () => {
  for (const age of AGED) {
    const at = atAge('oak', age);
    for (const [key, value] of Object.entries(at)) {
      const [lo, hi, step] = limitsFor(key, OAK_SHAPE[key], 'oak');
      const values = Array.isArray(value) ? value : [value];
      assert.equal(Array.isArray(value), Array.isArray(OAK_SHAPE[key]), `${age} years: ${key}`);
      if (Array.isArray(value)) assert.ok(value.length === 2 && value[0] <= value[1], `${age} years: ${key} is ${value}`);
      for (const v of values) {
        assert.ok(Number.isFinite(v) && v >= lo && v <= hi, `${age} years: ${key} is ${v} (its slider: ${lo} to ${hi})`);
        assert.ok(Math.abs(v / step - Math.round(v / step)) < 1e-6, `${age} years: ${key} is ${v}, off its slider's steps of ${step}`);
      }
    }
    assert.ok(at.limbs.every(Number.isInteger));
  }
});

test('an oak grows up early and thick by the year; its marks come late', () => {
  const middle = (value) => (Array.isArray(value) ? (value[0] + value[1]) / 2 : value);
  const of = (age, key) => middle(atAge('oak', age)[key]);
  // Taller every year to its prime, then lower; thicker every year of its life.
  for (let i = 1; i < AGED.length; i++) {
    const a = AGED[i - 1], b = AGED[i];
    if (b <= 150) assert.ok(of(b, 'height') >= of(a, 'height'), `${b} years: lower than at ${a}`);
    else assert.ok(of(b, 'height') <= of(a, 'height'), `${b} years: taller than at ${a}`);
    assert.ok(of(b, 'girth') >= of(a, 'girth'), `${b} years: thinner than at ${a}`);
    assert.ok(of(b, 'gnarl') >= of(a, 'gnarl') && of(b, 'burrs') >= of(a, 'burrs'), `${b} years: fewer marks than at ${a}`);
  }
  // (Half its height by 30 years or so; half its thickness not before 70.)
  assert.ok(of(30, 'height') > 0.5 * of(150, 'height'), `${of(30, 'height')} m at 30 years`);
  assert.ok(of(70, 'girth') < 0.5 * of(150, 'girth') + 0.02, `${of(70, 'girth')} m thick at 70 years`);
  assert.ok(of(50, 'girth') > 0.15 && of(50, 'girth') < 0.3, `a trunk ${of(50, 'girth')} m in radius at 50 years (real: about 0.2)`);
  assert.equal(of(100, 'hollows'), 0, 'hollows before its prime');
  assert.ok(of(300, 'hollows') > 0.2);
});

test('an oak of every age grows, sound', () => {
  for (const age of [10, 30, 80, 300, 800]) {
    const shape = applyAge('oak', structuredClone(OAK_SHAPE), age);
    for (const seed of [11, 22]) {
      const tree = buildOak(seed, shape);
      for (const g of [tree.wood, tree.foliage]) assert.ok(g.attributes.position.array.every(Number.isFinite), `${age} years: broken numbers`);
      assert.ok(tree.height > shape.height[0] * 0.7 && tree.height < shape.height[1] * 1.3 + 1, `${age} years: ${tree.height.toFixed(1)} m tall for ${shape.height}`);
      assert.ok(tree.layout.clumps.length > 3, `${age} years: ${tree.layout.clumps.length} clusters of leaves`);
    }
  }
  // (The age itself grows nothing: the same tree whatever it says.)
  const a = buildOak(7, OAK_SHAPE), b = buildOak(7, { ...OAK_SHAPE, age: 400 });
  assert.deepEqual(Array.from(b.wood.attributes.position.array), Array.from(a.wood.attributes.position.array));
});

// Ages in a forest: each of a kind's shapes at an age of its own.

test('a forest\'s oaks are all of one age until asked otherwise', async () => {
  const { defaultSettings, normalize, rangeOf } = await import('../src/settings.js');
  const mix = defaultSettings().forest.mix;
  assert.deepEqual([mix.oak.mixed, mix.oak.ages, mix.oak.old], [false, [30, 300], 0.5]);
  for (const kind of KINDS.filter((k) => k !== 'oak')) assert.ok(!('mixed' in mix[kind]) && !('ages' in mix[kind]), kind);
  assert.deepEqual(rangeOf('forest.mix.oak.ages'), [10, 800, 1]);
  assert.deepEqual(rangeOf('forest.mix.oak.old'), [0, 1, 0.01]);
  // (A file's ages are kept, in order and inside the slider; an older file has none and gets the usual.)
  const kept = normalize({ forest: { mix: { oak: { mixed: true, ages: [900, 40], old: 2 } } } }).settings.forest.mix.oak;
  assert.deepEqual([kept.mixed, kept.ages, kept.old], [true, [40, 800], 1]);
  assert.deepEqual(normalize({ forest: { mix: { oak: { on: true } } } }).settings.forest.mix.oak.ages, [30, 300]);
});

test('a kind\'s shapes get ages spread over the range, youngest first, more of them young or old as asked', () => {
  assert.deepEqual(agesOf(6, [30, 300]), [36, 53, 78, 115, 169, 248]);
  assert.deepEqual(agesOf(3, [150, 150]), [150, 150, 150]);
  for (const old of [0, 0.2, 0.5, 0.8, 1]) {
    const ages = agesOf(12, [20, 500], old);
    assert.equal(ages.length, 12);
    for (let i = 0; i < ages.length; i++) assert.ok(ages[i] >= 20 && ages[i] <= 500 && (i === 0 || ages[i] >= ages[i - 1]), `old ${old}: ${ages}`);
  }
  const middle = (ages) => ages[Math.floor(ages.length / 2)];
  assert.ok(middle(agesOf(12, [20, 500], 0)) < middle(agesOf(12, [20, 500], 0.5)) - 40 && middle(agesOf(12, [20, 500], 1)) > middle(agesOf(12, [20, 500], 0.5)) + 60);
});

test('a shape at another age is that age\'s oak, with what was changed by hand carried along', () => {
  // Untouched: exactly the age's own.
  const usual = structuredClone(OAK_SHAPE);
  for (const age of [20, 60, 150, 320, 700]) {
    const shape = reAged('oak', usual, age), at = atAge('oak', age);
    assert.equal(shape.age, age);
    for (const key of ageKeys('oak')) assert.deepEqual(shape[key], at[key], `${age} years: ${key}`);
  }
  assert.deepEqual(reAged('oak', usual, 150), usual);
  assert.deepEqual(usual, OAK_SHAPE, 'the shape given was changed');
  // Changed by hand: half as tall again, more gnarled, crowded, bent.
  const mine = { ...structuredClone(OAK_SHAPE), height: [25.5, 33], gnarl: 0.45, crowded: 1, bends: 1.5, reachLow: 0.58 };
  for (const age of [40, 90, 300]) {
    const shape = reAged('oak', mine, age), at = atAge('oak', age);
    assert.ok(Math.abs(shape.height[0] - at.height[0] * 1.5) < 1e-9 && Math.abs(shape.height[1] - at.height[1] * 1.5) < 1e-9, `${age} years: ${shape.height} m tall`);
    assert.ok(Math.abs(shape.gnarl - (at.gnarl + 0.3)) < 1e-9, `${age} years: gnarl ${shape.gnarl}`);
    assert.ok(Math.abs(shape.reachLow - (at.reachLow - 0.4)) < 1e-9);
    assert.deepEqual([shape.crowded, shape.bends], [1, 1.5]);
    assert.deepEqual(shape.girth, at.girth);
    assert.ok(shape.limbs.every(Number.isInteger));
  }
  // (Never off a slider.)
  const far = reAged('oak', { ...structuredClone(OAK_SHAPE), height: [49, 50], gnarl: 2 }, 800);
  assert.ok(far.height[1] <= 50 && far.gnarl <= 2);
  // The workshop's kinds have no ages: as they are.
  const fir = presetShape('fir', 'workshop');
  assert.deepEqual(reAged('fir', fir, 40), fir);
});

test('a forest of several ages holds small oaks and big ones, each sound', () => {
  const ages = agesOf(6, [20, 400]);
  const trees = ages.map((age, variant) => buildOak(100 + variant, reAged('oak', OAK_SHAPE, age)));
  const heights = trees.map((tree) => tree.height), girths = trees.map((tree) => tree.layout.oak.girth);
  assert.ok(heights[0] < 0.6 * Math.max(...heights), `heights ${heights.map((h) => h.toFixed(1))}`);
  for (let i = 1; i < girths.length; i++) assert.ok(girths[i] > girths[i - 1], `thickness ${girths.map((g) => g.toFixed(2))}`);
  for (const tree of trees) assert.ok(tree.wood.attributes.position.array.every(Number.isFinite) && tree.layout.clumps.length > 3);
});
