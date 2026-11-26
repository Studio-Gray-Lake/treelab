import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawnIn, focusOf, heightIn, isClick, ringPoints, ringRadius, sameTree, turnRate } from '../src/select.js';
import { layoutOak } from '../src/oak/oak.js';
import { DEFAULT_SHAPES, FRAMES, OWN_KINDS } from '../src/kinds.js';
import { RANGES, defaultSettings, normalize } from '../src/settings.js';
import { tip } from '../src/tips.js';

// Selecting a tree (a click), centring the view on it, what it drew from
// its kind's ranges (the panel's red marks), and how
// fast the view turns by itself (src/select.js; wired up in src/main.js).

test('"turn speed" is in degrees a second, and as it was to start with', () => {
  // (The orbit controls' own speed is 2, a turn in half a minute: 12° a second.)
  assert.equal(defaultSettings().view.turnSpeed, 12);
  assert.equal(turnRate(12), 2);
  assert.equal(turnRate(-12), -2, 'below 0 it turns the other way');
  assert.equal(turnRate(0), 0);
  const [least, most] = RANGES['view.turnSpeed'];
  assert.ok(least < 0 && most >= 30);
  assert.ok(tip('view.turnSpeed') && tip('action.centre'));
  // (Settings saved before there was a turn speed open at the usual one; one out of range is brought inside it.)
  const old = defaultSettings();
  delete old.view.turnSpeed;
  assert.equal(normalize(JSON.parse(JSON.stringify(old))).settings.view.turnSpeed, 12);
  const wild = defaultSettings();
  wild.view.turnSpeed = 500;
  assert.equal(normalize(JSON.parse(JSON.stringify(wild))).settings.view.turnSpeed, most);
});

test('the view turns by the clock, not by the frame', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /controls\.update\(Math\.min\(dt, 0\.1\)\)/);
  assert.equal(main.match(/controls\.autoRotateSpeed = turnRate\(/g).length, 3, 'set from the slider, on loading settings, and at the start');
});

test('a click is a press and a release in one place; a drag is not', () => {
  assert.ok(isClick({ x: 100, y: 100 }, { x: 102, y: 103 }));
  assert.ok(!isClick({ x: 100, y: 100 }, { x: 130, y: 100 }));
  assert.ok(!isClick(null, { x: 1, y: 1 }), 'no press of the first button: no click');
});

test('a selected tree: how tall it stands, where the view turns round it, and its ring on the ground', () => {
  const a = { kind: 'oak', x: 3, z: -4, y: 1.2, size: 1.1, crown: 9 }, b = { kind: 'hazel', x: 10, z: 2, y: 0, size: 1, crown: 2.5 };
  const species = { broadleaf: { variants: [{ trees: [a], height: 20 }, { trees: [b], height: 5 }] } };
  assert.equal(heightIn(species, a), 22);
  assert.equal(heightIn(species, b), 5);
  assert.equal(heightIn(species, { kind: 'oak' }), 0, 'a tree that isn\'t planted');
  assert.equal(heightIn(undefined, a), 0);
  // (The view turns round a point on its trunk, a little under halfway up it, from the ground it stands on.)
  const [x, y, z] = focusOf({ x: a.x, y: a.y, z: a.z, height: 22 });
  assert.deepEqual([x, z], [3, -4]);
  assert.ok(Math.abs(y - (1.2 + 9.9)) < 1e-9);
  // (The ring: round its foot, on the ground wherever that is, a little above it; wider under a wider tree, never huge.)
  const hills = (px, pz) => 0.1 * px + 0.2 * pz;
  const ring = ringPoints({ x: a.x, z: a.z, radius: ringRadius(a.crown), heightAt: hills });
  assert.ok(ring.length >= 24);
  for (const [px, py, pz] of ring) {
    assert.ok(Math.abs(Math.hypot(px - a.x, pz - a.z) - ringRadius(a.crown)) < 1e-9);
    assert.ok(Math.abs(py - hills(px, pz) - 0.1) < 1e-9);
  }
  assert.ok(ringRadius(9) > ringRadius(2.5) && ringRadius(0) >= 0.8 && ringRadius(100) <= 3.5 && ringRadius(undefined) >= 0.8);
});

test('the selection stays on the tree when the trees are planted again', () => {
  const was = { kind: 'oak', x: 3, z: -4 };
  const again = [{ kind: 'hazel', x: 3, z: -4 }, { kind: 'oak', x: 3.01, z: -4 }, { kind: 'oak', x: 12, z: 0 }];
  assert.equal(sameTree(again, was), again[1], 'the one of its kind standing where it stood');
  assert.equal(sameTree([again[0], again[2]], was), null, 'gone: another kind stands there now');
  assert.equal(sameTree(again, null), null);
});

test('every tree of TreeLab\'s own says what it drew from each of its kind\'s ranges', () => {
  for (const kind of OWN_KINDS) {
    const shape = DEFAULT_SHAPES[kind];
    const { drew } = layoutOak(7, shape, FRAMES[kind]).oak;
    for (const key of ['height', 'spread', 'girth', 'limbs', 'lean']) {
      const [least, most] = shape[key];
      assert.ok(drew[key] >= least && drew[key] <= most, `the ${kind}'s ${key}: ${drew[key]} in ${least} to ${most}`);
    }
    assert.ok(Number.isInteger(drew.limbs), `the ${kind}'s limbs are counted: ${drew.limbs}`);
    // (A kind of stems has no trunk to draw.)
    assert.equal('trunk' in drew, !FRAMES[kind].stems, `the ${kind}'s bare trunk`);
    assert.deepEqual(layoutOak(7, shape, FRAMES[kind]).oak.drew, drew, 'the same seed draws the same');
  }
  // (Two trees of a kind draw their own.)
  assert.notEqual(layoutOak(7, DEFAULT_SHAPES.oak, FRAMES.oak).oak.drew.height, layoutOak(8, DEFAULT_SHAPES.oak, FRAMES.oak).oak.drew.height);
});

test('a planted tree\'s own values are its grown tree\'s, its lengths by its own size', () => {
  const big = { size: 1.5 }, plain = {}, other = {};
  const drew = { height: 20, spread: 0.6, trunk: 4, girth: 0.5, limbs: 7, lean: 3 };
  const species = {
    broadleaf: { variants: [{ trees: [big, plain], model: { tree: { layout: { oak: { drew } } } } }, { trees: [other], model: { tree: {} } }] },
  };
  assert.deepEqual(drawnIn(species, big), { height: 30, spread: 0.6, trunk: 6, girth: 0.75, limbs: 7, lean: 3 }, 'metres grow with the tree; a share, a count and an angle do not');
  assert.deepEqual(drawnIn(species, plain), drew);
  assert.equal(drawnIn(species, other), null, 'a tree grown by the workshop\'s code keeps none');
  assert.equal(drawnIn(species, {}), null, 'nor a tree that is not planted');
  assert.equal(drawnIn(null, big), null);
});

test('the page says how to select and centre', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(page, /Click a tree to select it \(C centres on it\)/);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /\.name\('turn speed \(°\/s\)'\)/);
  assert.match(main, /\.name\('centre on the selected tree'\)/);
});
