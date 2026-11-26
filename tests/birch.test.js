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
import { OAK_FRAME, OAK_SHAPE, buildOak } from '../src/oak/oak.js';

// TreeLab's own birch (src/oak/broadleaves.js): a slim white tree with a
// light, weeping crown, grown by the oak's code; its bark is drawn by its
// wood's thickness (src/oak/oakMesh.js).

const SEEDS = [3, 8, 11];
const grown = (seed, preset = 'open-grown') => growKind('birch', seed, 0, presetShape('birch', preset));
// A tree's wood, by how light each corner of it is (0 black to 1 white): the mean, and the shares lighter than 0.7 and darker than 0.3.
const bark = (tree) => {
  const c = tree.wood.attributes.color;
  let sum = 0, white = 0, dark = 0;
  for (let i = 0; i < c.count; i++) {
    const light = (c.getX(i) + c.getY(i) + c.getZ(i)) / 3;
    sum += light;
    if (light > 0.7) white++;
    if (light < 0.3) dark++;
  }
  return { mean: sum / c.count, white: white / c.count, dark: dark / c.count };
};
// How high the clusters at the crown's outside stand (m): those further than six tenths of its half width from the trunk.
const outside = (tree) => {
  const far = tree.layout.clumps.filter((k) => Math.hypot(k.center[0], k.center[2]) > tree.layout.oak.width * 0.3);
  return far.reduce((sum, k) => sum + k.center[1], 0) / far.length;
};
const triangles = (tree) => (tree.wood.attributes.position.count + tree.foliage.attributes.position.count) / 3;

test('the birch is a kind of TreeLab\'s own: a broadleaf that turns in autumn, with everything the oak has in its panel', () => {
  assert.ok(KINDS.includes('birch') && isOwn('birch'));
  assert.equal(kindName('birch'), 'birch');
  assert.ok(leafy('birch') && !evergreen('birch') && turns('birch', { amount: 1, evergreens: false }));
  assert.equal(swayKind('birch'), 'broadleaf');
  assert.equal(GREENS.birch.length, 2);
  for (const key of Object.keys(OAK_SHAPE)) assert.ok(key in DEFAULT_SHAPES.birch, key);
  assert.ok(limitsFor('tipRise', DEFAULT_SHAPES.birch.tipRise, 'birch')[0] < 0 && DEFAULT_SHAPES.birch.tipRise < 0, 'its tips hang');
  const sections = sectionsOf('birch', DEFAULT_SHAPES.birch);
  assert.ok(!sections.some((section) => section.title === OTHER), 'a setting with no section');
  assert.equal(Object.keys(ROWS.birch.size)[0], 'age');
  assert.deepEqual(Object.keys(PANELS.birch), ['outline', 'noise']);
  assert.deepEqual(KIND_CHOICES.birch, KIND_CHOICES.oak);
  assert.ok(SHAPE_TIPS.birch.age.includes('birch') && !SHAPE_TIPS.birch.age.includes('oak'));
  const mix = defaultSettings().forest.mix.birch;
  assert.deepEqual([mix.on, mix.mixed, mix.ages[0] < mix.ages[1]], [false, true, true]); // (off in the forest to start with; of several ages when on)
  const old = defaultSettings();
  delete old.shapes.birch; delete old.forest.mix.birch; delete old.colors.birch;
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(old))).settings, defaultSettings());
});

test('its bark: a white trunk with black marks, dark thin wood, and a sapling brown all over', () => {
  const own = FRAMES.birch.bark;
  assert.ok(own.thin.below > 0.02 && own.thin.below < 0.1 && own.marks.share > 0 && own.footRise);
  for (const seed of SEEDS) {
    const tree = grown(seed), oak = growKind('oak', seed, 0);
    const b = bark(tree), o = bark(oak);
    // (Mostly white, where an oak has no white wood at all; with dark wood too: its marks, its foot, its twigs.)
    // (A share of its wood's corners: most of them are on its many twigs, which are dark.)
    assert.ok(b.white > 0.08 && o.white === 0, `seed ${seed}: ${(b.white * 100).toFixed(0)}% of its wood white (the oak's ${(o.white * 100).toFixed(0)}%)`);
    assert.ok(b.dark > 0.2 && b.dark < 0.9, `seed ${seed}: ${(b.dark * 100).toFixed(0)}% of it dark`);
    // (A sapling's trunk is thinner than wood whitens at: brown.)
    const sapling = bark(grown(seed, 'young'));
    assert.ok(sapling.white < 0.05 && sapling.mean < 0.4, `seed ${seed}: a sapling ${sapling.mean.toFixed(2)} light, ${(sapling.white * 100).toFixed(0)}% white`);
    // (Without its marks: more white, the same wood otherwise.)
    const plain = buildOak(tree.layout.oak ? seed : seed, presetShape('birch', 'open-grown'), { ...FRAMES.birch, bark: { ...own, marks: null } });
    assert.ok(bark(plain).white >= b.white);
  }
  // (An oak's bark is drawn as it was: its frame says nothing of thin wood or marks.)
  assert.equal(OAK_FRAME.bark, null);
});

test('a slim tree with a light, weeping crown: 15 to 21 m, less than half as wide, its tips hanging', () => {
  for (const seed of SEEDS) {
    const tree = grown(seed), oak = growKind('oak', seed, 0);
    assert.ok(tree.height > 14.5 && tree.height < 21.5, `seed ${seed}: ${tree.height.toFixed(1)} m`);
    const { width } = tree.layout.oak;
    assert.ok(width > tree.height * 0.35 && width < tree.height * 0.6, `seed ${seed}: ${width.toFixed(1)} m wide, ${tree.height.toFixed(1)} m tall`);
    assert.ok(tree.layout.wood.girth < oak.layout.wood.girth * 0.45, `seed ${seed}: a thin trunk, ${tree.layout.wood.girth.toFixed(2)} m`);
    // (Tresses: its clusters taller than wide, smaller than an oak's.)
    const size = (t) => t.layout.clumps.reduce((sum, k) => sum + k.radius, 0) / t.layout.clumps.length;
    const squash = tree.layout.clumps.reduce((sum, k) => sum + k.squash, 0) / tree.layout.clumps.length;
    assert.ok(squash > 1.2 && size(tree) < size(oak) * 0.7, `seed ${seed}: clusters ${size(tree).toFixed(2)} m, ${squash.toFixed(2)} tall for their width`);
    // (Its tips turn down a little: with them level, its leaves stand a little higher. They were turned far further once, and the whole limb wept as a willow's does.)
    const level = growKind('birch', seed, 0, { ...presetShape('birch', 'open-grown'), tipRise: 0 });
    assert.ok(outside(tree) < outside(level) - 0.15 && outside(tree) > outside(level) - 1.5, `seed ${seed}: its outer clusters at ${outside(tree).toFixed(1)} m, at ${outside(level).toFixed(1)} m with level tips`);
    assert.ok(triangles(tree) < 11000, `seed ${seed}: ${triangles(tree)} triangles`);
  }
});

test('it has a young, a grown and an old stage, an age between them, and a forest-grown shape that is no age', () => {
  assert.ok(hasAges('birch'));
  assert.deepEqual(AGES.birch.map((stage) => stage.preset), ['young', 'open-grown', 'old']);
  assert.equal(DEFAULT_SHAPES.birch.age, AGES.birch[1].age);
  for (const name of ['young', 'open-grown', 'forest-grown', 'old']) assert.equal(presetOf('birch', presetShape('birch', name)), name);
  const mid = atAge('birch', 20), young = presetShape('birch', 'young'), open = presetShape('birch', 'open-grown');
  assert.ok(mid.height[0] > young.height[0] && mid.height[1] < open.height[1] && mid.girth[0] > young.girth[0] && mid.girth[1] < open.girth[1]);
  for (const seed of SEEDS) {
    const [sapling, open, old, wood] = ['young', 'open-grown', 'old', 'forest-grown'].map((name) => grown(seed, name));
    assert.ok(sapling.height < 7, `seed ${seed}: young, ${sapling.height.toFixed(1)} m`);
    // (Old: taller, twice as thick, its foot black further up: more dark wood low down.)
    assert.ok(old.height > open.height && old.layout.wood.girth > open.layout.wood.girth * 1.7, `seed ${seed}: old`);
    assert.ok(triangles(old) < 17000, `seed ${seed}: an old one ${triangles(old)} triangles`);
    // (In a wood: taller, narrower, a bare pole for a third of its height and more.)
    assert.ok(wood.height > open.height && wood.layout.oak.width < open.layout.oak.width * 0.8 && wood.layout.wood.bare > wood.height * 0.3, `seed ${seed}: forest-grown ${wood.height.toFixed(1)} m, ${wood.layout.oak.width.toFixed(1)} m wide, bare for ${wood.layout.wood.bare.toFixed(1)} m`);
  }
  assert.ok(!AGES.birch.some((stage) => stage.preset === 'forest-grown'));
});
