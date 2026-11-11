import { limitsFor } from './limits.js';
import { PRESETS, presetShape } from './presets.js';

// A tree's age, as a slider that moves the others.
//
// A kind that has it (the oak) has a ready-made shape for each stage of its
// life in the open (src/presets.js): young, grown, ancient, each at an age.
// The age slider sets every setting those shapes differ in to what it is at
// that age, between the stage before and the stage after: its height, its
// crown's width and outline, its bare trunk, its thickness, its limbs,
// its leaves' clusters, its marks, its foot and roots. The sliders move in
// plain sight, and any of them can be moved by hand afterwards: age is a
// place to start from, like "start from", only without steps.
//
// How a setting goes from one stage to the next:
// - a tree's thickness and the marks of its age (gnarl, burrs, hollows,
//   stubs, its foot's flare, its roots) by the years: wood is laid on year
//   by year, and the marks come late;
// - everything else by the age's logarithm: a tree does most of its
//   growing up and out early, so the step from 15 years to 50 is about as
//   big as from 50 to 150.
// Younger than the first stage or older than the last, it carries on the
// same way, as far as each slider goes.
//
// (It's an oak grown in the open at that age. What neighbours do to a tree,
// the forest-grown oak, is not an age: the age slider doesn't know it yet.)

export const AGES = {
  oak: [{ age: 15, preset: 'young' }, { age: 150, preset: 'open-grown' }, { age: 500, preset: 'ancient' }],
};
const BY_YEARS = new Set(['girth', 'gnarl', 'burrs', 'hollows', 'stubs', 'flare', 'roots']);

// The settings a kind's age moves: those its stages' shapes differ in.
export function ageKeys(kind) {
  const stages = (AGES[kind] ?? []).map(({ preset }) => presetShape(kind, preset));
  if (stages.length < 2) return [];
  return Object.keys(stages[0]).filter((key) => key !== 'age' && stages.some((shape) => JSON.stringify(shape[key]) !== JSON.stringify(stages[0][key])));
}

// Those settings at an age: { setting: value } (a number, or [least, most]),
// each on its slider's steps and inside its slider.
export function atAge(kind, age) {
  const stages = AGES[kind];
  if (!stages) return {};
  const shapes = stages.map(({ preset }) => presetShape(kind, preset));
  // The two stages it's between (or beyond the first or the last pair).
  let i = 0;
  while (i < stages.length - 2 && age > stages[i + 1].age) i++;
  const a = stages[i], b = stages[i + 1];
  const out = {};
  for (const key of ageKeys(kind)) {
    const exact = stages.findIndex((stage) => stage.age === age);
    if (exact >= 0) {
      out[key] = structuredClone(shapes[exact][key]);
      continue;
    }
    const t = BY_YEARS.has(key) ? (age - a.age) / (b.age - a.age) : Math.log(age / a.age) / Math.log(b.age / a.age);
    const [lo, hi, step] = limitsFor(key, shapes[i][key], kind);
    const digits = Number.isInteger(step) ? 0 : Math.min(4, String(step).split('.')[1]?.length ?? 2);
    const fit = (from, to) => {
      const v = Math.min(hi, Math.max(lo, from + (to - from) * t));
      return Number((Math.round((v - lo) / step) * step + lo).toFixed(digits));
    };
    const from = shapes[i][key], to = shapes[i + 1][key];
    out[key] = Array.isArray(from) ? [fit(from[0], to[0]), fit(from[1], to[1])].sort((p, q) => p - q) : fit(from, to);
  }
  return out;
}

// A shape put to an age, in place (its arrays stay the same arrays, so the
// panel's rows stay bound to them). Returns the shape.
export function applyAge(kind, shape, age) {
  for (const [key, value] of Object.entries(atAge(kind, age))) {
    if (!(key in shape)) continue;
    if (Array.isArray(value) && Array.isArray(shape[key])) shape[key].splice(0, shape[key].length, ...value);
    else shape[key] = value;
  }
  if ('age' in shape) shape.age = age;
  return shape;
}

// Whether a kind has ages (and so an age slider).
export const hasAges = (kind) => Boolean(AGES[kind]) && Object.keys(PRESETS[kind] ?? {}).length > 0;

// --- Ages in a forest ----------------------------------------------------------------------

// A forest grows a few shapes of a kind and plants each many times
// (src/forest.js: its "variants"). With "several ages" on for a kind
// (src/settings.js: forest.mix), each of those shapes has an age of its
// own, from the range asked for, and is the Tree tab's tree at that age.

const BY_SIZE = new Set(['height', 'spread', 'trunk', 'girth', 'clumpSize']);

// The ages of a kind's shapes in a forest: `count` of them, spread over
// [least, most] years, the first the youngest. They're spread evenly by
// the age's logarithm, not by the years: a tree changes most while it's
// young, so from 20 to 400 years the shapes are 26, 42, 70, 115, 189 and
// 311 years old, each about as different from the next. old: 0.5 as
// described; toward 0 mostly young (a few old ones); toward 1 mostly old.
export function agesOf(count, [least, most], old = 0.5) {
  const power = Math.pow(4, 0.5 - Math.min(1, Math.max(0, old)));
  return Array.from({ length: count }, (_, i) => Math.round(least * Math.pow(most / least, Math.pow((i + 0.5) / count, power))));
}

// A shape at another age: what its age moves is put to that age, and what
// was changed by hand since the age set it goes along. A size (height,
// crown width, bare trunk, thickness, cluster size) changed to so many
// times its age's own is so many times the other age's; anything else
// changed by so much is changed by as much. A new shape; the one given is
// left as it is.
export function reAged(kind, shape, age) {
  const out = structuredClone(shape);
  if (!AGES[kind] || !('age' in shape) || age === shape.age) return out;
  const was = atAge(kind, shape.age), now = atAge(kind, age);
  for (const key of Object.keys(now)) {
    if (!(key in shape)) continue;
    const [lo, hi, step] = limitsFor(key, shape[key], kind);
    const carry = (mine, base, target) => {
      const v = Math.min(hi, Math.max(lo, BY_SIZE.has(key) && base > 0 ? target * (mine / base) : target + (mine - base)));
      return Number.isInteger(step) ? Math.round(v) : v;
    };
    out[key] = Array.isArray(now[key]) ? [0, 1].map((i) => carry(shape[key][i], was[key][i], now[key][i])).sort((p, q) => p - q) : carry(shape[key], was[key], now[key]);
  }
  out.age = age;
  return out;
}
