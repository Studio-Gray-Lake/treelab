import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY, GRAVITY, JUMPS, RUNS, WALKS, createWalker, onSlope, slopeToward, stepWalker, wanted } from '../src/walker.js';

// The figure's walk through the forest (src/walker.js): its speeds, what a
// slope does to them, its jump, the trunks, and which way it faces.

const flat = { heightAt: () => 0 };
const ramp = (slope) => ({ heightAt: (x, z) => z * slope }); // (rises toward +z)
const ahead = { x: 0, z: 1, run: 0, jump: false };

// `seconds` on, in frames of `dt`, asked the same thing all the way.
function go(walker, want, seconds, ground = flat, dt = 1 / 60) {
  for (let t = 0; t < seconds - 1e-9; t += dt) stepWalker(walker, want, dt, ground);
  return walker;
}

test('it walks at a walk and runs at a run, and takes a moment to get there and to stop', () => {
  const w = createWalker();
  go(w, ahead, 0.1);
  assert.ok(w.speed > 0.3 && w.speed < WALKS * 0.75, `${w.speed.toFixed(2)} m/s a tenth of a second on`);
  go(w, ahead, 2);
  assert.ok(Math.abs(w.speed - WALKS) < 0.01, `${w.speed.toFixed(3)} m/s at a walk`);
  const from = w.z;
  go(w, ahead, 1);
  assert.ok(Math.abs(w.z - from - WALKS) < 0.02, `${(w.z - from).toFixed(2)} m in a second`);
  go(w, { ...ahead, run: 1 }, 2);
  assert.ok(Math.abs(w.speed - RUNS) < 0.02, `${w.speed.toFixed(3)} m/s at a run`);
  go(w, { ...ahead, run: 0.5 }, 2);
  assert.ok(Math.abs(w.speed - (WALKS + RUNS) / 2) < 0.02, 'half way between, asked half');
  go(w, { x: 0, z: 0, run: 0, jump: false }, 1);
  assert.ok(w.speed < 0.01, `still going ${w.speed.toFixed(2)} m/s a second after letting go`);
  // (A stick pushed half way: half the pace.)
  go(w, { x: 0, z: 0.5, run: 0, jump: false }, 2);
  assert.ok(Math.abs(w.speed - WALKS / 2) < 0.01);
});

test('a slope slows it as Tobler measured: fastest a little downhill, slower the steeper either way', () => {
  assert.equal(onSlope(0), 1);
  assert.ok(onSlope(-0.05) > onSlope(0) && onSlope(-0.05) > onSlope(-0.1), 'not fastest one in twenty downhill');
  assert.ok(Math.abs(onSlope(0.2) - Math.exp(-3.5 * 0.2)) < 1e-9);
  assert.ok(onSlope(0.4) < onSlope(0.2) && onSlope(-0.5) < onSlope(-0.2));
  // (Six km/h at its best, five on the flat: Tobler's own numbers.)
  assert.ok(Math.abs(onSlope(-0.05) * 5.036 - 6) < 0.01);
  for (const slope of [0.2, -0.3]) {
    const w = go(createWalker(), ahead, 3, ramp(slope));
    assert.ok(Math.abs(w.speed - WALKS * onSlope(slope)) < 0.01, `${w.speed.toFixed(2)} m/s on a slope of ${slope}`);
    assert.ok(Math.abs(w.y - w.z * slope) < 1e-9, 'not on the ground');
    assert.ok(Math.abs(w.slope - slope) < 1e-9);
  }
  // Across a slope it's as fast as on the flat.
  const across = go(createWalker(), { x: 1, z: 0, run: 0, jump: false }, 3, ramp(0.3));
  assert.ok(Math.abs(across.speed - WALKS) < 0.01);
  assert.ok(Math.abs(slopeToward(ramp(0.3), 5, 5, 0, 1) - 0.3) < 1e-9);
});

test('a jump lifts it as high as asked and lasts as long as gravity says, whatever the frames', () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
    const w = createWalker();
    stepWalker(w, { ...ahead, z: 0, jump: true }, dt, flat);
    assert.equal(w.grounded, false);
    let top = 0, time = dt;
    while (!w.grounded && time < 3) {
      stepWalker(w, { x: 0, z: 0, run: 0, jump: true }, dt, flat); // (held down: no second jump in the air)
      top = Math.max(top, w.y);
      time += dt;
    }
    assert.ok(Math.abs(top - JUMPS) < 0.01, `${top.toFixed(3)} m high at ${Math.round(1 / dt)} frames a second`);
    const lasts = 2 * Math.sqrt(2 * JUMPS / GRAVITY);
    assert.ok(Math.abs(time - lasts) < 2 * dt, `in the air ${time.toFixed(2)} s, not ${lasts.toFixed(2)}`);
    assert.equal(w.y, 0);
    assert.ok(Math.abs(w.landing - Math.sqrt(2 * GRAVITY * JUMPS)) < GRAVITY * dt * 1.5, 'came down as fast as it went up');
    assert.ok(w.since < 2 * dt);
  }
});

test('in the air it keeps its speed, and is steered only a little', () => {
  const w = go(createWalker(), { ...ahead, run: 1 }, 2);
  stepWalker(w, { ...ahead, run: 1, jump: true }, 1 / 60, flat);
  const before = w.speed;
  go(w, { x: 0, z: 0, run: 0, jump: false }, 0.3);
  assert.equal(w.grounded, false);
  assert.ok(Math.abs(w.speed - before) < 1e-9, 'slowed in the air with nothing asked');
  go(w, { x: 0, z: -1, run: 1, jump: false }, 0.2);
  assert.ok(w.vz > before * 0.5, 'turned round in the air');
  // A running jump carries it about as far as its speed and the time in the air.
  const far = go(createWalker(), { ...ahead, run: 1 }, 2);
  const from = far.z;
  stepWalker(far, { ...ahead, run: 1, jump: true }, 1 / 60, flat);
  while (!far.grounded) stepWalker(far, { ...ahead, run: 1, jump: false }, 1 / 60, flat);
  assert.ok(far.z - from > 2.2 && far.z - from < 2.9, `a running jump of ${(far.z - from).toFixed(2)} m`);
});

test('trunks stop it, and it slides round them', () => {
  const ground = { heightAt: () => 0, trunks: [{ x: 0.3, z: 5, r: 0.6 }] };
  const w = createWalker();
  let nearest = Infinity;
  for (let i = 0; i < 60 * 12; i++) {
    stepWalker(w, { ...ahead, run: 1 }, 1 / 60, ground);
    nearest = Math.min(nearest, Math.hypot(w.x - 0.3, w.z - 5));
  }
  assert.ok(nearest >= 0.6 + BODY - 1e-9, `${nearest.toFixed(3)} m from a trunk's middle`);
  assert.ok(w.z > 8, `stuck at the trunk (z = ${w.z.toFixed(2)})`);
  assert.ok(w.x < -0.3, 'went through it, not round');
});

test('it faces the way it goes, turning the short way, and keeps facing as it was when it stops', () => {
  const w = go(createWalker({ heading: 0 }), { x: 1, z: 0, run: 0, jump: false }, 1);
  assert.ok(Math.abs(w.heading - Math.PI / 2) < 0.01, `faces ${w.heading.toFixed(2)}`);
  go(w, { x: 0, z: 0, run: 0, jump: false }, 1);
  assert.ok(Math.abs(w.heading - Math.PI / 2) < 0.02, 'turned while standing');
  // From just short of half a turn one way to just past it the other: across, not all the way round.
  const round = createWalker({ heading: 3 });
  let most = 0;
  for (let i = 0; i < 120; i++) {
    stepWalker(round, { x: Math.sin(-3), z: Math.cos(-3), run: 0, jump: false }, 1 / 60, flat);
    most = Math.max(most, Math.abs(Math.cos(round.heading) - Math.cos(3)));
  }
  assert.ok(most < 0.02, 'turned the long way round');
});

test('what the keys and the pad ask is turned the way the camera looks', () => {
  const north = wanted({ ahead: 1 }, { x: 0, z: -1 });
  assert.ok(Math.abs(north.x) < 1e-9 && Math.abs(north.z + 1) < 1e-9);
  // To the camera's right: looking toward -z, that's +x.
  const right = wanted({ aside: 1 }, { x: 0, z: -4 });
  assert.ok(Math.abs(right.x - 1) < 1e-9 && Math.abs(right.z) < 1e-9);
  // Two keys at once are no faster than one; a stick half pushed asks half.
  const both = wanted({ ahead: 1, aside: 1 }, { x: 1, z: 0 });
  assert.ok(Math.abs(Math.hypot(both.x, both.z) - 1) < 1e-9);
  const half = wanted({ ahead: 0.5 }, { x: 1, z: 0 });
  assert.ok(Math.abs(half.x - 0.5) < 1e-9);
  assert.deepEqual(wanted({ ahead: 1, run: 2, jump: true }, { x: 0, z: 0 }), { x: 0, z: 0, run: 1, jump: true });
});

test('it follows the ground, stays on it at the edge, and the frames\' length hardly matters', () => {
  const hills = { heightAt: (x, z) => 2 * Math.sin(x * 0.1) + Math.cos(z * 0.13), half: 20 };
  const w = createWalker();
  for (let i = 0; i < 60 * 30; i++) {
    stepWalker(w, { x: 0.6, z: 0.8, run: 1, jump: false }, 1 / 60, hills);
    assert.ok(Math.abs(w.y - hills.heightAt(w.x, w.z)) < 1e-9);
  }
  assert.ok(Math.abs(w.x) <= 20 && Math.abs(w.z) <= 20, 'walked off the ground');
  const slow = go(createWalker(), { x: 0.6, z: 0.8, run: 1, jump: false }, 3, hills, 1 / 30);
  const fast = go(createWalker(), { x: 0.6, z: 0.8, run: 1, jump: false }, 3, hills, 1 / 120);
  assert.ok(Math.hypot(slow.x - fast.x, slow.z - fast.z) < 0.1, `${Math.hypot(slow.x - fast.x, slow.z - fast.z).toFixed(3)} m apart at 30 and 120 frames a second`);
});
