import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EYE, LOOK_UP, PIVOT, standingSpot, standingView, stepOnGround } from '../src/stand.js';
import { placeForest } from '../src/forest.js';
import { sunAt } from '../src/light.js';
import { defaultSettings, normalize } from '../src/settings.js';

// Standing among the trees (src/stand.js): where, looking which way, and a
// step on the ground. (The camera and its controls are checked in the
// browser.)

const flat = { heightAt: () => 0, slopeAt: () => 0, half: 150 };
const wood = (radius, density) => placeForest({ ...defaultSettings().forest, radius, density }, flat).records;
const toSun = sunAt(6.75, 220).direction;
const onMap = (v) => new THREE.Vector2(v.x, v.z).normalize();

test('you stand back from the middle, the sun ahead beyond it, clear of the trunks', () => {
  const trees = wood(60, 80);
  const spot = standingSpot({ trees, toSun, radius: 60 });
  const s = onMap(toSun);
  const along = spot.x * s.x + spot.z * s.y; // (how far toward the sun from the middle)
  assert.ok(along < -8 && along > -20, `${along.toFixed(1)} m toward the sun`);
  assert.ok(Math.hypot(spot.x, spot.z) < 60 * 0.5, 'not well inside the forest');
  const clear = Math.min(...trees.map((t) => Math.hypot(t.x - spot.x, t.z - spot.z)));
  assert.ok(clear > 2, `${clear.toFixed(1)} m from the nearest trunk`);
  // The same forest and sun: the same spot.
  assert.deepEqual(standingSpot({ trees, toSun, radius: 60 }), spot);
});

test('the spot is the clearest one near: a trunk where you would stand moves you off it', () => {
  const s = onMap(toSun);
  const open = standingSpot({ trees: [], toSun, radius: 60 });
  assert.ok(Math.abs(open.x + s.x * 14) < 1e-9 && Math.abs(open.z + s.y * 14) < 1e-9, 'with no trees: 14 m back, exactly');
  const blocked = standingSpot({ trees: [{ x: open.x, z: open.z }], toSun, radius: 60 });
  assert.ok(Math.hypot(blocked.x - open.x, blocked.z - open.z) >= 3.5, 'still at the trunk');
  // A dense forest: no spot is clear, the best one is taken.
  const dense = wood(30, 2500);
  const tight = standingSpot({ trees: dense, toSun, radius: 30 });
  const clear = Math.min(...dense.map((t) => Math.hypot(t.x - tight.x, t.z - tight.z)));
  assert.ok(clear > 0.9, `${clear.toFixed(2)} m from the nearest trunk in a forest of one every 2 m`);
});

test('in a small forest you stand nearer its middle, and still inside it', () => {
  for (const radius of [5, 12, 30, 160]) {
    const spot = standingSpot({ trees: [], toSun, radius });
    const back = Math.hypot(spot.x, spot.z);
    assert.ok(back > 3 - 1e-6 && back < 14 + 1e-6 && back < Math.max(3, radius * 0.6) + 1e-6, `${back.toFixed(1)} m back in a forest of ${radius} m`);
  }
  // A sun straight overhead (it never is): a spot all the same.
  const noon = standingSpot({ trees: [], toSun: { x: 0, z: 0 }, radius: 30 });
  assert.ok(Number.isFinite(noon.x) && Number.isFinite(noon.z));
});

test('the eye is 1.7 m over the ground, looking toward the sun and a little up', () => {
  const spot = { x: 4, z: -7 };
  const { position, target } = standingView({ spot, toSun, ground: 2.5 });
  assert.deepEqual(position.toArray(), [4, 2.5 + EYE, -7]);
  assert.equal(EYE, 1.7);
  const look = target.clone().sub(position);
  assert.ok(Math.abs(look.length() - PIVOT) < 1e-9, 'the point it turns round is just ahead');
  assert.ok(Math.abs(THREE.MathUtils.radToDeg(Math.asin(look.y / PIVOT)) - LOOK_UP) < 1e-6);
  assert.ok(onMap(look).distanceTo(onMap(toSun)) < 1e-6, 'not facing the sun');
  assert.ok(LOOK_UP > 5 && LOOK_UP < 20);
});

test('a step is on the ground: ahead the way the camera faces, aside to its right, however it tilts', () => {
  const position = new THREE.Vector3(1, 1.7, 1);
  // Facing -z (three.js's "ahead"), looking steeply up.
  const target = new THREE.Vector3(1, 1.7 + 0.4, 1 - 0.3);
  assert.deepEqual(stepOnGround(position, target, 2, 0).toArray().map((v) => +v.toFixed(9) || 0), [0, 0, -2]);
  assert.deepEqual(stepOnGround(position, target, 0, 1.5).toArray().map((v) => +v.toFixed(9) || 0), [1.5, 0, 0]);
  // Any way round: as long as asked, level, at right angles.
  const turned = new THREE.Vector3(1 + 0.3, 1.5, 1 + 0.2);
  const ahead = stepOnGround(position, turned, 3, 0).clone(), aside = stepOnGround(position, turned, 0, 3).clone();
  assert.ok(Math.abs(ahead.length() - 3) < 1e-9 && ahead.y === 0 && aside.y === 0);
  assert.ok(Math.abs(ahead.dot(aside)) < 1e-9);
  assert.ok(ahead.clone().cross(new THREE.Vector3(0, 1, 0)).normalize().distanceTo(aside.clone().normalize()) < 1e-9, 'aside is not to the right');
  // Looking straight up: nowhere to go.
  assert.deepEqual(stepOnGround(position, new THREE.Vector3(1, 3, 1), 2, 2).toArray(), [0, 0, 0]);
});

test('settings: the forest is seen from above to start, and from among the trees when asked', () => {
  assert.equal(normalize({}).settings.view.stand, false);
  assert.equal(normalize({ view: { stand: true } }).settings.view.stand, true);
  const { settings, notes } = normalize({ view: { stand: 'yes' } });
  assert.equal(settings.view.stand, false);
  assert.ok(notes.some((n) => n.includes('view.stand')));
});
