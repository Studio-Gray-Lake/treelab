import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KOFI, KOFI_BUTTON, SUPPORT_AFTER, SUPPORT_STORE, SUPPORT_VISIT, markSeen, seenThisVisit, showsSupport, supportDelay, supportIsOff, supportPlace, turnSupportOff } from '../src/support.js';

// The support card: once a visit, after a few minutes in view, in the
// corner clear of the settings; never again once a viewer has said so.

// A browser's storage, as far as the card uses it.
const storage = (kept = {}) => ({
  kept,
  getItem: (key) => (key in kept ? kept[key] : null),
  setItem: (key, value) => { kept[key] = String(value); },
});
const blocked = () => { throw new Error('storage is blocked'); };
const refusing = () => ({ getItem: blocked, setItem: blocked });

test('the studio\'s Ko-fi page, as a plain link with Ko-fi\'s own button from TreeLab\'s files', () => {
  assert.equal(KOFI, 'https://ko-fi.com/Z1K222EED7');
  // (Nothing loaded from Ko-fi: no script, picture or frame from its site. A link sends nothing until it's clicked.)
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!/(src|srcset)="[^"]*ko-fi\.com|storage\.ko-fi|<iframe/i.test(page));
  assert.match(page, /id="support"[^>]*hidden/);
  // (The button is a picture of TreeLab's own, a PNG with nothing written in it but the image.)
  assert.ok(KOFI_BUTTON.startsWith('file:') && KOFI_BUTTON.endsWith('/src/assets/kofi-support.png'));
  const png = readFileSync(new URL(KOFI_BUTTON));
  assert.equal(png.toString('latin1', 1, 4), 'PNG');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [980, 198]);
});

test('after five minutes in view, or as long as the address asks', () => {
  assert.equal(SUPPORT_AFTER, 300);
  assert.equal(supportDelay(''), 300);
  assert.equal(supportDelay('?support=10s'), 10);
  assert.equal(supportDelay('?support=10'), 10);
  assert.equal(supportDelay('?support=2m'), 120);
  assert.equal(supportDelay('?support=soon'), 300);
});

test('once a visit: shown, it isn\'t shown again in that tab', () => {
  const store = storage(), session = storage();
  assert.equal(showsSupport({ store: () => store, session: () => session }), true);
  assert.equal(markSeen(() => session), true);
  assert.equal(seenThisVisit(() => session), true);
  assert.deepEqual(session.kept, { [SUPPORT_VISIT]: 'seen' });
  assert.equal(showsSupport({ store: () => store, session: () => session }), false);
  // (A new tab is a new visit.)
  assert.equal(showsSupport({ store: () => store, session: () => storage() }), true);
  assert.deepEqual(store.kept, {});
});

test('"never show this again" is kept in the browser, and nothing else is', () => {
  const store = storage();
  assert.equal(turnSupportOff(() => store), true);
  assert.deepEqual(store.kept, { [SUPPORT_STORE]: 'never' });
  assert.equal(supportIsOff(() => store), true);
  assert.equal(showsSupport({ store: () => store, session: () => storage() }), false);
});

test('where the browser keeps nothing, the card still works and keeps nothing', () => {
  assert.equal(supportIsOff(refusing), false);
  assert.equal(turnSupportOff(refusing), false);
  assert.equal(markSeen(refusing), false);
  assert.equal(showsSupport({ store: refusing, session: refusing }), true);
  assert.equal(showsSupport({ store: blocked, session: blocked }), true);
});

test('in the corner, clear of the settings panel', () => {
  const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  // (A panel down the right side, reaching the bottom: the card stands to its left.)
  assert.deepEqual(supportPlace(box(1168, 12, 420, 876), 1600, 900), { right: 444, bottom: 12 });
  // (A short or folded panel leaves the corner free.)
  assert.deepEqual(supportPlace(box(1168, 12, 420, 60), 1600, 900), { right: 12, bottom: 12 });
  // (A phone: the panel across the bottom, the card above it.)
  assert.deepEqual(supportPlace(box(12, 400, 366, 400), 390, 812), { right: 12, bottom: 424 });
  // (No panel shown: the corner.)
  assert.deepEqual(supportPlace(box(0, 0, 0, 0), 1600, 900), { right: 12, bottom: 12 });
  assert.deepEqual(supportPlace(null, 1600, 900), { right: 12, bottom: 12 });
});
