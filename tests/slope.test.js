import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slopeAt, slopeSpot } from '../src/slope.js';
import { createTerrain, groundFor } from '../src/terrain.js';
import { defaultSettings } from '../src/settings.js';

// Where one tree stands on the hills: on a slope near the middle, the same
// place every time for the same hills.

const tilted = (deg) => (x) => x * Math.tan((deg * Math.PI) / 180);

test('a slope is measured in degrees', () => {
  assert.ok(Math.abs(slopeAt(tilted(12), 3, -5) - 12) < 0.01);
  assert.equal(slopeAt(() => 0, 0, 0), 0);
});

test('on even ground sloping about the aim, the tree stands at the middle; on level ground too', () => {
  const spot = slopeSpot(tilted(12));
  assert.deepEqual([spot.x, spot.z], [0, 0]);
  assert.ok(Math.abs(spot.slope - 12) < 0.01);
  assert.deepEqual(slopeSpot(() => 0), { x: 0, z: 0, slope: 0 });
});

test('on a level middle with a hill to one side, the tree goes to the hill\'s side, as near as it can', () => {
  // (Level within 10 m of the middle; beyond, a slope of about 14° rising east.)
  const ground = (x) => (x > 10 ? (x - 10) * Math.tan((14 * Math.PI) / 180) : 0);
  const spot = slopeSpot(ground);
  assert.ok(spot.x > 10 && spot.x <= 14 && spot.z === 0, `at ${spot.x}, ${spot.z}`);
  assert.ok(spot.slope > 10);
});

test('the same hills give the same place, within reach of the middle', () => {
  const settings = defaultSettings();
  const hills = createTerrain({ ...settings.terrain, height: 14 }, groundFor(settings.forest.radius));
  try {
    const a = slopeSpot((x, z) => hills.heightAt(x, z)), b = slopeSpot((x, z) => hills.heightAt(x, z));
    assert.deepEqual(a, b);
    assert.ok(Math.hypot(a.x, a.z) <= 40);
    assert.ok(a.slope >= 4 && a.slope < 30, `a slope of ${a.slope.toFixed(1)}°`);
  } finally {
    hills.dispose?.();
  }
});
