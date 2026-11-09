// Each shape setting's slider: least, most, step.
//
// WORKSHOP_LIMITS is the workshop's own table (LIMITS in its
// src/labs/trees.js, which isn't exported), tuned for the game's trees.
// TreeLab's LIMITS reach further, for outlying trees (an old oak's girth, a
// 25 m spruce, weeping limbs). Each end was grown for every kind
// (tests/limits.test.js): the generator copes with all of them, and a tree
// with every count at its most stays near 6,000 triangles. A broadleaf's
// trunk stops at 0.5 m: below 0.4 m the generator sometimes fails.
export const WORKSHOP_LIMITS = {
  trunk: [0.8, 4, 0.05], girth: [0.08, 0.4, 0.01], lean: [0, 12, 0.5], branches: [1, 6, 1], length: [0.5, 3.5, 0.05],
  tilt: [0, 90, 1], curl: [0, 60, 1], leader: [0, 1, 0.05], clumps: [1, 4, 1], clumpSize: [0.3, 2, 0.05],
  squash: [0.25, 1.2, 0.01], rough: [0, 0.5, 0.01], sway: [0, 0.08, 0.002], height: [3, 9, 0.1], bare: [0, 3, 0.05],
  tiers: [2, 12, 1], radius: [0.8, 3, 0.05], points: [4, 12, 1], droop: [0, 1.2, 0.02], jag: [0, 0.6, 0.01],
  crook: [0, 0.8, 0.01], core: [0, 2.5, 0.05], crown: [0.3, 0.9, 0.01], stubs: [0, 6, 1],
};

export const LIMITS = {
  trunk: [0.5, 8, 0.05], girth: [0.04, 1.2, 0.01], lean: [0, 25, 0.5], branches: [1, 10, 1], length: [0.3, 6, 0.05],
  tilt: [0, 100, 1], curl: [-30, 90, 1], leader: [0, 1, 0.05], clumps: [1, 6, 1], clumpSize: [0.2, 3.5, 0.05],
  squash: [0.15, 2, 0.01], rough: [0, 0.8, 0.01], sway: [0, 0.15, 0.002], height: [2, 25, 0.1], bare: [0, 8, 0.05],
  tiers: [2, 24, 1], radius: [0.4, 5, 0.05], points: [3, 16, 1], droop: [-0.5, 2.5, 0.02], jag: [0, 0.9, 0.01],
  crook: [0, 2, 0.01], core: [0, 4, 0.05], crown: [0.15, 0.95, 0.01], stubs: [0, 12, 1],
};

// What kind of slider a setting gets: 'number' (one slider), 'range' (two,
// least and most) or null (none yet). If the workshop's generator gains a
// setting of a new kind (an age, a switch), it's listed under "no slider
// yet" until TreeLab catches up, instead of breaking the panel.
export function sliderKind(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  if (Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === 'number' && Number.isFinite(v))) return 'range';
  return null;
}

// The slider for a setting. If the workshop's generator gains a setting this
// table doesn't know yet, it still gets a slider: from 0 to three times its
// default, in whole steps if the default is a whole number. Every slider
// stretches to take in its default.
export function limitsFor(key, value) {
  const values = Array.isArray(value) ? value : [value];
  const biggest = Math.max(...values.map(Math.abs));
  const [lo, hi, step] = LIMITS[key] ?? [0, Math.max(1, biggest * 3), values.every(Number.isInteger) ? 1 : 0.01];
  return [Math.min(lo, ...values), Math.max(hi, ...values), step];
}
