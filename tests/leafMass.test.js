import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OAK_CHOICES, OAK_LIMITS, OAK_SHAPE, buildOak, layoutOak } from '../src/oak/oak.js';
import { byLimb, lumpsOf, massGeometry } from '../src/oak/leafMass.js';
import { NOISE_TYPES, USUAL_PATTERN } from '../src/oak/leafNoise.js';

// The oak's leaves as masses (src/oak/leafMass.js): each limb's clusters
// merged into one surface, hollow underneath. A test, behind the "merged
// masses" setting.

const merged = { ...OAK_SHAPE, masses: 1 };
const limb = { phase: 1, heading: 2, reach1: 0.02 };
const clump = (center, radius, extra = {}) => ({ center, radius, squash: 0.9, seed: 7, shade: 1, limb, ...extra });
const triangles = (g) => g.attributes.position.count / 3;

// Its corners, as whole places: [key, ...] for each triangle.
const cornersOf = (g) => {
  const p = g.attributes.position;
  return Array.from({ length: p.count }, (_, i) => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`);
};
// How many separate pieces a geometry is in (triangles that share a corner are one piece).
function pieces(g) {
  const keys = cornersOf(g);
  const parent = new Map();
  const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
  for (const k of keys) if (!parent.has(k)) parent.set(k, k);
  for (let i = 0; i < keys.length; i += 3) {
    parent.set(find(keys[i + 1]), find(keys[i]));
    parent.set(find(keys[i + 2]), find(keys[i]));
  }
  return new Set(keys.map(find)).size;
}

test('a cluster becomes lumps of many sizes, the same ones every time, and a hollow under it', () => {
  const c = clump([0, 10, 0], 2);
  const lumps = lumpsOf(c);
  assert.deepEqual(lumpsOf(c), lumps, 'the same cluster, other lumps');
  const full = lumps.filter((l) => l.weight > 0), hollow = lumps.filter((l) => l.weight < 0);
  assert.equal(hollow.length, 1);
  assert.ok(hollow[0].c[1] < 10 && hollow[0].r > full[0].r, 'the hollow is under its middle, and wider than it');
  assert.ok(full.length >= 4 && full.length <= 7, `${full.length} lumps`);
  assert.ok(full[0].r <= 2 && full[0].r >= 1.6, 'its own lump is no bigger than the light allows');
  for (const small of full.slice(1)) {
    assert.ok(small.r < full[0].r * 0.71 && small.r > full[0].r * 0.34, `a small lump of ${small.r.toFixed(2)} m on one of ${full[0].r.toFixed(2)} m`);
    assert.ok(small.c[1] > 10 - 0.5, 'a small lump under the cluster');
  }
  assert.notDeepEqual(lumpsOf(clump([0, 10, 0], 2, { seed: 8 })).map((l) => l.r), lumps.map((l) => l.r), 'every cluster has the same lumps');
});

test('a cluster on its own is a cap of leaves: about its own size, closed, and hollow underneath', () => {
  const c = clump([0, 10, 0], 2);
  const g = massGeometry([c], { cell: 0.4, rough: 0 });
  assert.equal(g.index, null);
  for (const name of ['position', 'normal', 'color', 'branch']) assert.ok(g.attributes[name], `no ${name}`);
  assert.ok(g.attributes.position.array.every(Number.isFinite));
  const p = g.attributes.position;
  let top = -Infinity, wide = 0, under = Infinity;
  for (let i = 0; i < p.count; i++) {
    top = Math.max(top, p.getY(i));
    wide = Math.max(wide, Math.hypot(p.getX(i), p.getZ(i)));
    // (Straight under its middle: where the leaves end.)
    if (Math.hypot(p.getX(i), p.getZ(i)) < 0.5) under = Math.min(under, p.getY(i));
  }
  assert.ok(top > 10 + 1.2 && top < 10 + 2 * 0.9 + 1.4, `its top is at ${top.toFixed(2)} m`);
  assert.ok(wide > 1.2 && wide < 3.4, `it reaches ${wide.toFixed(2)} m from its middle`);
  // (A ball's underside would be 1.1 m under its middle; the cap's is at about its middle.)
  assert.ok(under > 10 - 0.75, `the leaves reach down to ${under.toFixed(2)} m under a cluster at 10 m`);
  // Closed: every edge is shared by two triangles.
  const keys = cornersOf(g), edges = new Map();
  for (let i = 0; i < keys.length; i += 3) {
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const edge = [keys[i + a], keys[i + b]].sort().join('|');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  assert.ok([...edges.values()].every((n) => n === 2), 'the surface has an open edge');
});

test('clusters close together on one limb run into one mass; those of another limb stay their own', () => {
  const near = [clump([0, 10, 0], 1.6), clump([2.2, 10.3, 0], 1.4, { seed: 9 }), clump([1, 10.2, 2], 1.5, { seed: 11 })];
  assert.equal(pieces(massGeometry(near, { cell: 0.4, rough: 0 })), 1, 'three clusters side by side on one limb');
  const other = { phase: 3, heading: 4, reach1: 0.03 };
  const two = [...near, clump([0.6, 10.1, 0.8], 1.5, { seed: 13, limb: other })];
  assert.deepEqual(byLimb(two).map((group) => group.length), [3, 1]);
  const g = massGeometry(two, { cell: 0.4, rough: 0 });
  assert.equal(pieces(g), 2, 'another limb\'s cluster merged with them');
  // (Each corner sways with its own limb.)
  const sways = g.attributes.branch, limbs = new Set();
  for (let i = 0; i < sways.count; i++) limbs.add(`${sways.getX(i)}|${sways.getZ(i)}`);
  assert.deepEqual([...limbs].sort(), ['1|2', '3|4']);
});

test('coarser facets are fewer, and the mass still the same size', () => {
  const group = [clump([0, 10, 0], 1.8), clump([2.5, 10.5, 0.5], 1.6, { seed: 9 })];
  const fine = massGeometry(group, { cell: 0.35, rough: 0.25 }), coarse = massGeometry(group, { cell: 1, rough: 0.25 });
  assert.ok(triangles(fine) > triangles(coarse) * 4, `${triangles(fine)} fine, ${triangles(coarse)} coarse`);
  fine.computeBoundingBox();
  coarse.computeBoundingBox();
  for (const k of ['x', 'y', 'z']) assert.ok(Math.abs((fine.boundingBox.max[k] - fine.boundingBox.min[k]) - (coarse.boundingBox.max[k] - coarse.boundingBox.min[k])) < 2.2, `the mass changes size along ${k}`);
});

test('an oak with merged masses: far fewer pieces than clusters, the same wood, in good time', () => {
  for (const seed of [11, 22, 33]) {
    const usual = buildOak(seed, OAK_SHAPE);
    const start = performance.now();
    const tree = buildOak(seed, merged);
    const ms = performance.now() - start;
    assert.deepEqual(tree.layout.clumps, usual.layout.clumps, `seed ${seed}: the clusters themselves changed`);
    assert.deepEqual(Array.from(tree.wood.attributes.position.array), Array.from(usual.wood.attributes.position.array), `seed ${seed}: the wood changed`);
    const n = tree.layout.clumps.length;
    assert.ok(pieces(tree.foliage) < n / 2, `seed ${seed}: ${pieces(tree.foliage)} masses of ${n} clusters`);
    assert.ok(triangles(tree.foliage) > 1500 && triangles(tree.foliage) < 16000, `seed ${seed}: ${triangles(tree.foliage)} triangles of leaves`);
    assert.ok(Math.abs(tree.height - usual.height) < 2.5 && Math.abs(tree.reach - usual.reach) < 2.5, `seed ${seed}: the crown changed size`);
    assert.ok(ms < 700, `seed ${seed}: ${ms.toFixed(0)} ms`);
  }
  assert.equal(layoutOak(11, OAK_SHAPE).leaves.merged, false, 'the usual oak has merged masses');
});

// Every edge of a closed surface that faces one way throughout is walked
// once each way by the two triangles that share it. { oneWay: edges walked
// one way only (an open edge, or two triangles facing opposite ways: one of
// them is culled and shows as a hole), euler: corners - edges + faces (2
// for a surface with no hole through it, in one piece) }.
function soundness(g) {
  const p = g.attributes.position;
  const key = (i) => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  const walked = new Map(), places = new Set();
  for (let i = 0; i < p.count; i += 3) {
    const k = [key(i), key(i + 1), key(i + 2)];
    for (const place of k) places.add(place);
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) walked.set(`${k[a]}>${k[b]}`, (walked.get(`${k[a]}>${k[b]}`) ?? 0) + 1);
  }
  let oneWay = 0;
  for (const [edge, n] of walked) {
    const [a, b] = edge.split('>');
    if ((walked.get(`${b}>${a}`) ?? 0) !== n) oneWay++;
  }
  return { oneWay, euler: places.size - walked.size / 2 + p.count / 3 };
}

test('no face of a mass faces inward, and no cluster on its own has a hole through it', () => {
  // (A face facing inward is culled: it showed as a gap in the leaves.)
  for (let seed = 1; seed <= 24; seed++) {
    for (const cell of [0.5, 0.9]) {
      for (const rough of [0.25, 1]) {
        const g = massGeometry([clump([0.13, 10.2, -0.07], 1.2 + (seed % 5) * 0.3, { seed })], { cell, rough });
        const { oneWay, euler } = soundness(g);
        assert.equal(oneWay, 0, `seed ${seed}, facets ${cell} m: ${oneWay} edges with a face the wrong way round`);
        assert.equal(euler, 2, `seed ${seed}, facets ${cell} m: a hole through the mass, or it is in pieces`);
      }
    }
  }
  for (const seed of [11, 22]) {
    const { clumps } = layoutOak(seed, merged);
    for (const cell of [0.5, 0.9]) assert.equal(soundness(massGeometry(clumps, { cell, rough: 0.25 })).oneWay, 0, `oak ${seed}, facets ${cell} m: a face the wrong way round`);
  }
});

test('a cluster\'s hollow is its own: it leaves the cap of a cluster under and beside it whole', () => {
  // (The lower cluster's top lies where the upper one's hollow is. When
  // every hollow ate into every lump, that opened a hole in it.)
  const upper = clump([0, 10, 0], 1.7), lower = clump([1.3, 8.8, 0.2], 1.7, { seed: 9 });
  const alone = massGeometry([lower], { cell: 0.4, rough: 0 }), both = massGeometry([upper, lower], { cell: 0.4, rough: 0 });
  // How high the leaves reach straight over the lower cluster's middle.
  const over = (g) => {
    const p = g.attributes.position;
    let top = -Infinity;
    for (let i = 0; i < p.count; i++) if (Math.hypot(p.getX(i) - 1.3, p.getZ(i) - 0.2) < 0.45) top = Math.max(top, p.getY(i));
    return top;
  };
  assert.ok(over(both) >= over(alone) - 0.05, `the lower cluster's cap is at ${over(both).toFixed(2)} m under its neighbour, ${over(alone).toFixed(2)} m on its own`);
  assert.equal(soundness(both).oneWay, 0);
});

test('with no noise the masses are the lumps as they are; with it, shaped by it, and still sound', () => {
  const group = [clump([0, 10, 0], 1.8), clump([2.4, 10.4, 0.5], 1.6, { seed: 9 }), clump([1, 10.2, 2.2], 1.5, { seed: 11 })];
  const corners = (g) => Array.from(g.attributes.position.array);
  const plain = massGeometry(group, { cell: 0.5, rough: 0.25 });
  assert.deepEqual(corners(massGeometry(group, { cell: 0.5, rough: 0.25, noise: 0, seed: 5 })), corners(plain), 'no noise, and the masses changed');
  for (const noise of [0.5, 1, 2]) {
    const shaped = massGeometry(group, { cell: 0.5, rough: 0.25, noise, seed: 5 });
    assert.notDeepEqual(corners(shaped), corners(plain), `noise ${noise} changes nothing`);
    assert.deepEqual(corners(massGeometry(group, { cell: 0.5, rough: 0.25, noise, seed: 5 })), corners(shaped), 'the same noise, another shape');
    assert.notDeepEqual(corners(massGeometry(group, { cell: 0.5, rough: 0.25, noise, seed: 6 })), corners(shaped), 'another tree, the same noise');
    assert.equal(soundness(shaped).oneWay, 0, `noise ${noise}: a face the wrong way round`);
    assert.ok(triangles(shaped) > 100, `noise ${noise}: almost no leaves left (${triangles(shaped)} triangles)`);
    // No leaves where there is no twig: every corner is near a cluster
    // (within its lumps' reach, and as far again as the noise carries).
    const p = shaped.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const near = group.some((c) => Math.hypot(p.getX(i) - c.center[0], p.getY(i) - c.center[1], p.getZ(i) - c.center[2]) < c.radius * 2.4 + noise * 1.1 + 0.6);
      assert.ok(near, `noise ${noise}: leaves in the air, far from any cluster`);
    }
  }
});

test('the bits noise pinches off the masses are left out', () => {
  // (A piece of a few faces hanging by itself. Each piece kept has at least 12 four-sided faces.)
  for (const seed of [3, 4, 5, 6]) {
    const group = [clump([0, 10, 0], 1.8, { seed }), clump([2.6, 10.4, 0.5], 1.5, { seed: seed + 20 })];
    const g = massGeometry(group, { cell: 0.4, rough: 0.25, noise: 2, seed });
    const keys = cornersOf(g);
    const parent = new Map();
    const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
    for (const k of keys) if (!parent.has(k)) parent.set(k, k);
    for (let i = 0; i < keys.length; i += 3) { parent.set(find(keys[i + 1]), find(keys[i])); parent.set(find(keys[i + 2]), find(keys[i])); }
    const sizes = new Map();
    for (let i = 0; i < keys.length; i += 3) sizes.set(find(keys[i]), (sizes.get(find(keys[i])) ?? 0) + 1);
    for (const n of sizes.values()) assert.ok(n >= 24, `seed ${seed}: a piece of ${n} triangles`);
  }
});

test('an oak with noise in its masses: the same clusters and wood, sound, in good time', () => {
  for (const seed of [11, 22]) {
    const lumps = buildOak(seed, merged);
    const start = performance.now();
    const tree = buildOak(seed, { ...merged, noise: 100 });
    const ms = performance.now() - start;
    assert.deepEqual(tree.layout.clumps, lumps.layout.clumps, `seed ${seed}: the clusters themselves changed`);
    assert.deepEqual(Array.from(tree.wood.attributes.position.array), Array.from(lumps.wood.attributes.position.array), `seed ${seed}: the wood changed`);
    assert.equal(soundness(tree.foliage).oneWay, 0, `seed ${seed}: a face the wrong way round`);
    assert.ok(triangles(tree.foliage) > 1500 && triangles(tree.foliage) < 20000, `seed ${seed}: ${triangles(tree.foliage)} triangles of leaves`);
    assert.ok(ms < 800, `seed ${seed}: ${ms.toFixed(0)} ms`);
    assert.equal(tree.layout.leaves.noise, 1);
    assert.equal(lumps.layout.leaves.noise, 0);
  }
});

// A geometry's triangles, each as its corners' places, in an order of their own (so two geometries with the same triangles compare equal however they are listed).
const triangleSet = (g) => {
  const keys = cornersOf(g), out = [];
  for (let i = 0; i < keys.length; i += 3) out.push(`${keys[i]} ${keys[i + 1]} ${keys[i + 2]}`);
  return out.sort();
};

test('merging: all of them is the masses as they were, none is a mass for every cluster', async () => {
  const { groupsOf } = await import('../src/oak/leafMass.js');
  const { clumps } = layoutOak(11, merged);
  const all = massGeometry(clumps, { cell: 0.9, rough: 0.25, seed: 5 });
  assert.deepEqual(triangleSet(massGeometry(clumps, { cell: 0.9, rough: 0.25, merge: 1, seed: 5 })), triangleSet(all));
  assert.deepEqual(triangleSet(massGeometry(clumps, { cell: 0.9, rough: 0.25, noise: 1, merge: 1, seed: 5 })), triangleSet(massGeometry(clumps, { cell: 0.9, rough: 0.25, noise: 1, seed: 5 })), 'with noise');
  for (const limbs of byLimb(clumps)) {
    assert.equal(groupsOf(limbs, { merge: 0, seed: 5 }).length, limbs.length, 'at 0 every cluster is its own');
    assert.deepEqual(groupsOf(limbs, { merge: 1, seed: 5 }).flat().map((c) => c.seed).sort(), limbs.map((c) => c.seed).sort(), 'a cluster lost, or twice');
  }
  // (Every cluster a closed mass of its own: as many pieces as clusters.)
  const near = [clump([0, 10, 0], 1.6), clump([2.2, 10.3, 0], 1.4, { seed: 9 }), clump([1, 10.2, 2], 1.5, { seed: 11 })];
  assert.equal(pieces(massGeometry(near, { cell: 0.4, rough: 0, merge: 0 })), 3);
  assert.equal(pieces(massGeometry(near, { cell: 0.4, rough: 0, merge: 1 })), 1);
  assert.equal(soundness(massGeometry(near, { cell: 0.4, rough: 0.25, merge: 0 })).oneWay, 0);
});

test('merging: raising it only adds merges, about as many as it says, the same every time', async () => {
  const { groupsOf } = await import('../src/oak/leafMass.js');
  let clusters = 0, could = 0, did = 0;
  for (const seed of [11, 22, 33]) {
    const { clumps } = layoutOak(seed, merged);
    for (const limbs of byLimb(clumps)) {
      const at = (merge) => groupsOf(limbs, { merge, seed: 5 }).map((group) => group.map((c) => c.seed));
      const none = at(0), some = at(0.3), half = at(0.5), most = at(0.8), every = at(1);
      assert.deepEqual(at(0.5), half, 'the same setting, other merges');
      // (Each group at the lower setting lies whole within one at the higher.)
      for (const [fewer, more] of [[none, some], [some, half], [half, most], [most, every]]) {
        for (const group of fewer) assert.ok(more.some((bigger) => group.every((c) => bigger.includes(c))), 'a merge undone by raising the setting');
        assert.ok(more.length <= fewer.length);
      }
      clusters += limbs.length;
      could += limbs.length - every.length;
      did += limbs.length - half.length;
    }
    const other = byLimb(clumps).flatMap((limbs) => groupsOf(limbs, { merge: 0.5, seed: 6 }).map((group) => group.length));
    const same = byLimb(clumps).flatMap((limbs) => groupsOf(limbs, { merge: 0.5, seed: 5 }).map((group) => group.length));
    assert.notDeepEqual(other, same, `seed ${seed}: another tree merges the same clusters`);
  }
  assert.ok(could > clusters * 0.4, `only ${could} of ${clusters} clusters can join another`);
  assert.ok(did > could * 0.35 && did < could * 0.65, `at a half, ${did} of the ${could} that can join do`);
});

test('an oak with half its clusters merged: sound, the same wood, more masses than with all', () => {
  for (const seed of [11, 22]) {
    const all = buildOak(seed, merged), half = buildOak(seed, { ...merged, merge: 50 }), none = buildOak(seed, { ...merged, merge: 0 });
    assert.deepEqual(Array.from(half.wood.attributes.position.array), Array.from(all.wood.attributes.position.array), `seed ${seed}: the wood changed`);
    assert.deepEqual(half.layout.clumps, all.layout.clumps);
    assert.equal(soundness(half.foliage).oneWay, 0);
    assert.ok(pieces(half.foliage) > pieces(all.foliage) && pieces(none.foliage) > pieces(half.foliage), `seed ${seed}: ${pieces(all.foliage)}, ${pieces(half.foliage)}, ${pieces(none.foliage)} masses at all, half, none`);
    assert.equal(pieces(none.foliage), none.layout.clumps.length, `seed ${seed}: not a mass for every cluster`);
    assert.equal(half.layout.leaves.merge, 0.5);
  }
});

// What the noise is like can be chosen (src/oak/leafNoise.js): its type,
// its billows' size, its finer layers, its bend and its billowing.

test('the usual noise is what it was before its pattern could be chosen', () => {
  // (Recorded from the masses as they were: [seed, noise, coarseness, triangles of leaves, the sums of their corners' x, y and z].)
  const was = [
    [11, 100, 0.9, 6924, 800.70, 240405.46, 13692.84],
    [22, 164, 0.9, 7344, -5567.09, 241623.74, -2038.85],
    [11, 100, 0.5, 24360, 9978.62, 840368.61, 36524.58],
    [33, 50, 0.9, 6560, -1807.55, 208969.12, -18356.87],
  ];
  for (const [seed, noise, coarse, count, ...sums] of was) {
    // (On a straight trunk, as every oak had when these were recorded.)
    const tree = buildOak(seed, { ...merged, bends: 0, noise, coarse });
    assert.deepEqual(tree.layout.leaves.pattern, USUAL_PATTERN);
    const p = tree.foliage.attributes.position.array;
    assert.equal(p.length / 9, count, `seed ${seed}, noise ${noise}, facets of ${coarse} m: ${p.length / 9} triangles of leaves`);
    const sum = [0, 0, 0];
    for (let i = 0; i < p.length; i++) sum[i % 3] += p[i];
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(sum[k] - sums[k]) < 0.02 + Math.abs(sums[k]) * 1e-6, `seed ${seed}, noise ${noise}: its corners add up to ${sum[k].toFixed(2)}, not ${sums[k]}`);
  }
});

test('the noise chosen: with no bend and no billow it does nothing; each type is its own, and sound', () => {
  const group = [clump([0, 10, 0], 1.8), clump([2.4, 10.4, 0.5], 1.6, { seed: 9 }), clump([1, 10.2, 2.2], 1.5, { seed: 11 })];
  const corners = (g) => Array.from(g.attributes.position.array);
  const made = (noise, pattern, cell = 0.5) => massGeometry(group, { cell, rough: 0.25, noise, seed: 5, pattern });
  const plain = corners(massGeometry(group, { cell: 0.5, rough: 0.25 }));
  assert.deepEqual(corners(made(2, { bend: 0, billow: 0 })), plain, 'no bend and no billow, and the masses changed');
  assert.deepEqual(corners(made(1, USUAL_PATTERN)), corners(massGeometry(group, { cell: 0.5, rough: 0.25, noise: 1, seed: 5 })), 'the usual pattern, spelled out, is another');
  assert.deepEqual(corners(made(1, {})), corners(made(1, USUAL_PATTERN)), 'a pattern with nothing asked is not the usual one');
  // Bending alone and billowing alone each shape the masses, each its own way.
  const bent = corners(made(1, { billow: 0 })), billowed = corners(made(1, { bend: 0 })), both = corners(made(1, {}));
  for (const [name, one] of [['bent', bent], ['billowed', billowed], ['both', both]]) assert.notDeepEqual(one, plain, `${name}: nothing changed`);
  assert.notDeepEqual(bent, billowed);
  assert.notDeepEqual(bent, both);
  assert.notDeepEqual(billowed, both);
  // Every type: its own shape, sound, with leaves left, and none far from a cluster.
  const seen = [];
  for (const type of NOISE_TYPES) {
    for (const noise of [1, 2]) {
      const g = made(noise, { type });
      assert.equal(soundness(g).oneWay, 0, `${type}, noise ${noise}: a face the wrong way round`);
      assert.ok(triangles(g) > 100, `${type}, noise ${noise}: almost no leaves left (${triangles(g)} triangles)`);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const near = group.some((c) => Math.hypot(p.getX(i) - c.center[0], p.getY(i) - c.center[1], p.getZ(i) - c.center[2]) < c.radius * 2.4 + noise * 1.1 * Math.sqrt(3) + 0.6);
        assert.ok(near, `${type}, noise ${noise}: leaves in the air, far from any cluster`);
      }
      if (noise === 1) {
        for (const [other, its] of seen) assert.notDeepEqual(corners(g), its, `${type} is the same as ${other}`);
        seen.push([type, corners(g)]);
      }
    }
  }
});

test('the noise chosen: size, detail, bend and billow each do what they say', () => {
  const group = [clump([0, 10, 0], 1.8), clump([2.4, 10.4, 0.5], 1.6, { seed: 9 }), clump([1, 10.2, 2.2], 1.5, { seed: 11 })];
  const corners = (g) => Array.from(g.attributes.position.array);
  const made = (noise, pattern, cell = 0.5) => massGeometry(group, { cell, rough: 0.25, noise, seed: 5, pattern });
  // Size: other billows; and billows too small for the facets to show are no noise at all.
  assert.notDeepEqual(corners(made(1, { size: 6 })), corners(made(1, {})));
  assert.notDeepEqual(corners(made(1, { size: 1 })), corners(made(1, {})));
  assert.deepEqual(corners(made(2, { size: 0.3 }, 0.9)), corners(massGeometry(group, { cell: 0.9, rough: 0.25 })), 'billows a third the facets\' size still shape the masses');
  // Detail: each finer layer the facets can show changes the masses; one they can't changes nothing.
  const fine = [0, 1, 2, 3].map((detail) => corners(made(1, { size: 6, detail }, 0.3)));
  for (let k = 1; k < fine.length; k++) assert.notDeepEqual(fine[k], fine[k - 1], `detail ${k} is detail ${k - 1}`);
  assert.notDeepEqual(corners(made(1, { detail: 0 }, 0.9)), corners(made(1, { detail: 1 }, 0.9)));
  assert.deepEqual(corners(made(1, { detail: 4 }, 0.9)), corners(made(1, { detail: 1 }, 0.9)), 'layers finer than the facets changed the masses');
  // Bend: further is another shape, and the leaves are carried no further than asked.
  const reachOf = (g) => {
    const p = g.attributes.position;
    let far = 0;
    for (let i = 0; i < p.count; i++) far = Math.max(far, Math.min(...group.map((c) => Math.hypot(p.getX(i) - c.center[0], p.getY(i) - c.center[1], p.getZ(i) - c.center[2]) - c.radius * 2.4)));
    return far;
  };
  assert.notDeepEqual(corners(made(1, { bend: 3 })), corners(made(1, {})));
  for (const bend of [0, 1.1, 3, 5]) {
    const g = made(2, { bend, billow: 0 });
    assert.equal(soundness(g).oneWay, 0, `bend ${bend}: a face the wrong way round`);
    assert.ok(reachOf(g) < 2 * bend * Math.sqrt(3) + 0.6, `bend ${bend}: leaves ${reachOf(g).toFixed(1)} m past a cluster's reach`);
  }
  // Billow: more of it is another shape; at its most, still sound.
  assert.notDeepEqual(corners(made(1, { billow: 2 })), corners(made(1, {})));
  assert.equal(soundness(made(2, { billow: 3 })).oneWay, 0);
});

test('an oak with each noise setting at both its ends: the same clusters and wood, sound leaves, in good time', () => {
  const base = buildOak(11, merged);
  const wood = Array.from(base.wood.attributes.position.array);
  const usual = Array.from(buildOak(11, { ...merged, noise: 200 }).foliage.attributes.position.array);
  for (const key of ['noiseType', 'noiseSize', 'noiseDetail', 'noiseBend', 'noiseBillow']) {
    const [lo, hi] = OAK_LIMITS[key];
    assert.ok(OAK_SHAPE[key] >= lo && OAK_SHAPE[key] <= hi, `${key} starts outside its slider`);
    let changed = 0;
    for (const v of [lo, hi]) {
      const start = performance.now();
      const tree = buildOak(11, { ...merged, noise: 200, [key]: v });
      const ms = performance.now() - start;
      assert.deepEqual(tree.layout.clumps, base.layout.clumps, `${key} = ${v}: the clusters themselves changed`);
      assert.deepEqual(Array.from(tree.wood.attributes.position.array), wood, `${key} = ${v}: the wood changed`);
      const p = tree.foliage.attributes.position.array;
      assert.ok(p.every(Number.isFinite) && p.length > 9 * 500, `${key} = ${v}: ${p.length / 9} triangles of leaves`);
      assert.equal(soundness(tree.foliage).oneWay, 0, `${key} = ${v}: a face the wrong way round`);
      assert.ok(ms < 3000, `${key} = ${v}: ${ms.toFixed(0)} ms`);
      if (p.length !== usual.length || p.some((value, i) => value !== usual[i])) changed++;
    }
    // (One end at least: the most detail changes nothing on billows this
    // small, whose finer layers the facets can't show.)
    assert.ok(changed > 0, `${key}: neither end changes the leaves`);
  }
  // On big billows the most detail does show.
  const leavesOf = (shape) => Array.from(buildOak(11, { ...merged, noise: 200, noiseSize: 12, ...shape }).foliage.attributes.position.array);
  assert.notDeepEqual(leavesOf({ noiseDetail: 4 }), leavesOf({ noiseDetail: 1 }), 'on big billows, more detail changes nothing');
  // The type is chosen by name in the panel, and kept as a number.
  assert.deepEqual(Object.keys(OAK_CHOICES.noiseType), NOISE_TYPES);
  for (const [name, value] of Object.entries(OAK_CHOICES.noiseType)) {
    assert.equal(layoutOak(11, { ...merged, noiseType: value }).leaves.pattern.type, name);
    assert.ok(Number.isInteger(value) && value >= OAK_LIMITS.noiseType[0] && value <= OAK_LIMITS.noiseType[1], `${name} is outside the type's slider`);
  }
  assert.deepEqual(layoutOak(11, { ...merged, noiseType: 2, noiseSize: 5, noiseDetail: 3, noiseBend: 0.5, noiseBillow: 2 }).leaves.pattern, { type: 'ridged', size: 5, detail: 3, bend: 0.5, billow: 2 });
  assert.deepEqual(layoutOak(11, OAK_SHAPE).leaves.pattern, USUAL_PATTERN);
});
