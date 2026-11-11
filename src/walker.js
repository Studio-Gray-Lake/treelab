import { PACE, RUN } from './stand.js';

// The figure's walk through the forest: where it is, how fast it goes, which
// way it faces, and when it's in the air. Numbers only: what draws it and
// moves its legs is src/figure.js, and what reads the keys and the pad is
// src/main.js.
//
// - It walks at a walker's pace and runs at three times that, and takes a
//   moment to reach either or to stop.
// - Slopes slow it as they slow a walker: Tobler's hiking function (1993,
//   fitted to people's speeds on paths: fastest a little downhill, slower
//   the steeper it is either way). Used for the run too, though it was
//   measured on walkers.
// - A jump is a body thrown up and left to gravity: it keeps the speed it
//   left the ground with, and can be steered only a little in the air.
// - Trunks stop it: it slides round them.

export const WALKS = PACE;         // m a second
export const RUNS = PACE * RUN;    // m a second
export const GRAVITY = 9.81;       // m/s2
export const JUMPS = 0.45;         // m: how high a jump lifts it (a standing jump's)
export const QUICKENS = 8;         // a second: how fast it comes to the speed asked, on the ground
export const STEERS = 1;           // a second: and in the air
export const TURNS = 10;           // a second: how fast it turns to face the way it goes
export const BODY = 0.25;          // m: its half-width, kept clear of the trunks
const REACH = 0.5;                 // m: a slope is measured this far each way
const MOVING = 0.15;               // m a second: slower than this, it keeps facing as it was

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// How fast a walker goes on a slope, as a share of its speed on the flat
// (Tobler: 6 e^(-3.5 |s + 0.05|) km/h). slope: rise over run the way it
// goes (0.1: one in ten uphill).
export const onSlope = (slope) => Math.exp(-3.5 * Math.abs(slope + 0.05)) / Math.exp(-3.5 * 0.05);

// The ground's slope at a place, toward (dx, dz) (a direction on the map, of
// length 1).
export function slopeToward(ground, x, z, dx, dz) {
  return (ground.heightAt(x + dx * REACH, z + dz * REACH) - ground.heightAt(x - dx * REACH, z - dz * REACH)) / (2 * REACH);
}

// A walker standing still at a place, facing `heading` (radians about the
// vertical: 0 faces +z, a quarter turn faces +x).
export function createWalker({ x = 0, z = 0, heading = 0, y = 0 } = {}) {
  return {
    x, y, z, heading,
    vx: 0, vy: 0, vz: 0,   // m a second
    speed: 0,              // m a second over the ground
    slope: 0,              // the ground's, the way it faces
    grounded: true,
    air: 0,                // s since it left the ground
    since: 1,              // s since it landed
    landing: 0,            // m a second: how fast it came down, the last time
  };
}

// What's asked of it, from the keys and the pad together: { x, z, run, jump }
// (x, z: which way on the map, as long as how hard, at most 1).
// ahead, aside: -1 to 1, as the camera sees them; facing: { x, z }, the way
// the camera looks on the map; run: 0 to 1; jump: asked this moment.
export function wanted({ ahead = 0, aside = 0, run = 0, jump = false }, facing) {
  const length = Math.hypot(facing.x, facing.z);
  if (length < 1e-6) return { x: 0, z: 0, run: clamp(run), jump };
  const fx = facing.x / length, fz = facing.z / length;
  const hard = Math.hypot(ahead, aside);
  const scale = hard > 1 ? 1 / hard : 1;
  return { x: (fx * ahead - fz * aside) * scale, z: (fz * ahead + fx * aside) * scale, run: clamp(run), jump };
}

// A moment on: `walker` moved `dt` seconds on, asked for `want` (wanted()'s),
// over `ground`: { heightAt(x, z), trunks: [{ x, z, r }] (optional), half
// (optional: it stays within this many m of the middle, each way) }.
export function stepWalker(walker, want, dt, ground) {
  const w = walker;
  if (!(dt > 0)) return w;
  const hard = Math.min(1, Math.hypot(want.x, want.z));
  const dx = hard > 1e-6 ? want.x / Math.hypot(want.x, want.z) : 0, dz = hard > 1e-6 ? want.z / Math.hypot(want.x, want.z) : 0;

  // The speed asked for: a walk to a run, as the slope ahead allows.
  const top = (WALKS + (RUNS - WALKS) * clamp(want.run ?? 0)) * (hard > 0 ? onSlope(slopeToward(ground, w.x, w.z, dx, dz)) : 1);
  if (w.grounded) {
    const k = 1 - Math.exp(-dt * QUICKENS);
    w.vx += (dx * hard * top - w.vx) * k;
    w.vz += (dz * hard * top - w.vz) * k;
  } else if (hard > 0) {
    // (In the air it keeps its speed, and is steered only a little.)
    const k = 1 - Math.exp(-dt * STEERS);
    w.vx += (dx * hard * top - w.vx) * k;
    w.vz += (dz * hard * top - w.vz) * k;
  }

  if (want.jump && w.grounded) {
    w.vy = Math.sqrt(2 * GRAVITY * JUMPS);
    w.grounded = false;
    w.air = 0;
  }

  w.x += w.vx * dt;
  w.z += w.vz * dt;

  // Trunks: pushed back out of any it has stepped into, and its speed into
  // the trunk taken away, so it slides round.
  for (const trunk of ground.trunks ?? []) {
    const ox = w.x - trunk.x, oz = w.z - trunk.z;
    const clear = trunk.r + BODY;
    const apart = Math.hypot(ox, oz);
    if (apart >= clear) continue;
    const nx = apart > 1e-6 ? ox / apart : 1, nz = apart > 1e-6 ? oz / apart : 0;
    w.x = trunk.x + nx * clear;
    w.z = trunk.z + nz * clear;
    const into = w.vx * nx + w.vz * nz;
    if (into < 0) {
      w.vx -= into * nx;
      w.vz -= into * nz;
    }
  }
  if (ground.half > 0) {
    if (Math.abs(w.x) > ground.half) w.vx = 0;
    if (Math.abs(w.z) > ground.half) w.vz = 0;
    w.x = clamp(w.x, -ground.half, ground.half);
    w.z = clamp(w.z, -ground.half, ground.half);
  }

  const floor = ground.heightAt(w.x, w.z);
  if (w.grounded) {
    w.y = floor;
    w.vy = 0;
    w.since += dt;
  } else {
    // (A thrown body's path, exactly, whatever the frames' length.)
    w.y += w.vy * dt - 0.5 * GRAVITY * dt * dt;
    w.vy -= GRAVITY * dt;
    w.air += dt;
    if (w.y <= floor && w.vy <= 0) {
      w.landing = -w.vy;
      w.y = floor;
      w.vy = 0;
      w.grounded = true;
      w.since = 0;
    }
  }

  w.speed = Math.hypot(w.vx, w.vz);
  if (w.speed > MOVING) {
    // It turns to face the way it goes, the short way round.
    let turn = Math.atan2(w.vx, w.vz) - w.heading;
    turn -= Math.round(turn / (2 * Math.PI)) * 2 * Math.PI;
    w.heading += turn * (1 - Math.exp(-dt * TURNS));
  }
  w.slope = slopeToward(ground, w.x, w.z, Math.sin(w.heading), Math.cos(w.heading));
  return w;
}
