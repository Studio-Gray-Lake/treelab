import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGES, atAge, hasAges } from '../src/age.js';
import { DEFAULT_SHAPES, FRAMES, KINDS, KIND_CHOICES, growKind, isOwn, kindName, leafy, swayKind } from '../src/kinds.js';
import { limitsFor } from '../src/limits.js';
import { presetOf, presetShape } from '../src/presets.js';
import { OTHER, PANELS, ROWS, sectionsOf } from '../src/sections.js';
import { defaultSettings, normalize } from '../src/settings.js';
import { SHAPE_TIPS } from '../src/tips.js';
import { GREENS } from '../src/tree.js';
import { OAK_FRAME, OAK_SHAPE, layoutOak } from '../src/oak/oak.js';
import { agedBy } from '../src/oak/oakMesh.js';

// TreeLab's own hawthorn (src/oak/broadleaves.js): a small tree, grown by
// the oak's code, by its own settings and in its own frame.

const SEEDS = [3, 8, 11];
const grown = (seed, preset = 'open-grown') => growKind('hawthorn', seed, 0, presetShape('hawthorn', preset));
// A tree's leaves measured: their lowest point (m), and how far their middle lies from the trunk's foot, sideways (m).
const leaves = (tree) => {
  const p = tree.foliage.attributes.position;
  let low = Infinity, x = 0, z = 0;
  for (let i = 0; i < p.count; i++) { low = Math.min(low, p.getY(i)); x += p.getX(i); z += p.getZ(i); }
  return { low, off: Math.hypot(x / p.count, z / p.count) };
};
const triangles = (tree) => (tree.wood.attributes.position.count + tree.foliage.attributes.position.count) / 3;

test('the hawthorn is a kind of TreeLab\'s own: a broadleaf, with everything the oak has in its panel, and the wind', () => {
  assert.ok(KINDS.includes('hawthorn') && isOwn('hawthorn'));
  assert.equal(kindName('hawthorn'), 'hawthorn');
  assert.ok(leafy('hawthorn'), 'it has leaves: it turns in autumn');
  assert.equal(swayKind('hawthorn'), 'broadleaf');
  assert.ok(!FRAMES.hawthorn.needles && FRAMES.hawthorn.bark, 'leaves, and bark of its own');
  assert.equal(GREENS.hawthorn.length, 2);
  for (const key of Object.keys(OAK_SHAPE)) assert.ok(key in DEFAULT_SHAPES.hawthorn, key);
  assert.ok('swept' in DEFAULT_SHAPES.hawthorn && limitsFor('swept', DEFAULT_SHAPES.hawthorn.swept, 'hawthorn')[1] > 1);
  const sections = sectionsOf('hawthorn', DEFAULT_SHAPES.hawthorn);
  assert.ok(!sections.some((section) => section.title === OTHER), 'a setting with no section');
  assert.equal(Object.keys(ROWS.hawthorn.size)[0], 'age');
  assert.ok('swept' in ROWS.hawthorn.size);
  assert.deepEqual(Object.keys(PANELS.hawthorn), ['outline', 'noise']);
  assert.deepEqual(KIND_CHOICES.hawthorn, KIND_CHOICES.oak);
  assert.ok(SHAPE_TIPS.hawthorn.age.includes('hawthorn') && !SHAPE_TIPS.hawthorn.age.includes('oak'));
  assert.ok(SHAPE_TIPS.hawthorn.swept);
  // (Off in the forest to start, as TreeLab's other trees are.)
  const mix = defaultSettings().forest.mix.hawthorn;
  assert.deepEqual([mix.on, mix.mixed, mix.ages[0] < mix.ages[1]], [false, true, true]); // (off in the forest to start with; of several ages when on)
  // (A link made before there was a hawthorn opens with the hawthorn at its defaults.)
  const old = defaultSettings();
  delete old.shapes.hawthorn; delete old.forest.mix.hawthorn; delete old.colors.hawthorn;
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(old))).settings, defaultSettings());
});

test('it is a small tree: a grown one 6 to 9 m, about as wide as tall, on a short thin trunk', () => {
  for (const seed of SEEDS) {
    const tree = grown(seed), oak = growKind('oak', seed, 0);
    assert.ok(tree.height > 5.5 && tree.height < 9.5, `seed ${seed}: ${tree.height.toFixed(1)} m`);
    assert.ok(tree.height < oak.height * 0.5, `seed ${seed}: ${tree.height.toFixed(1)} m beside an oak's ${oak.height.toFixed(1)} m`);
    const { width } = tree.layout.oak;
    assert.ok(width > tree.height * 0.8 && width < tree.height * 1.15, `seed ${seed}: ${width.toFixed(1)} m wide, ${tree.height.toFixed(1)} m tall`);
    assert.ok(tree.layout.wood.girth < 0.2 && tree.layout.wood.bare < 2.2);
    // (Its leaves come down nearly to its first limbs: a dense crown, full underneath.)
    assert.ok(leaves(tree).low < tree.layout.wood.bare + 1.2, `seed ${seed}: its lowest leaves at ${leaves(tree).low.toFixed(1)} m`);
    // (No heavier than an oak, though it's drawn as finely.)
    assert.ok(triangles(tree) < 13000, `seed ${seed}: ${triangles(tree)} triangles`);
  }
});

test('it has a young, a grown and an old stage, and an age between them', () => {
  assert.ok(hasAges('hawthorn'));
  assert.deepEqual(AGES.hawthorn.map((stage) => stage.preset), ['young', 'open-grown', 'old']);
  assert.equal(DEFAULT_SHAPES.hawthorn.age, AGES.hawthorn[1].age);
  for (const name of ['young', 'open-grown', 'forest-grown', 'wind-swept', 'old']) assert.equal(presetOf('hawthorn', presetShape('hawthorn', name)), name);
  const mid = atAge('hawthorn', 30), young = presetShape('hawthorn', 'young'), open = presetShape('hawthorn', 'open-grown');
  assert.ok(mid.height[0] > young.height[0] && mid.height[1] < open.height[1] && mid.girth[0] > young.girth[0] && mid.girth[1] < open.girth[1]);
  for (const seed of SEEDS) {
    const [sapling, open, old] = ['young', 'open-grown', 'old'].map((name) => grown(seed, name));
    assert.ok(sapling.height < 4.5 && sapling.height < open.height * 0.6, `seed ${seed}: ${sapling.height.toFixed(1)} m young`);
    // (Old: hardly taller, far thicker, wider.)
    assert.ok(old.height < open.height * 1.35 && old.layout.wood.girth > open.layout.wood.girth * 1.4 && old.reach > open.reach, `seed ${seed}: old ${old.height.toFixed(1)} m, ${old.layout.wood.girth.toFixed(2)} m thick`);
    assert.ok(old.layout.wood.hollows.length + old.layout.wood.burrs.length > 0, `seed ${seed}: an old hawthorn's trunk is marked`);
  }
  assert.ok(!AGES.hawthorn.some((stage) => ['forest-grown', 'wind-swept'].includes(stage.preset)));
});

test('a hawthorn shows its age on far less wood than an oak: its frame says at what thickness', () => {
  assert.equal(OAK_FRAME.marked, undefined);
  assert.ok(FRAMES.hawthorn.marked < 0.3);
  assert.equal(agedBy(0.25, FRAMES.hawthorn.marked), 1);
  assert.ok(agedBy(0.25) < 0.3, 'an oak that thin is hardly marked');
  // (The same thin trunk, the same gnarl asked for: several times as fluted in the hawthorn's frame.)
  for (const seed of SEEDS) {
    const shape = presetShape('hawthorn', 'open-grown');
    const own = layoutOak(seed, shape, FRAMES.hawthorn), asOak = layoutOak(seed, shape, { ...FRAMES.hawthorn, marked: undefined });
    assert.equal(own.wood.girth, asOak.wood.girth);
    assert.ok(own.wood.gnarl > asOak.wood.gnarl * 2.5, `seed ${seed}: ${own.wood.gnarl.toFixed(2)} beside ${asOak.wood.gnarl.toFixed(2)}`);
  }
});

test('under taller trees it is thinner and narrower, its leaves at the top; in the wind it is low, its crown to one side', () => {
  for (const seed of SEEDS) {
    const open = grown(seed), wood = grown(seed, 'forest-grown'), wind = grown(seed, 'wind-swept');
    assert.ok(wood.layout.wood.girth < open.layout.wood.girth && wood.layout.oak.width < open.layout.oak.width, `seed ${seed}: under trees`);
    assert.ok(wood.layout.wood.bare > open.layout.wood.bare && leaves(wood).low > leaves(open).low, `seed ${seed}: its lowest leaves at ${leaves(wood).low.toFixed(1)} m (in the open ${leaves(open).low.toFixed(1)} m)`);
    assert.ok(wood.layout.clumps.length < open.layout.clumps.length, `seed ${seed}: an open crown`);
    assert.ok(wind.height < open.height * 0.85, `seed ${seed}: ${wind.height.toFixed(1)} m in the wind, ${open.height.toFixed(1)} m out of it`);
    assert.ok(leaves(wind).off > 1.5 && leaves(wind).off > leaves(open).off * 2, `seed ${seed}: its leaves ${leaves(wind).off.toFixed(1)} m to one side (out of the wind ${leaves(open).off.toFixed(1)} m)`);
  }
  // ("wind-swept" moves the crown, and leaves the trunk's thickness and bare length as they were.)
  const shape = presetShape('hawthorn', 'open-grown');
  const still = growKind('hawthorn', 5, 0, { ...shape, swept: 0 }), blown = growKind('hawthorn', 5, 0, { ...shape, swept: 1 });
  assert.deepEqual([blown.layout.wood.girth, blown.layout.wood.bare], [still.layout.wood.girth, still.layout.wood.bare]);
  assert.ok(leaves(blown).off > leaves(still).off + 1);
});
