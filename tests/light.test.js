import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NOON, SUNRISE, SUNSET, lightAt, onScreen, sunAt, DAY_EXPOSURE, SKY_SHARE, brightness } from '../src/light.js';
import { RANGES, normalize } from '../src/settings.js';

// The day's light (src/light.js): the sun's path, the light, haze and
// exposure for each hour, and the screen's colours for the fog.

const HOURS = [];
for (let h = RANGES['light.hour'][0]; h <= RANGES['light.hour'][1]; h += RANGES['light.hour'][2]) HOURS.push(h);
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const compass = (v) => ((THREE.MathUtils.radToDeg(Math.atan2(v.x, -v.z)) % 360) + 360) % 360;

test('the sun rises at sunrise, stands highest at noon and sets at sunset', () => {
  assert.ok(close(sunAt(SUNRISE, 200).elevation, 0));
  assert.ok(close(sunAt(SUNSET, 200).elevation, 0));
  const noon = sunAt(NOON, 200).elevation;
  for (const h of HOURS) assert.ok(sunAt(h, 200).elevation <= noon + 1e-9, `${h} h`);
  assert.ok(noon > 50 && noon < 70, `${noon}° at noon`);
  assert.ok(sunAt(SUNRISE - 0.25, 200).elevation < 0 && sunAt(SUNSET + 0.25, 200).elevation < 0, 'down at night');
});

test('the sun is where its elevation says, one unit away', () => {
  for (const h of HOURS) {
    const { elevation, direction } = sunAt(h, 130);
    assert.ok(close(direction.length(), 1), `${h} h`);
    assert.ok(close(THREE.MathUtils.radToDeg(Math.asin(direction.y)), elevation, 1e-4), `${h} h`);
  }
});

test('the noon sun shines from "from"; the morning sun from its left, the evening sun from its right', () => {
  for (const from of [0, 90, 200, 355]) {
    const turn = (h) => ((compass(sunAt(h, from).direction) - from + 540) % 360) - 180;
    assert.ok(close(turn(NOON), 0), `${from}°: noon ${turn(NOON)}°`);
    assert.ok(turn(9) < -30, `${from}°: morning ${turn(9)}°`);
    assert.ok(turn(17) > 30, `${from}°: evening ${turn(17)}°`);
  }
});

test('every hour gives finite light, haze and exposure', () => {
  const finite = (v) => {
    if (v instanceof THREE.Color) return [v.r, v.g, v.b].every((c) => Number.isFinite(c) && c >= 0);
    if (v instanceof THREE.Vector3) return [v.x, v.y, v.z].every(Number.isFinite);
    if (typeof v === 'object') return Object.values(v).every(finite);
    return Number.isFinite(v) && v >= 0;
  };
  for (const h of HOURS) {
    const L = lightAt({ hour: h, from: 200 });
    assert.ok(finite({ ...L, elevation: 0 }), `${h} h`);
    assert.ok(L.exposure >= DAY_EXPOSURE && L.exposure < 3 * DAY_EXPOSURE, `${h} h: exposure ${L.exposure}`);
    assert.ok(L.skyGives > 0, `${h} h`);
  }
});

test('the sky gives its share of the sun\'s light: an eighth with the sun high, a quarter on the horizon', () => {
  const share = (L) => L.skyGives / (L.sun.intensity * brightness(L.sun.color));
  const noon = lightAt({ hour: NOON }), morning = lightAt({ hour: 8.25 }), low = lightAt({ hour: SUNSET - 0.25 });
  assert.ok(Math.abs(share(noon) - SKY_SHARE[1]) < 1e-9 && SKY_SHARE[1] > 0.1 && SKY_SHARE[1] < 0.16);
  assert.ok(Math.abs(share(morning) - SKY_SHARE[1]) < 0.01, 'by mid-morning, as at noon');
  assert.ok(share(low) > 0.2 && share(low) <= SKY_SHARE[0] + 1e-9, `${share(low).toFixed(2)} with the sun 3 degrees up`);
  // Dimmer in all as the sun sinks, though a bigger share.
  assert.ok(low.skyGives < morning.skyGives);
  // The camera at noon: a white thing lying in the sun (and the sky's
  // light) comes out just short of white.
  const white = (noon.sun.intensity * brightness(noon.sun.color) * Math.sin(THREE.MathUtils.degToRad(noon.elevation)) + noon.skyGives) / Math.PI;
  assert.ok(white * DAY_EXPOSURE > 0.9 && white * DAY_EXPOSURE < 1.3, `a white card: ${(white * DAY_EXPOSURE).toFixed(2)}`);
});

test('a low sun is warmer and weaker than the noon sun, and the eye opens up for it', () => {
  const noon = lightAt({ hour: NOON }), evening = lightAt({ hour: SUNSET - 0.75 });
  const warmth = (c) => c.r - c.b;
  assert.ok(warmth(evening.sun.color) > warmth(noon.sun.color) + 0.1);
  assert.ok(evening.sun.intensity < noon.sun.intensity);
  assert.ok(evening.exposure > noon.exposure);
  assert.ok(evening.sky.turbidity > noon.sky.turbidity, 'hazier low down');
});

test('no sun after sunset', () => {
  const night = lightAt({ hour: RANGES['light.hour'][1] });
  assert.equal(night.sun.intensity, 0);
  assert.ok(night.skyGives > 0 && night.skyGives < 0.05, 'the sky still lights a little');
});

test('the screen\'s colours follow three.js\'s Neutral tone mapping', () => {
  // Dim colours: only the slight lift off black is taken.
  const dim = onScreen(new THREE.Color().setRGB(0.5, 0.3, 0.2), 1);
  assert.ok(close(dim.r, 0.46) && close(dim.g, 0.26) && close(dim.b, 0.16));
  // Exposure scales the light first.
  const half = onScreen(new THREE.Color().setRGB(1, 0.6, 0.4), 0.5);
  assert.ok(close(half.r, 0.46) && close(half.g, 0.26) && close(half.b, 0.16));
  // Bright ones are brought under 1 and whiten, in order.
  let last = -1;
  for (const v of [0.8, 1, 2, 5, 20]) {
    const c = onScreen(new THREE.Color().setRGB(v, v * 0.5, v * 0.2), 1);
    assert.ok(c.r < 1 && c.r > last, `${v}`);
    assert.ok(c.b < c.g && c.g < c.r, `${v}: keeps its hue`);
    last = c.r;
  }
  const blazing = onScreen(new THREE.Color().setRGB(50, 25, 10), 1);
  assert.ok(blazing.b > 0.8, 'blazing light turns white');
});

test('settings keep the hour and the sun\'s direction in range', () => {
  const { settings } = normalize({ light: { hour: 30, from: -40 } });
  assert.equal(settings.light.hour, RANGES['light.hour'][1]);
  assert.equal(settings.light.from, RANGES['light.from'][0]);
  assert.deepEqual(normalize({ light: { hour: 'noon' } }).settings.light.hour, normalize({}).settings.light.hour);
});

test('the air is hazier, and catches more sun, as the sun sinks', () => {
  const noon = lightAt({ hour: NOON }).haze, evening = lightAt({ hour: SUNSET - 1 }).haze;
  assert.ok(noon > 0 && evening > noon * 2, `noon ${noon}, evening ${evening}`);
  for (const h of HOURS) {
    const { haze } = lightAt({ hour: h });
    // (Clear air: you see 4 km at the least, and 40 at the most.)
    assert.ok(Number.isFinite(haze) && 3.9 / haze > 4000 && 3.9 / haze < 40000, `${h} h: ${haze}`);
  }
});

test('settings keep the light shafts in range', () => {
  assert.equal(normalize({}).settings.light.shafts, 1); // (as in life)
  assert.equal(RANGES['light.shafts'][1], 10, 'how far the boost goes (named in the tip and the README)');
  assert.equal(normalize({ light: { shafts: 6 } }).settings.light.shafts, 6);
  assert.equal(normalize({ light: { shafts: 99 } }).settings.light.shafts, RANGES['light.shafts'][1]);
  assert.equal(normalize({ light: { shafts: -2 } }).settings.light.shafts, RANGES['light.shafts'][0]);
});

test('TreeLab opens in the evening, the sun low and to one side, and a little mist', () => {
  const { settings } = normalize({});
  const L = lightAt(settings.light);
  assert.ok(L.elevation > 10 && L.elevation < 25, `${L.elevation.toFixed(1)}° up`);
  assert.ok(L.sun.intensity > 1.5, 'too dark');
  assert.ok(settings.light.mist > 0 && settings.light.mist < 0.5);
  assert.equal(normalize({ light: { mist: 7 } }).settings.light.mist, RANGES['light.mist'][1]);
});

test('the day runs: so many hours for each minute watched, and starts again after its last hour', async () => {
  const { hourAfter } = await import('../src/light.js');
  assert.equal(hourAfter(12, 0, 60), 12, 'a day standing still moves');
  assert.ok(Math.abs(hourAfter(12, 6, 60) - 18) < 1e-9, '6 hours a minute, for a minute');
  assert.ok(Math.abs(hourAfter(12, 6, 10) - 13) < 1e-9, 'and for ten seconds');
  assert.ok(Math.abs(hourAfter(20.5, 6, 10) - 5.5) < 1e-9, 'past 21:00 it is morning again');
  assert.ok(Math.abs(hourAfter(20, 24, 60 * 3) - 12) < 1e-9, 'whole days on, the same hour of the day');
  for (let hour = 5, i = 0; i < 2000; i++) {
    hour = hourAfter(hour, 24, 0.016);
    assert.ok(hour >= 5 && hour <= 21, `out of the day: ${hour}`);
  }
});
