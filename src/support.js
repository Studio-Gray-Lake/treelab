// The support card (index.html: #support): a card in the middle of the
// screen that asks whether the viewer would like to support the studio on
// Ko-fi. A trial, before any paid version: what it brings is read from
// Ko-fi's own count of supporters.
//
// - Twice a visit at most. The first ask comes as the page opens (once the
//   welcome card, if it shows, is closed), with only "OK". The second comes
//   after a few minutes with the page in view, with "OK" and "Never show this
//   again". After it, nothing more that visit. A reload in the same tab
//   carries on where the visit was; a new tab is a new visit.
// - Following the Ko-fi link counts as an answer: no more asks that visit.
// - A plain link to the studio's Ko-fi page, drawn as a button in Ko-fi's
//   look: Ko-fi's cup (cut from its own button, served from TreeLab's own
//   files) and our words, "Support us on Ko-fi": no Ko-fi script and nothing loaded from Ko-fi, so Ko-fi
//   sees nothing until someone clicks.
// - "Never show this again" is kept in this browser only: never in settings
//   or links, and nothing about the viewer is kept anywhere.
// - The time before the second ask counts only while the page is in view and
//   no card of TreeLab's own (welcome, log, share) is open.

// The studio's Ko-fi page.
export const KOFI = 'https://ko-fi.com/Z1K222EED7';
// Ko-fi's cup (122 by 122, cut from Ko-fi's own button), bundled with TreeLab: the card's button is the cup and our own words.
export const KOFI_CUP = new URL('./assets/kofi-cup.png', import.meta.url).href;

// What an ask says: a line picked at random each time, over one plain line
// that says what's being asked, for anyone the pun passes by. "Enjoying
// TreeLab?" only on the second ask: the first comes before the viewer has
// done anything. Picked at random rather than in turn, so nothing more is
// kept in the browser.
export const LINES = [
  'Made with tree.js. Help it keep growing?',
  'Help us branch out.',
  'Leaf us a tip.',
  'With your donations we can really get our roots in.',
];
export const LATER_LINES = [...LINES, 'Enjoying TreeLab? Support our development on Ko-fi.'];
export const PLAIN_LINE = 'TreeLab is free, made by a small studio.';

// A line for this ask, never the one the visit last showed (`last`), from
// `random` (0 to 1).
export function lineFor(which, last = null, random = Math.random) {
  const lines = (which === 'second' ? LATER_LINES : LINES).filter((line) => line !== last);
  return lines[Math.min(lines.length - 1, Math.floor(random() * lines.length))];
}

// How long the page is in view between the first ask and the second: five
// minutes, or ?support=<n>s (or <n>m) in the address, to try it out.
export const SUPPORT_AFTER = 5 * 60;
export function supportDelay(search = '') {
  const asked = new URLSearchParams(search).get('support')?.match(/^(\d+(?:\.\d+)?)([sm]?)$/);
  if (!asked) return SUPPORT_AFTER;
  return Number(asked[1]) * (asked[2] === 'm' ? 60 : 1);
}

// Where the browser keeps "never show this again" (this browser's own), and
// how far this visit has got (this tab's own): "1" after the first ask,
// "2" when there's nothing more to ask.
export const SUPPORT_STORE = 'treelab.support';
export const SUPPORT_VISIT = 'treelab.support.visit';
const NEVER = 'never';

// Storage, where the browser gives it: asking for it can itself fail (it's
// blocked, or a private window), and then nothing is kept.
function read(store, key) {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}
function write(store, key, value) {
  try {
    store().setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export const supportIsOff = (store = () => localStorage) => read(store, SUPPORT_STORE) === NEVER;
export const turnSupportOff = (store = () => localStorage) => write(store, SUPPORT_STORE, NEVER);

// How many asks this visit has had (0, 1 or 2), and setting it.
export function asksMade(session = () => sessionStorage) {
  const n = Number(read(session, SUPPORT_VISIT));
  return n === 1 || n === 2 ? n : 0;
}
export const setAsksMade = (n, session = () => sessionStorage) => write(session, SUPPORT_VISIT, String(n));

// Which ask is due this visit: 'first', 'second' or null (none: the viewer
// said never, or the visit has had both).
export function askDue({ store, session } = {}) {
  if (supportIsOff(store)) return null;
  return ['first', 'second', null][asksMade(session)];
}
