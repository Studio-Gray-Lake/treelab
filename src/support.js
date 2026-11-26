// The support card (index.html: #support): after a few minutes with the
// page in view, a small card in the corner asks, once a visit, whether the
// viewer would like to support the studio on Ko-fi. A trial, before any paid
// version: what it brings is read from Ko-fi's own count of supporters.
//
// - A plain link to the studio's Ko-fi page, drawn as Ko-fi's own button (a
//   picture from Ko-fi's button kit, served from TreeLab's own files, as the
//   workshop's was): no Ko-fi script and nothing loaded from Ko-fi, so Ko-fi
//   sees nothing until someone clicks.
// - Once a visit: shown, it isn't shown again in that tab, even on a reload
//   (a new tab is a new visit). "Not now" just puts it away.
// - "Never show this again" is kept in this browser only: never in settings
//   or links, and nothing about the viewer is kept anywhere.
// - Its time counts only while the page is in view and no card of TreeLab's
//   own (welcome, log, share) is open.

// The studio's Ko-fi page.
export const KOFI = 'https://ko-fi.com/Z1K222EED7';
// Ko-fi's own button (980 by 198), bundled with TreeLab.
export const KOFI_BUTTON = new URL('./assets/kofi-support.png', import.meta.url).href;

// How long the page is in view before the card: five minutes, or
// ?support=<n>s (or <n>m) in the address, to try it out.
export const SUPPORT_AFTER = 5 * 60;
export function supportDelay(search = '') {
  const asked = new URLSearchParams(search).get('support')?.match(/^(\d+(?:\.\d+)?)([sm]?)$/);
  if (!asked) return SUPPORT_AFTER;
  return Number(asked[1]) * (asked[2] === 'm' ? 60 : 1);
}

// Where the browser keeps "never show this again" (this browser's own), and
// that the card was shown this visit (this tab's own).
export const SUPPORT_STORE = 'treelab.support';
export const SUPPORT_VISIT = 'treelab.support.visit';
const NEVER = 'never';
const SEEN = 'seen';

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
export const seenThisVisit = (session = () => sessionStorage) => read(session, SUPPORT_VISIT) === SEEN;
export const markSeen = (session = () => sessionStorage) => write(session, SUPPORT_VISIT, SEEN);

// Whether this visit may still show the card.
export const showsSupport = ({ store, session } = {}) => !supportIsOff(store) && !seenThisVisit(session);

// Where the card stands, clear of the settings panel: { right, bottom } in
// px, given the panel's box and the window's size. A panel across the
// bottom (a phone) puts the card above it; a panel down the right side that
// reaches the bottom corner puts it to the panel's left; otherwise, the
// corner itself.
export function supportPlace(panel, width, height, gap = 12, room = 160) {
  if (!panel || panel.width <= 0) return { right: gap, bottom: gap };
  if (panel.width > width * 0.6) return { right: gap, bottom: Math.max(gap, height - panel.top + gap) };
  if (panel.bottom > height - room) return { right: Math.max(gap, width - panel.left + gap), bottom: gap };
  return { right: gap, bottom: gap };
}
