import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KINDS, KIND_GROUPS, OWN_KINDS, WORKSHOP_KINDS } from '../src/kinds.js';
import { tip } from '../src/tips.js';

// The forest's mix as a table (src/mixTable.js; built in src/main.js): a
// row a kind, the kinds in their groups, and what is a kind's own in the
// kind's panel.

test('every kind is in one group of the mix, in the order the kinds are kept', () => {
  const listed = KIND_GROUPS.flatMap((group) => group.kinds);
  assert.deepEqual(listed, KINDS, 'a kind is missing from the groups, twice in them, or out of order');
  for (const group of KIND_GROUPS) assert.ok(group.title && group.kinds.length, 'a group has a name and trees');
  // (TreeLab's own kinds and the workshop's are never in one group.)
  for (const group of KIND_GROUPS) assert.ok(group.kinds.every((k) => OWN_KINDS.includes(k)) || group.kinds.every((k) => WORKSHOP_KINDS.includes(k)), group.title);
});

test('the mix is a table of rows, and a kind\'s own rows are in its own panel', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /new MixController\(mixFolder, settings\.forest\.mix\[kind\]/, 'a row a kind');
  assert.match(main, /onName: \(\) => pickKind\(kind\)/, 'a click on its name shows the kind');
  assert.match(main, /row\.stands\(records\.filter/, 'how many stand, from the forest as planted');
  // (No kind's rows are left in the settings' panel: its ages and its greens are the kind's own.)
  assert.doesNotMatch(main, /mixFolder\.add\(settings\.forest\.mix\[kind\]/);
  assert.doesNotMatch(main, /greensFolder/);
  assert.match(main, /forestRows\.add\(mix, 'mixed'\)/);
  assert.match(main, /greens\.addColor\(settings\.colors\[kind\], 'dark'\)/);
  assert.match(main, /siteSays\(siteOf\(kind\)\)/, 'and where it grows');
});

test('the row\'s tooltip says what each of its parts is', () => {
  const says = tip('mix.share', 'hawthorn');
  assert.match(says, /Tick: hawthorn trees grow/);
  assert.match(says, /how many stand/);
  assert.ok(says.length < 200, `${says.length} characters`);
});
