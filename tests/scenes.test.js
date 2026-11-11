import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, sceneOf, sceneSettings } from '../src/scenes.js';
import { placeForest } from '../src/forest.js';
import { KINDS } from '../src/kinds.js';
import { sunAt } from '../src/light.js';
import { presetOf } from '../src/presets.js';
import { changes, defaultSettings, fromLink, normalize, toLink } from '../src/settings.js';

// The starting points (src/scenes.js): whole settings, each one valid, told
// apart from each other and from a visitor's own.

const flat = { heightAt: () => 0, slopeAt: () => 0, half: 150 };

test('every starting point is settings TreeLab takes as they are, and says what it is', () => {
  for (const name of Object.keys(SCENES)) {
    const settings = sceneSettings(name);
    const { settings: again, notes } = normalize(JSON.parse(JSON.stringify(settings)));
    assert.deepEqual(notes, [], name);
    assert.deepEqual(again, settings, `${name}: changed by being read again`);
    assert.ok(SCENES[name].says.length > 10 && SCENES[name].says.length < 120, `${name}: its note`);
    // Only settings there are: nothing asked for that isn't taken.
    const asked = JSON.parse(JSON.stringify(SCENES[name].changes));
    const taken = (want, got, path) => {
      for (const [key, value] of Object.entries(want)) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) taken(value, got?.[key] ?? {}, `${path}${key}.`);
        else assert.deepEqual(got?.[key], value, `${name}: ${path}${key}`);
      }
    };
    taken(asked, settings, '');
  }
});

test('"one oak" is TreeLab as it opens, and "mixed forest" the same on the Forest tab', () => {
  assert.deepEqual(sceneSettings('one oak'), defaultSettings());
  assert.deepEqual(changes(sceneSettings('mixed forest')), { tab: 'forest' });
});

test('the misty wood: tall oaks grown close, a low morning sun, mist, seen from among the trees', () => {
  const s = sceneSettings('misty wood');
  assert.equal(s.tab, 'forest');
  assert.deepEqual(KINDS.filter((k) => s.forest.mix[k].on), ['oak']);
  assert.equal(presetOf('oak', s.shapes.oak), 'forest-grown');
  assert.equal(s.view.stand, true);
  const { elevation } = sunAt(s.light.hour, s.light.from);
  assert.ok(elevation > 8 && elevation < 25, `the sun ${elevation.toFixed(0)}° up`);
  assert.ok(s.light.mist >= 0.5 && s.light.mist <= 0.85);
  // Nothing brought out: the shafts, the shade and the eye as in life.
  assert.equal(s.light.shafts, 1);
  assert.equal(s.light.shade, 1);
  assert.equal(s.light.eye, 1);
  // A wood, not a few trees: enough of them, one every 11 m or so.
  const { records } = placeForest(s.forest, flat);
  assert.ok(records.length > 60 && records.length < 130, `${records.length} trees`);
  assert.ok(records.every((r) => r.kind === 'oak'));
});

test('settings are told for the starting point they are; a change makes them custom, the view does not', () => {
  for (const name of Object.keys(SCENES)) assert.equal(sceneOf(sceneSettings(name)), name);
  const mine = sceneSettings('misty wood');
  mine.view.stand = false;
  mine.view.person = false;
  mine.view.spin = true;
  assert.equal(sceneOf(mine), 'misty wood', 'looking from above made it custom');
  mine.tab = 'tree';
  assert.equal(sceneOf(mine), 'misty wood', 'looking at its oak on the Tree tab made it custom');
  mine.light.mist = 0.4;
  assert.equal(sceneOf(mine), 'custom');
  const oak = defaultSettings();
  assert.equal(sceneOf(oak), 'one oak');
  oak.tab = 'forest';
  assert.equal(sceneOf(oak), 'mixed forest');
  oak.shapes.oak.crooked += 0.05;
  assert.equal(sceneOf(oak), 'custom');
});

test('a link to the misty wood opens on it, among the trees', () => {
  const { settings, notes } = fromLink(toLink(sceneSettings('misty wood')));
  assert.deepEqual(notes, []);
  assert.equal(sceneOf(settings), 'misty wood');
  assert.equal(settings.view.stand, true);
});
