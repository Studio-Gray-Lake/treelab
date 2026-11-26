// A card made wider or narrower by dragging its edge: the settings on the
// right by their left edge, the kind's on the left by their right edge. What
// src/main.js needs worked out (no page here).
//
// How wide a card is is this viewer's own, kept in the browser like which
// cards are folded: never in settings or links.

// The narrowest a card goes (px): its rows still read.
export const LEAST = 220;

// The widest: three fifths of the window, so the trees still show.
export const mostFor = (windowWidth) => Math.max(LEAST, Math.round(windowWidth * 0.6));

// A card's width after its edge was dragged `moved` px to the right.
// grows: 1 if the card widens that way (its right edge is the one dragged),
// -1 if it narrows (its left edge).
export function widthAfter(start, moved, { grows = 1, least = LEAST, most = Infinity } = {}) {
  return Math.round(Math.min(most, Math.max(least, start + grows * moved)));
}

// The kept widths as text ("panel:480,left:420") and back. Anything that
// isn't a card's name and a sensible number of px is left out.
export const writeWidths = (widths) => Object.entries(widths).filter(([, w]) => Number.isFinite(w)).map(([name, w]) => `${name}:${Math.round(w)}`).join(',');
export function readWidths(text, names) {
  const out = {};
  for (const part of String(text ?? '').split(',')) {
    const [name, value] = part.split(':');
    const w = Number(value);
    if (names.includes(name) && Number.isFinite(w) && w >= LEAST && w <= 4000) out[name] = Math.round(w);
  }
  return out;
}
