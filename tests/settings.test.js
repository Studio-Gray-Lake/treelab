import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TREE_KINDS, TREE_SHAPES } from '@workshop/treeShapes.js';
import { CHOICES, RANGES, SETTINGS_VERSION, assign, changes, defaultSettings, fromLink, normalize, rangeOf, toFile, toLink } from '../src/settings.js';

// Settings files and share links come from other TreeLabs, older and newer,
// and from people editing them by hand: whatever comes in, TreeLab gets
// settings it can use.

test('the defaults read back as they are, with nothing to report', () => {
  const { settings, notes } = normalize(defaultSettings());
  assert.deepEqual(settings, defaultSettings());
  assert.deepEqual(notes, []);
});

test('every default sits in its slider, and every choice is one of its list', () => {
  const walk = (value, path) => {
    if (Array.isArray(value)) value.forEach((v) => walk(v, path));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => walk(v, path ? `${path}.${k}` : k));
    else if (typeof value === 'number' && path !== 'version') {
      const range = rangeOf(path);
      assert.ok(range, `${path} has no slider`);
      assert.ok(value >= range[0] && value <= range[1], `${path} = ${value} outside ${range}`);
    } else if (typeof value === 'string' && path !== 'app') {
      assert.ok(path.startsWith('colors.') ? /^#[0-9a-f]{6}$/.test(value) : CHOICES[path]?.includes(value), `${path} = ${value}`);
    }
  };
  walk(defaultSettings(), '');
});

test('a file saves everything and loads back the same', () => {
  const settings = defaultSettings();
  settings.tab = 'forest';
  settings.forest.pattern = 'clumps';
  settings.forest.mix.pine.on = false;
  settings.shapes.fir.height[1] = 8;
  const file = toFile(settings);
  const back = normalize(JSON.parse(file));
  assert.deepEqual(back.settings, settings);
  assert.equal(JSON.parse(file).version, SETTINGS_VERSION);
  assert.equal(JSON.parse(file).app, 'TreeLab');
});

test('a share link carries only the changes, and reads back the same', () => {
  const settings = defaultSettings();
  assert.deepEqual(changes(settings), {});
  settings.tree.kind = 'pine';
  settings.forest.size[0] = 0.9;
  settings.wind.speed = 5;
  assert.deepEqual(changes(settings), { tree: { kind: 'pine' }, forest: { size: [0.9, 1.35] }, wind: { speed: 5 } });
  const link = toLink(settings);
  assert.match(link, /^[A-Za-z0-9_-]+$/, 'not safe in an address');
  assert.ok(link.length < 200, `${link.length} characters`);
  assert.deepEqual(fromLink(link).settings, settings);
});

test('a damaged link gives the defaults and says so', () => {
  const { settings, notes } = fromLink('not*base64');
  assert.deepEqual(settings, defaultSettings());
  assert.equal(notes.length, 1);
});

test('settings TreeLab doesn\'t know are left out; missing ones take their defaults', () => {
  const { settings } = normalize({ version: 1, tree: { kind: 'fir', colour: 'red' }, telemetry: true });
  assert.equal(settings.tree.kind, 'fir');
  assert.equal(settings.tree.colour, undefined);
  assert.equal(settings.telemetry, undefined);
  assert.equal(settings.tree.seed, 7);
});

test('out-of-range numbers are brought into range, wrong kinds of value left at their defaults', () => {
  const { settings, notes } = normalize({
    tree: { seed: 5000, rows: 2.6, kind: 'palm', labels: 'yes' },
    forest: { radius: 500, density: -3, size: [1.5, 0.6], mix: { fir: { share: 1e9 } } },
    wind: { speed: Infinity },
    shapes: { fir: { height: 'tall', points: 99 } },
  });
  assert.equal(settings.tree.seed, RANGES['tree.seed'][1]);
  assert.equal(settings.tree.rows, 3, 'rounded to its whole-number step');
  assert.equal(settings.tree.kind, 'broadleaf');
  assert.equal(settings.tree.labels, true);
  assert.equal(settings.forest.radius, 40, 'the wind covers 80 m: the forest stays inside');
  assert.equal(settings.forest.density, RANGES['forest.density'][0]);
  assert.deepEqual(settings.forest.size, [0.6, 1.5], 'a range comes back in order');
  assert.equal(settings.forest.mix.fir.share, 100);
  assert.equal(settings.wind.speed, defaultSettings().wind.speed);
  assert.deepEqual(settings.shapes.fir.height, TREE_SHAPES.fir.height);
  assert.equal(settings.shapes.fir.points, rangeOf('shapes.fir.points')[1]);
  for (const path of ['tree.kind', 'tree.labels', 'wind.speed', 'shapes.fir.height']) {
    assert.ok(notes.some((n) => n.startsWith(path)), `nothing said about ${path}`);
  }
});

test('a file from a newer TreeLab still loads, with a note', () => {
  const { settings, notes } = normalize({ version: SETTINGS_VERSION + 1, tree: { kind: 'pine' }, newThing: {} });
  assert.equal(settings.tree.kind, 'pine');
  assert.ok(notes.some((n) => n.includes('newer')));
});

// When the workshop reshapes a kind's settings, a saved shape keeps what still fits and takes the new defaults for the rest.
test('a saved shape with settings the workshop has since dropped or reshaped still loads', () => {
  const saved = structuredClone(TREE_SHAPES.broadleaf);
  saved.oldSetting = 3;
  const key = Object.keys(saved).find((k) => Array.isArray(saved[k]));
  saved[key] = 2; // a range saved as a single number
  const { settings } = normalize({ shapes: { broadleaf: saved } });
  assert.equal(settings.shapes.broadleaf.oldSetting, undefined);
  assert.deepEqual(settings.shapes.broadleaf[key], TREE_SHAPES.broadleaf[key]);
});

test('every kind\'s mix is in the settings', () => {
  assert.deepEqual(Object.keys(defaultSettings().forest.mix).sort(), [...TREE_KINDS].sort());
});

test('loading into the panel\'s settings keeps every object and array the panel is bound to', () => {
  const live = defaultSettings();
  const { forest, shapes } = live;
  const height = live.shapes.fir.height;
  const size = live.forest.size;
  const loaded = defaultSettings();
  loaded.forest.radius = 12;
  loaded.shapes.fir.height = [3, 4];
  loaded.forest.size = [0.8, 1];
  assign(live, loaded);
  assert.equal(live.forest, forest);
  assert.equal(live.shapes, shapes);
  assert.equal(live.shapes.fir.height, height);
  assert.equal(live.forest.size, size);
  assert.deepEqual(live, loaded);
});

test('colours must be colours: anything else is left at its default', () => {
  const { settings, notes } = normalize({ colors: { fir: { dark: 'red', light: '#ABCDEF' } }, autumn: { amount: 3, palette: 'neon' } });
  assert.equal(settings.colors.fir.dark, defaultSettings().colors.fir.dark);
  assert.equal(settings.colors.fir.light, '#abcdef');
  assert.equal(settings.autumn.amount, 1);
  assert.equal(settings.autumn.palette, 'mixed');
  assert.ok(notes.some((n) => n.startsWith('colors.fir.dark')));
});
