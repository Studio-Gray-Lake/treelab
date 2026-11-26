import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGES, atAge, hasAges } from '../src/age.js';
import { placeForest } from '../src/forest.js';
import { DEFAULT_SHAPES, FRAMES, KINDS, growKind, isOwn, kindName, leafy, swayKind } from '../src/kinds.js';
import { limitsFor } from '../src/limits.js';
import { sunAt } from '../src/light.js';
import { presetOf, presetShape } from '../src/presets.js';
import { OTHER, PANELS, ROWS, sectionsOf } from '../src/sections.js';
import { SCENES, sceneOf, sceneSettings } from '../src/scenes.js';
import { defaultSettings, normalize } from '../src/settings.js';
import { SHAPE_TIPS } from '../src/tips.js';
import { GREENS } from '../src/tree.js';
import { OAK_FRAME, OAK_SHAPE, layoutOak } from '../src/oak/oak.js';

// TreeLab's own hazel (src/oak/broadleaves.js): a shrub of many stems from
// one stool, grown by the oak's code as stems (src/oak/oak.js: a frame's
// "stems").

const SEEDS = [3, 8, 11];
const grown = (seed, preset = 'open-grown') => growKind('hazel', seed, 0, presetShape('hazel', preset));
const layout = (seed, preset = 'open-grown') => layoutOak(seed, presetShape('hazel', preset), FRAMES.hazel);
// The runs of wood that leave the stool: its stems. (Each starts on the stool: its first point is the stool's top.)
const stemsOf = (wood) => {
  const stool = wood.runs.find((run) => run.trunk);
  const top = stool.points.at(-1).p;
  return wood.runs.filter((run) => run.side && !run.stalk && run.points[0].p === top);
};
const lengthOf = (run) => run.points.slice(1).reduce((sum, point, i) => sum + Math.hypot(...point.p.map((v, k) => v - run.points[i].p[k])), 0);
// How high its leaves begin: the height a twentieth of them lie under (m). (Not its very lowest leaf: a stray shoot low on a stem.)
const lowestLeaf = (tree) => {
  const p = tree.foliage.attributes.position;
  const heights = Array.from({ length: p.count }, (_, i) => p.getY(i)).sort((a, b) => a - b);
  return heights[Math.floor(heights.length / 20)];
};

test('the hazel is a kind of TreeLab\'s own: a broadleaf, with its stems and its stool in its panel and no trunk\'s rows', () => {
  assert.ok(KINDS.includes('hazel') && isOwn('hazel'));
  assert.equal(kindName('hazel'), 'hazel');
  assert.ok(leafy('hazel'));
  assert.equal(swayKind('hazel'), 'broadleaf');
  assert.ok(FRAMES.hazel.stems && !FRAMES.hazel.needles && FRAMES.hazel.bark);
  assert.equal(GREENS.hazel.length, 2);
  // (What a shrub of stems hasn't got is left out of its shape; everything else the oak has is there.)
  const none = ['trunk', 'leader', 'whorl', 'bends', 'burrs', 'hollows', 'marksHigh'];
  for (const key of Object.keys(OAK_SHAPE)) assert.equal(key in DEFAULT_SHAPES.hazel, !none.includes(key), key);
  assert.ok('stool' in DEFAULT_SHAPES.hazel);
  const sections = sectionsOf('hazel', DEFAULT_SHAPES.hazel);
  assert.ok(!sections.some((section) => section.title === OTHER), 'a setting with no section');
  assert.equal(ROWS.hazel.limbs.limbs, 'stems');
  assert.ok('stool' in ROWS.hazel.trunk && 'girth' in ROWS.hazel.limbs);
  assert.deepEqual(Object.keys(PANELS.hazel), ['outline', 'noise']);
  // (Its sliders are a shrub's: thinner stems, more of them, a younger age.)
  assert.ok(limitsFor('girth', DEFAULT_SHAPES.hazel.girth, 'hazel')[0] < 0.01 && limitsFor('limbs', DEFAULT_SHAPES.hazel.limbs, 'hazel')[1] > 12 && limitsFor('age', 25, 'hazel')[0] < 5);
  assert.ok(limitsFor('stool', DEFAULT_SHAPES.hazel.stool, 'hazel')[1] >= 1);
  assert.ok(SHAPE_TIPS.hazel.age.includes('hazel') && !SHAPE_TIPS.hazel.age.includes('oak') && SHAPE_TIPS.hazel.stool && SHAPE_TIPS.hazel.limbs.includes('stems'));
  const mix = defaultSettings().forest.mix.hazel;
  assert.deepEqual([mix.on, mix.mixed, mix.ages[0] < mix.ages[1]], [false, true, true]); // (off in the forest to start with; of several ages when on)
  // (A link made before there was a hazel opens with the hazel at its defaults.)
  const old = defaultSettings();
  delete old.shapes.hazel; delete old.forest.mix.hazel; delete old.colors.hazel;
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(old))).settings, defaultSettings());
});

test('it has no trunk: a low stool as wide as asked, and every stem leaves it', () => {
  for (const seed of SEEDS) {
    const { wood, oak } = layout(seed);
    const stool = wood.runs.find((run) => run.trunk);
    // (The stool: a stump lower than it is wide, as wide as "stool" says, and nothing carries it on.)
    assert.equal(wood.girth, DEFAULT_SHAPES.hazel.stool);
    assert.ok(stool.points.at(-1).p[1] < 0.2 && lengthOf(stool) < wood.girth, `seed ${seed}: a stool ${lengthOf(stool).toFixed(2)} m high`);
    assert.ok(wood.bare < 0.2);
    // (Its stems: as many as asked, each starting on the stool, inside its rim.)
    const stems = stemsOf(wood);
    const [least, most] = DEFAULT_SHAPES.hazel.limbs;
    assert.ok(stems.length >= least && stems.length <= most + 1, `seed ${seed}: ${stems.length} stems`);
    for (const stem of stems) {
      const [x, y, z] = stem.points[1].p;
      assert.ok(Math.hypot(x, z) < wood.girth && Math.hypot(x, z) > wood.girth * 0.3 && y < 0.2, `seed ${seed}: a stem starts ${Math.hypot(x, z).toFixed(2)} m from the stool's middle`);
    }
    // (And they stand round it, not in a bunch on one side.)
    const sides = new Set(stems.map((stem) => Math.floor(((Math.atan2(stem.points[1].p[2], stem.points[1].p[0]) + Math.PI) / (2 * Math.PI)) * 4) % 4));
    assert.ok(sides.size >= 3, `seed ${seed}: stems on ${sides.size} of its four sides`);
    // (The thickest stem is as thick as asked; the others thinner, none thicker.)
    const [thin, thick] = DEFAULT_SHAPES.hazel.girth;
    assert.ok(oak.stem >= thin && oak.stem <= thick);
    const radii = stems.map((stem) => stem.points[1].r);
    assert.ok(Math.max(...radii) < oak.stem * 1.6 && Math.min(...radii) < Math.max(...radii) * 0.9, `seed ${seed}: stems ${Math.min(...radii).toFixed(3)} to ${Math.max(...radii).toFixed(3)} m thick`);
    assert.equal(wood.burrs.length + wood.hollows.length, 0);
  }
});

test('its stems are slender, where an oak\'s wood of that length would be far thicker', () => {
  assert.ok(FRAMES.hazel.slender > 150 && OAK_FRAME.slender === undefined);
  for (const seed of SEEDS) {
    const tree = grown(seed);
    const stems = stemsOf(tree.layout.wood);
    const longest = stems.reduce((a, b) => (lengthOf(a) > lengthOf(b) ? a : b));
    assert.ok(lengthOf(longest) > tree.height * 0.6, `seed ${seed}: its longest stem ${lengthOf(longest).toFixed(1)} m of its ${tree.height.toFixed(1)} m`);
    assert.ok(longest.points[1].r < 0.07, `seed ${seed}: ${longest.points[1].r.toFixed(3)} m thick`);
    // (The same shrub in an oak's frame of slenderness: thicker stems.)
    const asOak = layoutOak(seed, presetShape('hazel', 'open-grown'), { ...FRAMES.hazel, slender: undefined });
    const thick = (wood) => stemsOf(wood).reduce((sum, stem) => sum + stem.points[1].r, 0);
    assert.ok(thick(asOak.wood) > thick(tree.layout.wood), `seed ${seed}`);
  }
});

test('a shrub: 4 to 7 m, about as wide as tall, and light', () => {
  for (const seed of SEEDS) {
    const tree = grown(seed);
    assert.ok(tree.height > 4 && tree.height < 7, `seed ${seed}: ${tree.height.toFixed(1)} m`);
    const { width } = tree.layout.oak;
    assert.ok(width > tree.height * 0.8 && width < tree.height * 1.2, `seed ${seed}: ${width.toFixed(1)} m wide`);
    const triangles = (tree.wood.attributes.position.count + tree.foliage.attributes.position.count) / 3;
    assert.ok(triangles < 7500, `seed ${seed}: ${triangles} triangles`);
  }
});

test('young, grown and long uncut, an age between them; and coppiced and forest-grown, which are no age', () => {
  assert.ok(hasAges('hazel'));
  assert.deepEqual(AGES.hazel.map((stage) => stage.preset), ['young', 'open-grown', 'old']);
  assert.equal(DEFAULT_SHAPES.hazel.age, AGES.hazel[1].age);
  for (const name of ['young', 'open-grown', 'coppiced', 'forest-grown', 'old']) assert.equal(presetOf('hazel', presetShape('hazel', name)), name);
  const mid = atAge('hazel', 12), young = presetShape('hazel', 'young'), open = presetShape('hazel', 'open-grown');
  assert.ok(mid.height[0] > young.height[0] && mid.height[1] < open.height[1] && mid.girth[0] > young.girth[0] && mid.girth[1] < open.girth[1] && mid.stool > young.stool && mid.stool < open.stool);
  for (const seed of SEEDS) {
    const [sapling, open, old, cut, wood] = ['young', 'open-grown', 'old', 'coppiced', 'forest-grown'].map((name) => grown(seed, name));
    const count = (tree) => stemsOf(tree.layout.wood).length;
    assert.ok(sapling.height < 3.5 && count(sapling) <= 6, `seed ${seed}: young, ${sapling.height.toFixed(1)} m, ${count(sapling)} stems`);
    // (Long uncut: taller, fewer and thicker stems, on a wider stool.)
    assert.ok(old.height > open.height * 1.2 && old.layout.oak.stem > open.layout.oak.stem * 1.6 && old.layout.wood.girth > open.layout.wood.girth, `seed ${seed}: old`);
    assert.ok(count(old) < count(open), `seed ${seed}: ${count(old)} stems old, ${count(open)} grown`);
    // (Coppiced: more rods than a grown hazel has stems, thinner, and a narrow sheaf.)
    assert.ok(count(cut) > count(open) && cut.layout.oak.stem < open.layout.oak.stem * 0.7 && cut.layout.oak.width < open.layout.oak.width * 0.6, `seed ${seed}: coppiced, ${count(cut)} rods, ${cut.layout.oak.width.toFixed(1)} m wide`);
    // (Under taller trees: taller, its leaves higher up.)
    assert.ok(wood.height > open.height && lowestLeaf(wood) > lowestLeaf(open) + 0.2, `seed ${seed}: forest-grown, its leaves from ${lowestLeaf(wood).toFixed(1)} m up (in the open from ${lowestLeaf(open).toFixed(1)} m)`);
  }
});

test('a kind without stems grows as it did: stems are the frame\'s to ask for', () => {
  for (const seed of SEEDS) {
    const oak = layoutOak(seed, OAK_SHAPE, OAK_FRAME);
    const trunk = oak.wood.runs.find((run) => run.trunk);
    assert.ok(lengthOf(trunk) > oak.wood.bare, `seed ${seed}: an oak's trunk runs on up`);
    assert.equal(oak.oak.stem, null);
  }
});

test('oak and underwood: tall oaks over hazel, hawthorn and a few hollies, in a morning sun', () => {
  const s = sceneSettings('oak and underwood');
  assert.equal(s.tab, 'forest');
  assert.deepEqual(KINDS.filter((k) => s.forest.mix[k].on), ['oak', 'hawthorn', 'hazel', 'holly']);
  for (const kind of ['oak', 'hawthorn', 'hazel', 'holly']) assert.equal(presetOf(kind, s.shapes[kind]), 'forest-grown', kind);
  assert.equal(s.view.stand, true);
  const { elevation } = sunAt(s.light.hour, s.light.from);
  assert.ok(s.light.hour < 12 && elevation > 20 && elevation < 40, `the sun ${elevation.toFixed(0)}° up at ${s.light.hour}`);
  const { records } = placeForest(s.forest, { heightAt: () => 0, slopeAt: () => 0, half: 150 });
  const count = (kind) => records.filter((r) => r.kind === kind).length;
  // (Oaks 35 to 70 to the hectare, and more underwood than oaks, hazel the most of it.)
  const hectares = (Math.PI * s.forest.radius ** 2) / 10000;
  assert.ok(count('oak') / hectares > 35 && count('oak') / hectares < 70, `${(count('oak') / hectares).toFixed(0)} oaks to the hectare`);
  assert.ok(count('hazel') + count('hawthorn') + count('holly') > count('oak') * 1.3 && count('hazel') > count('hawthorn') && count('hawthorn') > count('holly') && count('holly') > 3, `${count('oak')} oaks, ${count('hazel')} hazels, ${count('hawthorn')} hawthorns, ${count('holly')} hollies`);
  assert.equal(count('oak') + count('hazel') + count('hawthorn') + count('holly'), records.length);
  assert.equal(sceneOf(s), 'oak and underwood');
  assert.ok(Object.keys(SCENES).includes('oak and underwood'));
});

test('every stem is a rod of its own: none is left a stub at the stool', () => {
  // (Left to compete from the stool, the first stems up took every place to grow to and the rest stayed three steps
  // long: half the rods of a cut stool. Each stem now starts as a rod a third to over half the crown's height.)
  for (const preset of ['open-grown', 'coppiced', 'forest-grown', 'old', 'young']) {
    let short = 0, all = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { wood, oak } = layout(seed, preset);
      for (const stem of stemsOf(wood)) {
        all++;
        if (Math.max(...stem.points.map((point) => point.p[1])) < oak.height * 0.25) short++;
      }
    }
    assert.ok(short <= all * 0.05, `${preset}: ${short} of ${all} stems are under a quarter of the shrub's height`);
  }
  // (And its dead stubs are on its stems, never on the stool.)
  for (const seed of SEEDS) assert.ok(layout(seed, 'old').wood.stubs.every((stub) => stub.y === undefined), `seed ${seed}: a stub on the stool`);
});
