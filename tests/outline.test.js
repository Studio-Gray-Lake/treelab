import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OAK_LIMITS, OAK_SHAPE, OUTLINE, buildOak, layoutOak, outlineOf } from '../src/oak/oak.js';
import { outlinePath } from '../src/outlineEditor.js';
import { PRESETS, presetShape } from '../src/presets.js';
import { DRAWINGS, PANELS } from '../src/sections.js';

// The crown's outline (src/oak/oak.js: outlineOf): how far the branches
// reach at each height in the crown, set at five heights and drawn in the
// panel (src/outlineEditor.js). The branches grow into it.

const SEEDS = [11, 22, 33];
const FOREST = { reachBottom: 0, reachLow: 0.3, reachMid: 0.6, reachHigh: 1, reachTop: 0.3 };
const OUTLINES = [
  {},
  FOREST,
  { reachBottom: 0.3, reachLow: 1.1, reachMid: 1, reachHigh: 0.85, reachTop: 0.3 },
  { reachBottom: 0, reachLow: 0.7, reachMid: 1, reachHigh: 0.75, reachTop: 0.1 },
  { reachBottom: 1.3, reachLow: 1.3, reachMid: 1.3, reachHigh: 1.3, reachTop: 1.3 },
  { reachBottom: 0, reachLow: 0, reachMid: 0, reachHigh: 0, reachTop: 0 },
  { reachBottom: 1, reachLow: 0.1, reachMid: 1.2, reachHigh: 0.05, reachTop: 0.9 },
];

test('the outline an oak starts with is the dome it always had: the same oak for a seed', () => {
  // (Recorded before the outline could be drawn: [seed, numbers of wood, their sum, numbers of leaves, their sum].)
  const was = [
    [7, 85509, 244888.54111072508, 54720, 230893.51367450797],
    [11, 84177, 235627.13505681977, 50400, 214286.90570360597],
    [22, 73107, 162729.70319169166, 45360, 138239.65809740743],
    [33, 81945, 177765.81705566324, 49680, 154183.28294888645],
  ];
  const sum = (array) => array.reduce((total, v) => total + v, 0);
  for (const [seed, wood, woodSum, leaves, leafSum] of was) {
    const tree = buildOak(seed, OAK_SHAPE);
    const w = tree.wood.attributes.position.array, l = tree.foliage.attributes.position.array;
    assert.equal(w.length, wood, `seed ${seed}: its wood changed`);
    assert.equal(l.length, leaves, `seed ${seed}: its leaves changed`);
    assert.ok(Math.abs(sum(w) - woodSum) < 1e-6 * Math.abs(woodSum) && Math.abs(sum(l) - leafSum) < 1e-6 * Math.abs(leafSum), `seed ${seed}: it moved`);
  }
});

test('the outline reaches what its settings say at their heights, and stays a shape', () => {
  assert.deepEqual(OUTLINE, ['reachBottom', 'reachLow', 'reachMid', 'reachHigh', 'reachTop']);
  for (const key of OUTLINE) assert.deepEqual(OAK_LIMITS[key], [0, 1.3, 0.01]);
  for (const changes of OUTLINES) {
    const shape = { ...OAK_SHAPE, ...changes }, outline = outlineOf(shape);
    OUTLINE.forEach((key, i) => {
      const reach = outline(i / 4);
      assert.ok(Math.abs(reach - shape[key]) < 0.012, `${JSON.stringify(changes)}: ${key} is ${shape[key]}, the outline reaches ${reach.toFixed(3)} there`);
    });
    for (let i = 0; i <= 200; i++) {
      const reach = outline(i / 200);
      assert.ok(reach >= 0 && reach <= 1.3 && Number.isFinite(reach), `${JSON.stringify(changes)}: it reaches ${reach} at ${i / 200}`);
    }
    assert.equal(outline(-0.01), 0);
    assert.equal(outline(1.01), 0);
    // (Between two settings it stays between them, give or take the dome's own bulge: no spikes.)
    for (let i = 0; i < 4; i++) {
      const a = shape[OUTLINE[i]], b = shape[OUTLINE[i + 1]];
      for (let f = 0.1; f < 1; f += 0.1) {
        const reach = outline((i + f) / 4);
        assert.ok(reach > Math.min(a, b) - 0.3 && reach < Math.max(a, b) + 0.3, `${JSON.stringify(changes)}: between ${a} and ${b} it reaches ${reach.toFixed(2)}`);
      }
    }
  }
  // (A setting moved changes the outline only near its own height.)
  const dome = outlineOf(), lifted = outlineOf({ ...OAK_SHAPE, reachTop: 0.8 });
  for (let t = 0; t <= 0.75; t += 0.05) assert.equal(lifted(t), dome(t));
  assert.ok(lifted(0.95) > dome(0.95) + 0.3);
});

test('the branches grow into the outline: a crown drawn wide only at the top is narrow below', () => {
  // How far the leaves reach from the trunk, low in the crown and high in it.
  const reaches = (layout) => {
    const { bare, height } = layout.oak;
    const at = (lo, hi) => Math.max(0, ...layout.clumps.filter((c) => c.center[1] >= bare + (height - bare) * lo && c.center[1] < bare + (height - bare) * hi).map((c) => Math.hypot(c.center[0], c.center[2]) + c.radius));
    return { low: at(0, 0.4), high: at(0.6, 1.01) };
  };
  const tall = { ...OAK_SHAPE, height: [26, 26], spread: [0.6, 0.6], trunk: [8, 8], bends: 0, lean: [0, 0], droop: 0 };
  for (const seed of SEEDS) {
    const domed = reaches(layoutOak(seed, tall)), drawn = reaches(layoutOak(seed, { ...tall, ...FOREST }));
    assert.ok(drawn.low < 0.6 * drawn.high, `seed ${seed}: drawn wide at the top, it reaches ${drawn.low.toFixed(1)} m low down and ${drawn.high.toFixed(1)} m high up`);
    assert.ok(domed.low > 0.8 * domed.high, `seed ${seed}: the dome reaches ${domed.low.toFixed(1)} m low down and ${domed.high.toFixed(1)} m high up`);
    assert.ok(drawn.low < 0.6 * domed.low, `seed ${seed}: no narrower low down than the dome`);
  }
});

test('under a crown widest high up, the trunk carries on up through it and the limbs leave it all the way up', () => {
  const tall = { ...OAK_SHAPE, height: [26, 26], spread: [0.6, 0.6], trunk: [8, 8], limbs: [5, 5], bends: 0, lean: [0, 0] };
  const over = (layout) => {
    const starts = layout.oak.limbStarts;
    return (Math.max(...starts) - Math.min(...starts)) / (layout.oak.height - layout.oak.bare);
  };
  for (const seed of SEEDS) {
    const domed = layoutOak(seed, tall), drawn = layoutOak(seed, { ...tall, ...FOREST });
    assert.equal(drawn.oak.limbStarts.length, 5);
    assert.ok(over(drawn) > 1.6 * over(domed) && over(drawn) > 0.28, `seed ${seed}: its limbs leave the trunk over ${(over(drawn) * 100).toFixed(0)}% of the crown's height (under the dome: ${(over(domed) * 100).toFixed(0)}%)`);
    // (And a crown widest low down keeps its limbs low.)
    const low = layoutOak(seed, { ...tall, reachLow: 1.2, reachMid: 0.5, reachHigh: 0.2 });
    assert.ok(over(low) < over(domed), `seed ${seed}: widest low down, its limbs leave over ${(over(low) * 100).toFixed(0)}%`);
  }
});

test('every outline grows a sound oak, a slimmer one with fewer branches', () => {
  for (const seed of SEEDS) {
    const nodes = [];
    for (const changes of OUTLINES) {
      const tree = buildOak(seed, { ...OAK_SHAPE, ...changes });
      for (const g of [tree.wood, tree.foliage]) assert.ok(g.attributes.position.array.every(Number.isFinite), `${JSON.stringify(changes)}: broken numbers`);
      assert.ok(tree.wood.attributes.position.count > 300, `${JSON.stringify(changes)}: no wood`);
      nodes.push(tree.layout.oak.nodes);
    }
    assert.ok(nodes[1] < nodes[0] && nodes[4] > nodes[0] && nodes[5] < nodes[1], `seed ${seed}: ${nodes.join(', ')} steps of wood grown`);
  }
});

test('the ready-made oaks have outlines of their own, and the panel draws them', () => {
  const outlineOfPreset = (name) => OUTLINE.map((key) => presetShape('oak', name)[key]);
  assert.deepEqual(outlineOfPreset('open-grown'), OUTLINE.map((key) => OAK_SHAPE[key]));
  for (const name of ['young', 'forest-grown', 'ancient']) assert.notDeepEqual(outlineOfPreset(name), outlineOfPreset('open-grown'), name);
  assert.ok(PRESETS.oak['forest-grown'].reachLow < 0.5 && PRESETS.oak['forest-grown'].reachHigh >= 1, 'the forest oak\'s crown isn\'t wide only near the top');
  assert.equal(DRAWINGS.oak.outline, 'outline');
  assert.deepEqual([...PANELS.oak.outline].sort(), [...OUTLINE].sort());
  // (The drawing: one closed path, up one side and down the other, as wide either side.)
  for (const changes of OUTLINES) {
    const path = outlinePath(outlineOf({ ...OAK_SHAPE, ...changes }), 70, 24);
    assert.match(path, /^M[\d.,L-]+Z$/);
    const xs = path.slice(1, -1).split('L').map((pair) => Number(pair.split(',')[0]));
    assert.equal(xs.length, 50);
    assert.ok(Math.abs(Math.max(...xs) - 100 - (100 - Math.min(...xs))) < 0.11, 'lopsided');
    assert.ok(Math.max(...xs) <= 100 + 1.3 * 70 + 0.1);
  }
});
