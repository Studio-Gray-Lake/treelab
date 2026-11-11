import { RUNS, WALKS } from './walker.js';

// The figure's hand-keyed cycles: standing, a walk and a run, each a handful
// of keys round one stride, and what they give at any moment of it (a pose).
// They stand in for any clip of Mixamo's that hasn't been fitted to the
// figure (src/figureClips.js, scripts/bake-clips.mjs). What puts a pose on
// the figure's bones, and its feet on the ground under them, is
// src/figure.js.
//
// The keys are set by hand from textbook figures of how people walk and run
// (how long a foot is on the ground, how far a stride goes, how high the
// foot lifts, how far the arms swing): they aren't captured from anyone.
// The legs are keyed by where the ankles are, not by the joints' angles:
// the knees follow from that (src/figure.js bends each leg to reach its
// ankle), so a foot that's on the ground stays exactly where it stands
// while the body passes over it. The hips are never keyed higher than the
// legs reach: they rise over each step and sink between them, as a
// walker's do, and a runner's sink over each foot and rise in flight.
//
// A pose is in the figure's own space: x to its left, y up from the ground
// under it, z the way it faces; metres and degrees.

// The figure's own measures (the workshop's rig: tests/figureKeys.test.js
// checks them against it), m.
export const BODY = {
  thigh: 0.45, shin: 0.45, // hip to knee, knee to ankle
  ankle: 0.08,             // the ankle above the sole
  heel: 0.05, ball: 0.13,  // the heel behind the ankle, the ball of the foot ahead of it
  hip: 0.98,               // the hip joints above the ground, standing straight
  apart: 0.1,              // each hip joint, and each foot at rest, from the middle
};

const rad = (degrees) => (degrees * Math.PI) / 180;
const mix = (a, b, t) => a + (b - a) * t;
const wrap = (p) => p - Math.floor(p);

// A value keyed round a cycle: keys [[when, value], ...] (when: 0 to 1, in
// order), read at any moment, smoothly through the keys and round the end.
// once: the keys aren't a cycle (they run from the first to the last, flat
// at both).
export function keyed(keys, { once = false } = {}) {
  const n = keys.length;
  if (n === 1) return () => keys[0][1];
  const at = (i) => keys[((i % n) + n) % n];
  const when = (i) => (once ? at(Math.min(n - 1, Math.max(0, i)))[0] : at(i)[0] + Math.floor(i / n));
  const value = (i) => (once ? at(Math.min(n - 1, Math.max(0, i)))[1] : at(i)[1]);
  // (The slope at a key: from the key before to the key after.)
  const slope = (i) => {
    const span = when(i + 1) - when(i - 1);
    return span > 1e-9 ? (value(i + 1) - value(i - 1)) / span : 0;
  };
  return (p) => {
    const t = once ? Math.min(keys[n - 1][0], Math.max(keys[0][0], p)) : wrap(p);
    let i = -1;
    for (let k = 0; k < n; k++) if (keys[k][0] <= t) i = k;
    // (Before the first key of a cycle: between the last, a turn back, and it.)
    const p0 = when(i), p1 = when(i + 1);
    const span = p1 - p0;
    if (!(span > 1e-9)) return value(i);
    const s = (t - p0) / span, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * value(i) + (s3 - 2 * s2 + s) * span * slope(i)
      + (-2 * s3 + 3 * s2) * value(i + 1) + (s3 - s2) * span * slope(i + 1);
  };
}

// The cycles. For each: the speed it's keyed at (m a second) and how far a
// stride goes (m: two steps); the share of a stride a foot is on the ground;
// where the ankle is, ahead of the hips, as the foot lands; how the foot
// rolls (degrees toes up as the heel lands, until when it's flat, from when
// the heel lifts, degrees heel up as the toes leave); the swing (how much
// of the ground's speed the foot still has as it leaves, how far the ankle
// lifts above a straight line from where it left to where it lands, and
// the foot's tilt, by share of the swing); how far from the
// middle the feet step; the hips (as high as this at most, the knees never
// straighter than `bend` degrees; their sway to the side, their turn, and
// the chest's turn against it); how far the body leans; and the arms (the
// shoulder back and forward, the elbow's bend at each end).
export const CYCLES = {
  // Standing: both feet under the hips.
  stand: {
    speed: 0, stride: 0, stance: 1, lands: 0, strike: 0, flat: [0, 1], off: 0,
    leaves: 1, lift: [[0, 0]], tilt: [[0, 0]], width: BODY.apart,
    hips: [[0, 0.978]], bend: 4, sway: 0, turn: 0, chest: 0, lean: 0,
    shoulder: [0, 0], elbow: [6, 6],
  },
  // A walk: 1.4 m a second, 130 steps a minute, a foot on the ground for
  // three fifths of a stride (so both are for a fifth of it, twice).
  walk: {
    speed: WALKS, stride: 1.3, stance: 0.62, lands: 0.34, strike: 15, flat: [0.08, 0.38], off: 38,
    leaves: 1, lift: [[0, 0], [0.3, 0.1], [0.62, 0.05], [1, 0]], tilt: [[0, -38], [0.3, -22], [0.68, 0], [1, 15]], width: 0.075,
    hips: [[0.03, 0.92], [0.29, 0.965], [0.53, 0.92], [0.79, 0.965]], bend: 12, sway: 0.02, turn: 4, chest: 7, lean: 2,
    shoulder: [-18, 15], elbow: [12, 28],
  },
  // A run: 4.2 m a second, 172 steps a minute, a foot on the ground for a
  // third of a stride (so neither is, twice a stride: it flies). The hips
  // are keyed: lowest as the body passes over the foot, highest in flight.
  run: {
    speed: RUNS, stride: 2.94, stance: 0.32, lands: 0.3, strike: 4, flat: [0.03, 0.14], off: 55,
    leaves: 0.3, lift: [[0, 0], [0.14, 0.2], [0.4, 0.38], [0.72, 0.2], [1, 0]], tilt: [[0, -55], [0.35, -45], [0.75, -8], [1, 4]], width: 0.04,
    hips: [[0, 0.905], [0.16, 0.875], [0.32, 0.915], [0.41, 0.935], [0.5, 0.905], [0.66, 0.875], [0.82, 0.915], [0.91, 0.935]], bend: 16, sway: 0.008, turn: 7, chest: 12, lean: 9,
    shoulder: [-38, 30], elbow: [80, 95],
  },
};

// One foot at a moment of its own stride (0: it lands): { z, y (its ankle),
// tilt (degrees, toes up), contact (1 on the ground, 0 off it) }.
function footAt(c, p) {
  const { ankle, heel, ball } = BODY;
  const onGround = (q) => {
    const flat = c.lands - c.stride * q; // (the ankle, were the foot flat)
    if (q < c.flat[0]) {
      // On its heel: the foot comes down round it.
      const a = rad(c.strike) * (1 - q / c.flat[0]);
      return { z: flat - heel + heel * Math.cos(a) - ankle * Math.sin(a), y: heel * Math.sin(a) + ankle * Math.cos(a), tilt: (a * 180) / Math.PI };
    }
    if (q <= c.flat[1]) return { z: flat, y: ankle, tilt: 0 };
    // On the ball of the foot: the heel lifts round it.
    const s = (q - c.flat[1]) / Math.max(1e-9, c.stance - c.flat[1]);
    const a = -rad(c.off) * s * s * (3 - 2 * s);
    return { z: flat + ball - ball * Math.cos(a) - ankle * Math.sin(a), y: -ball * Math.sin(a) + ankle * Math.cos(a), tilt: (a * 180) / Math.PI };
  };
  if (p < c.stance || c.stance >= 1) return { ...onGround(Math.min(p, c.stance)), contact: 1 };
  // The swing: from where it left to where it lands, as fast at each end as
  // the ground goes by (so it neither scuffs nor snatches).
  const from = onGround(c.stance), to = onGround(0);
  const s = (p - c.stance) / (1 - c.stance), s2 = s * s, s3 = s2 * s;
  const pace = -c.stride * (1 - c.stance);
  const z = (2 * s3 - 3 * s2 + 1) * from.z + (s3 - 2 * s2 + s) * pace * c.leaves + (-2 * s3 + 3 * s2) * to.z + (s3 - s2) * pace;
  return { z, y: mix(from.y, to.y, s) + c.lift(s), tilt: c.tilt(s), contact: 0 };
}

// How high the hips can be over a foot, the knee bent at least `bend`
// degrees. foot: { y, z }; x: how far it is from the middle.
export function reachOver(foot, x, bend) {
  const leg = (BODY.thigh + BODY.shin) * Math.cos(rad(bend) / 2);
  const across = x - BODY.apart;
  return foot.y + Math.sqrt(Math.max(0, leg * leg - foot.z * foot.z - across * across));
}

// A cycle made ready: its keys as curves, and its hips' height round the
// stride (as keyed, and no higher than its legs reach: those on the ground
// with the knee a little bent, those in the air straight), smoothed.
const STRAIGHT = 3; // degrees: a leg in the air is never straighter
const STEPS = 96;
function ready(c) {
  const made = { ...c, lift: keyed(c.lift, { once: true }), tilt: keyed(c.tilt, { once: true }), high: keyed(c.hips) };
  const heights = [];
  for (let i = 0; i < STEPS; i++) {
    const p = i / STEPS;
    let h = made.high(p);
    for (const q of [p, wrap(p + 0.5)]) {
      const foot = footAt(made, q);
      h = Math.min(h, reachOver(foot, c.width, foot.contact ? c.bend : STRAIGHT));
    }
    heights.push(h);
  }
  // (Smoothed where one leg takes over from the other.)
  let smooth = heights;
  for (let pass = 0; pass < 3; pass++) smooth = smooth.map((v, i) => (smooth[(i + STEPS - 1) % STEPS] + 2 * v + smooth[(i + 1) % STEPS]) / 4);
  made.heights = smooth;
  return made;
}
const READY = Object.fromEntries(Object.entries(CYCLES).map(([name, c]) => [name, ready(c)]));

// A cycle's pose at a moment of its stride (p, 0 to 1: 0 as the left foot
// lands; the right lands half a stride later):
// { hips: { x, y, turn }, feet: [left, right] (each { x, y, z, tilt,
// contact }), chest (its turn, against the hips'), lean, arms: [left,
// right] (each { shoulder, elbow }) }.
export function poseOf(name, p) {
  const c = READY[name];
  p = wrap(p);
  const feet = [0, 0.5].map((shift, side) => ({ x: (side ? -1 : 1) * c.width, ...footAt(c, wrap(p + shift)) }));
  const at = p * STEPS, i = Math.floor(at) % STEPS;
  const y = mix(c.heights[i], c.heights[(i + 1) % STEPS], at - Math.floor(at));
  // The body swings round the stride: over the left foot while it stands,
  // the left hip forward as the left foot lands, and the chest and the arms
  // against that (the left arm back as the left foot lands).
  const swing = Math.cos(2 * Math.PI * p);
  const arm = (way) => ({
    shoulder: mix(c.shoulder[0], c.shoulder[1], (1 - way * swing) / 2),
    elbow: mix(c.elbow[0], c.elbow[1], (1 - way * swing) / 2),
  });
  return {
    hips: { x: c.sway * Math.sin(2 * Math.PI * (p - 0.05)), y, turn: -c.turn * swing },
    feet,
    chest: c.chest * swing,
    lean: c.lean,
    arms: [arm(1), arm(-1)],
  };
}
