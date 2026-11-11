import { cellsOf, pushOf } from './chance.js';

// The noise that shapes the oak's merged masses of leaves (./leafMass.js).
//
// The lumps are the base, and noise shapes them, two ways:
// - it bends them: a slow pattern over space carries every place a little
//   way off before the lumps are asked about it, so the round shapes go
//   out of round;
// - it billows them: a pattern swells the leaves in one place and thins
//   them in the next, so a mass billows, and where it runs thin it opens.
//   The pattern is in layers: a broad one, and finer, weaker ones on top
//   of it (the "detail").
//
// What can be chosen (the oak's "noise" panel): the pattern's type, how
// big its broad layer is, how many finer layers lie on it, how far it
// bends, and how strongly it billows. The usual pattern (USUAL_PATTERN) is
// the one the masses had before any of it could be chosen.
//
// A layer finer than the masses' facets can't be drawn: sampled once a
// facet, it's no pattern at all, only each corner pushed its own way. So a
// layer fades out as it gets finer than the facets (shows()), and so does
// the bending.

// The types: what the billowing pattern is like.
// - smooth: soft swells and dips;
// - creased: puffs, with thin sharp creases between them;
// - ridged: the other way up: thin sharp ridges, with soft dips between;
// - cells: round clumps, one to a cell, with seams between them.
export const NOISE_TYPES = ['smooth', 'creased', 'ridged', 'cells'];

// The usual pattern, at full noise (1): the bends carry a place this far
// (bend, m) in a pattern `over` m across; the broad layer is `size` m
// across and swells and thins the leaves this much (swell); the first
// finer layer is finer.size m across and this strong (finer.swell), and
// each one after it finer and weaker again by the same shares; and the
// smallest piece of a mass kept (least, in four-sided faces: smaller ones
// are bits the noise pinched off).
export const NOISE = { bend: 1.1, over: 3.2, size: 2.4, swell: 1.7, finer: { size: 0.95, swell: 0.9 }, least: 12 };
const FINER = NOISE.finer.size / NOISE.size;     // a layer's size over the one before's
const WEAKER = NOISE.finer.swell / NOISE.swell;  // and its strength
export const MOST_LAYERS = 4;                    // finer layers, at most

export const USUAL_PATTERN = { type: 'smooth', size: NOISE.size, detail: 1, bend: NOISE.bend, billow: 1 };

// The smooth pattern's spread, and the others' middles and spreads
// (measured over 400,000 places: .scratch/pattern-stats.mjs), so that
// every type is about nothing on average and spreads as far as the smooth
// one: the same amount of noise is then about as strong in each.
const SPREAD = 0.1849;
const SIZE = { mean: 0.1516, spread: 0.1059 };   // of the smooth pattern's size (how far from nothing)
const CELL = { mean: 0.5205, spread: 0.1723 };   // of how far the nearest cell's point is

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// One layer's pattern over space: (x, y, z) => a number, about nothing on
// average, more where the leaves are to swell and less where they thin.
// The same seed gives the same pattern (and the creased and the ridged
// follow the smooth one's of the same seed: their creases and ridges run
// where it passes through nothing).
export function patternOf(type, seed) {
  if (type === 'cells') {
    const far = cellsOf(seed);
    return (x, y, z) => (CELL.mean - far(x, y, z)) * (SPREAD / CELL.spread);
  }
  const smooth = pushOf(seed);
  if (type === 'creased') return (x, y, z) => (Math.abs(smooth(x, y, z)) - SIZE.mean) * (SPREAD / SIZE.spread);
  if (type === 'ridged') return (x, y, z) => (SIZE.mean - Math.abs(smooth(x, y, z))) * (SPREAD / SIZE.spread);
  return smooth;
}

// How much of a pattern `across` m across shows on facets `cell` m big:
// all of it if it's no finer than the facets, none at half their size.
export function shows(across, cell) {
  const t = clamp((across - 0.5 * cell) / (0.5 * cell));
  return t * t * (3 - 2 * t);
}

// A pattern as it was asked for, made whole and kept within what there
// is: { type, size, detail, bend, billow }.
export function patternFrom(pattern = {}) {
  const asked = { ...USUAL_PATTERN, ...pattern };
  return {
    type: NOISE_TYPES.includes(asked.type) ? asked.type : USUAL_PATTERN.type,
    size: Math.max(0.01, asked.size),
    detail: clamp(Math.round(asked.detail), 0, MOST_LAYERS),
    bend: Math.max(0, asked.bend),
    billow: Math.max(0, asked.billow),
  };
}

// The billowing's layers, for facets `cell` m big: [{ value: the layer's
// pattern, size: m across, strength }], the broad one first; those too
// fine to show at all left out. seed: the tree's.
export function layersOf(pattern, cell, seed) {
  const { type, size, detail } = patternFrom(pattern);
  const scale = size / NOISE.size; // (1 at the usual size)
  const layers = [];
  for (let k = 0; k <= detail; k++) {
    const across = k === 0 ? NOISE.size * scale : NOISE.finer.size * scale * FINER ** (k - 1);
    const shown = shows(across, cell);
    if (!(shown > 0)) continue;
    const strength = (k === 0 ? NOISE.swell : NOISE.finer.swell * WEAKER ** (k - 1)) * shown;
    const own = k === 0 ? seed ^ 0x5bd1e995 : k === 1 ? seed ^ 0x27d4eb2f : seed ^ Math.imul(k, 0x9e3779b1);
    layers.push({ value: patternOf(type, own >>> 0), size: across, strength });
  }
  return layers;
}

// How far the bends carry a place at most (m), for an amount of noise and
// facets `cell` m big, and how big their pattern is (m across).
export function bendOf(pattern, noise, cell) {
  const { size, bend } = patternFrom(pattern);
  const over = NOISE.over * (size / NOISE.size);
  return { far: Math.max(0, noise) * bend * shows(over, cell), over };
}
