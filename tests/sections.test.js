import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SHAPES, KINDS, KIND_CHOICES, KIND_LIMITS } from '../src/kinds.js';
import { OTHER, PANELS, ROWS, SECTIONS, sectionsOf } from '../src/sections.js';
import { SHAPE_TIPS } from '../src/tips.js';

// The shape sliders are laid out in sections, by the part of the tree they
// shape, the same sections in the same order for every kind.

test('every setting of every kind has its section and a plain name, once', () => {
  for (const kind of KINDS) {
    const shape = DEFAULT_SHAPES[kind];
    const laid = sectionsOf(kind, shape);
    const keys = laid.flatMap((section) => section.rows.map((row) => row.key));
    assert.deepEqual([...keys].sort(), Object.keys(shape).sort(), `${kind}: every setting once`);
    assert.ok(!laid.some((section) => section.title === OTHER), `${kind}: a setting has no section yet (add it to src/sections.js)`);
    for (const { rows } of laid) {
      for (const { key, name } of rows) {
        assert.ok(name && !/[A-Z]/.test(name), `${kind}: "${name}" for ${key} isn't a plain name`);
        assert.ok(SHAPE_TIPS[kind][key], `${kind}: ${key} has no tooltip`);
      }
    }
  }
});

test('the sections come in one order for every kind, and none is empty', () => {
  for (const kind of KINDS) {
    const titles = sectionsOf(kind, DEFAULT_SHAPES[kind]).map((section) => section.title);
    assert.deepEqual(titles, SECTIONS.filter((title) => titles.includes(title)), `${kind}: out of order`);
    assert.ok(titles.includes('trunk') && titles.includes('limbs'), `${kind}: no trunk or no limbs`);
  }
  assert.deepEqual(sectionsOf('oak', DEFAULT_SHAPES.oak).map((section) => section.title), SECTIONS, 'the oak has every section');
});

test('no section lists a setting its kind doesn\'t have, or the same one twice', () => {
  for (const kind of KINDS) {
    const listed = Object.values(ROWS[kind]).flatMap((rows) => Object.keys(rows));
    assert.equal(new Set(listed).size, listed.length, `${kind}: a setting listed twice`);
    for (const key of listed) assert.ok(key in DEFAULT_SHAPES[kind], `${kind}: no setting "${key}"`);
  }
});

test('a setting new to a generator goes under "other", by its own key, and a missing one is left out', () => {
  const laid = sectionsOf('fir', { ...DEFAULT_SHAPES.fir, age: 40 });
  assert.deepEqual(laid.at(-1), { title: OTHER, rows: [{ key: 'age', name: 'age' }] });
  const { sway, ...still } = DEFAULT_SHAPES.fir;
  assert.ok(!sectionsOf('fir', still).some((section) => section.title === 'movement'), 'an empty section is shown');
});

test('rows that share a folded panel of their own are together in their section, and only they are marked', () => {
  for (const kind of KINDS) {
    const laid = sectionsOf(kind, DEFAULT_SHAPES[kind]);
    const inPanel = new Set(Object.values(PANELS[kind] ?? {}).flat());
    for (const [panel, keys] of Object.entries(PANELS[kind] ?? {})) {
      const section = laid.find(({ rows }) => rows.some((row) => row.panel === panel));
      assert.ok(section, `${kind}: no section shows the "${panel}" panel`);
      const at = section.rows.map((row, i) => (row.panel === panel ? i : -1)).filter((i) => i >= 0);
      assert.deepEqual(at.map((i) => section.rows[i].key), keys, `${kind}: the "${panel}" panel's rows`);
      assert.equal(at.at(-1) - at[0] + 1, at.length, `${kind}: the "${panel}" panel's rows aren't together`);
      assert.ok(!laid.some((other) => other !== section && other.rows.some((row) => row.panel === panel)), `${kind}: the "${panel}" panel is in two sections`);
      assert.ok(!/[A-Z]/.test(panel), `${kind}: "${panel}" isn't a plain name`);
    }
    for (const { rows } of laid) for (const row of rows) assert.equal('panel' in row, inPanel.has(row.key), `${kind}: ${row.key}`);
  }
  const crown = sectionsOf('oak', DEFAULT_SHAPES.oak).find((section) => section.title === 'crown');
  assert.deepEqual(crown.rows.filter((row) => row.panel === 'noise').map((row) => row.name), ['amount (%)', 'type', 'size (m)', 'detail', 'bend (m)', 'billow']);
  assert.equal(crown.rows.findLast((row) => !row.panel).key, 'coarse', 'the noise panel isn\'t last in the crown');
});

test('a setting that is a choice is a whole number for each name, within its slider', () => {
  for (const [kind, choices] of Object.entries(KIND_CHOICES)) {
    for (const [key, named] of Object.entries(choices)) {
      const [lo, hi, step] = KIND_LIMITS[kind][key];
      assert.equal(step, 1);
      assert.deepEqual(Object.values(named), Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), `${kind}.${key}: a name for every value`);
      assert.ok(Object.values(named).includes(DEFAULT_SHAPES[kind][key]), `${kind}.${key} starts as none of its names`);
      for (const name of Object.keys(named)) assert.ok(!/[A-Z]/.test(name), `${kind}.${key}: "${name}" isn't a plain name`);
    }
  }
});
