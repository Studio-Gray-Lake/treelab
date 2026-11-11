import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ADAPTS, AIM, createEye, eased, exposureFor, rangeAt } from '../src/eye.js';
import { DAY_EXPOSURE, lightAt } from '../src/light.js';
import { RANGES, normalize } from '../src/settings.js';

// The eye (src/eye.js): the exposure it heads for, how fast it gets there,
// and the meter's bookkeeping. (The measuring itself is checked in the
// browser.)

const stops = (a, b) => Math.log2(a / b);

test('the eye heads for the exposure that brings the picture to its aim, within its range of the hour\'s', () => {
  const base = 0.8;
  // At its aim already: stays.
  assert.ok(Math.abs(exposureFor({ base, was: base, seen: AIM }) - base) < 1e-9);
  // A view a quarter as bright: two stops up, however it was drawn.
  assert.ok(Math.abs(stops(exposureFor({ base, was: base, seen: AIM / 2, range: [-3, 3] }), base) - 1) < 1e-9);
  assert.ok(Math.abs(stops(exposureFor({ base, was: base * 2, seen: AIM, range: [-3, 3] }), base) - 1) < 1e-9, 'the exposure it was drawn with not counted');
  // A view calling for 5 stops: the first in full, half of the other 4.
  assert.ok(Math.abs(stops(exposureFor({ base, was: base, seen: AIM / 32, range: [-3, 9] }), base) - 3) < 1e-9);
  assert.ok(ADAPTS.fully === 1 && ADAPTS.partly === 0.5);
  // Deeper shade still: as far as it opens, no further; a bright view: as far as it closes.
  assert.ok(Math.abs(stops(exposureFor({ base, was: base, seen: AIM / 1e4 }), base) - ADAPTS.opens) < 1e-9);
  assert.ok(Math.abs(stops(exposureFor({ base, was: base, seen: 1 }), base) + ADAPTS.closes) < 1e-9);
  assert.ok(ADAPTS.closes > 0 && ADAPTS.opens > 2 && ADAPTS.opens <= 4);
  // Following half way: half the stops. Not at all, or nothing seen yet: the hour's.
  assert.ok(Math.abs(stops(exposureFor({ base, was: base, seen: AIM / 2, follow: 0.5 }), base) - 0.5) < 1e-9);
  assert.equal(exposureFor({ base, was: base, seen: AIM / 2, follow: 0 }), base);
  assert.equal(exposureFor({ base, was: undefined, seen: undefined }), base);
  assert.equal(exposureFor({ base, was: base, seen: 0 }), base);
});

test('the darker the hour, the less further the eye can open: dusk is not made as bright as noon', () => {
  // With the sun high: all of its opening to spare.
  assert.deepEqual(rangeAt(DAY_EXPOSURE, DAY_EXPOSURE), [-ADAPTS.closes, ADAPTS.opens]);
  assert.equal(lightAt({ hour: 13 }).exposure, DAY_EXPOSURE);
  // Each stop the hour has opened it already is a stop less.
  assert.ok(Math.abs(rangeAt(DAY_EXPOSURE * 2, DAY_EXPOSURE)[1] - (ADAPTS.opens - 1)) < 1e-9);
  // Through the day: never more than at noon, and at night about two stops (as TreeLab's eye first had).
  let last = Infinity;
  for (const hour of [13, 17, 19.25, 20.25, 21]) {
    const up = rangeAt(lightAt({ hour }).exposure, DAY_EXPOSURE)[1];
    assert.ok(up <= last + 1e-9 && up <= ADAPTS.opens, `${hour} h: ${up.toFixed(2)} stops`);
    last = up;
  }
  assert.ok(last > 1.9 && last < 2.3, `at night: ${last.toFixed(2)} stops`);
  // However dark the hour: what it makes up for in full, at least.
  assert.equal(rangeAt(DAY_EXPOSURE * 64, DAY_EXPOSURE)[1], ADAPTS.fully);
  // The exposure it heads for keeps to the hour's range.
  const dusk = lightAt({ hour: 21 }).exposure, range = rangeAt(dusk, DAY_EXPOSURE);
  assert.ok(Math.abs(stops(exposureFor({ base: dusk, was: dusk, seen: AIM / 1e4, range }), dusk) - range[1]) < 1e-9);
});

test('it gets there over a second or so, faster when the view got brighter', () => {
  assert.equal(eased(1, 2, 0), 1);
  assert.equal(eased(1, 1, 0.1), 1);
  const up = eased(1, 2, 0.1), down = eased(2, 1, 0.1);
  assert.ok(up > 1 && up < 2 && down < 2 && down > 1);
  assert.ok(stops(2, down) > 2 * stops(up, 1), 'closing down no faster than opening up');
  // Frame by frame: there within a few seconds, never past.
  let e = 1, frames = 0;
  while (e !== 4 && frames < 2000) { e = eased(e, 4, 1 / 60); assert.ok(e <= 4); frames++; }
  assert.ok(frames > 60 && frames < 600, `${frames} frames to open up two stops`);
  e = 4; frames = 0;
  while (e !== 1 && frames < 2000) { e = eased(e, 1, 1 / 60); assert.ok(e >= 1); frames++; }
  assert.ok(frames > 15 && frames < 200, `${frames} frames to close down two stops`);
});

// A renderer that notes what's asked of it; what's read back is mid-grey.
function fakeRenderer() {
  const calls = [];
  const state = { target: null };
  const fill = (buffer) => buffer.fill(128);
  let read = null;
  return {
    calls,
    autoClear: true,
    toneMappingExposure: 1.5,
    getDrawingBufferSize: (v) => v.set(800, 600),
    getRenderTarget: () => state.target,
    setRenderTarget: (t) => { state.target = t; },
    copyFramebufferToTexture: (texture) => calls.push(['copy', texture.image.width, texture.image.height, state.target]),
    render: () => calls.push(['render', state.target]),
    readRenderTargetPixels: (t, x, y, w, h, buffer) => { calls.push(['read']); fill(buffer); },
    readRenderTargetPixelsAsync: (t, x, y, w, h, buffer) => new Promise((resolve) => { calls.push(['read later']); read = () => { fill(buffer); resolve(buffer); }; }),
    answer: () => read?.(),
  };
}

test('a look copies the frame on screen, shrinks it and reads it back without waiting; one look at a time', async () => {
  const renderer = fakeRenderer();
  const eye = createEye({ renderer });
  const before = new THREE.WebGLRenderTarget(4, 4);
  renderer.setRenderTarget(before);
  eye.look();
  assert.deepEqual(renderer.calls.map((c) => c[0]), ['copy', 'render', 'read later']);
  assert.deepEqual(renderer.calls[0].slice(1), [800, 600, null], 'not the screen\'s frame, whole');
  assert.equal(renderer.getRenderTarget(), before);
  assert.equal(renderer.autoClear, true);
  assert.equal(eye.seen, null, 'an answer before the GPU gave one');
  for (let i = 0; i < 6; i++) eye.look();
  assert.equal(renderer.calls.length, 3, 'a second look while the first is out');
  renderer.toneMappingExposure = 3; // (moved on meanwhile)
  renderer.answer();
  await new Promise((r) => setTimeout(r, 0));
  // (Mid-grey bytes hold the mean's square root.)
  assert.ok(Math.abs(eye.seen.mean - (128 / 255) ** 2) < 1e-9);
  assert.equal(eye.seen.at, 1.5, 'not the exposure the frame was drawn with');
  // Not every frame.
  const looks = () => renderer.calls.filter((c) => c[0] === 'read later').length;
  for (let i = 0; i < 2; i++) { eye.look(); renderer.answer(); await new Promise((r) => setTimeout(r, 0)); }
  const after = looks();
  for (let i = 0; i < 9; i++) { eye.look(); renderer.answer(); await new Promise((r) => setTimeout(r, 0)); }
  assert.equal(looks() - after, 3);
});

test('measured at once when asked (the first frame), and nothing with no screen yet', () => {
  const renderer = fakeRenderer();
  const eye = createEye({ renderer });
  const seen = eye.measure();
  assert.deepEqual(renderer.calls.map((c) => c[0]), ['copy', 'render', 'read']);
  assert.ok(seen.mean > 0.2 && seen.mean < 0.3 && seen.at === 1.5);
  renderer.getDrawingBufferSize = (v) => v.set(0, 0);
  const hidden = createEye({ renderer });
  assert.equal(hidden.measure(), null);
  hidden.look();
  assert.equal(renderer.calls.length, 3);
});

test('settings keep the eye in range, following all the way to start', () => {
  assert.equal(normalize({}).settings.light.eye, 1);
  assert.equal(normalize({ light: { eye: 3 } }).settings.light.eye, RANGES['light.eye'][1]);
  assert.equal(normalize({ light: { eye: -1 } }).settings.light.eye, RANGES['light.eye'][0]);
});
