import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellsOf, pushOf, pushesOf } from '../src/oak/chance.js';
import { MOST_LAYERS, NOISE, NOISE_TYPES, USUAL_PATTERN, bendOf, layersOf, patternFrom, patternOf, shows } from '../src/oak/leafNoise.js';

// The noise that shapes the oak's merged masses of leaves
// (src/oak/leafNoise.js): its types, its layers, and how it fades out
// where it's finer than the facets it's drawn with.

// Places spread evenly through a box 80 across: [[x, y, z], ...].
function places(n, from = 12345) {
  let s = from;
  const random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  return Array.from({ length: n }, () => [(random() - 0.5) * 80, (random() - 0.5) * 80, (random() - 0.5) * 80]);
}
const meanOf = (values) => values.reduce((a, b) => a + b, 0) / values.length;
const spreadOf = (values) => { const m = meanOf(values); return Math.sqrt(meanOf(values.map((v) => (v - m) ** 2))); };

test('one number alone is the first of the three; the cells\' is how far the nearest point is', () => {
  const one = pushOf(77), three = pushesOf(77), far = cellsOf(77), other = cellsOf(78);
  let differ = 0;
  for (const [x, y, z] of places(3000)) {
    assert.equal(one(x, y, z), three(x, y, z)[0]);
    const d = far(x, y, z);
    assert.ok(d >= 0 && d <= 1, `${d} from the nearest point`);
    assert.equal(far(x, y, z), d, 'the same place, another distance');
    // (How far the nearest point is changes no faster than the place does.)
    assert.ok(Math.abs(far(x + 0.01, y, z) - d) <= 0.0101, 'a jump in the cells');
    if (other(x, y, z) !== d) differ++;
  }
  assert.ok(differ > 2900, 'another seed, the same cells');
});

test('every type of noise is about nothing on average and spreads as far as the smooth one', () => {
  const at = places(20000);
  const spread = {};
  for (const type of NOISE_TYPES) {
    const values = [];
    for (const seed of [1, 9001, 123456789]) {
      const pattern = patternOf(type, seed);
      for (const [x, y, z] of at) values.push(pattern(x, y, z));
    }
    assert.ok(values.every(Number.isFinite));
    assert.ok(Math.abs(meanOf(values)) < 0.01, `${type}: ${meanOf(values).toFixed(4)} on average`);
    spread[type] = spreadOf(values);
    assert.ok(Math.abs(spread[type] / spread.smooth - 1) < 0.06, `${type}: spreads ${spread[type].toFixed(4)}, the smooth one ${spread.smooth.toFixed(4)}`);
    const again = patternOf(type, 9001), other = patternOf(type, 9002);
    const [x, y, z] = at[5];
    assert.equal(again(x, y, z), patternOf(type, 9001)(x, y, z), `${type}: the same seed, another pattern`);
    assert.ok(at.slice(0, 50).some(([a, b, c]) => other(a, b, c) !== again(a, b, c)), `${type}: another seed, the same pattern`);
  }
  // The smooth one is the pattern the masses always had.
  const smooth = patternOf('smooth', 5), creased = patternOf('creased', 5), ridged = patternOf('ridged', 5), cells = patternOf('cells', 5);
  let creases = 0, least = Infinity, most = -Infinity;
  for (const [x, y, z] of at) {
    assert.equal(smooth(x, y, z), pushOf(5)(x, y, z));
    // The ridged is the creased the other way up, and the creased is lowest
    // where the smooth one passes through nothing: that's a crease.
    assert.equal(ridged(x, y, z), -creased(x, y, z));
    if (Math.abs(smooth(x, y, z)) < 0.005) {
      creases++;
      assert.ok(creased(x, y, z) < -0.24, `a crease only ${creased(x, y, z).toFixed(3)} deep`);
    }
    least = Math.min(least, cells(x, y, z));
    most = Math.max(most, cells(x, y, z));
  }
  assert.ok(creases > 100, 'no place on a crease was looked at');
  // (Cells: thick at a cell's point, thin where the nearest is far.)
  assert.ok(most > 0.45 && least < -0.4, `the cells run from ${least.toFixed(2)} to ${most.toFixed(2)}`);
  for (const [a, b] of [['smooth', 'creased'], ['smooth', 'cells'], ['creased', 'cells']]) {
    const [x, y, z] = at[7];
    assert.notEqual(patternOf(a, 5)(x, y, z), patternOf(b, 5)(x, y, z), `${a} and ${b} are the same`);
  }
});

test('a pattern finer than the facets fades out', () => {
  assert.equal(shows(0.9, 0.9), 1);
  assert.equal(shows(5, 0.9), 1);
  assert.equal(shows(0.45, 0.9), 0);
  assert.equal(shows(0.1, 0.9), 0);
  assert.ok(Math.abs(shows(0.675, 0.9) - 0.5) < 1e-9);
  for (let across = 0.4; across < 1; across += 0.05) assert.ok(shows(across + 0.05, 0.9) >= shows(across, 0.9), 'a finer pattern shows more');
});

test('the layers: a broad one and finer, weaker ones on it, as many as the detail asks and the facets can show', () => {
  // The usual pattern: the two layers the masses always had.
  const usual = layersOf(USUAL_PATTERN, 0.9, 5);
  assert.deepEqual(usual.map((layer) => [layer.size, layer.strength]), [[NOISE.size, NOISE.swell], [NOISE.finer.size, NOISE.finer.swell]]);
  assert.deepEqual(usual.map((layer) => [layer.size, layer.strength]), [[2.4, 1.7], [0.95, 0.9]]);
  const [x, y, z] = [3.3, 12.1, -4.7];
  assert.equal(usual[0].value(x, y, z), pushOf((5 ^ 0x5bd1e995) >>> 0)(x, y, z));
  assert.equal(usual[1].value(x, y, z), pushOf((5 ^ 0x27d4eb2f) >>> 0)(x, y, z));
  // No detail: the broad one alone.
  assert.equal(layersOf({ ...USUAL_PATTERN, detail: 0 }, 0.9, 5).length, 1);
  // More detail than the facets can show: no more layers (the third would be 0.38 m across, on facets of 0.9 m).
  assert.equal(layersOf({ ...USUAL_PATTERN, detail: MOST_LAYERS }, 0.9, 5).length, 2);
  // Big billows on fine facets: every layer shows, each finer and weaker than the last, each a pattern of its own.
  const many = layersOf({ ...USUAL_PATTERN, size: 12, detail: MOST_LAYERS }, 0.3, 5);
  assert.equal(many.length, MOST_LAYERS + 1);
  assert.equal(many[0].size, 12);
  for (let k = 1; k < many.length; k++) {
    assert.ok(many[k].size < many[k - 1].size * 0.45 && many[k].size > many[k - 1].size * 0.35, `layer ${k} is ${many[k].size.toFixed(2)} m on one of ${many[k - 1].size.toFixed(2)} m`);
    assert.ok(many[k].strength < many[k - 1].strength * 0.6, `layer ${k} is as strong as the one before`);
    assert.notEqual(many[k].value(x, y, z), many[k - 1].value(x, y, z), 'two layers, one pattern');
  }
  // Twice the size: every layer twice as big, and as strong.
  const twice = layersOf({ ...USUAL_PATTERN, size: 4.8 }, 0.9, 5);
  assert.deepEqual(twice.map((layer) => layer.strength), [1.7, 0.9]);
  assert.ok(Math.abs(twice[0].size - 4.8) < 1e-9 && Math.abs(twice[1].size - 1.9) < 1e-9);
  // Billows smaller than the facets: nothing to show. Half-way: weaker.
  assert.equal(layersOf({ ...USUAL_PATTERN, size: 0.3 }, 0.9, 5).length, 0);
  const faded = layersOf({ ...USUAL_PATTERN, size: 2.4, detail: 1 }, 1.4, 5);
  assert.equal(faded.length, 2);
  assert.equal(faded[0].strength, 1.7);
  assert.ok(faded[1].strength > 0 && faded[1].strength < 0.9, `the finer layer, finer than the facets, is still ${faded[1].strength}`);
  // The type is every layer's.
  const cells = layersOf({ ...USUAL_PATTERN, type: 'cells' }, 0.9, 5);
  assert.equal(cells[0].value(x, y, z), patternOf('cells', (5 ^ 0x5bd1e995) >>> 0)(x, y, z));
});

test('the bends: as far as asked at full noise, further with more, and none in a pattern finer than the facets', () => {
  assert.deepEqual(bendOf(USUAL_PATTERN, 1, 0.9), { far: 1.1, over: 3.2 });
  assert.equal(bendOf(USUAL_PATTERN, 2, 0.9).far, 2.2);
  assert.equal(bendOf(USUAL_PATTERN, 0, 0.9).far, 0);
  assert.equal(bendOf({ ...USUAL_PATTERN, bend: 0 }, 2, 0.9).far, 0);
  assert.ok(Math.abs(bendOf({ ...USUAL_PATTERN, size: 4.8 }, 1, 0.9).over - 6.4) < 1e-9);
  assert.equal(bendOf({ ...USUAL_PATTERN, size: 0.3 }, 1, 0.9).far, 0);
});

test('a pattern asked for in part, or past what there is, is made whole', () => {
  assert.deepEqual(patternFrom(), USUAL_PATTERN);
  assert.deepEqual(patternFrom({ type: 'cells' }), { ...USUAL_PATTERN, type: 'cells' });
  assert.deepEqual(patternFrom({ type: 'feathery', detail: 9.4, bend: -1, billow: -2, size: 0 }), { type: 'smooth', size: 0.01, detail: MOST_LAYERS, bend: 0, billow: 0 });
  assert.equal(patternFrom({ detail: 1.6 }).detail, 2);
});
