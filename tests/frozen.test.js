import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FROZEN } from '../src/frozen/index.js';
import { LINK_VERSION, fromOldLink, fromShortLink, liveBases, toShortLink } from '../src/link.js';
import { presetShape } from '../src/presets.js';
import { sceneSettings } from '../src/scenes.js';
import { BEFORE, defaultSettings, normalize } from '../src/settings.js';

// A link opens as it was made, always (src/link.js, src/frozen). What links
// of each version start from is recorded, once, and a link is read against
// its own version's record.

const copy = (v) => JSON.parse(JSON.stringify(v));
const old = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

test('every version of the links has its record, and this version\'s is TreeLab as it is', () => {
  for (let version = 0; version <= LINK_VERSION; version++) assert.ok(FROZEN[version]?.defaults, `no record of version ${version}`);
  assert.deepEqual(Object.keys(FROZEN).map(Number).sort((a, b) => a - b), Array.from({ length: LINK_VERSION + 1 }, (_, i) => i), 'a record without a version');
  // (Should this fail: something a link can start from has changed, a default, a view or a ready-made shape.
  // Links already made must keep their meaning: raise LINK_VERSION in src/link.js and run `npm run freeze`,
  // which writes the new record and lists it. Never edit a record.)
  assert.deepEqual(copy(FROZEN[LINK_VERSION]), copy(liveBases()), 'what links start from has changed since this version was recorded');
});

test('a link of this version is read against TreeLab as it is, and reads back what it was made from', () => {
  for (const settings of [defaultSettings(), sceneSettings('misty wood'), sceneSettings('beech wood')]) {
    assert.deepEqual(fromShortLink(toShortLink(settings)).settings, settings);
  }
  assert.ok(toShortLink(defaultSettings()).startsWith(`${LINK_VERSION}`));
});

test('a link of an older version opens as it was made: against that version\'s defaults, views and ready-made shapes', () => {
  // (TreeLab one version on: since version 1, say, the default hour, the misty wood's hour and the ancient oak's height were all retuned.)
  const then = copy(liveBases());
  then.defaults.light.hour = 6;
  then.scenes['misty wood'].light.hour = 10;
  then.presets.oak.ancient.height = [20, 21];
  delete then.scenes['beech wood'];
  const as = { frozen: { 0: FROZEN[0], 1: then }, current: 2 };
  const now = defaultSettings();
  assert.notEqual(now.light.hour, 6);
  // (Its defaults, as they were.)
  assert.equal(fromShortLink('1', as).settings.light.hour, 6);
  assert.equal(fromShortLink('2', as).settings.light.hour, now.light.hour, 'a link of this version: today\'s default');
  // (A view, as it was; and what the link itself says still counts.)
  assert.equal(fromShortLink('1-misty.wood', as).settings.light.hour, 10);
  assert.equal(fromShortLink('2-misty.wood', as).settings.light.hour, sceneSettings('misty wood').light.hour);
  const said = fromShortLink('1-misty.wood~light_mist-.5', as).settings;
  assert.deepEqual([said.light.hour, said.light.mist], [10, 0.5]);
  assert.deepEqual(fromShortLink('1-misty.wood', as).settings.forest, sceneSettings('misty wood').forest, 'what wasn\'t retuned is as it is');
  // (A ready-made shape, as it was.)
  assert.deepEqual(fromShortLink('1~shapes.oak-ancient', as).settings.shapes.oak.height, [20, 21]);
  assert.deepEqual(fromShortLink('2~shapes.oak-ancient', as).settings.shapes.oak.height, presetShape('oak', 'ancient').height);
  assert.deepEqual(fromShortLink('1~shapes.oak-ancient_gnarl-.5', as).settings.shapes.oak.gnarl, 0.5);
  // (A view that version didn't have: the defaults, and a note.)
  const none = fromShortLink('1-beech.wood', as);
  assert.deepEqual(none.settings, defaultSettings());
  assert.match(none.notes.join(' '), /doesn't have/);
  // (A version with no record, which shouldn't happen: read as today's, with a note.)
  assert.match(fromShortLink('1-misty.wood', { frozen: {}, current: 2 }).notes.join(' '), /record is missing/);
});

test('a setting an older link couldn\'t know of is put to what it was in effect then, not to today\'s default', () => {
  const then = copy(liveBases());
  delete then.defaults.view.turnSpeed; // (version 1, say, had no turn speed: the view turned at 30° a second)
  const as = { frozen: { 1: then }, current: 2, before: { 'view.turnSpeed': 30 } };
  assert.equal(fromShortLink('1', as).settings.view.turnSpeed, 30);
  assert.equal(fromShortLink('1-misty.wood', as).settings.view.turnSpeed, 30);
  // (A version that had the setting keeps its own; so does a link of today's.)
  assert.equal(fromShortLink('1', { ...as, frozen: { 1: copy(liveBases()) } }).settings.view.turnSpeed, defaultSettings().view.turnSpeed);
  assert.equal(fromShortLink('2', as).settings.view.turnSpeed, defaultSettings().view.turnSpeed);
  // (With no line for it: today's default, as before.)
  assert.equal(fromShortLink('1', { ...as, before: {} }).settings.view.turnSpeed, defaultSettings().view.turnSpeed);
});

test('the older links (#s=) open as TreeLab 0.3.1 opened them', () => {
  // (0.3.1's settings as TreeLab keeps them now; and what has come since and would change them is off: BEFORE.)
  const then = normalize(copy(FROZEN[0].defaults)).settings;
  then.forest.rules = { ground: 0, room: 0, light: 0 };
  // (Nothing changed: 0.3.1's defaults. What the link says: that.)
  assert.deepEqual(fromOldLink(old({ version: 1 })).settings, then);
  const seeded = fromOldLink(old({ version: 1, tree: { seed: 5 }, shapes: { oak: { height: [14, 18] } } })).settings;
  assert.deepEqual([seeded.tree.seed, seeded.shapes.oak.height], [5, [14, 18]]);
  assert.deepEqual(seeded.shapes.oak.girth, FROZEN[0].defaults.shapes.oak.girth);
  // (A kind of tree TreeLab has gained since is there, at its own defaults and off in the forest.)
  assert.ok(!('beech' in FROZEN[0].defaults.shapes));
  assert.deepEqual(then.shapes.beech, defaultSettings().shapes.beech);
  assert.equal(then.forest.mix.beech.on, false);
  // (Its defaults are 0.3.1's, not today's, where the two differ.)
  const stood = copy(FROZEN[0]);
  stood.defaults.light.hour = 6;
  assert.equal(fromOldLink(old({ version: 1, tree: { seed: 5 } }), { frozen: { 0: stood } }).settings.light.hour, 6);
  // (A damaged one: the defaults, and a note.)
  const damaged = fromOldLink('!!!');
  assert.deepEqual(damaged.settings, defaultSettings());
  assert.match(damaged.notes.join(' '), /damaged/);
});

// Every path to a setting in an object ('light.hour'), leaving out the kinds' own groups (a kind TreeLab gained
// later is new as a whole, and starts off in the forest).
const pathsOf = (value, path = '') => (value !== null && typeof value === 'object' && !Array.isArray(value)
  ? Object.entries(value).flatMap(([key, inner]) => (path === '' && ['shapes', 'colors'].includes(key)) || path === 'forest.mix' ? [] : pathsOf(inner, path ? `${path}.${key}` : key))
  : [path]);
const at = (value, path) => path.split('.').reduce((node, name) => node?.[name], value);

test('what a record doesn\'t know of has its line in BEFORE, and what it does know still reads as it was', () => {
  const now = defaultSettings();
  for (let version = 0; version < LINK_VERSION; version++) {
    const then = FROZEN[version].defaults;
    // (A setting newer than the record: put to what it was in effect then. Should this fail, add its line to
    // BEFORE in src/settings.js: without one, links of that version follow today's default for good.)
    for (const path of pathsOf(now)) {
      if (path === 'app' || path === 'version' || at(then, path) !== undefined) continue;
      assert.ok(Object.hasOwn(BEFORE, path), `version ${version} has no ${path}, and BEFORE has no line for it`);
    }
    // (A setting the record has: today's TreeLab reads the record's own value back unchanged. Should this fail,
    // a slider or a list was narrowed past what older links hold: widen it again.)
    const read = normalize(copy(then)).settings;
    for (const path of pathsOf(then)) {
      if (path === 'app' || path === 'version' || at(now, path) === undefined) continue;
      assert.deepEqual(at(read, path), at(then, path), `version ${version}: ${path} no longer reads as it was`);
    }
    for (const kind of Object.keys(then.shapes)) if (now.shapes[kind]) for (const key of Object.keys(then.shapes[kind])) if (key in now.shapes[kind]) assert.deepEqual(read.shapes[kind][key], then.shapes[kind][key], `version ${version}: shapes.${kind}.${key}`);
  }
});

test('the records are data and nothing else, and the page reads the older links through them', () => {
  for (let version = 0; version <= LINK_VERSION; version++) {
    const text = readFileSync(new URL(`../src/frozen/v${version}.js`, import.meta.url), 'utf8');
    assert.match(text, /^\/\/ [^\n]+\n(?:\/\/ [^\n]+\n)*export default \{.*\};\r?\n$/s, `v${version}.js`);
    assert.ok(text.length < 60000, `v${version}.js is ${text.length} characters`);
  }
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /hash\.startsWith\('s='\)\) return \{ \.\.\.fromOldLink\(/);
  assert.match(main, /hash\.startsWith\('v='\)\) return \{ \.\.\.fromShortLink\(/);
});
