import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DEFAULT_WIND } from '@workshop/wind.js';
import { OAK_LIMITS, OAK_SHAPE, buildOak, layoutOak, partOf } from '../src/oak/oak.js';
import { limitsFor, sliderKind } from '../src/limits.js';
import { PRESETS, presetOf, presetShape } from '../src/presets.js';
import { createPlanter } from '../src/tree.js';
import { createSwayRig } from '../src/swayRig.js';

// TreeLab's own English oak (src/oak/oak.js): it grows into its crown at its
// real size, its joins are clean, and the workshop's mesher and sway take it.

const triangles = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const finite = (g) => g.attributes.position.array.every(Number.isFinite);
const SEEDS = [11, 22, 33, 44, 55, 66];

function sound(tree, label, shape = OAK_SHAPE) {
  assert.ok(finite(tree.wood) && finite(tree.foliage), `${label}: broken numbers`);
  // (A crown bigger than the usual settings grow gets more wood and more
  // clusters, as many times more as its outline is bigger. An ancient
  // oak's thick wood is round: more sides.)
  const n = triangles(tree.wood) + triangles(tree.foliage);
  // (And a trunk thicker than any oak's has thick wood all the way out.)
  const most = 22000 * tree.layout.oak.big ** 2 * Math.max(1, shape.girth[1] / 1.5);
  assert.ok(n > 200 && n < most, `${label}: ${n} triangles (at most ${Math.round(most)})`);
  const [lo, hi] = shape.height;
  assert.ok(tree.height > lo * 0.7 && tree.height < hi * 1.3 + 1, `${label}: ${tree.height.toFixed(1)} m tall for ${lo}–${hi}`);
  assert.ok(tree.foliage.attributes.branch && tree.wood.attributes.branch, `${label}: no sway attribute`);
}

test('an oak grows at its real size, wider than tall, in good time', () => {
  for (const seed of SEEDS) {
    const start = performance.now();
    const tree = buildOak(seed, OAK_SHAPE);
    const ms = performance.now() - start;
    sound(tree, `seed ${seed}`);
    assert.ok(tree.reach * 2 > tree.height * 0.9, `seed ${seed}: ${(tree.reach * 2).toFixed(1)} m wide, ${tree.height.toFixed(1)} m tall`);
    assert.ok(ms < 600, `seed ${seed}: ${ms.toFixed(0)} ms`);
  }
});

test('the same seed grows the same oak; another seed another', () => {
  const a = Array.from(buildOak(5, OAK_SHAPE).wood.attributes.position.array);
  assert.deepEqual(Array.from(buildOak(5, OAK_SHAPE).wood.attributes.position.array), a);
  assert.notDeepEqual(Array.from(buildOak(6, OAK_SHAPE).wood.attributes.position.array), a);
});

test('a side branch starts thinner than the branch it leaves: no corners break out', () => {
  for (const seed of SEEDS) {
    const { oak } = layoutOak(seed, OAK_SHAPE);
    assert.ok(oak.joins.length > 20, `seed ${seed}: only ${oak.joins.length} side branches`);
    for (const j of oak.joins) assert.ok(j.r0 < j.parent, `seed ${seed}: a branch of ${j.r0.toFixed(3)} m off one of ${j.parent.toFixed(3)} m`);
  }
});

test('the big limbs set off at different heights, not from one point', () => {
  for (const seed of SEEDS) {
    const { oak } = layoutOak(seed, OAK_SHAPE);
    const spread = Math.max(...oak.limbStarts) - Math.min(...oak.limbStarts);
    assert.ok(spread > 0.8, `seed ${seed}: the limbs start within ${spread.toFixed(2)} m of each other`);
  }
});

test('the trunk is as thick as asked, and every branch thinner the further out', () => {
  const shape = { ...OAK_SHAPE, girth: [0.6, 0.6] };
  const { segments } = layoutOak(9, shape);
  const trunk = segments[0];
  assert.ok(trunk.r0 > 0.6 && trunk.r0 < 0.6 * 1.4, `the trunk's foot: ${trunk.r0.toFixed(2)} m`);
  for (const s of segments) assert.ok(s.r1 <= s.r0 * 1.001 + 1e-9 || s.from[1] < 1.3, 'a branch thickens outward');
});

test('every oak slider, at both ends, still grows a sound tree', () => {
  for (const [key, value] of Object.entries(OAK_SHAPE)) {
    const [lo, hi] = limitsFor(key, value, 'oak');
    assert.deepEqual([lo, hi], OAK_LIMITS[key].slice(0, 2), `${key} uses the oak's own slider`);
    for (const v of [lo, hi]) {
      const shape = { ...OAK_SHAPE, [key]: Array.isArray(value) ? [v, v] : v };
      sound(buildOak(3, shape), `${key} = ${v}`, shape);
    }
  }
});

test('the ready-made oaks fit the sliders and grow', () => {
  assert.ok(PRESETS.oak['open-grown'], 'no "open-grown" to start from');
  for (const [name, changes] of Object.entries(PRESETS.oak)) {
    for (const [key, value] of Object.entries(changes)) {
      assert.ok(key in OAK_SHAPE, `"${name}": the oak has no ${key}`);
      assert.equal(sliderKind(value), sliderKind(OAK_SHAPE[key]), `"${name}" ${key}`);
    }
    const shape = presetShape('oak', name);
    sound(buildOak(7, shape), `"${name}"`, shape);
    assert.equal(presetOf('oak', shape), name);
  }
});

test('an oak sways downwind with the workshop\'s sway, and plants with the rest', () => {
  globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
  const folder = { add: () => { const row = { name: () => row, listen: () => row, onChange: () => row, destroy() {} }; return row; } };
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial());
  const terrain = { heightAt: () => 0, normalAt: (x, z, out = new THREE.Vector3()) => out.set(0, 1, 0), mesh };
  const trees = new THREE.Group();
  scene.add(mesh, trees);
  createPlanter().plant(trees, [{ x: 0, y: 0, z: 0, size: 1, turn: 0, tint: 0.5, kind: 'oak', seed: 7, variant: 0 }]);
  assert.ok(trees.userData.species.broadleaf, 'an oak is tuned as the sway\'s broadleaf');
  const rig = createSwayRig({ scene, folder, wind: { ...DEFAULT_WIND, gust: 0, turbulence: 0, from: 90, speed: 6 }, sway: { on: true, branch: 1, flutter: 0, timeScale: 1 } });
  rig.bind({ trees, terrain });
  for (let i = 0; i < 300; i++) rig.update(1 / 60);
  const sway = trees.children[0].geometry.attributes.sway;
  assert.ok(sway.getX(0) < -0.05, `bent ${sway.getX(0).toFixed(3)} m along x, not downwind`);
});

test('an oak has grey-brown bark, darker at its foot', () => {
  const tree = buildOak(4, OAK_SHAPE);
  const { position, color } = tree.wood.attributes;
  let foot = null, high = null;
  for (let i = 0; i < color.count; i++) {
    if (position.getY(i) < 0.5 && !foot) foot = [color.getX(i), color.getY(i), color.getZ(i)];
    if (position.getY(i) > tree.height * 0.6 && !high) high = [color.getX(i), color.getY(i), color.getZ(i)];
  }
  assert.ok(foot[0] < high[0], 'the foot isn\'t darker');
  assert.ok(Math.abs(high[0] - high[2]) < 0.16, 'the bark up the limbs isn\'t a grey-brown');
});

test('an oak exports to .glb and turns in autumn', async () => {
  const { exportModel } = await import('../src/exportModel.js');
  const { foliageColor, PALETTES } = await import('../src/colors.js');
  const { defaultSettings } = await import('../src/settings.js');
  globalThis.FileReader ??= class {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); }); }
  };
  const trees = new THREE.Group();
  const record = { x: 0, y: 0, z: 0, size: 1, turn: 0, tint: 0.5, kind: 'oak', seed: 7, variant: 0 };
  createPlanter().plant(trees, [record]);
  const { buffer, triangles: n } = await exportModel({ trees });
  const view = new DataView(buffer);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, view.getUint32(12, true))));
  assert.ok(json.nodes.some((node) => /^oak /.test(node.name ?? '')), 'the model names it an oak');
  assert.ok(n > 5000);
  const { colors } = defaultSettings();
  const autumn = { amount: 1, palette: 'oak', spread: 0, evergreens: false };
  const oakColours = PALETTES.oak.map((c) => new THREE.Color(c).getHexString());
  assert.ok(oakColours.includes(foliageColor(record, colors, autumn).getHexString()), 'an oak stays green in autumn');
});

// --- A slider changes what it names and nothing else ---------------------------------

const headings = (layout) => [...new Set(layout.segments.map((s) => s.limb.heading).filter((h) => h !== 0))].sort((a, b) => a - b);
const near = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

test('each part of an oak has random numbers of its own', () => {
  const part = partOf(7);
  assert.equal(part('height')(), part('height')(), 'the same part, the same numbers');
  assert.notEqual(part('height')(), part('spread')(), 'two parts share their numbers');
  assert.notEqual(part('limb', 0)(), part('limb', 1)(), 'two limbs share their numbers');
  assert.notEqual(partOf(8)('height')(), part('height')(), 'two trees share their numbers');
});

test('shorter, narrower or longer in the trunk, it is the same oak fitted to another size', () => {
  for (const seed of SEEDS) {
    const usual = layoutOak(seed, OAK_SHAPE);
    for (const [key, by] of [['height', -3], ['spread', -0.3], ['trunk', 2]]) {
      const other = layoutOak(seed, { ...OAK_SHAPE, [key]: OAK_SHAPE[key].map((v) => v + by) });
      assert.equal(other.oak.nodes, usual.oak.nodes, `seed ${seed}, ${key}: it grew another tree`);
      assert.ok(near(headings(other), headings(usual)), `seed ${seed}, ${key}: its limbs turned`);
      assert.equal(other.lean.toward, usual.lean.toward, `seed ${seed}, ${key}: it leans another way`);
    }
    const shorter = layoutOak(seed, { ...OAK_SHAPE, height: OAK_SHAPE.height.map((v) => v - 3) });
    assert.ok(Math.abs(shorter.oak.height - usual.oak.height + 3) < 1e-9, `seed ${seed}: not 3 m shorter`);
    assert.equal(shorter.oak.girth, usual.oak.girth, `seed ${seed}: its trunk changed`);
  }
});

test('a giant keeps the limbs and the lean of the usual oak of its seed, with more on them', () => {
  for (const seed of SEEDS) {
    const usual = layoutOak(seed, OAK_SHAPE), giant = layoutOak(seed, { ...OAK_SHAPE, height: [35, 35] });
    assert.ok(near(headings(giant), headings(usual)), `seed ${seed}: its limbs turned`);
    assert.equal(giant.lean.toward, usual.lean.toward, `seed ${seed}: it leans another way`);
    assert.ok(giant.oak.nodes > usual.oak.nodes * 1.5, `seed ${seed}: no more branches`);
  }
});

test('one more limb leaves the others where they were', () => {
  for (const seed of SEEDS) {
    const four = headings(layoutOak(seed, { ...OAK_SHAPE, limbs: [4, 4] })), five = headings(layoutOak(seed, { ...OAK_SHAPE, limbs: [5, 5] }));
    assert.equal(four.length, 4);
    assert.equal(five.length, 5);
    for (const h of four) assert.ok(five.some((g) => Math.abs(g - h) < 1e-9), `seed ${seed}: a limb moved`);
  }
});

test('a fuller or more crooked crown keeps its limbs and its lean', () => {
  for (const seed of SEEDS) {
    const usual = layoutOak(seed, OAK_SHAPE);
    for (const change of [{ leafiness: 0.2 }, { leafiness: 1 }, { crooked: 0.9 }, { clumpSize: [0.5, 1] }, { squash: 0.4 }, { crowded: 1 }]) {
      const other = layoutOak(seed, { ...OAK_SHAPE, ...change });
      assert.ok(near(headings(other), headings(usual)), `seed ${seed}, ${Object.keys(change)}: its limbs turned`);
      assert.equal(other.lean.toward, usual.lean.toward, `seed ${seed}, ${Object.keys(change)}: it leans another way`);
    }
  }
});

// --- Leaves sit on twigs, on wood still growing, and there are enough of them ---------

// How far a cluster is from the nearest drawn wood (m; 0 or less: it holds
// some). As the mesher draws it: a ball, `squash` times as tall above its
// middle and 0.6 of that below.
function clear(c, segments) {
  let best = Infinity;
  for (const s of segments) {
    for (let k = 0; k <= 8; k++) {
      const p = [0, 1, 2].map((i) => s.from[i] + (s.to[i] - s.from[i]) * (k / 8));
      const dy = p[1] - c.center[1];
      const q = Math.sqrt(((p[0] - c.center[0]) ** 2 + (p[2] - c.center[2]) ** 2) / c.radius ** 2 + (dy / (c.radius * c.squash * (dy < 0 ? 0.6 : 1))) ** 2);
      best = Math.min(best, (q - 1) * c.radius);
    }
  }
  return best;
}

test('every cluster of leaves holds drawn wood: none floats', () => {
  const shapes = [OAK_SHAPE, { ...OAK_SHAPE, squash: 0.3 }, { ...OAK_SHAPE, squash: 1.5 }, { ...OAK_SHAPE, clumpSize: [0.3, 0.8] }, { ...OAK_SHAPE, height: [35, 35] }, presetShape('oak', 'forest-grown'), presetShape('oak', 'young')];
  for (const shape of shapes) {
    for (const seed of SEEDS.slice(0, 3)) {
      const { clumps, segments } = layoutOak(seed, shape);
      assert.ok(clumps.length > 10, `seed ${seed}: ${clumps.length} clusters`);
      for (const c of clumps) assert.ok(clear(c, segments) <= 0.02, `seed ${seed}: a cluster ${clear(c, segments).toFixed(2)} m clear of the wood`);
    }
  }
});

test('a bigger crown gets more wood and more clusters, not the same ones stretched', () => {
  for (const seed of SEEDS.slice(0, 3)) {
    const usual = layoutOak(seed, OAK_SHAPE), giant = layoutOak(seed, { ...OAK_SHAPE, height: [35, 35] });
    assert.equal(usual.oak.big, 1, 'the usual oak is given the usual detail');
    assert.ok(giant.oak.big > 1.3 && giant.oak.big <= 1.8, `a 35 m oak: ${giant.oak.big.toFixed(2)} times`);
    assert.ok(giant.clumps.length > usual.clumps.length * 1.7, `seed ${seed}: ${giant.clumps.length} clusters on the giant, ${usual.clumps.length} on the usual`);
    assert.ok(giant.segments.length > usual.segments.length * 1.7, `seed ${seed}: no more wood`);
  }
});

test('twigs that stopped growing long ago are bare: few clusters sit low and deep inside the crown', () => {
  const profile = (t) => { const c = 0.38, u = t < c ? (c - t) / c : (t - c) / (1 - c); return Math.sqrt(Math.max(0, 1 - Math.pow(u, t < c ? 3 : 2))); };
  let all = 0, lowInside = 0, stopped = 0;
  for (const seed of SEEDS) {
    const { clumps, oak } = layoutOak(seed, OAK_SHAPE);
    const bottom = Math.max(0.3, oak.bare * 0.95);
    stopped += oak.stopped;
    for (const c of clumps) {
      const t = Math.min(1, Math.max(0, (c.center[1] - bottom) / (oak.height - bottom)));
      const edge = (oak.width / 2) * profile(t);
      all++;
      if (t < 0.45 && edge > 0 && Math.hypot(c.center[0], c.center[2]) / edge < 0.6) lowInside++;
    }
  }
  assert.ok(stopped / SEEDS.length > 15, `only ${(stopped / SEEDS.length).toFixed(0)} bare twigs a tree`);
  assert.ok(lowInside / all < 0.09, `${Math.round((100 * lowInside) / all)}% of the clusters sit low and inside`);
});
