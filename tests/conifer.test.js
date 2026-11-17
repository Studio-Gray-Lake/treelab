import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, LEGACY_KINDS, kindName } from '../src/kinds.js';
import { OAK_FRAME, OAK_LIMITS, OAK_SHAPE, buildOak, layoutOak } from '../src/oak/oak.js';

// The conifer way of growing (src/oak/oak.js): a trunk that runs to the top
// ("leader"), limbs in rings ("whorl"), set off as steeply as asked
// ("riseTop", "riseBottom"), in a frame of the kind's own. The oak grows as
// it did: tests/outline.test.js pins its exact shape.

const SEEDS = [11, 22, 33];
// A plain test conifer: a narrow cone 26 m tall.
const CONE = {
  ...OAK_SHAPE, height: [26, 26], spread: [0.32, 0.32], trunk: [1.5, 1.5], girth: [0.36, 0.36], lean: [0, 0], bends: 0, limbs: [20, 20],
  leader: 1, whorl: 5, riseTop: 35, riseBottom: 0, crooked: 0, droop: 0.05, leafiness: 1,
  reachBottom: 1, reachLow: 0.85, reachMid: 0.6, reachHigh: 0.32, reachTop: 0, clumpSize: [1.2, 2], squash: 0.3, gnarl: 0, burrs: 0, stubs: 0,
};
const FRAME = { usual: { height: 26, width: 8.3, bare: 1.5 }, outline: 216, steps: 60, kind: 'fir', needles: 'fronds', bark: { foot: [0.33, 0.31, 0.29], limbs: [0.47, 0.46, 0.44] } };
const trunkTop = (layout) => Math.max(...layout.wood.runs.find((run) => run.trunk).points.filter((p) => Math.hypot(p.p[0], p.p[2]) < 0.6).map((p) => p.p[1]));

test('the oak has the new settings, at what it always did', () => {
  assert.deepEqual([OAK_SHAPE.leader, OAK_SHAPE.whorl, OAK_SHAPE.riseTop, OAK_SHAPE.riseBottom], [0.3, 0, 55, 20]);
  for (const key of ['leader', 'whorl', 'riseTop', 'riseBottom']) assert.ok(OAK_LIMITS[key], `${key} has no slider`);
  assert.deepEqual(OAK_FRAME.usual, { height: 19.5, width: 22.4, bare: 3.25 });
  assert.equal(OAK_FRAME.kind, 'broadleaf');
  // (A shape saved before them grows the same oak.)
  const { leader, whorl, riseTop, riseBottom, ...before } = OAK_SHAPE;
  assert.deepEqual(Array.from(buildOak(7, before).wood.attributes.position.array), Array.from(buildOak(7, OAK_SHAPE).wood.attributes.position.array));
});

test('a conifer\'s trunk runs to its top, and its limbs leave it all the way up, in rings', () => {
  for (const seed of SEEDS) {
    const cone = layoutOak(seed, CONE, FRAME), oak = layoutOak(seed, OAK_SHAPE);
    assert.equal(cone.kind, 'fir');
    assert.ok(trunkTop(cone) > cone.oak.height - 2.5, `seed ${seed}: the trunk stops at ${trunkTop(cone).toFixed(1)} m of ${cone.oak.height.toFixed(1)}`);
    assert.ok(trunkTop(oak) < oak.oak.height * 0.6, `seed ${seed}: the oak's trunk runs to ${trunkTop(oak).toFixed(1)} m`);
    const starts = [...cone.oak.limbStarts].sort((a, b) => a - b);
    assert.equal(starts.length, 20);
    const over = (starts.at(-1) - starts[0]) / (cone.oak.height - cone.oak.bare);
    assert.ok(over > 0.7, `seed ${seed}: its limbs leave over ${(over * 100).toFixed(0)}% of the crown's height`);
    // Four rings of five: between rings a gap, within a ring next to none.
    const gaps = starts.slice(1).map((y, i) => y - starts[i]).sort((a, b) => b - a);
    assert.ok(gaps[2] > 3 * gaps[4] + 0.5, `seed ${seed}: no rings: the gaps between limbs are ${gaps.slice(0, 6).map((g) => g.toFixed(1))}`);
  }
});

test('limbs set off as steeply as asked', () => {
  // How far above level a tree's big limbs point over their first steps, on average (degrees).
  const rise = (layout) => {
    const angles = layout.wood.runs.filter((run) => run.side && !run.stalk && run.points.length > 3 && run.parent > 0.2).map((run) => {
      const a = run.points[0].p, b = run.points[1].p;
      return (Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2])) * 180) / Math.PI;
    });
    return angles.reduce((sum, v) => sum + v, 0) / angles.length;
  };
  for (const seed of SEEDS) {
    const level = rise(layoutOak(seed, { ...CONE, riseTop: 5, riseBottom: 5, droop: 0 }, FRAME)), steep = rise(layoutOak(seed, { ...CONE, riseTop: 60, riseBottom: 60, droop: 0 }, FRAME));
    // (Not by as much as asked: a limb that sets off steeply in a narrow crown is drawn back into it, and its corner eased.)
    assert.ok(steep > level + 10, `seed ${seed}: asked for 5 and 60 degrees, its limbs rise ${level.toFixed(0)} and ${steep.toFixed(0)}`);
  }
});

test('a conifer grows sound, in its own frame and bark', () => {
  for (const seed of SEEDS) {
    const tree = buildOak(seed, CONE, FRAME);
    for (const g of [tree.wood, tree.foliage]) assert.ok(g.attributes.position.array.every(Number.isFinite), `seed ${seed}: broken numbers`);
    assert.ok(Math.abs(tree.layout.oak.width - 26 * 0.32) < 1e-6 && tree.height > 22 && tree.height < 30, `seed ${seed}: ${tree.height.toFixed(1)} m tall`);
    assert.ok(tree.layout.clumps.length > 12, `seed ${seed}: ${tree.layout.clumps.length} pads of needles`);
    assert.deepEqual(tree.layout.wood.bark, FRAME.bark);
    // (Paler than the oak's bark at the same height.)
    const light = (g) => { const c = g.attributes.color; let sum = 0; for (let i = 0; i < c.count; i++) sum += c.getX(i); return sum / c.count; };
    assert.ok(light(tree.wood) > light(buildOak(seed, CONE, { ...FRAME, bark: null }).wood) + 0.01);
  }
});

test('the workshop\'s fir and pine are named by the keys they always had', () => {
  assert.deepEqual(LEGACY_KINDS, []);
  assert.ok(['fir', 'pine'].every((kind) => KINDS.includes(kind)), 'a kind is gone from the list');
  assert.equal(kindName('fir'), 'fir');
  assert.equal(kindName('pine'), 'pine');
  assert.equal(kindName('oak'), 'oak');
  assert.equal(kindName('broadleaf'), 'broadleaf');
});

test('a kind with needles carries twigs with needles along each branch (a bough), and no clusters', () => {
  for (const seed of SEEDS) {
    const tree = buildOak(seed, CONE, FRAME), layout = tree.layout;
    const boughs = layout.leaves.boughs;
    assert.ok(boughs.length >= 20 && boughs.length <= 260 * layout.oak.big ** 2 + 1, `seed ${seed}: ${boughs.length} boughs on 20 limbs`);
    assert.equal(layout.clumps.length, boughs.length, 'each bough stands as a cluster for the tree\'s shade and reach');
    // Every limb carries a bough from the trunk (its first point is the trunk's step it leaves).
    const limbs = boughs.filter((bough) => Math.hypot(bough.points[0].p[0], bough.points[0].p[2]) < 0.5);
    assert.ok(limbs.length >= 18, `seed ${seed}: ${limbs.length} of 20 limbs carry a bough from the trunk`);
    for (const bough of boughs) assert.ok(bough.length >= 0.6 && bough.half > 0.1 && bough.half < bough.length, `seed ${seed}: a bough ${bough.length.toFixed(1)} m long and ${(2 * bough.half).toFixed(1)} m wide`);
    // Drawn: blades on twigs, not balls; reaching about as far as the crown is wide; swaying at their ends, still at the trunk.
    const p = tree.foliage.attributes.position, sway = tree.foliage.attributes.branch;
    assert.ok(p.array.every(Number.isFinite) && tree.foliage.attributes.normal.array.every(Number.isFinite), `seed ${seed}: broken numbers`);
    assert.ok(p.count / 3 > boughs.length * 18 && p.count / 3 < boughs.length * 400, `seed ${seed}: ${p.count / 3} triangles for ${boughs.length} boughs`);
    let far = 0, most = 0, least = Infinity;
    for (let i = 0; i < p.count; i++) {
      far = Math.max(far, Math.hypot(p.getX(i), p.getZ(i)));
      most = Math.max(most, sway.getY(i));
      least = Math.min(least, sway.getY(i));
    }
    assert.ok(far > layout.oak.width * 0.3 && far < layout.oak.width * 0.9, `seed ${seed}: its needles reach ${far.toFixed(1)} m from the trunk, its crown is ${layout.oak.width.toFixed(1)} m wide`);
    assert.ok(most > 0.005 && least < most * 0.5, `seed ${seed}: its boughs don't sway more at their ends (${least.toFixed(3)} to ${most.toFixed(3)})`);
    // (The oak has none.)
    assert.equal(layoutOak(seed, OAK_SHAPE).leaves.boughs.length, 0);
  }
});
