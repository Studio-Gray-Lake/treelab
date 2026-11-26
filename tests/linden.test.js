import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGES, atAge, hasAges } from '../src/age.js';
import { turns } from '../src/colors.js';
import { DEFAULT_SHAPES, FRAMES, KINDS, KIND_CHOICES, evergreen, growKind, isOwn, kindName, leafTiming, leafy, swayKind } from '../src/kinds.js';
import { limitsFor } from '../src/limits.js';
import { presetOf, presetShape } from '../src/presets.js';
import { leavesOf } from '../src/season.js';
import { OTHER, PANELS, ROWS, sectionsOf } from '../src/sections.js';
import { defaultSettings, normalize } from '../src/settings.js';
import { siteOf } from '../src/site.js';
import { SHAPE_TIPS, TIPS } from '../src/tips.js';
import { GREENS } from '../src/tree.js';
import { OAK_SHAPE } from '../src/oak/oak.js';

// TreeLab's own linden (src/oak/broadleaves.js): a tall tree with a dense,
// egg-shaped crown, grown by the oak's code, by its own settings and in its
// own frame. (The small-leaved linden; "lime" in England, a name TreeLab
// doesn't use: it isn't the fruit.)

const SEEDS = [3, 8, 11];
const grown = (kind, seed, preset = 'open-grown') => growKind(kind, seed, 0, presetShape(kind, preset));
// How much of its crown's outline its leaves fill: the clusters' volumes together, over an egg as tall as the crown and as wide as the tree.
const filled = (tree) => {
  const { width, bare } = tree.layout.oak;
  const crown = (4 / 3) * Math.PI * (width / 2) ** 2 * ((tree.height - bare) / 2);
  return tree.layout.clumps.reduce((sum, k) => sum + (4 / 3) * Math.PI * k.radius ** 3 * k.squash, 0) / crown;
};
const lowestLeaf = (tree) => {
  const p = tree.foliage.attributes.position;
  const heights = Array.from({ length: p.count }, (_, i) => p.getY(i)).sort((a, b) => a - b);
  return heights[Math.floor(heights.length / 20)];
};
const triangles = (tree) => (tree.wood.attributes.position.count + tree.foliage.attributes.position.count) / 3;

test('the linden is a kind of TreeLab\'s own, called a linden and never a lime', () => {
  assert.ok(KINDS.includes('linden') && isOwn('linden') && !KINDS.includes('lime'));
  assert.equal(kindName('linden'), 'linden');
  assert.ok(leafy('linden') && !evergreen('linden') && turns('linden', { amount: 1, evergreens: false }));
  assert.equal(swayKind('linden'), 'broadleaf');
  assert.ok(!FRAMES.linden.needles && !FRAMES.linden.stems && FRAMES.linden.bark);
  assert.equal(GREENS.linden.length, 2);
  for (const key of Object.keys(OAK_SHAPE)) assert.ok(key in DEFAULT_SHAPES.linden, key);
  assert.ok('tipRise' in DEFAULT_SHAPES.linden && limitsFor('tipRise', DEFAULT_SHAPES.linden.tipRise, 'linden')[0] < 0);
  const sections = sectionsOf('linden', DEFAULT_SHAPES.linden);
  assert.ok(!sections.some((section) => section.title === OTHER), 'a setting with no section');
  assert.equal(Object.keys(ROWS.linden.size)[0], 'age');
  assert.deepEqual(Object.keys(PANELS.linden), ['outline', 'noise']);
  assert.deepEqual(KIND_CHOICES.linden, KIND_CHOICES.oak);
  assert.ok(SHAPE_TIPS.linden.age.includes('linden') && !SHAPE_TIPS.linden.age.includes('oak'));
  // (No tooltip says "lime": the word reads as the fruit.)
  for (const text of [...Object.values(TIPS), ...Object.values(SHAPE_TIPS.linden)]) assert.ok(!/\blimes?\b/i.test(text), text);
  const mix = defaultSettings().forest.mix.linden;
  assert.deepEqual([mix.on, mix.mixed, mix.ages[0] < mix.ages[1]], [false, true, true]); // (off in the forest to start with; of several ages when on)
  const old = defaultSettings();
  delete old.shapes.linden; delete old.forest.mix.linden; delete old.colors.linden;
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(old))).settings, defaultSettings());
});

test('beside an oak: taller and narrower, an egg of a crown, denser, on a straighter trunk that carries on further up', () => {
  for (const seed of SEEDS) {
    const linden = grown('linden', seed), oak = growKind('oak', seed, 0);
    assert.ok(linden.height > 21 && linden.height < 29 && linden.height > oak.height * 1.1, `seed ${seed}: ${linden.height.toFixed(1)} m beside ${oak.height.toFixed(1)} m`);
    const wide = (tree) => tree.layout.oak.width / tree.height;
    assert.ok(wide(linden) > 0.5 && wide(linden) < 0.75 && wide(linden) < wide(oak) * 0.7, `seed ${seed}: ${wide(linden).toFixed(2)} as wide as tall (the oak ${wide(oak).toFixed(2)})`);
    assert.ok(filled(linden) > filled(oak) * 1.1, `seed ${seed}: its leaves fill ${(filled(linden) * 100).toFixed(0)}% of its crown (the oak's ${(filled(oak) * 100).toFixed(0)}%)`);
    assert.ok(Math.max(...linden.layout.oak.limbStarts) > Math.max(...oak.layout.oak.limbStarts) + 2, `seed ${seed}: its highest limb leaves the trunk at ${Math.max(...linden.layout.oak.limbStarts).toFixed(1)} m`);
    assert.ok(triangles(linden) < 17000, `seed ${seed}: ${triangles(linden)} triangles`);
  }
  const shape = DEFAULT_SHAPES.linden;
  assert.ok(shape.bends < OAK_SHAPE.bends && shape.crooked < OAK_SHAPE.crooked && shape.leafiness > OAK_SHAPE.leafiness && shape.burrs > OAK_SHAPE.burrs && shape.tipRise > 0);
});

test('it has a young, a grown and an old stage, an age between them, and a forest-grown shape that is no age', () => {
  assert.ok(hasAges('linden'));
  assert.deepEqual(AGES.linden.map((stage) => stage.preset), ['young', 'open-grown', 'old']);
  assert.equal(DEFAULT_SHAPES.linden.age, AGES.linden[1].age);
  for (const name of ['young', 'open-grown', 'forest-grown', 'old']) assert.equal(presetOf('linden', presetShape('linden', name)), name);
  const mid = atAge('linden', 60), young = presetShape('linden', 'young'), open = presetShape('linden', 'open-grown');
  assert.ok(mid.height[0] > young.height[0] && mid.height[1] < open.height[1] && mid.girth[0] > young.girth[0] && mid.girth[1] < open.girth[1]);
  for (const seed of SEEDS) {
    const [sapling, open, old, wood] = ['young', 'open-grown', 'old', 'forest-grown'].map((name) => grown('linden', seed, name));
    assert.ok(sapling.height < 11, `seed ${seed}: young, ${sapling.height.toFixed(1)} m`);
    // (Old: taller, twice as thick, wider, its trunk burry and hollow.)
    assert.ok(old.height > open.height && old.layout.wood.girth > open.layout.wood.girth * 1.8 && old.reach > open.reach, `seed ${seed}: old`);
    assert.ok(old.layout.wood.burrs.length > open.layout.wood.burrs.length && old.layout.wood.hollows.length > 0, `seed ${seed}: ${old.layout.wood.burrs.length} burrs, ${old.layout.wood.hollows.length} hollows`);
    assert.ok(triangles(old) < 30000, `seed ${seed}: an old one ${triangles(old)} triangles`);
    // (In a wood: taller, half as wide and less, a clean trunk for a third of its height and more, its leaves at the top.)
    assert.ok(wood.height > open.height && wood.layout.oak.width < open.layout.oak.width * 0.7, `seed ${seed}: forest-grown ${wood.height.toFixed(1)} m, ${wood.layout.oak.width.toFixed(1)} m wide`);
    assert.ok(wood.layout.wood.bare > wood.height * 0.35 && lowestLeaf(wood) > wood.height * 0.45, `seed ${seed}: bare for ${wood.layout.wood.bare.toFixed(1)} m, its leaves from ${lowestLeaf(wood).toFixed(1)} m up`);
  }
  assert.ok(!AGES.linden.some((stage) => stage.preset === 'forest-grown'));
});

test('its time of year and its place: in leaf after the birch and before the oak, bare before the oak; it bears shade, and keeps off the highest ground', () => {
  const coming = (kind) => leavesOf(leafTiming(kind), { leaves: 0.3 }, { amount: 0 });
  const going = (kind) => leavesOf(leafTiming(kind), { leaves: 0.3 }, { amount: 1 });
  assert.ok(coming('linden') < coming('birch') && coming('linden') > coming('oak'));
  assert.ok(going('linden') < going('oak') && going('linden') > going('ash'));
  const site = siteOf('linden');
  assert.ok(site.shade > siteOf('oak').shade && site.shade < siteOf('holly').shade && site.ground[0] === 0 && site.ground[1] < 1);
});
