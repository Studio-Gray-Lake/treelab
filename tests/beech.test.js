import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AGES, atAge, hasAges } from '../src/age.js';
import { PALETTES, foliageColor } from '../src/colors.js';
import { placeForest } from '../src/forest.js';
import { DEFAULT_SHAPES, FRAMES, KINDS, KIND_CHOICES, growKind, isOwn, kindName, leafy, swayKind } from '../src/kinds.js';
import { limitsFor } from '../src/limits.js';
import { sunAt } from '../src/light.js';
import { presetOf, presetShape } from '../src/presets.js';
import { OTHER, PANELS, ROWS, sectionsOf } from '../src/sections.js';
import { SCENES, sceneOf, sceneSettings } from '../src/scenes.js';
import { CHOICES, defaultSettings, normalize } from '../src/settings.js';
import { SHAPE_TIPS } from '../src/tips.js';
import { GREENS } from '../src/tree.js';
import { OAK_SHAPE } from '../src/oak/oak.js';

// TreeLab's own beech (src/oak/broadleaves.js): grown by the oak's code, by
// its own settings and in its own frame.

const SEEDS = [3, 8, 11];
const grown = (kind, seed, preset = 'open-grown') => growKind(kind, seed, 0, presetShape(kind, preset));
// A tree measured: its lowest leaves (m), its wood's colour (how light, and how much redder than blue), its clusters.
const measured = (tree) => {
  const p = tree.foliage.attributes.position, c = tree.wood.attributes.color;
  let low = Infinity;
  for (let i = 0; i < p.count; i++) low = Math.min(low, p.getY(i));
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < c.count; i++) { r += c.getX(i); g += c.getY(i); b += c.getZ(i); }
  const clumps = tree.layout.clumps;
  const mean = (of) => clumps.reduce((sum, k) => sum + of(k), 0) / clumps.length;
  return { low, light: (r + g + b) / 3 / c.count, warm: (r - b) / c.count, clumps: clumps.length, squash: mean((k) => k.squash), middle: mean((k) => k.center[1]) };
};

test('the beech is a kind of TreeLab\'s own: a broadleaf, with everything the oak has in its panel', () => {
  assert.ok(KINDS.includes('beech') && isOwn('beech'));
  assert.equal(kindName('beech'), 'beech');
  assert.ok(leafy('beech'), 'it has leaves: it turns in autumn');
  assert.equal(swayKind('beech'), 'broadleaf');
  assert.ok(!FRAMES.beech.needles && FRAMES.beech.bark, 'leaves, and bark of its own');
  assert.equal(GREENS.beech.length, 2);
  // (Every setting the oak has, and its limbs' tips; each in a section, its age first, with the oak's two folded panels.)
  for (const key of Object.keys(OAK_SHAPE)) assert.ok(key in DEFAULT_SHAPES.beech, key);
  assert.ok('tipRise' in DEFAULT_SHAPES.beech && limitsFor('tipRise', DEFAULT_SHAPES.beech.tipRise, 'beech')[0] < 0);
  const sections = sectionsOf('beech', DEFAULT_SHAPES.beech);
  assert.ok(!sections.some((section) => section.title === OTHER), 'a setting with no section');
  assert.equal(Object.keys(ROWS.beech.size)[0], 'age');
  assert.deepEqual(Object.keys(PANELS.beech), ['outline', 'noise']);
  assert.deepEqual(KIND_CHOICES.beech, KIND_CHOICES.oak);
  // (Its tooltips are a beech's where a beech differs, and never speak of an oak's age.)
  assert.ok(SHAPE_TIPS.beech.age.includes('beech') && !SHAPE_TIPS.beech.age.includes('oak'));
  assert.ok(SHAPE_TIPS.beech.tipRise);
  // (Off in the forest to start, as the oak is: at its real size it would crowd it.)
  const mix = defaultSettings().forest.mix.beech;
  assert.deepEqual([mix.on, mix.mixed, mix.ages[0] < mix.ages[1]], [false, true, true]); // (off in the forest to start with; of several ages when on)
  // (A link made before there was a beech opens with the beech at its defaults.)
  const old = defaultSettings();
  delete old.shapes.beech; delete old.forest.mix.beech; delete old.colors.beech;
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(old))).settings, defaultSettings());
});

test('it has a young, a grown and an old stage, an age between them, and a forest-grown shape that is no age', () => {
  assert.ok(hasAges('beech'));
  assert.deepEqual(AGES.beech.map((stage) => stage.preset), ['young', 'open-grown', 'old']);
  assert.equal(DEFAULT_SHAPES.beech.age, AGES.beech[1].age);
  for (const name of ['young', 'open-grown', 'forest-grown', 'old']) assert.equal(presetOf('beech', presetShape('beech', name)), name);
  // (Between two stages, between their settings.)
  const mid = atAge('beech', 60), young = presetShape('beech', 'young'), open = presetShape('beech', 'open-grown');
  assert.ok(mid.height[0] > young.height[0] && mid.height[1] < open.height[1] && mid.girth[0] > young.girth[0] && mid.girth[1] < open.girth[1]);
  for (const seed of SEEDS) {
    const [sapling, open, old, wood] = ['young', 'open-grown', 'old', 'forest-grown'].map((name) => grown('beech', seed, name));
    assert.ok(sapling.height < 10 && open.height > 23 && open.height < 32, `seed ${seed}: ${sapling.height.toFixed(1)} m young, ${open.height.toFixed(1)} m grown`);
    // (Old: thicker far more than taller, wider, its lowest leaves nearer the ground.)
    assert.ok(old.layout.wood.girth > open.layout.wood.girth * 1.5 && old.height < open.height * 1.3 && old.reach > open.reach);
    assert.ok(measured(old).low < measured(open).low, `seed ${seed}: an old beech's low limbs hang lower`);
    // (In a wood: taller, a third as wide, a clean trunk for half its height and more, its leaves all at the top.)
    assert.ok(wood.height > open.height && wood.reach < open.reach * 0.65, `seed ${seed}: ${wood.height.toFixed(1)} m tall, reaching ${wood.reach.toFixed(1)} m`);
    assert.ok(wood.layout.wood.bare > wood.height * 0.4 && measured(wood).low > wood.height * 0.45, `seed ${seed}: bare for ${wood.layout.wood.bare.toFixed(1)} m, its lowest leaves at ${measured(wood).low.toFixed(1)} m`);
  }
  assert.ok(!AGES.beech.some((stage) => stage.preset === 'forest-grown'));
});

test('beside an oak: taller, its bark pale and grey, its leaves in more and flatter clusters that come lower', () => {
  for (const seed of SEEDS) {
    const beech = grown('beech', seed), oak = growKind('oak', seed, 0);
    const b = measured(beech), o = measured(oak);
    assert.ok(beech.height > oak.height * 1.2, `seed ${seed}: ${beech.height.toFixed(1)} m beside ${oak.height.toFixed(1)} m`);
    assert.ok(b.light > o.light * 1.25 && b.warm < o.warm * 0.3, `seed ${seed}: bark ${b.light.toFixed(2)} light, ${b.warm.toFixed(3)} warm (the oak's ${o.light.toFixed(2)}, ${o.warm.toFixed(3)})`);
    assert.ok(b.clumps > o.clumps && b.squash < o.squash * 0.9, `seed ${seed}: ${b.clumps} clusters ${b.squash.toFixed(2)} flat (the oak's ${o.clumps}, ${o.squash.toFixed(2)})`);
    assert.ok(b.low < o.low, `seed ${seed}: its lowest leaves at ${b.low.toFixed(1)} m (the oak's ${o.low.toFixed(1)} m)`);
    // (No heavier than a tree half again its size should be.)
    const triangles = (beech.wood.attributes.position.count + beech.foliage.attributes.position.count) / 3;
    assert.ok(triangles < 26000, `seed ${seed}: ${triangles} triangles`);
  }
  // (Smooth: hardly a lump, no burrs, no stubs, where an oak has all three.)
  const shape = DEFAULT_SHAPES.beech;
  assert.ok(shape.gnarl < OAK_SHAPE.gnarl / 3 && shape.burrs === 0 && shape.stubs === 0 && shape.crooked < OAK_SHAPE.crooked);
});

test('"tips turn up" lifts the ends of its limbs, and leaves its trunk as it was', () => {
  for (const seed of SEEDS) {
    const shape = presetShape('beech', 'open-grown');
    const flat = growKind('beech', seed, 0, { ...shape, tipRise: 0 }), up = growKind('beech', seed, 0, { ...shape, tipRise: 0.8 });
    assert.ok(measured(up).middle > measured(flat).middle + 1, `seed ${seed}: its clusters at ${measured(up).middle.toFixed(1)} m, from ${measured(flat).middle.toFixed(1)} m`);
    assert.deepEqual([up.layout.wood.girth, up.layout.wood.bare, up.layout.wood.height], [flat.layout.wood.girth, flat.layout.wood.bare, flat.layout.wood.height]);
  }
});

test('the beech wood: forest-grown beeches in autumn, copper, in a morning sun', () => {
  const s = sceneSettings('beech wood');
  assert.equal(s.tab, 'forest');
  assert.deepEqual(KINDS.filter((k) => s.forest.mix[k].on), ['beech']);
  assert.equal(presetOf('beech', s.shapes.beech), 'forest-grown');
  assert.equal(s.view.stand, true);
  assert.deepEqual([s.autumn.palette, s.autumn.amount > 0.7], ['beech', true]);
  const { elevation } = sunAt(s.light.hour, s.light.from);
  assert.ok(s.light.hour < 12 && elevation > 20 && elevation < 40, `the sun ${elevation.toFixed(0)}° up at ${s.light.hour}`);
  assert.deepEqual([s.light.shafts, s.light.shade, s.light.eye], [1, 1, 1]);
  const { records } = placeForest(s.forest, { heightAt: () => 0, slopeAt: () => 0, half: 150 });
  assert.ok(records.length > 70 && records.length < 140, `${records.length} trees`);
  assert.ok(records.every((r) => r.kind === 'beech'));
  assert.equal(sceneOf(s), 'beech wood');
  assert.ok(Object.keys(SCENES).includes('beech wood'));
});

test('autumn can be a beech wood\'s copper, and the mixed colours are the ones they were', () => {
  assert.ok(CHOICES['autumn.palette'].includes('beech'));
  assert.deepEqual(PALETTES.mixed, [...PALETTES.maple, ...PALETTES.birch, ...PALETTES.oak]);
  const copper = PALETTES.beech.map((c) => new THREE.Color(c).getHexString());
  const colors = defaultSettings().colors;
  const autumn = { amount: 1, palette: 'beech', spread: 0, evergreens: false };
  for (let i = 0; i < 20; i++) {
    const record = { kind: 'beech', x: i * 3.7, z: i * -2.1, tint: 0.5 };
    assert.ok(copper.includes(foliageColor(record, colors, autumn).getHexString()), `tree ${i}`);
  }
});

test('its crown is a layered dome: flat, wide layers that run together across its limbs; "cushions" is what it was', async () => {
  const { KIND_CROWNS, crownOf } = await import('../src/kinds.js');
  const { fromShortLink, toShortLink, LINK_VERSION } = await import('../src/link.js');
  assert.deepEqual(Object.keys(KIND_CROWNS.beech), ['layered dome', 'cushions']);
  assert.equal(crownOf('beech', DEFAULT_SHAPES.beech), 'layered dome');
  assert.equal(crownOf('oak', DEFAULT_SHAPES.oak), null, 'a kind with one form has no forms to list');
  // (A form sets the same few settings as every other, each inside its slider; every ready-made shape keeps the form.)
  const keys = Object.keys(KIND_CROWNS.beech['layered dome']);
  for (const [name, form] of Object.entries(KIND_CROWNS.beech)) {
    assert.deepEqual(Object.keys(form), keys, name);
    for (const [key, value] of Object.entries(form)) { const [lo, hi] = limitsFor(key, value, 'beech'); assert.ok(value >= lo && value <= hi, `${name}: ${key}`); }
  }
  for (const name of ['young', 'open-grown', 'forest-grown', 'old']) assert.equal(crownOf('beech', presetShape('beech', name)), 'layered dome', name);
  assert.equal(crownOf('beech', { ...DEFAULT_SHAPES.beech, squash: 0.5 }), 'custom');
  // (The dome: its leaves in fewer pieces than as cushions, and lower for their width.)
  const pieces = (g) => { const p = g.attributes.position, parent = new Map(); const find = (k) => { while (parent.get(k) !== k) k = parent.get(k); return k; }; const key = (i) => `${Math.round(p.getX(i) * 1e3)},${Math.round(p.getY(i) * 1e3)},${Math.round(p.getZ(i) * 1e3)}`; for (let i = 0; i < p.count; i += 3) { const [a, b, c] = [key(i), key(i + 1), key(i + 2)]; for (const k of [a, b, c]) if (!parent.has(k)) parent.set(k, k); parent.set(find(b), find(a)); parent.set(find(c), find(a)); } return new Set([...parent.keys()].map(find)).size; };
  const dome = growKind('beech', 7, 0), cushions = growKind('beech', 7, 0, { ...DEFAULT_SHAPES.beech, ...KIND_CROWNS.beech.cushions });
  assert.ok(pieces(dome.foliage) < pieces(cushions.foliage) / 2, `${pieces(dome.foliage)} masses against ${pieces(cushions.foliage)}`);
  const leaves = (tree) => tree.foliage.attributes.position.count / 3;
  assert.ok(leaves(dome) < leaves(cushions) * 1.3, `${leaves(dome)} triangles of leaves against ${leaves(cushions)}`);
  // (A link made before the dome opens with the beech as it was made: cushions.)
  const made = fromShortLink('6~shapes.beech_height-26-31');
  assert.deepEqual(made.notes, []);
  const before = made.settings.shapes.beech;
  assert.deepEqual(before.height, [26, 31]);
  assert.deepEqual([before.squash, before.clumpWide, before.across, before.merge, before.leafReach, before.rough], [0.75, 1, 0, 90, 0.28, 0.15]);
  assert.equal(crownOf('beech', before), 'cushions');
  // (And today's link, back to cushions, says so and comes back the same.)
  const settings = defaultSettings();
  Object.assign(settings.shapes.beech, KIND_CROWNS.beech.cushions);
  assert.ok(LINK_VERSION >= 7);
  assert.equal(crownOf('beech', fromShortLink(toShortLink(settings)).settings.shapes.beech), 'cushions');
});

test('a forest-grown tree carries no leaves on a stub its trunk grew on past: none far under its crown', () => {
  // (A big limb that set off where the crown had no room never grew: it kept a cluster of leaves on a bare trunk, metres under the crown.)
  for (const kind of ['oak', 'beech']) {
    for (const seed of [1, 3, 7, 12, 21, 40]) {
      const tree = growKind(kind, seed, 0, presetShape(kind, 'forest-grown'));
      const heights = tree.layout.clumps.map((clump) => clump.center[1]).sort((a, b) => a - b);
      const middle = heights[Math.floor(heights.length / 2)];
      let gap = 0;
      for (let i = 1; i < heights.length; i++) if (heights[i] < middle) gap = Math.max(gap, heights[i] - heights[i - 1]);
      assert.ok(gap < 3, `${kind} ${seed}: a cluster ${gap.toFixed(1)} m under the next one up`);
      assert.ok(tree.layout.oak.stopped > 0, `${kind} ${seed}: its stopped twigs are still counted`);
    }
  }
  // (A hazel's short stems are not such stubs: they stand at the stool's edge, in the light, and keep their leaves.)
  const hazel = growKind('hazel', 3, 0, presetShape('hazel', 'young'));
  const low = hazel.layout.clumps.filter((clump) => clump.center[1] < hazel.height * 0.4).length;
  assert.ok(low >= 5, `a young hazel has ${low} clusters low down`);
});
