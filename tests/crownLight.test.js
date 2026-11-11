import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K, LEAF_AREA, LEAST, biggest, leafy, leastFor, lightAt, through } from '../src/oak/crownLight.js';
import { OAK_SHAPE, OUTLINE, layoutOak } from '../src/oak/oak.js';
import { presetShape } from '../src/presets.js';

// Leaves where there's light (src/oak/crownLight.js): how much of the sky's
// light reaches a place through the clusters of leaves, which clusters keep
// their leaves, and what that does to the oak's crown.

const ball = (x, y, z, radius, squash = 1) => ({ center: [x, y, z], radius, squash });
const SEEDS = [7, 11, 22, 33];

test('a ray through a cluster runs as far inside it as the ball is thick there', () => {
  const c = ball(0, 10, 0, 2);
  assert.ok(Math.abs(through([0, 0, 0], [0, 1, 0], c) - 4) < 1e-9, 'straight through its middle');
  assert.ok(Math.abs(through([0, 10, 0], [0, 1, 0], c) - 2) < 1e-9, 'from its middle: half of it');
  assert.equal(through([0, 13, 0], [0, 1, 0], c), 0, 'from above it, upward');
  assert.equal(through([3, 0, 0], [0, 1, 0], c), 0, 'past its side');
  // Squashed to half its height: half as thick straight up, as wide.
  const flat = ball(0, 10, 0, 2, 0.5);
  assert.ok(Math.abs(through([0, 0, 0], [0, 1, 0], flat) - 2) < 1e-9);
  assert.ok(Math.abs(through([-5, 10, 0], [1, 0, 0], flat) - 4) < 1e-9);
});

test('light through leaves: all of it in the open, Beer and Lambert\'s share under a cluster, none of the low sky among neighbours', () => {
  assert.ok(Math.abs(lightAt([0, 0, 0], []) - 1) < 1e-9);
  // Under a wide flat layer 1 m thick: every way up passes 1 m of leaves or more.
  const layer = ball(0, 5, 0, 400, 0.5 / 400);
  const under = lightAt([0, 0, 0], [layer]);
  assert.ok(under < Math.exp(-K * LEAF_AREA * 1) && under > 0.2 * Math.exp(-K * LEAF_AREA * 1), `${under.toFixed(3)} under a metre of leaves`);
  // A cluster below, or the place's own (when asked), doesn't count.
  assert.ok(Math.abs(lightAt([0, 10, 0], [layer]) - 1) < 1e-9);
  assert.ok(Math.abs(lightAt([0, 0, 0], [layer], layer) - 1) < 1e-9);
  // Neighbours 20 m tall, 20 m away: near their tops all the sky is in
  // sight; 8 m down the lowest of it is hidden; 15 m down, the lower half.
  const wood = { top: 20, away: 20 };
  assert.ok(Math.abs(lightAt([0, 19, 0], [], null, wood) - 1) < 1e-9);
  const mid = lightAt([0, 12, 0], [], null, wood), low = lightAt([0, 5, 0], [], null, wood), lowest = lightAt([0, 0, 0], [], null, wood);
  assert.ok(mid < 1 && mid > 0.8 && low < 0.6 && low > 0.4 && lowest <= low, `${mid.toFixed(2)}, ${low.toFixed(2)}, ${lowest.toFixed(2)} of the light, going down`);
  // Nearer neighbours hide more.
  assert.ok(lightAt([0, 12, 0], [], null, { top: 20, away: 8 }) < mid);
});

test('the least light leaves live on: oak\'s, less for a fuller crown', () => {
  assert.ok(LEAST[0] > LEAST[1] && LEAST[1] >= 0.04 && LEAST[0] <= 0.2);
  assert.ok(leastFor(OAK_SHAPE.leafiness) > 0.06 && leastFor(OAK_SHAPE.leafiness) < 0.1, 'the English oak: a little over sessile oak\'s 6%');
  assert.equal(leastFor(-1), LEAST[0]);
  assert.equal(leastFor(2), LEAST[1]);
  // A cluster on its own can be only so big before its own leaves starve its underside.
  const size = biggest(leastFor(OAK_SHAPE.leafiness), 0.9);
  assert.ok(size > 1.5 && size < 4, `${size.toFixed(2)} m`);
  assert.ok(biggest(LEAST[1], 0.9) > size && biggest(LEAST[0], 0.9) < size);
  const one = ball(0, 0, 0, size, 0.9);
  assert.ok(Math.abs(lightAt([0, -size * 0.9, 0], [one]) - leastFor(OAK_SHAPE.leafiness)) < 0.01);
});

test('clusters keep their leaves from the top down: those under too many keep none, those under some are smaller', () => {
  const least = 0.08;
  // A wide canopy: four layers of clusters, 9 by 9 in each, one over the other.
  const canopy = [];
  for (let level = 0; level < 4; level++) for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) canopy.push({ ...ball(i * 2.6, 20 - level * 2.6, j * 2.6, 1.6, 0.9), level, middle: Math.abs(i) <= 1 && Math.abs(j) <= 1 });
  const kept = leafy(canopy, least);
  assert.ok(kept.length < canopy.length, 'every cluster kept its leaves');
  for (const c of kept) assert.ok(c.light >= least && c.radius <= 1.6 + 1e-9 && c.radius >= 1.6 * 0.44, 'kept with too little light, or at no size it was tried at');
  const middleOf = (level) => kept.filter((c) => c.middle && c.level === level);
  assert.equal(middleOf(0).length, 9, 'the top layer keeps its leaves');
  assert.equal(middleOf(3).length, 0, 'the bottom layer\'s middle, under three layers, keeps leaves');
  assert.ok(middleOf(1).length + middleOf(2).length < 18, 'the layers between, in the middle, all keep theirs');
  // Its rim is lit from the side: leaves lower down there than in the middle.
  const rim = kept.filter((c) => !c.middle && c.level >= 2).length;
  assert.ok(rim > 0, 'no leaves low down at the rim');
  // Given in any order: the same clusters.
  const places = (list) => list.map((c) => c.center.join(',')).sort();
  assert.deepEqual(places(leafy(canopy.slice().reverse(), least)), places(kept));
  // A column in the open is lit from the side all the way down: every one
  // keeps some leaves, the top one whole.
  const column = [0, 1, 2, 3].map((i) => ball(0, 20 - i * 3.2, 0, 1.6, 0.9));
  const stack = leafy(column, least);
  assert.equal(stack.length, 4);
  assert.equal(stack[0].radius, 1.6);
  // Among close neighbours (the low sky hidden), the lower ones go.
  assert.ok(leafy(column, least, { top: 21, away: 2 }).length < 4);
  // Side by side in the open: all of them, whole.
  const row = [0, 1, 2, 3].map((i) => ball(i * 8, 10, 0, 1.6, 0.9));
  assert.deepEqual(leafy(row, least).map((c) => c.radius), [1.6, 1.6, 1.6, 1.6]);
});

// Where an oak's leaves are: points spread through its crown's box that lie
// in a cluster, and looks straight up from the ground under it.
function crown(layout) {
  const { clumps, oak } = layout;
  const lo = Math.min(...clumps.map((c) => c.center[1] - c.radius * c.squash)), hi = Math.max(...clumps.map((c) => c.center[1] + c.radius * c.squash));
  const half = Math.max(...clumps.map((c) => Math.hypot(c.center[0], c.center[2]) + c.radius));
  let s = 12345;
  const random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const inside = (p) => clumps.some((c) => ((p[0] - c.center[0]) ** 2 + ((p[1] - c.center[1]) / c.squash) ** 2 + (p[2] - c.center[2]) ** 2) <= c.radius ** 2);
  let leaves = 0, upper = 0;
  const N = 2500;
  for (let i = 0; i < N; i++) {
    const p = [(random() * 2 - 1) * half, lo + random() * (hi - lo), (random() * 2 - 1) * half];
    if (!inside(p)) continue;
    leaves++;
    if (p[1] > oak.height / 2) upper++;
  }
  const ground = Math.PI * (oak.width / 2) ** 2 * 0.8;
  let open = 0;
  const LOOKS = 600;
  for (let i = 0; i < LOOKS; i++) {
    const a = random() * Math.PI * 2, r = Math.sqrt(random()) * (oak.width / 2) * 0.8;
    if (!clumps.some((c) => through([Math.cos(a) * r, 0.1, Math.sin(a) * r], [0, 1, 0], c) > 0)) open++;
  }
  return { filled: ((2 * half) ** 2 * (hi - lo) * leaves) / N / (ground * (hi - lo) * 0.62), upper: upper / leaves, sky: open / LOOKS };
}
const mean = (values) => values.reduce((a, v) => a + v, 0) / values.length;

test('the open-grown oak: leaves in a layer, bare inside, sky showing through from under it', () => {
  const crowns = SEEDS.map((seed) => ({ layout: layoutOak(seed, OAK_SHAPE) })).map(({ layout }) => ({ layout, ...crown(layout) }));
  const filled = mean(crowns.map((c) => c.filled)), sky = mean(crowns.map((c) => c.sky)), upper = mean(crowns.map((c) => c.upper));
  // (It was nine tenths full, with 1% of the sky showing. A real oak's leaf
  // clouds fill about a tenth; TreeLab's lumps are bigger than those.)
  assert.ok(filled > 0.3 && filled < 0.65, `leaves fill ${(filled * 100).toFixed(0)}% of the crown's space`);
  assert.ok(sky > 0.03 && sky < 0.24, `${(sky * 100).toFixed(0)}% of the sky shows from under the crown (real oaks: 7 to 24%)`);
  assert.ok(upper > 0.55, `the upper half of the tree holds ${(upper * 100).toFixed(0)}% of the leaves`);
  for (const { layout } of crowns) {
    assert.ok(layout.clumps.length <= 84 && layout.clumps.length > 30);
    assert.ok(layout.oak.places > layout.clumps.length, 'every place for a cluster kept its leaves');
  }
});

test('the forest-grown oak, among neighbours: its leaves at the top, bare below; the same shape in the open is leafy down its sides', () => {
  // (On a straight trunk: the crown is measured from the foot of the tree.)
  const forest = { ...presetShape('oak', 'forest-grown'), bends: 0 };
  assert.equal(forest.crowded, 1);
  assert.equal(OAK_SHAPE.crowded, 0);
  const among = SEEDS.map((seed) => crown(layoutOak(seed, forest)));
  assert.ok(mean(among.map((c) => c.upper)) > 0.9, `the upper half holds ${(mean(among.map((c) => c.upper)) * 100).toFixed(0)}% (real: 79 to 88% in the upper 40 to 55%)`);
  // What its neighbours alone do, under an oak's own broad outline (the
  // forest oak's own outline has few low branches to carry leaves, open or
  // not): there, the same tree in the open is leafy down its sides.
  const domed = { ...forest, ...Object.fromEntries(OUTLINE.map((key) => [key, OAK_SHAPE[key]])) };
  const crowded = SEEDS.map((seed) => crown(layoutOak(seed, domed))), alone = SEEDS.map((seed) => crown(layoutOak(seed, { ...domed, crowded: 0 })));
  assert.ok(mean(crowded.map((c) => c.filled)) < 0.7 * mean(alone.map((c) => c.filled)), 'no barer among neighbours');
  assert.ok(mean(among.map((c) => c.sky)) > 0.05 && mean(among.map((c) => c.sky)) < 0.35, `${(mean(among.map((c) => c.sky)) * 100).toFixed(0)}% of the sky from under it`);
  // The same seed, the same leaves.
  assert.deepEqual(layoutOak(7, forest).clumps, layoutOak(7, forest).clumps);
});

test('a fuller crown keeps more leaves under its top; a thin one fewer', () => {
  const at = (leafiness) => mean(SEEDS.map((seed) => crown(layoutOak(seed, { ...OAK_SHAPE, leafiness })).filled));
  const thin = at(0.2), usual = at(OAK_SHAPE.leafiness), full = at(1);
  assert.ok(thin < usual && usual < full, `${thin.toFixed(2)}, ${usual.toFixed(2)}, ${full.toFixed(2)}`);
});
