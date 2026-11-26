import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeForest } from '../src/forest.js';
import { KINDS } from '../src/kinds.js';
import { fromOldLink, fromShortLink } from '../src/link.js';
import { presetShape } from '../src/presets.js';
import { BEFORE, RANGES, defaultSettings } from '../src/settings.js';
import { fitOf, siteOf, siteSays, standOf, standingOf } from '../src/site.js';
import { createTerrain } from '../src/terrain.js';
import { tip } from '../src/tips.js';

// The forest's rules: where each kind of tree grows (src/site.js; planted
// by src/forest.js).

const flat = { heightAt: () => 0, slopeAt: () => 0, half: 150 };
const hills = createTerrain({ seed: 3, height: 14, size: 35, roughness: 0.45 });
const shapes = { ...defaultSettings().shapes, oak: presetShape('oak', 'forest-grown'), hazel: presetShape('hazel', 'forest-grown'), holly: presetShape('holly', 'forest-grown') };
const standing = (kind) => standOf(shapes[kind]);
const mixOf = (shares) => Object.fromEntries(KINDS.map((k) => [k, { ...defaultSettings().forest.mix[k], on: k in shares, share: shares[k] ?? 30 }]));
const forestOf = (shares, more = {}) => ({ ...defaultSettings().forest, radius: 60, density: 400, pattern: 'random', maxSlope: 90, mix: mixOf(shares), ...more });
const none = { ground: 0, room: 0, light: 0 };
const apart = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const of = (records, kind) => records.filter((r) => r.kind === kind);
// The trees of a kind that stand under an oak's crown (nearer one than 0.85 of its crown's reach).
const underOaks = (records, kind) => {
  const oaks = of(records, 'oak');
  return of(records, kind).filter((r) => oaks.some((o) => apart(o, r) < 0.85 * standing('oak').crown * o.size));
};

test('every kind has a site: a stretch of ground it likes, and how much shade it bears', () => {
  for (const kind of KINDS) {
    const { ground, shade } = siteOf(kind);
    assert.ok(ground[0] >= 0 && ground[1] <= 1 && ground[0] < ground[1] && shade >= 0 && shade <= 1, kind);
    const { height, crown } = standOf(defaultSettings().shapes[kind]);
    assert.ok(height > 1 && height < 45 && crown > 0.3 && crown < height, `${kind}: ${height.toFixed(1)} m tall, a crown reaching ${crown.toFixed(1)} m`);
  }
  // (As the trees are: the holly and the beech bear the most shade, the birch and the pine the least; the ash
  // keeps low, the birch high, the hawthorn grows anywhere.)
  assert.ok(siteOf('holly').shade > siteOf('hazel').shade && siteOf('hazel').shade > siteOf('oak').shade && siteOf('oak').shade > siteOf('birch').shade);
  assert.ok(siteOf('beech').shade > 0.8 && siteOf('pine').shade < 0.2);
  assert.ok(siteOf('ash').ground[1] < siteOf('birch').ground[1] && siteOf('birch').ground[0] > siteOf('ash').ground[0]);
  assert.deepEqual(siteOf('hawthorn').ground, [0, 1]);
  // (How a kind likes the ground: wholly on its own stretch, less and less outside it, never quite nothing.)
  const birch = siteOf('birch');
  assert.equal(fitOf(birch, 0.7), 1);
  assert.ok(fitOf(birch, 0.3) < 1 && fitOf(birch, 0.3) > fitOf(birch, 0.15) && fitOf(birch, 0) > 0 && fitOf(birch, 0) < 0.1);
});

test('with every rule at 0 the forest is planted as it was before there were rules; and the rules are on to start with', () => {
  assert.deepEqual(defaultSettings().forest.rules, { ground: 1, room: 1, light: 1 });
  for (const key of ['ground', 'room', 'light']) assert.ok(RANGES[`forest.rules.${key}`] && tip(`forest.rules.${key}`) && BEFORE[`forest.rules.${key}`] === 0, key);
  const forest = forestOf({ oak: 30, hazel: 40, birch: 30 });
  const before = placeForest(forest, hills);
  assert.deepEqual(placeForest({ ...forest, rules: none }, hills, standing).records, before.records);
  assert.deepEqual(placeForest(forest, hills).records, before.records, 'nothing to reckon with: no rules');
  assert.ok(placeForest(forest, hills, standing).records.length < before.records.length, 'with them, some trees don\'t stand');
  // (A link made before there were rules opens without them: its forest is the one it was made with.)
  assert.deepEqual(fromShortLink('1-misty.wood').settings.forest.rules, none);
  assert.deepEqual(fromShortLink('2').settings.forest.rules, none);
  assert.deepEqual(fromOldLink(Buffer.from(JSON.stringify({ version: 1, tab: 'forest' })).toString('base64')).settings.forest.rules, none);
});

test('room: trees of a height keep their crowns\' room between them; a small tree under a tall one only keeps clear of its trunk', () => {
  const forest = forestOf({ oak: 40, hazel: 60 });
  const { records, report } = placeForest({ ...forest, rules: { ground: 0, room: 1, light: 0 } }, flat, standing);
  const seeds = placeForest({ ...forest, rules: none }, flat, standing).records;
  assert.ok(report.crowded > seeds.length * 0.2 && report.shaded === 0, `${report.crowded} of ${seeds.length} crowded out`);
  assert.equal(records.length + report.crowded, seeds.length);
  const oak = standing('oak'), hazel = standing('hazel');
  for (const a of of(records, 'oak')) {
    // (Two oaks of a height. A far smaller one beside a big one is the light's business, not the room's.)
    for (const b of of(records, 'oak')) if (a !== b && Math.min(a.size, b.size) >= 0.6 * Math.max(a.size, b.size)) assert.ok(apart(a, b) >= 0.55 * oak.crown * (a.size + b.size) - 1e-9, `two oaks ${apart(a, b).toFixed(1)} m apart`);
    for (const b of of(records, 'hazel')) assert.ok(apart(a, b) >= 1.2, `a hazel ${apart(a, b).toFixed(1)} m from an oak's trunk`);
  }
  for (const a of of(records, 'hazel')) for (const b of of(records, 'hazel')) if (a !== b && Math.min(a.size, b.size) >= 0.6 * Math.max(a.size, b.size)) assert.ok(apart(a, b) >= 0.55 * hazel.crown * (a.size + b.size) - 1e-9);
  // (Hazels do stand under the oaks' crowns: the underwood.)
  assert.ok(underOaks(records, 'hazel').length > 10);
  // (More room: fewer trees, further apart. The same forest every time.)
  const wide = placeForest({ ...forest, rules: { ground: 0, room: 2, light: 0 } }, flat, standing).records;
  assert.ok(wide.length < records.length * 0.8, `${wide.length} trees with twice the room, ${records.length} with the usual`);
  assert.deepEqual(placeForest({ ...forest, rules: { ground: 0, room: 1, light: 0 } }, flat, standing).records, records);
});

test('light: under an oak\'s crown a holly grows, a hazel mostly, a birch hardly ever', () => {
  const forest = forestOf({ oak: 25, holly: 25, hazel: 25, birch: 25 }, { density: 500 });
  const lit = placeForest({ ...forest, rules: { ground: 0, room: 1, light: 1 } }, flat, standing);
  const dark = placeForest({ ...forest, rules: { ground: 0, room: 1, light: 0 } }, flat, standing);
  // (How many of a kind's trees that stood under a crown with no light rule still stand there with it.)
  const share = (kind) => underOaks(lit.records, kind).length / Math.max(1, underOaks(dark.records, kind).length);
  assert.ok(underOaks(dark.records, 'birch').length > 8 && underOaks(dark.records, 'holly').length > 8, 'with no light rule, every kind stands under the oaks');
  assert.ok(share('holly') > 0.85, `${(share('holly') * 100).toFixed(0)}% of the hollies`);
  assert.ok(share('hazel') > 0.45 && share('hazel') < share('holly'), `${(share('hazel') * 100).toFixed(0)}% of the hazels`);
  assert.ok(share('birch') < 0.25, `${(share('birch') * 100).toFixed(0)}% of the birches`);
  assert.ok(lit.report.shaded > 10 && dark.report.shaded === 0);
  // (In the open a birch stands as well as any: the rule is about shade, not about birches.)
  const open = (records) => of(records, 'birch').length - underOaks(records, 'birch').length;
  assert.ok(open(lit.records) > open(dark.records) * 0.8);
  // (Most oaks are untouched by it: only a small one under a big one's crown goes.)
  assert.ok(of(lit.records, 'oak').length > of(dark.records, 'oak').length * 0.7 && of(lit.records, 'oak').length <= of(dark.records, 'oak').length);
});

test('ground: on the hills each kind keeps to the ground it likes, and its share of the whole forest stays about what it was', () => {
  const forest = forestOf({ ash: 34, birch: 33, hawthorn: 33 });
  const ruled = placeForest({ ...forest, rules: { ground: 1, room: 0, light: 0 } }, hills, standing).records;
  const loose = placeForest({ ...forest, rules: none }, hills, standing).records;
  const meanHeight = (records, kind) => of(records, kind).reduce((sum, r) => sum + hills.heightAt(r.x, r.z), 0) / of(records, kind).length;
  assert.equal(ruled.length, loose.length, 'the ground moves kinds about; it takes no tree away');
  assert.ok(meanHeight(ruled, 'birch') > meanHeight(ruled, 'ash') + 3, `birches at ${meanHeight(ruled, 'birch').toFixed(1)} m, ashes at ${meanHeight(ruled, 'ash').toFixed(1)} m`);
  assert.ok(Math.abs(meanHeight(loose, 'birch') - meanHeight(loose, 'ash')) < 1, 'with no ground rule, a kind is as high as another');
  // (The hawthorn, which grows anywhere, lies between them.)
  assert.ok(meanHeight(ruled, 'hawthorn') > meanHeight(ruled, 'ash') && meanHeight(ruled, 'hawthorn') < meanHeight(ruled, 'birch'));
  for (const kind of ['ash', 'birch', 'hawthorn']) {
    const now = of(ruled, kind).length / ruled.length, was = of(loose, kind).length / loose.length;
    assert.ok(now > was * 0.6 && now < was * 1.5, `${kind}: ${(now * 100).toFixed(0)}% of the forest, ${(was * 100).toFixed(0)}% without the rule`);
  }
  // (On flat ground it changes nothing: the same trees, the same kinds.)
  assert.deepEqual(placeForest({ ...forest, rules: { ground: 1, room: 0, light: 0 } }, flat, standing).records, placeForest({ ...forest, rules: none }, flat, standing).records);
  // (Kinds "in stands" keep to their ground too.)
  const stands = placeForest({ ...forest, grouping: 'in stands', rules: { ground: 1, room: 0, light: 0 } }, hills, standing).records;
  assert.ok(meanHeight(stands, 'birch') > meanHeight(stands, 'ash') + 2);
});

test('a kind\'s panel says where it grows, in a sentence', () => {
  assert.equal(siteSays({ ground: [0, 1], shade: 0.55 }), 'It grows on any ground, and under taller trees it bears a good deal of shade.');
  assert.equal(siteSays({ ground: [0, 0.45], shade: 0.4 }), 'It grows on the lower ground (the lowest 45% of it), and under taller trees it bears some shade.');
  assert.equal(siteSays({ ground: [0.55, 1], shade: 0.05 }), 'It grows on the higher ground (the highest 45% of it), and under taller trees it needs the open sky.');
  assert.equal(siteSays({ ground: [0.25, 0.9], shade: 0.9 }), 'It grows on the middle ground (from 25% to 90% of the way up), and under taller trees it bears deep shade.');
  // (Every kind has its sentence, and the kinds the rules' own notes name read as they say.)
  for (const kind of KINDS) assert.match(siteSays(siteOf(kind)), /^It grows on .+, and under taller trees it .+\.$/, kind);
  assert.match(siteSays(siteOf('holly')), /deep shade/);
  assert.match(siteSays(siteOf('birch')), /higher ground.*open sky/);
  assert.match(siteSays(siteOf('hawthorn')), /any ground/);
});

test('the trees that stand: the tallest settle first, and what is given isn\'t changed', () => {
  const records = [{ x: 0, z: 0, kind: 'hazel', variant: 0, size: 1 }, { x: 0.5, z: 0, kind: 'oak', variant: 0, size: 1 }, { x: 30, z: 0, kind: 'oak', variant: 0, size: 1 }, { x: 33, z: 0, kind: 'oak', variant: 0, size: 0.9 }];
  const given = JSON.stringify(records);
  const report = {};
  const stand = standingOf(records, { room: 1, light: 0 }, standing, report);
  // (The hazel half a metre from an oak's trunk goes, though it came first; of two oaks 3 m apart, the taller stays.)
  assert.deepEqual(stand.map((r) => [r.x, r.kind]), [[0.5, 'oak'], [30, 'oak']]);
  assert.deepEqual([report.crowded, report.shaded], [2, 0]);
  assert.equal(JSON.stringify(records), given);
  assert.equal(standingOf(records, { room: 0, light: 0 }, standing, {}), records, 'no rule: the same trees');
});
