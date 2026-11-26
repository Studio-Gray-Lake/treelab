import { DEFAULT_SHAPES } from './kinds.js';
import { BEECH_FOREST, BEECH_STAGES, HAWTHORN_PLACES, HAWTHORN_STAGES, HAZEL_PLACES, HAZEL_STAGES, HOLLY_FOREST, HOLLY_STAGES, ASH_FOREST, ASH_STAGES, BIRCH_FOREST, BIRCH_STAGES, LINDEN_FOREST, LINDEN_STAGES } from './oak/broadleaves.js';
import { limitsFor, sliderKind } from './limits.js';

// Ready-made shapes to start a kind from (the shape panel's "start from"):
// the workshop's own, and a few that show how far the sliders reach. Each
// lists only what it changes from the workshop's; anything the generator
// doesn't have (or has reshaped since) is left out when it's applied.

export const PRESETS = {
  // TreeLab's own English oak: "open-grown" is its default. Each has its
  // crown's outline (reachBottom to reachTop): the open-grown oak's broad
  // dome; a young one's narrow egg; a forest oak's crown, short-branched
  // below and wide only near the top, on a trunk that carries on up through
  // it; an ancient one's low spread, flat on top and open underneath.
  // Young, open-grown and ancient are also the stages the age slider goes
  // between (src/age.js), each at its age.
  oak: {
    'open-grown': {},
    young: { age: 15, height: [5, 8], spread: [0.6, 0.8], trunk: [0.8, 1.4], girth: [0.07, 0.11], limbs: [3, 4], crooked: 0.2, droop: 0.1, clumpSize: [0.7, 1.1], gnarl: 0.02, burrs: 0, stubs: 0, flare: 0.15, roots: 0, reachLow: 0.7, reachMid: 1, reachHigh: 0.75, reachTop: 0.1 },
    'forest-grown': { height: [26, 31], spread: [0.4, 0.55], trunk: [8, 11], girth: [0.45, 0.6], limbs: [3, 4], crooked: 0.25, droop: 0.1, crowded: 1, clumpSize: [1.6, 2.4], gnarl: 0.08, burrs: 0.1, stubs: 0.5, flare: 0.3, roots: 0.2, reachLow: 0.3, reachMid: 0.6, reachHigh: 1, reachTop: 0.3 },
    ancient: { age: 500, height: [12, 16], spread: [1.15, 1.45], trunk: [2, 3], girth: [1.1, 1.4], lean: [2, 8], limbs: [4, 6], crooked: 0.75, droop: 0.55, leafiness: 0.45, clumpSize: [1.4, 2.4], gnarl: 0.8, burrs: 0.7, hollows: 0.67, stubs: 0.7, flare: 0.7, roots: 0.7, reachBottom: 0.3, reachLow: 1.1, reachMid: 1, reachHigh: 0.85, reachTop: 0.3 },
  },
  // TreeLab's own beech (src/oak/broadleaves.js): "open-grown" is its
  // default: a great dense dome on a short trunk, its lowest limbs sweeping
  // down. Young: slim and pointed, with a clear leader. Forest-grown: a
  // clean column with a narrow crown at its top. Old: thicker, wider, its
  // lowest limbs to the ground. Young, open-grown and old are the stages
  // its age slider goes between.
  beech: { 'open-grown': {}, young: BEECH_STAGES.young, 'forest-grown': BEECH_FOREST, old: BEECH_STAGES.old },
  // TreeLab's own hawthorn (src/oak/broadleaves.js): "open-grown" is its
  // default: a small dense round tree on a short, leaning, fluted trunk.
  // Young: a thin upright bush of a tree. Forest-grown: under taller
  // trees, drawn up thin, its crown open. Wind-swept: low and bowed over,
  // its crown to the lee. Old: wider, its trunk thick, hollow and deeply
  // fluted. Young, open-grown and old are the stages its age slider goes
  // between.
  hawthorn: { 'open-grown': {}, young: HAWTHORN_STAGES.young, 'forest-grown': HAWTHORN_PLACES['forest-grown'], 'wind-swept': HAWTHORN_PLACES['wind-swept'], old: HAWTHORN_STAGES.old },
  // TreeLab's own hazel (src/oak/broadleaves.js): a shrub of many stems
  // from one stool. "open-grown" is its default: twenty-five years uncut,
  // about as wide as tall. Young: a few thin rods. Coppiced: cut to the
  // stool seven years ago, a sheaf of straight rods. Forest-grown: under
  // taller trees, drawn up, leaning out, its crown open. Old: long uncut,
  // a few thick stems on a wide stool. Young, open-grown and old are the
  // stages its age slider goes between.
  hazel: { 'open-grown': {}, young: HAZEL_STAGES.young, coppiced: HAZEL_PLACES.coppiced, 'forest-grown': HAZEL_PLACES['forest-grown'], old: HAZEL_STAGES.old },
  // TreeLab's own holly (src/oak/broadleaves.js): "open-grown" is its
  // default: a dense dark pyramid with branches nearly to the ground.
  // Young: a narrow cone, leafy to the ground. Forest-grown: under taller
  // trees, thinner, leaning, its crown open. Old: taller, round-topped,
  // its trunk clear low down, its lowest branches hanging. Young,
  // open-grown and old are the stages its age slider goes between.
  holly: { 'open-grown': {}, young: HOLLY_STAGES.young, 'forest-grown': HOLLY_FOREST, old: HOLLY_STAGES.old },
  // TreeLab's own ash (src/oak/broadleaves.js): "open-grown" is its
  // default: a tall open dome, its limbs rising steeply, the lower ones
  // sweeping out and turning up at their tips. Young: a straight pole
  // with a few rising branches. Forest-grown: a long clean pole
  // with a small crown at its top. Old: broader, its lower limbs sweeping
  // low, dead wood in its crown. Young, open-grown and old are the stages
  // its age slider goes between.
  ash: { 'open-grown': {}, young: ASH_STAGES.young, 'forest-grown': ASH_FOREST, old: ASH_STAGES.old },
  // TreeLab's own birch (src/oak/broadleaves.js): "open-grown" is its
  // default: a slim white tree with a light crown that weeps at its
  // outside. Young: a thin brown pole. Forest-grown: a thin white pole
  // with a small crown at its top. Old: taller, its lower limbs weeping
  // low, its foot black. Young, open-grown and old are the stages its age
  // slider goes between.
  birch: { 'open-grown': {}, young: BIRCH_STAGES.young, 'forest-grown': BIRCH_FOREST, old: BIRCH_STAGES.old },
  // TreeLab's own linden (src/oak/broadleaves.js): "open-grown" is its
  // default: a tall, dense egg of a crown on a straight trunk, its lower
  // limbs arching down and sweeping up at their tips. Young: a neat cone.
  // Forest-grown: a tall straight trunk with a narrow crown at its top.
  // Old: broader, its trunk thick, burry and hollow. Young, open-grown
  // and old are the stages its age slider goes between.
  linden: { 'open-grown': {}, young: LINDEN_STAGES.young, 'forest-grown': LINDEN_FOREST, old: LINDEN_STAGES.old },
  broadleaf: {
    workshop: {},
    oak: {
      girth: 0.9, trunk: [1.6, 2.4], lean: 6, branches: [6, 8], length: [3, 4.5], tilt: [55, 75], curl: 30, leader: 0.3,
      clumps: [3, 4], clumpSize: [1.6, 2.4], core: 2.2, squash: 0.8, rough: 0.25,
    },
    birch: {
      girth: 0.12, trunk: [3.5, 5], lean: 5, branches: [3, 5], length: [1, 1.6], tilt: [15, 30], curl: 20, leader: 0.9,
      clumps: [3, 4], clumpSize: [0.6, 0.9], core: 0.6, squash: 1.4, rough: 0.15,
    },
    shrub: {
      girth: 0.07, trunk: [0.5, 0.7], lean: 10, branches: [5, 7], length: [0.8, 1.3], tilt: [45, 75], curl: 25, leader: 0.4,
      clumps: [2, 3], clumpSize: [0.6, 0.9], core: 0.7, squash: 0.85, rough: 0.3,
    },
    poplar: {
      girth: 0.3, trunk: [1.5, 2], lean: 2, branches: [5, 7], length: [3, 4.5], tilt: [5, 12], curl: 5, leader: 1,
      clumps: [4, 5], clumpSize: [0.8, 1.1], core: 1, squash: 1.8, rough: 0.2,
    },
    baobab: {
      girth: 1.2, trunk: [5, 6], lean: 2, branches: [5, 7], length: [1.5, 2.5], tilt: [60, 90], curl: 40, leader: 0.1,
      clumps: [1, 2], clumpSize: [0.5, 0.8], core: 0, squash: 0.6, rough: 0.3,
    },
  },
  fir: {
    workshop: {},
    'young fir': { height: [2.5, 3.5], bare: [0.1, 0.3], girth: 0.08, tiers: [4, 6], radius: [0.8, 1.1], points: 6, droop: 0.15, jag: 0.3 },
    'tall spruce': { height: [18, 22], bare: [2, 4], girth: 0.5, tiers: [14, 18], radius: [2.6, 3.2], points: 9, droop: 1, jag: 0.35 },
    'alpine fir': { height: [4, 5.5], bare: [0, 0.2], girth: 0.18, tiers: [10, 14], radius: [1, 1.3], points: 10, droop: -0.2, jag: 0.5 },
  },
  pine: {
    workshop: {},
    'old pine': {
      height: [13, 17], girth: 0.6, lean: 8, crook: 1.2, crown: [0.78, 0.86], branches: [3, 4], length: [2.2, 3.4], tilt: [45, 85],
      curl: 30, clumps: [2, 4], clumpSize: [1.3, 2.4], squash: 0.4, stubs: [3, 8],
    },
    'stone pine': {
      height: [8, 11], girth: 0.5, crook: 0.6, crown: [0.82, 0.9], branches: [5, 7], length: [2.5, 3.5], tilt: [55, 75],
      curl: 25, clumps: [2, 3], clumpSize: [1.8, 2.6], squash: 0.3, stubs: [0, 1],
    },
    'young pine': {
      height: [2.5, 4], girth: 0.1, crook: 0.2, crown: [0.25, 0.4], branches: [3, 4], length: [0.6, 1], tilt: [30, 60],
      clumps: [2, 3], clumpSize: [0.5, 0.9], squash: 0.6, stubs: [0, 0],
    },
  },
};

// A preset's whole shape: the workshop's, with the preset's changes that
// still fit (the same kind of value, inside its slider).
export function presetShape(kind, name) {
  const shape = structuredClone(DEFAULT_SHAPES[kind]);
  for (const [key, value] of Object.entries(PRESETS[kind]?.[name] ?? {})) {
    if (!(key in shape) || sliderKind(value) !== sliderKind(shape[key])) continue;
    const [lo, hi] = limitsFor(key, shape[key], kind);
    const fit = (v) => Math.min(hi, Math.max(lo, v));
    shape[key] = Array.isArray(value) ? value.map(fit) : fit(value);
  }
  return shape;
}

// Which preset a shape is, if any ('custom' otherwise).
export function presetOf(kind, shape) {
  const text = JSON.stringify(shape);
  return Object.keys(PRESETS[kind] ?? {}).find((name) => JSON.stringify(presetShape(kind, name)) === text) ?? 'custom';
}
