import { TREE_SHAPES } from '@workshop/treeShapes.js';
import { limitsFor, sliderKind } from './limits.js';

// Ready-made shapes to start a kind from (the shape panel's "start from"):
// the workshop's own, and a few that show how far the sliders reach. Each
// lists only what it changes from the workshop's; anything the generator
// doesn't have (or has reshaped since) is left out when it's applied.

export const PRESETS = {
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
  const shape = structuredClone(TREE_SHAPES[kind]);
  for (const [key, value] of Object.entries(PRESETS[kind]?.[name] ?? {})) {
    if (!(key in shape) || sliderKind(value) !== sliderKind(shape[key])) continue;
    const [lo, hi] = limitsFor(key, shape[key]);
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
