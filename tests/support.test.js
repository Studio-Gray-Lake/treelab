import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KOFI, KOFI_CUP, LATER_LINES, LINES, PLAIN_LINE, lineFor, SUPPORT_AFTER, SUPPORT_STORE, SUPPORT_VISIT, askDue, asksMade, setAsksMade, supportDelay, supportIsOff, turnSupportOff } from '../src/support.js';

// The support card: in the middle, twice a visit at most (as the page opens
// with only "OK", then a few minutes later with "Never show this again"),
// and never again once a viewer has said so.

// A browser's storage, as far as the card uses it.
const storage = (kept = {}) => ({
  kept,
  getItem: (key) => (key in kept ? kept[key] : null),
  setItem: (key, value) => { kept[key] = String(value); },
});
const blocked = () => { throw new Error('storage is blocked'); };
const refusing = () => ({ getItem: blocked, setItem: blocked });

test('the studio\'s Ko-fi page, as a plain link: Ko-fi\'s cup from TreeLab\'s files, and our words', () => {
  assert.equal(KOFI, 'https://ko-fi.com/Z1K222EED7');
  // (Nothing loaded from Ko-fi: no script, picture or frame from its site. A link sends nothing until it's clicked.)
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!/(src|srcset)="[^"]*ko-fi\.com|storage\.ko-fi|<iframe/i.test(page));
  // (A dialog in the middle, with OK, and "never" hidden until the second ask.)
  assert.match(page, /<dialog id="support"/);
  assert.match(page, /id="support-ok"/);
  assert.match(page, /id="support-never"[^>]*hidden/);
  // (The button: Ko-fi's cup, a picture of TreeLab's own, a PNG with nothing written in it but the image; and our words.)
  assert.ok(KOFI_CUP.startsWith('file:') && KOFI_CUP.endsWith('/src/assets/kofi-cup.png'));
  const png = readFileSync(new URL(KOFI_CUP));
  assert.equal(png.toString('latin1', 1, 4), 'PNG');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [122, 122]);
  assert.match(page, /Support us on Ko-fi<\/span>/);
});

test('a line at random each time, "Enjoying TreeLab?" only on the second, never the same twice running', () => {
  assert.deepEqual(LINES, ['Made with tree.js. Help it keep growing?', 'Help us branch out.', 'Leaf us a tip.', 'With your donations we can really get our roots in.']);
  assert.deepEqual(LATER_LINES, [...LINES, 'Enjoying TreeLab? Support our development on Ko-fi.']);
  assert.equal(PLAIN_LINE, 'TreeLab is free, made by a small studio.');
  // (The first ask: only the four, whatever the dice say.)
  const firsts = new Set([0, 0.24, 0.26, 0.5, 0.74, 0.99, 1].map((r) => lineFor('first', null, () => r)));
  assert.deepEqual([...firsts].sort(), [...LINES].sort());
  // (The second: any of the five but the one just shown.)
  for (const last of LATER_LINES) {
    const seconds = new Set([0, 0.2, 0.4, 0.6, 0.8, 0.99].map((r) => lineFor('second', last, () => r)));
    assert.ok(!seconds.has(last) && seconds.size === 4, `after "${last}"`);
  }
  assert.ok(LATER_LINES.includes(lineFor('second', 'Leaf us a tip.', () => 0.99)));
});

test('the second ask: five minutes after the first, or as long as the address asks', () => {
  assert.equal(SUPPORT_AFTER, 300);
  assert.equal(supportDelay(''), 300);
  assert.equal(supportDelay('?support=10s'), 10);
  assert.equal(supportDelay('?support=10'), 10);
  assert.equal(supportDelay('?support=2m'), 120);
  assert.equal(supportDelay('?support=soon'), 300);
});

test('a visit: the first ask, then the second, then nothing; a new tab starts again', () => {
  const store = storage(), session = storage();
  const due = () => askDue({ store: () => store, session: () => session });
  assert.equal(due(), 'first');
  assert.equal(setAsksMade(1, () => session), true);
  assert.equal(due(), 'second');
  assert.deepEqual(session.kept, { [SUPPORT_VISIT]: '1' });
  setAsksMade(2, () => session);
  assert.equal(asksMade(() => session), 2);
  assert.equal(due(), null);
  // (A new tab is a new visit; nothing was kept beyond the tab.)
  assert.equal(askDue({ store: () => store, session: () => storage() }), 'first');
  assert.deepEqual(store.kept, {});
  // (Anything else in the tab's note reads as a fresh visit.)
  assert.equal(asksMade(() => storage({ [SUPPORT_VISIT]: 'seen' })), 0);
});

test('"never show this again" is kept in the browser, and ends every ask', () => {
  const store = storage();
  assert.equal(turnSupportOff(() => store), true);
  assert.deepEqual(store.kept, { [SUPPORT_STORE]: 'never' });
  assert.equal(supportIsOff(() => store), true);
  assert.equal(askDue({ store: () => store, session: () => storage() }), null);
  assert.equal(askDue({ store: () => store, session: () => storage({ [SUPPORT_VISIT]: '1' }) }), null);
});

test('where the browser keeps nothing, the card still asks and keeps nothing', () => {
  assert.equal(supportIsOff(refusing), false);
  assert.equal(turnSupportOff(refusing), false);
  assert.equal(setAsksMade(1, refusing), false);
  assert.equal(asksMade(refusing), 0);
  assert.equal(askDue({ store: refusing, session: refusing }), 'first');
  assert.equal(askDue({ store: blocked, session: blocked }), 'first');
});
