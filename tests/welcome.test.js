import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ABOUT, WELCOME_STORE, opensOnAView, showsWelcome, turnWelcomeOff, welcomeIsOff } from '../src/welcome.js';
import { defaultSettings, toLink } from '../src/settings.js';

// The welcome card: shown on a first visit, not to someone sent a view by a
// link, and not again once a viewer has said so.

// A browser's storage, as far as the card uses it.
const storage = (kept = {}) => ({
  kept,
  getItem: (key) => (key in kept ? kept[key] : null),
  setItem: (key, value) => { kept[key] = String(value); },
});
const blocked = () => { throw new Error('storage is blocked'); };
const refusing = () => ({ getItem: blocked, setItem: blocked });

test('a first visit opens with the card', () => {
  assert.equal(showsWelcome({ hash: '', store: () => storage() }), true);
  assert.equal(showsWelcome({ hash: '#', store: () => storage() }), true);
});

test('"don\'t show this again" is remembered, and "OK" is not', () => {
  const box = storage();
  // (OK keeps nothing: the next visit shows the card again.)
  assert.equal(showsWelcome({ hash: '', store: () => box }), true);
  assert.deepEqual(box.kept, {});
  assert.equal(turnWelcomeOff(() => box), true);
  assert.equal(welcomeIsOff(() => box), true);
  assert.equal(showsWelcome({ hash: '', store: () => box }), false);
  assert.deepEqual(Object.keys(box.kept), [WELCOME_STORE], 'it keeps one thing, under its own name');
});

test('other things the browser keeps for TreeLab don\'t turn the card off', () => {
  const box = storage({ 'treelab.settings': '{}', 'treelab.folded': 'info', [WELCOME_STORE]: 'something else' });
  assert.equal(showsWelcome({ hash: '', store: () => box }), true);
});

test('with storage blocked the card still works, and shows again', () => {
  // (Asking for the storage can itself fail, or each use of it.)
  for (const store of [blocked, refusing, () => undefined]) {
    assert.equal(welcomeIsOff(store), false);
    assert.equal(turnWelcomeOff(store), false);
    assert.equal(showsWelcome({ hash: '', store }), true);
  }
});

test('someone sent a view by a link is not shown the card', () => {
  const settings = defaultSettings();
  settings.tab = 'forest';
  const share = `#s=${toLink(settings)}`;
  assert.equal(opensOnAView(share), true);
  assert.equal(showsWelcome({ hash: share, store: () => storage() }), false);
  // (TreeLab's first links.)
  assert.equal(opensOnAView('#kind=fir&seed=3&variant=1'), true);
  assert.equal(showsWelcome({ hash: '#kind=fir&seed=3&variant=1', store: () => storage() }), false);
  // (Anything else in the address is not a view.)
  for (const hash of ['', '#', '#top', '#seed=3', '#x=s=1']) assert.equal(opensOnAView(hash), false, hash);
});

test('the page has the card, and the link goes to the studio\'s website', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const card = page.match(/<dialog id="welcome"[\s\S]*?<\/dialog>/)?.[0];
  assert.ok(card, 'index.html has <dialog id="welcome">');
  for (const id of ['welcome-ok', 'welcome-never', 'welcome-about', 'welcome-phone']) assert.ok(card.includes(`id="${id}"`), `the card has #${id}`);
  assert.match(card, />OK</);
  assert.match(card, />Don't show this again</);
  assert.match(card, />What is TreeLab\?</);
  assert.ok(!/href="http/.test(card), 'the address is src/welcome.js\'s ABOUT, not written into the page');
  const about = new URL(ABOUT);
  assert.equal(about.protocol, 'https:');
  assert.equal(about.hostname, 'studiograylake.com');
  assert.ok(about.pathname.startsWith('/news/') && about.pathname.endsWith('/'));
});
