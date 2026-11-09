import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TREE_KINDS, TREE_SHAPES } from '@workshop/treeShapes.js';
import { DEFAULT_WIND } from '@workshop/wind.js';
import { defaultSettings } from '../src/settings.js';
import { SHAPE_TIPS, TIPS, shapeTip, tip } from '../src/tips.js';

// Every value in the panel has a tooltip saying what it does.

test('every setting has a tooltip', () => {
  const missing = [];
  const walk = (value, path) => {
    if (Array.isArray(value) || value === null || typeof value !== 'object') {
      const key = path.replace(/^forest\.mix\.\w+\./, 'mix.').replace(/^colors\.\w+\./, 'colors.');
      if (!tip(key)) missing.push(path);
      return;
    }
    for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
  };
  const { app, version, tab, shapes, ...rest } = defaultSettings();
  walk(rest, '');
  assert.deepEqual(missing, []);
});

test('every one of the wind\'s own rows has a tooltip', () => {
  for (const key of Object.keys(DEFAULT_WIND)) assert.ok(tip(`wind.${key}`), key);
});

test('every setting of the tree generator has a tooltip, for its kind', () => {
  for (const kind of TREE_KINDS) {
    const missing = Object.keys(TREE_SHAPES[kind]).filter((key) => !SHAPE_TIPS[kind][key]);
    assert.deepEqual(missing, [], `${kind}: add these to src/tips.js SHAPE_TIPS`);
  }
});

test('a setting new to the generator still gets a tooltip, and {kind} is filled in', () => {
  assert.match(shapeTip('fir', 'age'), /"age"/);
  assert.equal(tip('mix.on', 'pine'), 'Whether pine trees grow in the forest.');
  assert.ok(Object.values(TIPS).every((t) => t.length < 200), 'a tooltip is too long to read at a glance');
});
