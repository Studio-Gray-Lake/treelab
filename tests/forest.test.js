import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TREE_KINDS, TREE_SHAPES, mulberry32 } from '@workshop/treeShapes.js';
import { createNoise } from '../src/noise.js';
import { createTerrain } from '../src/terrain.js';
import { PATTERNS, areaOf, inArea, scatter } from '../src/patterns.js';
import { placeForest } from '../src/forest.js';
import { gardenRecords } from '../src/garden.js';
import { createPlanter } from '../src/tree.js';
import { defaultSettings, MAX_TREES } from '../src/settings.js';

// --- The ground ---------------------------------------------------------------

test('the noise is the same for the same seed, and differs for another', () => {
  const a = createNoise(5), b = createNoise(5), c = createNoise(6);
  const at = (n) => [0.3, 4.7, 11.2].map((x) => n.fractal(x, x * 0.7));
  assert.deepEqual(at(a), at(b));
  assert.notDeepEqual(at(a), at(c));
  for (let i = 0; i < 2000; i++) {
    const v = a.noise(i * 0.137, i * 0.291);
    assert.ok(Math.abs(v) <= 1.0001, `noise ${v}`);
  }
});

test('trees stand on the ground as drawn: heightAt is the mesh\'s surface', () => {
  const terrain = createTerrain({ seed: 4, height: 10, size: 25, roughness: 0.6 });
  const pos = terrain.mesh.geometry.attributes.position;
  for (let t = 0; t < pos.count; t += 997) {
    // Each corner, and the middle of its facet.
    const v = t - (t % 3);
    const mx = (pos.getX(v) + pos.getX(v + 1) + pos.getX(v + 2)) / 3;
    const my = (pos.getY(v) + pos.getY(v + 1) + pos.getY(v + 2)) / 3;
    const mz = (pos.getZ(v) + pos.getZ(v + 1) + pos.getZ(v + 2)) / 3;
    assert.ok(Math.abs(terrain.heightAt(pos.getX(t), pos.getZ(t)) - pos.getY(t)) < 1e-4, `corner ${t}`);
    assert.ok(Math.abs(terrain.heightAt(mx, mz) - my) < 1e-4, `facet ${v}`);
  }
});

test('hills are hills: as high as asked, flat at 0, the same for a seed', () => {
  const tops = (terrain) => {
    let lo = Infinity, hi = -Infinity;
    for (let x = -40; x <= 40; x += 2) for (let z = -40; z <= 40; z += 2) {
      const h = terrain.heightAt(x, z);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    return hi - lo;
  };
  const rise = tops(createTerrain({ seed: 2, height: 8, size: 30, roughness: 0.4 }));
  assert.ok(rise > 3 && rise < 20, `the hills rise ${rise.toFixed(1)} m`);
  assert.equal(tops(createTerrain({ seed: 2, height: 0 })), 0);
  assert.equal(createTerrain({ seed: 9 }).heightAt(7, 3), createTerrain({ seed: 9 }).heightAt(7, 3));
  const flat = createTerrain({ height: 0 });
  assert.equal(flat.slopeAt(3, 4), 0);
});

// --- The patterns ---------------------------------------------------------------

const area = { shape: 'circle', radius: 30 };
const density = 400 / 10000;

test('every pattern stays in its area, and is the same for the same seed', () => {
  for (const pattern of Object.keys(PATTERNS)) {
    for (const shape of ['circle', 'square']) {
      const a = { shape, radius: 20 };
      const points = scatter(pattern, { area: a, density, random: mulberry32(3) });
      assert.ok(points.length > 0, `${pattern} in a ${shape}: no trees`);
      assert.ok(points.every((p) => inArea(a, p.x, p.z)), `${pattern} in a ${shape}: a tree outside`);
      assert.deepEqual(scatter(pattern, { area: a, density, random: mulberry32(3) }), points, pattern);
    }
  }
});

test('the density sets how many trees stand', () => {
  const expected = density * areaOf(area);
  for (const pattern of ['even spacing', 'random', 'jittered grid', 'rows']) {
    const n = scatter(pattern, { area, density, random: mulberry32(1) }).length;
    assert.ok(Math.abs(n - expected) < expected * 0.12, `${pattern}: ${n} trees for ${expected.toFixed(0)}`);
  }
  // (Clumps vary more: so many groups, so many trees each, about.)
  const clumped = scatter('clumps', { area, density, random: mulberry32(1) }).length;
  assert.ok(clumped > expected * 0.5 && clumped < expected * 1.5, `clumps: ${clumped} for ${expected.toFixed(0)}`);
});

// The mean distance from each tree to its nearest neighbour.
function nearest(points) {
  let sum = 0;
  for (const p of points) {
    let best = Infinity;
    for (const q of points) if (q !== p) best = Math.min(best, Math.hypot(p.x - q.x, p.z - q.z));
    sum += best;
  }
  return sum / points.length;
}

test('even spacing keeps trees apart, clumps pull them together', () => {
  const spacing = 1 / Math.sqrt(density);
  const even = scatter('even spacing', { area, density, random: mulberry32(2) });
  const closest = Math.min(...even.map((p) => Math.min(...even.filter((q) => q !== p).map((q) => Math.hypot(p.x - q.x, p.z - q.z)))));
  assert.ok(closest >= 0.75 * spacing - 1e-9, `two trees ${closest.toFixed(2)} m apart`);
  const random = nearest(scatter('random', { area, density, random: mulberry32(2) }));
  const clumped = nearest(scatter('clumps', { area, density, random: mulberry32(2), clumpTrees: 10, clumpSpread: 3 }));
  assert.ok(nearest(even) > random * 1.2, `even ${nearest(even).toFixed(2)} vs random ${random.toFixed(2)}`);
  assert.ok(clumped < random * 0.9, `clumps ${clumped.toFixed(2)} vs random ${random.toFixed(2)}`);
});

test('rows run at their angle', () => {
  const along = (angle) => {
    const points = scatter('rows', { area: { shape: 'square', radius: 20 }, density, random: mulberry32(4), rowAngle: angle });
    // Neighbours within a row are closer than rows are apart: the nearest
    // neighbour's direction is the rows' direction.
    let sum = 0;
    for (const p of points) {
      let best = null, d = Infinity;
      for (const q of points) {
        const e = Math.hypot(p.x - q.x, p.z - q.z);
        if (q !== p && e < d) { d = e; best = q; }
      }
      sum += Math.abs(Math.cos(Math.atan2(best.z - p.z, best.x - p.x) - (angle * Math.PI) / 180));
    }
    return sum / points.length;
  };
  assert.ok(along(0) > 0.9);
  assert.ok(along(60) > 0.9);
});

// --- The forest ---------------------------------------------------------------

const flat = createTerrain({ height: 0 });

test('the forest is the same for the same settings, and another for another seed', () => {
  const forest = defaultSettings().forest;
  const a = placeForest(forest, flat).records;
  assert.deepEqual(placeForest(forest, flat).records, a);
  assert.notDeepEqual(placeForest({ ...forest, seed: 8 }, flat).records, a);
});

test('the mix sets each kind\'s share, and a kind switched off has none', () => {
  for (const grouping of ['mixed', 'in stands']) {
    const forest = { ...defaultSettings().forest, density: 1500, radius: 40, grouping };
    const { records } = placeForest(forest, flat);
    const total = TREE_KINDS.reduce((s, k) => s + forest.mix[k].share, 0);
    for (const kind of TREE_KINDS) {
      const share = records.filter((r) => r.kind === kind).length / records.length;
      const want = forest.mix[kind].share / total;
      assert.ok(Math.abs(share - want) < 0.08, `${grouping}: ${kind} ${(share * 100).toFixed(0)}% for ${(want * 100).toFixed(0)}%`);
    }
    const noPine = { ...forest, mix: { ...forest.mix, pine: { on: false, share: 50 } } };
    assert.ok(!placeForest(noPine, flat).records.some((r) => r.kind === 'pine'), grouping);
  }
  const none = { ...defaultSettings().forest, mix: Object.fromEntries(TREE_KINDS.map((k) => [k, { on: false, share: 30 }])) };
  assert.equal(placeForest(none, flat).records.length, 0);
});

test('in stands, a tree\'s neighbours are mostly its own kind', () => {
  const sameKindNearby = (grouping) => {
    const { records } = placeForest({ ...defaultSettings().forest, density: 1200, radius: 35, grouping, standSize: 20 }, flat);
    let same = 0;
    for (const p of records) {
      let best = null, d = Infinity;
      for (const q of records) {
        const e = Math.hypot(p.x - q.x, p.z - q.z);
        if (q !== p && e < d) { d = e; best = q; }
      }
      if (best.kind === p.kind) same++;
    }
    return same / records.length;
  };
  assert.ok(sameKindNearby('in stands') > sameKindNearby('mixed') + 0.2);
});

test('patches leave clearings, about as much as asked', () => {
  const forest = { ...defaultSettings().forest, density: 1500, radius: 40, patches: true, cover: 0.5 };
  const { records, report } = placeForest(forest, flat);
  const full = placeForest({ ...forest, patches: false }, flat).records.length;
  const kept = records.length / full;
  assert.ok(kept > 0.35 && kept < 0.65, `${(kept * 100).toFixed(0)}% kept for 50% cover`);
  assert.equal(report.clearings, full - records.length);
});

test('no tree on ground steeper than the forest allows; each stands on the ground', () => {
  const hills = createTerrain({ seed: 5, height: 18, size: 20, roughness: 0.6 });
  const forest = { ...defaultSettings().forest, maxSlope: 20, radius: 40, density: 1000 };
  const { records, report } = placeForest(forest, hills);
  assert.ok(report.steep > 0, 'these hills have no steep ground to test with');
  for (const r of records) {
    assert.ok(hills.slopeAt(r.x, r.z) <= 20);
    assert.ok(Math.abs(r.y - (hills.heightAt(r.x, r.z) - 0.3)) < 1e-9);
  }
});

test('sizes, variants and tints stay within the settings', () => {
  const forest = { ...defaultSettings().forest, size: [0.6, 0.9], variants: 3 };
  for (const r of placeForest(forest, flat).records) {
    assert.ok(r.size >= 0.6 && r.size <= 0.9);
    assert.ok(Number.isInteger(r.variant) && r.variant >= 0 && r.variant < 3);
    assert.ok(r.tint >= 0 && r.tint < 1);
  }
});

test('the densest, widest forest the sliders allow stays under the cap, and plants in reasonable time', () => {
  const forest = { ...defaultSettings().forest, area: 'square', radius: 40, density: 3000, pattern: 'random' };
  const start = performance.now();
  const { records } = placeForest(forest, flat);
  const group = { children: [], userData: {}, add(...m) { this.children.push(...m); }, remove() {} };
  const numbers = createPlanter().plant(group, records.map((r) => ({ ...r, seed: 7 })), TREE_SHAPES);
  const ms = performance.now() - start;
  assert.ok(records.length < MAX_TREES && records.length > 1500, `${records.length} trees`);
  assert.equal(numbers.models, TREE_KINDS.length * forest.variants, 'every kind\'s variants, each grown once');
  assert.ok(ms < 3000, `${ms.toFixed(0)} ms`);
});

// --- The Tree tab's grid ---------------------------------------------------------

test('the grid holds rows × columns trees, none touching, as asked to vary', () => {
  const planter = createPlanter();
  const tree = { ...defaultSettings().tree, show: 'grid', rows: 2, cols: 3, kind: 'fir', seed: 7, variant: 2 };
  const { records, spacing, reach } = gardenRecords(tree, TREE_SHAPES, planter);
  assert.equal(records.length, 6);
  assert.deepEqual(records.map((r) => r.variant), [2, 3, 4, 5, 6, 7]);
  assert.ok(records.every((r) => r.kind === 'fir' && r.seed === 7));
  assert.ok(spacing >= 2 * reach, 'crowns overlap');
  assert.deepEqual(new Set(records.map((r) => r.x)).size, 3);

  const seeds = gardenRecords({ ...tree, vary: 'seeds' }, TREE_SHAPES, planter).records;
  assert.deepEqual(seeds.map((r) => r.seed), [7, 8, 9, 10, 11, 12]);
  assert.ok(seeds.every((r) => r.variant === 2));

  const kinds = gardenRecords({ ...tree, vary: 'kinds by row', rows: 3 }, TREE_SHAPES, planter).records;
  assert.deepEqual([...new Set(kinds.map((r) => r.kind))].length, 3);
  assert.ok(kinds.filter((r) => r.z === kinds[0].z).every((r) => r.kind === 'fir'), 'a row of one kind');
});

test('"one tree" is one tree at the middle', () => {
  const { records } = gardenRecords({ ...defaultSettings().tree, rows: 5, cols: 5 }, TREE_SHAPES, createPlanter());
  assert.equal(records.length, 1);
  assert.equal(records[0].x, 0);
  assert.equal(records[0].z, 0);
});

// --- Colour ---------------------------------------------------------------------

test('summer keeps the workshop\'s greens; autumn turns the broadleaves, tree by tree', async () => {
  const THREE = await import('three');
  const { foliageColor, PALETTES } = await import('../src/colors.js');
  const { greenOf } = await import('../src/tree.js');
  const { colors } = defaultSettings();
  const summer = { amount: 0, palette: 'maple', spread: 0.5, evergreens: false };
  const trees = Array.from({ length: 60 }, (_, i) => ({ kind: TREE_KINDS[i % 3], tint: (i % 7) / 7, x: i * 3.1, z: i * -1.7 }));
  for (const t of trees) assert.equal(foliageColor(t, colors, summer).getHexString(), greenOf(t).getHexString(), 'summer changed the greens');

  const fall = { ...summer, amount: 1, spread: 0 };
  const maple = PALETTES.maple.map((c) => new THREE.Color(c).getHexString());
  for (const t of trees.filter((t) => t.kind === 'broadleaf')) assert.ok(maple.includes(foliageColor(t, colors, fall).getHexString()));
  const fir = trees.find((t) => t.kind === 'fir');
  assert.notEqual(foliageColor(fir, colors, fall).getHexString(), greenOf(fir).getHexString(), 'evergreens dull a little');
  assert.ok(!maple.includes(foliageColor(fir, colors, fall).getHexString()), 'a fir turned red');

  const half = { ...summer, amount: 0.5, spread: 1 };
  const shades = new Set(trees.filter((t) => t.kind === 'broadleaf').map((t) => foliageColor(t, colors, half).getHexString()));
  assert.ok(shades.size > 5, 'halfway into autumn, the trees should differ');
  assert.equal(foliageColor(trees[0], colors, half).getHexString(), foliageColor({ ...trees[0] }, colors, half).getHexString(), 'not the same each time');
});

test('a planted forest takes new colours without growing again', async () => {
  const THREE = await import('three');
  const { recolor } = await import('../src/tree.js');
  const { foliageColor } = await import('../src/colors.js');
  const planter = createPlanter();
  const group = new THREE.Group();
  const { records } = placeForest(defaultSettings().forest, flat);
  const settings = defaultSettings();
  const shown = records.map((r) => ({ ...r, seed: 7 }));
  planter.plant(group, shown, TREE_SHAPES);
  settings.autumn.amount = 1;
  recolor(group, (t, out) => foliageColor(t, settings.colors, settings.autumn, out));
  const broadleaf = group.userData.species.broadleaf.variants[0];
  const c = new THREE.Color();
  broadleaf.meshes[1].getColorAt(0, c);
  assert.equal(c.getHexString(), foliageColor(broadleaf.trees[0], settings.colors, settings.autumn).getHexString());
  assert.equal(planter.plant(group, shown, TREE_SHAPES).grown, 0);
});

test('limbs mottle in autumn and come back as grown in summer', () => {
  const planter = createPlanter();
  const group = { children: [], userData: {}, add(...m) { this.children.push(...m); }, remove() {} };
  const record = { x: 0, y: 0, z: 0, size: 1, turn: 0, tint: 0.5, kind: 'broadleaf', seed: 7, variant: 0 };
  planter.plant(group, [record], TREE_SHAPES);
  const color = planter.model('broadleaf', 7, 0, TREE_SHAPES.broadleaf).tree.foliage.attributes.color;
  const before = Array.from(color.array);
  planter.mottle(() => 0.6);
  assert.notDeepEqual(Array.from(color.array), before);
  planter.mottle(() => 0);
  assert.deepEqual(Array.from(color.array), before);
});

// --- Big forests -------------------------------------------------------------------

test('a forest can reach 160 m from the middle, as thin as 10 trees a hectare', () => {
  const forest = { ...defaultSettings().forest, radius: 160, density: 10 };
  const { records } = placeForest(forest, flat);
  const expected = 10 * (Math.PI * 160 * 160) / 10000;
  assert.ok(Math.abs(records.length - expected) < expected * 0.2, `${records.length} trees for ${expected.toFixed(0)}`);
  assert.ok(records.some((r) => Math.hypot(r.x, r.z) > 140), 'no tree near the edge');
});

test('over the cap, a forest is planted thinner all over, not cut off at the end of its rows', async () => {
  for (const pattern of ['rows', 'jittered grid', 'even spacing']) {
    const forest = { ...defaultSettings().forest, area: 'square', radius: 160, density: 3000, pattern };
    const { records, report } = placeForest(forest, flat);
    assert.ok(records.length <= MAX_TREES, `${pattern}: ${records.length} trees`);
    assert.ok(report.thinnedTo > 0 && report.thinnedTo < 3000, `${pattern}: thinned to ${report.thinnedTo}`);
    for (const [axis, sign] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
      assert.ok(records.some((r) => sign * r[axis] > 130), `${pattern}: no trees out at ${sign > 0 ? '+' : '-'}${axis}`);
    }
  }
});

test('the hills grow with the forest, whole under every tree', async () => {
  const { groundFor } = await import('../src/terrain.js');
  assert.deepEqual(groundFor(30), { half: 150, cells: 200 });
  const big = groundFor(160 * Math.SQRT2);
  assert.ok(big.half * 0.75 >= 160 * Math.SQRT2, `the hills fade out at ${big.half * 0.75} m, inside the forest`);
  assert.ok(big.cells <= 320);
  const terrain = createTerrain({ seed: 2, height: 8, size: 30 }, big);
  assert.ok(Math.abs(terrain.heightAt(150, 150)) > 0 || Math.abs(terrain.heightAt(140, -150)) > 0, 'flat at the forest\'s corner');
});

test('the ground\'s facets are uneven: its corners sit off the grid, its outline stays square', () => {
  const terrain = createTerrain({ seed: 4, height: 10, size: 25, roughness: 0.6 });
  const pos = terrain.mesh.geometry.attributes.position;
  const step = (2 * terrain.half) / 200;
  let off = 0, edge = 0, far = 0;
  for (let i = 0; i < pos.count; i += 7) {
    const x = pos.getX(i), z = pos.getZ(i);
    const dx = Math.abs(x / step - Math.round(x / step)), dz = Math.abs(z / step - Math.round(z / step));
    far = Math.max(far, dx, dz);
    if (Math.abs(Math.abs(x) - terrain.half) < 1e-6 || Math.abs(Math.abs(z) - terrain.half) < 1e-6) edge++;
    else if (dx > 0.02 || dz > 0.02) off++;
    assert.ok(Math.abs(x) <= terrain.half + 1e-6 && Math.abs(z) <= terrain.half + 1e-6, 'a corner outside the ground');
  }
  assert.ok(off > (pos.count / 7) * 0.8, `only ${off} corners off the grid`);
  assert.ok(edge > 50, 'no corners on the outline');
  assert.ok(far < 0.25, `a corner ${far.toFixed(2)} of a square off its place`);
  // (And no facet is folded over: every one faces up.)
  const normal = terrain.mesh.geometry.attributes.normal;
  for (let i = 0; i < normal.count; i += 3) assert.ok(normal.getY(i) > 0.2, `facet ${i / 3} faces ${normal.getY(i).toFixed(2)} up`);
  // (Both ways of cutting a patch are used.)
  const same = (a, b) => pos.getX(a) === pos.getX(b) && pos.getZ(a) === pos.getZ(b);
  let oneWay = 0, other = 0;
  for (let t = 0; t + 5 < pos.count; t += 6) same(t, t + 3) ? oneWay++ : other++;
  assert.ok(oneWay > 5000 && other > 5000, `${oneWay} patches cut one way, ${other} the other`);
});
