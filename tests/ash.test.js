import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGES, atAge, hasAges } from '../src/age.js';
import { turns } from '../src/colors.js';
import { DEFAULT_SHAPES, FRAMES, KINDS, KIND_CHOICES, evergreen, growKind, isOwn, kindName, leafy, swayKind } from '../src/kinds.js';
import { limitsFor } from '../src/limits.js';
import { presetOf, presetShape } from '../src/presets.js';
import { OTHER, PANELS, ROWS, sectionsOf } from '../src/sections.js';
import { defaultSettings, normalize } from '../src/settings.js';
import { SHAPE_TIPS } from '../src/tips.js';
import { GREENS } from '../src/tree.js';
import { OAK_SHAPE } from '../src/oak/oak.js';

// TreeLab's own ash (src/oak/broadleaves.js): a tall tree with an open
// crown, grown by the oak's code, by its own settings and in its own frame.

const SEEDS = [3, 8, 11];
const grown = (kind, seed, preset = 'open-grown') => growKind(kind, seed, 0, presetShape(kind, preset));
// A tree measured: its wood's colour (how light, how much redder than blue), its clusters, and how much of its crown's outline its leaves fill.
const measured = (tree) => {
  const c = tree.wood.attributes.color;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < c.count; i++) { r += c.getX(i); g += c.getY(i); b += c.getZ(i); }
  const clumps = tree.layout.clumps;
  const mean = (of) => clumps.reduce((sum, k) => sum + of(k), 0) / clumps.length;
  // (The clusters' volumes together, over the volume of an egg as tall as the crown and as wide as the tree.)
  const { width, bare } = tree.layout.oak;
  const crown = (4 / 3) * Math.PI * (width / 2) ** 2 * ((tree.height - bare) / 2);
  const leaves = clumps.reduce((sum, k) => sum + (4 / 3) * Math.PI * k.radius ** 3 * k.squash, 0);
  return { light: (r + g + b) / 3 / c.count, warm: (r - b) / c.count, clumps: clumps.length, middle: mean((k) => k.center[1]), filled: leaves / crown };
};
const lowestLeaf = (tree) => {
  const p = tree.foliage.attributes.position;
  const heights = Array.from({ length: p.count }, (_, i) => p.getY(i)).sort((a, b) => a - b);
  return heights[Math.floor(heights.length / 20)];
};

test('the ash is a kind of TreeLab\'s own: a broadleaf that turns in autumn, with everything the oak has in its panel', () => {
  assert.ok(KINDS.includes('ash') && isOwn('ash'));
  assert.equal(kindName('ash'), 'ash');
  assert.ok(leafy('ash') && !evergreen('ash') && turns('ash', { amount: 1, evergreens: false }));
  assert.equal(swayKind('ash'), 'broadleaf');
  assert.ok(!FRAMES.ash.needles && !FRAMES.ash.stems && FRAMES.ash.bark);
  assert.equal(GREENS.ash.length, 2);
  for (const key of Object.keys(OAK_SHAPE)) assert.ok(key in DEFAULT_SHAPES.ash, key);
  assert.ok('tipRise' in DEFAULT_SHAPES.ash && limitsFor('tipRise', DEFAULT_SHAPES.ash.tipRise, 'ash')[0] < 0);
  const sections = sectionsOf('ash', DEFAULT_SHAPES.ash);
  assert.ok(!sections.some((section) => section.title === OTHER), 'a setting with no section');
  assert.equal(Object.keys(ROWS.ash.size)[0], 'age');
  assert.deepEqual(Object.keys(PANELS.ash), ['outline', 'noise']);
  assert.deepEqual(KIND_CHOICES.ash, KIND_CHOICES.oak);
  assert.ok(SHAPE_TIPS.ash.age.includes('ash') && !SHAPE_TIPS.ash.age.includes('oak') && SHAPE_TIPS.ash.tipRise.includes('ash'));
  const mix = defaultSettings().forest.mix.ash;
  assert.deepEqual([mix.on, mix.mixed, mix.ages[0] < mix.ages[1]], [false, true, true]); // (off in the forest to start with; of several ages when on)
  // (A link made before there was an ash opens with the ash at its defaults.)
  const old = defaultSettings();
  delete old.shapes.ash; delete old.forest.mix.ash; delete old.colors.ash;
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(old))).settings, defaultSettings());
});

test('beside an oak: taller and narrower, its bark pale grey, its limbs steeper, its crown as full but finer', () => {
  for (const seed of SEEDS) {
    const ash = grown('ash', seed), oak = growKind('oak', seed, 0);
    const a = measured(ash), o = measured(oak);
    assert.ok(ash.height > 21 && ash.height < 29 && ash.height > oak.height * 1.1, `seed ${seed}: ${ash.height.toFixed(1)} m beside ${oak.height.toFixed(1)} m`);
    const wide = (tree) => tree.layout.oak.width / tree.height;
    assert.ok(wide(ash) > 0.6 && wide(ash) < 0.85 && wide(ash) < wide(oak) * 0.8, `seed ${seed}: ${wide(ash).toFixed(2)} as wide as tall (the oak ${wide(oak).toFixed(2)})`);
    assert.ok(a.light > o.light * 1.15 && a.warm < o.warm * 0.5, `seed ${seed}: bark ${a.light.toFixed(2)} light, ${a.warm.toFixed(3)} warm (the oak's ${o.light.toFixed(2)}, ${o.warm.toFixed(3)})`);
    // (Grown in the open, its crown is about as full as an oak's (photos of grown ashes, 25 November 2026), and finer:
    // more clusters, and smaller ones.)
    assert.ok(a.filled > o.filled * 0.8 && a.filled < o.filled * 1.15, `seed ${seed}: its leaves fill ${(a.filled * 100).toFixed(0)}% of its crown (the oak's ${(o.filled * 100).toFixed(0)}%)`);
    const size = (tree) => tree.layout.clumps.reduce((sum, k) => sum + k.radius, 0) / tree.layout.clumps.length;
    assert.ok(size(ash) < size(oak) * 0.92, `seed ${seed}: its clusters ${size(ash).toFixed(2)} m across, the oak's ${size(oak).toFixed(2)} m`);
    const triangles = (ash.wood.attributes.position.count + ash.foliage.attributes.position.count) / 3;
    assert.ok(triangles < 15000, `seed ${seed}: ${triangles} triangles`);
  }
  const shape = DEFAULT_SHAPES.ash;
  assert.ok(shape.riseTop > OAK_SHAPE.riseTop + 15 && shape.riseBottom > OAK_SHAPE.riseBottom + 15 && shape.crooked < OAK_SHAPE.crooked && shape.tipRise > 0.4);
});

test('its limbs\' tips turn up: more of it, and its leaves stand higher', () => {
  for (const seed of SEEDS) {
    const shape = presetShape('ash', 'open-grown');
    const flat = growKind('ash', seed, 0, { ...shape, tipRise: 0 }), up = growKind('ash', seed, 0, shape);
    assert.ok(measured(up).middle > measured(flat).middle + 0.5, `seed ${seed}: its clusters at ${measured(up).middle.toFixed(1)} m, from ${measured(flat).middle.toFixed(1)} m with no upturn`);
    assert.deepEqual([up.layout.wood.girth, up.layout.wood.bare], [flat.layout.wood.girth, flat.layout.wood.bare]);
  }
});

test('it has a young, a grown and an old stage, an age between them, and a forest-grown shape that is no age', () => {
  assert.ok(hasAges('ash'));
  assert.deepEqual(AGES.ash.map((stage) => stage.preset), ['young', 'open-grown', 'old']);
  assert.equal(DEFAULT_SHAPES.ash.age, AGES.ash[1].age);
  for (const name of ['young', 'open-grown', 'forest-grown', 'old']) assert.equal(presetOf('ash', presetShape('ash', name)), name);
  const mid = atAge('ash', 45), young = presetShape('ash', 'young'), open = presetShape('ash', 'open-grown');
  assert.ok(mid.height[0] > young.height[0] && mid.height[1] < open.height[1] && mid.girth[0] > young.girth[0] && mid.girth[1] < open.girth[1]);
  for (const seed of SEEDS) {
    const [sapling, open, old, wood] = ['young', 'open-grown', 'old', 'forest-grown'].map((name) => grown('ash', seed, name));
    assert.ok(sapling.height < 10 && sapling.layout.oak.width < sapling.height * 0.6, `seed ${seed}: young, ${sapling.height.toFixed(1)} m, a pole`);
    // (Old: taller, far thicker, wider, marked.)
    assert.ok(old.height > open.height && old.layout.wood.girth > open.layout.wood.girth * 1.6 && old.reach > open.reach, `seed ${seed}: old`);
    assert.ok(old.layout.wood.stubs.length > open.layout.wood.stubs.length, `seed ${seed}: dead wood in an old ash`);
    // (In a wood: taller, half as wide and less, a clean pole for a third of its height and more, its leaves at the top.)
    assert.ok(wood.height > open.height && wood.layout.oak.width < open.layout.oak.width * 0.7, `seed ${seed}: forest-grown ${wood.height.toFixed(1)} m, ${wood.layout.oak.width.toFixed(1)} m wide`);
    assert.ok(wood.layout.wood.bare > wood.height * 0.35 && lowestLeaf(wood) > wood.height * 0.45, `seed ${seed}: bare for ${wood.layout.wood.bare.toFixed(1)} m, its leaves from ${lowestLeaf(wood).toFixed(1)} m up`);
  }
  assert.ok(!AGES.ash.some((stage) => stage.preset === 'forest-grown'));
});
