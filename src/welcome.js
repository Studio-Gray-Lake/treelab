// The welcome card (index.html: #welcome): whether a visit opens with it,
// and remembering that a viewer asked not to see it again.

// "What is TreeLab?" goes here: the news post on the studio's website.
export const ABOUT = 'https://studiograylake.com/news/treelab-0-3/';

// Where the browser keeps "don't show this again" (this viewer's own: never
// in settings or links).
export const WELCOME_STORE = 'treelab.welcome';
const OFF = 'off';

// Whether the address carries a view: a share link (#s=…), or one of
// TreeLab's first links (#kind=…&seed=…&variant=…).
export function opensOnAView(hash = '') {
  const text = hash.replace(/^#/, '');
  return text.startsWith('s=') || new URLSearchParams(text).has('kind');
}

// Whether this viewer asked not to see the card again. `store` gives the
// browser's storage; where there is none, or it's blocked (asking for it
// can itself fail), nobody has asked.
export function welcomeIsOff(store = () => localStorage) {
  try {
    return store().getItem(WELCOME_STORE) === OFF;
  } catch {
    return false;
  }
}

// "Don't show this again." True if the browser kept it; false where it
// keeps nothing, and the card shows again on the next visit.
export function turnWelcomeOff(store = () => localStorage) {
  try {
    store().setItem(WELCOME_STORE, OFF);
    return true;
  } catch {
    return false;
  }
}

// Whether a visit opens with the card: not for someone sent a view by a
// link (they came to see that view), and not for a viewer who asked not to
// see it again.
export const showsWelcome = ({ hash = '', store } = {}) => !opensOnAView(hash) && !welcomeIsOff(store);
