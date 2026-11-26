import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYERS, layerOf, layersOf } from '../src/cover.js';
import { placeForest } from '../src/forest.js';
import { KINDS } from '../src/kinds.js';
import { fromShortLink, toShortLink } from '../src/link.js';
import { sceneSettings } from '../src/scenes.js';
import { MAX_TREES, defaultSettings } from '../src/settings.js';
import { standOf } from '../src/site.js';
import { createTerrain } from '../src/terrain.js';
import { WOODS, plantWood, woodOf } from '../src/woods.js';

// The forest's mix set by layer and by ground covered (src/cover.js),
// beside the mix by count.

// A forest planted from settings, as the page plants it (without ages).
function planted(settings) {
  const standing = (kind) => standOf(settings.shapes[kind]);
  return placeForest(settings.forest, createTerrain(settings.terrain), standing);
}
const wood = (layers, mix) => {
  const settings = sceneSettings('oak and underwood');
  settings.forest.mixBy = 'by cover';
  Object.assign(settings.forest.layers, layers);
  if (mix) for (const kind of KINDS) Object.assign(settings.forest.mix[kind], kind in mix ? { on: true, share: mix[kind] } : { on: false });
  return settings;
};

test('every kind is of one layer: a hazel, a hawthorn and a holly of the underwood, the rest of the canopy', () => {
  for (const kind of KINDS) assert.ok(LAYERS.includes(layerOf(kind)), kind);
  assert.deepEqual(KINDS.filter((kind) => layerOf(kind) === 'underwood'), ['hawthorn', 'hazel', 'holly']);
  const { forest } = sceneSettings('oak and underwood');
  assert.deepEqual(layersOf(forest), { canopy: ['oak'], underwood: ['hawthorn', 'hazel', 'holly'] });
});

test('by count, the layers have no say: the forest is as it was', () => {
  const a = sceneSettings('oak and underwood'), b = sceneSettings('oak and underwood');
  assert.equal(a.forest.mixBy, 'by count');
  b.forest.layers.canopy = 5;
  b.forest.layers.underwood = 95;
  assert.deepEqual(planted(a).records, planted(b).records);
  assert.equal(planted(a).report.layers, undefined);
});

test('by cover, each layer stands at about the cover asked, and each kind at about its share of its layer', () => {
  for (const [canopy, underwood] of [[50, 60], [70, 40], [30, 20], [85, 10]]) {
    const { records, report } = planted(wood({ canopy, underwood }, { oak: 100, hazel: 60, hawthorn: 25, holly: 15 }));
    const told = report.layers;
    assert.ok(Math.abs(told.canopy.stands - canopy / 100) < 0.04, `canopy asked ${canopy}%, stands ${(100 * told.canopy.stands).toFixed(1)}%`);
    assert.ok(Math.abs(told.underwood.stands - underwood / 100) < 0.04, `underwood asked ${underwood}%, stands ${(100 * told.underwood.stands).toFixed(1)}%`);
    assert.equal(told.canopy.kinds.oak.stands, 1);
    for (const [kind, got] of Object.entries(told.underwood.kinds)) {
      assert.ok(Math.abs(got.stands - got.asked) < 0.08, `${kind} at ${canopy}/${underwood}: asked ${(100 * got.asked).toFixed(0)}%, stands ${(100 * got.stands).toFixed(0)}%`);
      assert.equal(got.trees, records.filter((r) => r.kind === kind).length);
    }
    assert.ok(records.length <= MAX_TREES);
  }
});

test('more cover asked is more trees standing; none asked is none', () => {
  const oaks = (canopy) => planted(wood({ canopy, underwood: 0 })).records;
  const few = oaks(25), many = oaks(75);
  assert.ok(many.length > 2 * few.length, `${few.length} oaks at 25%, ${many.length} at 75%`);
  assert.ok(many.every((r) => r.kind === 'oak'), 'an underwood of no cover has no trees');
  assert.deepEqual(planted(wood({ canopy: 0, underwood: 0 })).records, []);
});

test('a share by cover is a share of the crowns, not of the trees: a few oaks are as much canopy as many birches', () => {
  const { report } = planted(wood({ canopy: 70, underwood: 0 }, { oak: 50, birch: 50 }));
  const { oak, birch } = report.layers.canopy.kinds;
  assert.ok(Math.abs(oak.stands - 0.5) < 0.12, `oak stands ${(100 * oak.stands).toFixed(0)}% of the canopy`);
  assert.ok(birch.trees > oak.trees, `${birch.trees} birches, ${oak.trees} oaks`);
});

test('a layer with no kind ticked has no trees, and says so; the same settings give the same forest', () => {
  const only = wood({ canopy: 60, underwood: 50 }, { oak: 100 });
  const { records, report } = planted(only);
  assert.deepEqual(report.layers.underwood.kinds, {});
  assert.equal(report.layers.underwood.stands, 0);
  assert.ok(records.length && records.every((r) => r.kind === 'oak'));
  assert.deepEqual(planted(only).records, records);
});

test('where the rules allow less than was asked, the layer stands at what they allow', () => {
  // (Room at its widest: crowns of a height keep well apart, and can't cover nine tenths of the ground.)
  const wide = wood({ canopy: 90, underwood: 0 });
  wide.forest.rules.room = 2;
  const { report } = planted(wide);
  assert.ok(report.layers.canopy.stands < 0.8, `stands ${(100 * report.layers.canopy.stands).toFixed(0)}%`);
  assert.ok(report.layers.canopy.stands > 0.2);
});

test('a ready-made wood is a mix by cover: its own kinds, each in a layer with cover asked', () => {
  for (const [name, made] of Object.entries(WOODS)) {
    const { forest } = defaultSettings();
    plantWood(forest, name);
    assert.equal(forest.mixBy, 'by cover');
    assert.equal(woodOf(forest), name);
    for (const kind of Object.keys(made.mix)) assert.ok(KINDS.includes(kind), `${name}: ${kind}`);
    assert.deepEqual(KINDS.filter((kind) => forest.mix[kind].on), KINDS.filter((kind) => kind in made.mix));
    for (const layer of LAYERS) assert.ok(made.layers[layer] === 0 || layersOf(forest)[layer].length, `${name}: its ${layer} has cover asked and no kind`);
    // (Moved, it is the user's own.)
    forest.layers.canopy -= 5;
    assert.equal(woodOf(forest), 'custom');
  }
  assert.equal(woodOf(defaultSettings().forest), 'custom', 'by count is no ready-made wood');
});

test('a link carries a mix by cover, and an older link is still by count', () => {
  const settings = sceneSettings('oak and underwood');
  plantWood(settings.forest, 'oak over hazel');
  const link = toShortLink(settings);
  assert.match(link, /mixBy-by\.cover/);
  assert.deepEqual(fromShortLink(link).settings, settings);
  const old = fromShortLink('5-oak.and.underwood').settings;
  assert.equal(old.forest.mixBy, 'by count');
  // (The same mix, of one age per kind, as it was made then: several ages came later.)
  const same = structuredClone(sceneSettings('oak and underwood').forest.mix);
  for (const kind of Object.keys(same)) if ('mixed' in same[kind]) same[kind].mixed = false;
  assert.deepEqual(old.forest.mix, same);
});
