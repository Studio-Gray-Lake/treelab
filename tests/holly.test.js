import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGES, atAge, hasAges } from '../src/age.js';
import { foliageColor, mottleOf, turns } from '../src/colors.js';
import { DEFAULT_SHAPES, FRAMES, KINDS, KIND_CHOICES, evergreen, growKind, isOwn, kindName, leafy, swayKind } from '../src/kinds.js';
import { limitsFor } from '../src/limits.js';
import { presetOf, presetShape } from '../src/presets.js';
import { OTHER, PANELS, ROWS, sectionsOf } from '../src/sections.js';
import { defaultSettings, normalize } from '../src/settings.js';
import { SHAPE_TIPS } from '../src/tips.js';
import { GREENS, greenOf } from '../src/tree.js';
import { OAK_SHAPE } from '../src/oak/oak.js';

// TreeLab's own holly (src/oak/broadleaves.js): a small evergreen tree,
// grown by the oak's code, by its own settings and in its own frame.

const SEEDS = [3, 8, 11];
const grown = (seed, preset = 'open-grown') => growKind('holly', seed, 0, presetShape('holly', preset));
// How high its leaves begin (the height a twentieth of them lie under, m), and how wide they are at a share of the way up it (m).
const leaves = (tree) => {
  const p = tree.foliage.attributes.position;
  const points = Array.from({ length: p.count }, (_, i) => [p.getX(i), p.getY(i), p.getZ(i)]).sort((a, b) => a[1] - b[1]);
  const from = points[Math.floor(points.length / 20)][1];
  const wideAt = (share) => {
    const band = points.filter(([, y]) => Math.abs(y - tree.height * share) < tree.height * 0.08);
    return band.length ? Math.max(...band.map(([x, , z]) => Math.hypot(x, z))) * 2 : 0;
  };
  return { from, wideAt };
};
const triangles = (tree) => (tree.wood.attributes.position.count + tree.foliage.attributes.position.count) / 3;

test('the holly is a kind of TreeLab\'s own: a broadleaf, with everything the oak has in its panel', () => {
  assert.ok(KINDS.includes('holly') && isOwn('holly'));
  assert.equal(kindName('holly'), 'holly');
  assert.ok(leafy('holly'), 'it has leaves, not needles');
  assert.equal(swayKind('holly'), 'broadleaf');
  assert.ok(!FRAMES.holly.needles && FRAMES.holly.evergreen && FRAMES.holly.bark);
  assert.equal(GREENS.holly.length, 2);
  for (const key of Object.keys(OAK_SHAPE)) assert.ok(key in DEFAULT_SHAPES.holly, key);
  assert.ok('tipRise' in DEFAULT_SHAPES.holly && limitsFor('tipRise', DEFAULT_SHAPES.holly.tipRise, 'holly')[0] < 0);
  const sections = sectionsOf('holly', DEFAULT_SHAPES.holly);
  assert.ok(!sections.some((section) => section.title === OTHER), 'a setting with no section');
  assert.equal(Object.keys(ROWS.holly.size)[0], 'age');
  assert.deepEqual(Object.keys(PANELS.holly), ['outline', 'noise']);
  assert.deepEqual(KIND_CHOICES.holly, KIND_CHOICES.oak);
  assert.ok(SHAPE_TIPS.holly.age.includes('holly') && !SHAPE_TIPS.holly.age.includes('oak'));
  const mix = defaultSettings().forest.mix.holly;
  assert.deepEqual([mix.on, mix.mixed, mix.ages[0] < mix.ages[1]], [false, true, true]); // (off in the forest to start with; of several ages when on)
  // (A link made before there was a holly opens with the holly at its defaults.)
  const old = defaultSettings();
  delete old.shapes.holly; delete old.forest.mix.holly; delete old.colors.holly;
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(old))).settings, defaultSettings());
});

test('it is evergreen: a tree with leaves that never turns in autumn, whatever is asked of the needles', () => {
  assert.ok(evergreen('holly'));
  // (Every kind with needles is evergreen; the other kinds with leaves are not.)
  for (const kind of KINDS) assert.equal(evergreen(kind), !leafy(kind) || kind === 'holly', kind);
  const colors = defaultSettings().colors;
  for (const evergreens of [false, true]) {
    const autumn = { amount: 1, palette: 'mixed', spread: 0, evergreens };
    assert.ok(!turns('holly', autumn) && mottleOf('holly', autumn) === 0);
    assert.ok(turns('oak', autumn) && turns('hazel', autumn));
    // (Still dark green: only a little duller, as a fir that doesn't turn is.)
    const record = { kind: 'holly', x: 4, z: -7, tint: 0.5 };
    const green = greenOf(record), now = foliageColor(record, colors, autumn);
    assert.ok(now.g > now.r && Math.abs(now.g - green.g) < 0.08, `green ${green.getHexString()}, in autumn ${now.getHexString()}`);
    const oak = foliageColor({ kind: 'oak', x: 4, z: -7, tint: 0.5 }, colors, autumn);
    assert.ok(oak.r > oak.g, 'an oak beside it has turned');
  }
  // (And darker than an oak's leaves.)
  const dark = (kind) => greenOf({ kind, tint: 0.5 }).getHSL({}).l;
  assert.ok(dark('holly') < dark('oak') * 0.8);
});

test('a small dense pyramid: 8 to 12 m, half as wide as tall, leafy nearly to the ground, widest low down', () => {
  for (const seed of SEEDS) {
    const tree = grown(seed), oak = growKind('oak', seed, 0);
    assert.ok(tree.height > 7.5 && tree.height < 12.5, `seed ${seed}: ${tree.height.toFixed(1)} m`);
    assert.ok(tree.height < oak.height * 0.7);
    const { width } = tree.layout.oak;
    assert.ok(width > tree.height * 0.4 && width < tree.height * 0.65, `seed ${seed}: ${width.toFixed(1)} m wide, ${tree.height.toFixed(1)} m tall`);
    const { from, wideAt } = leaves(tree);
    assert.ok(from < 2.2, `seed ${seed}: its leaves from ${from.toFixed(1)} m up`);
    assert.ok(wideAt(0.3) > wideAt(0.8) * 1.3, `seed ${seed}: ${wideAt(0.3).toFixed(1)} m wide low down, ${wideAt(0.8).toFixed(1)} m near the top`);
    // (Its trunk carries on up through its crown, where an oak's gives way a third of the way up.)
    const limbs = tree.layout.oak.limbStarts;
    assert.ok(Math.max(...limbs) > tree.height * 0.5, `seed ${seed}: its highest limb leaves the trunk at ${Math.max(...limbs).toFixed(1)} m`);
    assert.ok(triangles(tree) < 12500, `seed ${seed}: ${triangles(tree)} triangles`);
  }
  const shape = DEFAULT_SHAPES.holly;
  assert.ok(shape.gnarl < OAK_SHAPE.gnarl / 2 && shape.burrs === 0 && shape.bends < OAK_SHAPE.bends, 'a smooth, straight trunk');
});

test('it has a young, a grown and an old stage, an age between them, and a forest-grown shape that is no age', () => {
  assert.ok(hasAges('holly'));
  assert.deepEqual(AGES.holly.map((stage) => stage.preset), ['young', 'open-grown', 'old']);
  assert.equal(DEFAULT_SHAPES.holly.age, AGES.holly[1].age);
  for (const name of ['young', 'open-grown', 'forest-grown', 'old']) assert.equal(presetOf('holly', presetShape('holly', name)), name);
  const mid = atAge('holly', 30), young = presetShape('holly', 'young'), open = presetShape('holly', 'open-grown');
  assert.ok(mid.height[0] > young.height[0] && mid.height[1] < open.height[1] && mid.girth[0] > young.girth[0] && mid.girth[1] < open.girth[1]);
  for (const seed of SEEDS) {
    const [sapling, open, old, wood] = ['young', 'open-grown', 'old', 'forest-grown'].map((name) => grown(seed, name));
    assert.ok(sapling.height < 4 && leaves(sapling).from < 1, `seed ${seed}: young, ${sapling.height.toFixed(1)} m, leafy from ${leaves(sapling).from.toFixed(1)} m`);
    // (Old: taller, far thicker, its trunk clear further up.)
    assert.ok(old.height > open.height * 1.2 && old.layout.wood.girth > open.layout.wood.girth * 1.6 && old.layout.wood.bare > open.layout.wood.bare, `seed ${seed}: old`);
    // (19,500, where it was 17,000 as cushions: its tiers are flat and wide, which is more surface, about a twelfth more.)
    assert.ok(triangles(old) < 19500, `seed ${seed}: an old one ${triangles(old)} triangles`);
    // (Under taller trees: thinner, with fewer clusters: an open crown.)
    assert.ok(wood.layout.wood.girth < open.layout.wood.girth * 0.75 && wood.layout.clumps.length < open.layout.clumps.length, `seed ${seed}: forest-grown`);
  }
  assert.ok(!AGES.holly.some((stage) => stage.preset === 'forest-grown'));
});
