import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { rigBones } from '../scripts/rig.js';
import CLIPS from '../src/figureClips.js';
import { BODY, CYCLES, keyed, poseOf } from '../src/figureKeys.js';
import { createFigure, gaitOf, sourcesOf } from '../src/figure.js';
import { JUMPS, RUNS, WALKS, createWalker, stepWalker } from '../src/walker.js';
import { createPlanter, trunkRadius, trunksOf } from '../src/tree.js';
import { OAK_SHAPE } from '../src/oak/oak.js';
import { DEFAULT_SHAPES } from '../src/kinds.js';

// The figure walking (src/figure.js): its hand-keyed cycles
// (src/figureKeys.js), Mixamo's clips fitted to it (src/figureClips.js),
// its feet on the ground, and the trunks it walks round.

const flat = { heightAt: () => 0 };
const at = (root, name) => root.worldToLocal(root.getObjectByName(name).getWorldPosition(new THREE.Vector3()));

// A figure of its own (bare bones), walked `seconds` over `ground`, asked
// `want`; `each(walker, pose, figure, root)` after every frame.
function walked({ want = { x: 0, z: 1, run: 0, jump: false }, ground = flat, seconds = 4, sources = sourcesOf({}), each = () => {}, from = 0 } = {}) {
  const root = rigBones();
  const figure = createFigure(root, { sources });
  const walker = createWalker();
  for (let i = 0; i < seconds * 60; i++) {
    stepWalker(walker, typeof want === 'function' ? want(i / 60) : want, 1 / 60, ground);
    root.position.set(walker.x, walker.y, walker.z);
    root.rotation.y = walker.heading;
    const pose = figure.update(1 / 60, walker, ground);
    root.updateWorldMatrix(true, true);
    if (i / 60 >= from) each(walker, pose, figure, root, i / 60);
  }
  return { root, figure, walker };
}

test('the keyed cycles are measured for the workshop\'s figure', () => {
  const root = rigBones();
  const hip = at(root, 'UpperLeg_L'), knee = at(root, 'LowerLeg_L'), ankle = at(root, 'Foot_L'), toes = at(root, 'Toes_L');
  assert.ok(Math.abs(hip.distanceTo(knee) - BODY.thigh) < 0.005, `its thigh is ${hip.distanceTo(knee).toFixed(3)} m`);
  assert.ok(Math.abs(knee.distanceTo(ankle) - BODY.shin) < 0.005, `its shin is ${knee.distanceTo(ankle).toFixed(3)} m`);
  assert.ok(Math.abs(ankle.y - BODY.ankle) < 0.005 && Math.abs(hip.y - BODY.hip) < 0.005 && Math.abs(hip.x - BODY.apart) < 0.005);
  assert.ok(Math.abs(toes.z - ankle.z - BODY.ball) < 0.01, 'the ball of its foot');
});

test('a keyed value goes smoothly through its keys, and round the end', () => {
  const round = keyed([[0, 1], [0.25, 3], [0.6, -1]]);
  for (const [when, value] of [[0, 1], [0.25, 3], [0.6, -1], [1, 1], [1.25, 3], [-0.4, -1]]) assert.ok(Math.abs(round(when) - value) < 1e-9, `${when}`);
  for (let p = 0; p < 1; p += 0.01) assert.ok(Math.abs(round(p + 0.002) - round(p)) < 0.08, `a jump at ${p.toFixed(2)}`);
  const once = keyed([[0, 0], [0.5, 2], [1, 1]], { once: true });
  assert.equal(once(-1), 0);
  assert.equal(once(3), 1);
  assert.ok(Math.abs(once(0.5) - 2) < 1e-9);
  assert.equal(keyed([[0, 7]])(0.4), 7);
});

test('the keyed walk and run: a foot on the ground stays where it stands, the other foot half a stride behind', () => {
  for (const name of ['walk', 'run']) {
    const c = CYCLES[name];
    // (While it's flat on the ground it goes back, under the body, exactly as far as the stride says.)
    const a = poseOf(name, c.flat[0] + 0.01).feet[0], b = poseOf(name, c.flat[1] - 0.01).feet[0];
    assert.ok(Math.abs((a.z - b.z) - c.stride * (c.flat[1] - c.flat[0] - 0.02)) < 1e-9, `${name}: its foot slides on the ground`);
    assert.ok(Math.abs(a.y - BODY.ankle) < 1e-9 && a.contact === 1 && a.tilt === 0);
    for (let p = 0; p < 1; p += 0.05) {
      const now = poseOf(name, p), later = poseOf(name, p + 0.5);
      for (const k of ['y', 'z', 'tilt', 'contact']) assert.ok(Math.abs(now.feet[1][k] - later.feet[0][k]) < 1e-9, `${name}: the right foot isn't the left's, half a stride on`);
      assert.equal(now.feet[1].x, -now.feet[0].x);
      // It never asks more of a leg than it has, and its knees stay a little bent.
      for (const [f, foot] of now.feet.entries()) {
        const reach = Math.hypot(foot.x - (f ? -1 : 1) * BODY.apart - now.hips.x, foot.y - now.hips.y, foot.z) / (BODY.thigh + BODY.shin);
        assert.ok(reach < (foot.contact ? 0.999 : 1.03), `${name} at ${p.toFixed(2)}: a leg ${(reach * 100).toFixed(1)}% of its length`);
      }
    }
    // Round the end without a jump.
    const first = poseOf(name, 0), last = poseOf(name, 0.9999);
    assert.ok(Math.abs(first.hips.y - last.hips.y) < 0.005 && Math.abs(first.feet[0].z - last.feet[0].z) < 0.02 && Math.abs(first.arms[0].shoulder - last.arms[0].shoulder) < 0.5, `${name}: a jump where it comes round`);
    // As the left foot lands, the left arm is back and the right forward.
    assert.ok(first.arms[0].shoulder < 0 && first.arms[1].shoulder > 0, `${name}: its arms swing with its legs`);
  }
});

test('a walk always has a foot on the ground and rises over each step; a run flies and sinks over each foot', () => {
  let both = 0, neither = 0, flight = 0;
  for (let i = 0; i < 200; i++) {
    const walk = poseOf('walk', i / 200), run = poseOf('run', i / 200);
    const down = walk.feet[0].contact + walk.feet[1].contact;
    if (down === 2) both++;
    if (down === 0) neither++;
    if (run.feet[0].contact + run.feet[1].contact === 0) flight++;
  }
  assert.equal(neither, 0, 'the walk leaves the ground');
  assert.ok(both > 30 && both < 70, `both feet down for ${both / 2}% of a walk's stride`);
  assert.ok(flight > 50 && flight < 90, `in the air for ${flight / 2}% of a run's stride`);
  const high = (name) => [...Array(100).keys()].map((i) => poseOf(name, i / 100).hips.y);
  const walk = high('walk'), run = high('run');
  const rise = (list) => Math.max(...list) - Math.min(...list);
  assert.ok(rise(walk) > 0.025 && rise(walk) < 0.06, `a walk's hips rise ${(rise(walk) * 100).toFixed(1)} cm`);
  assert.ok(rise(run) > 0.04 && rise(run) < 0.09, `a run's hips rise ${(rise(run) * 100).toFixed(1)} cm`);
  // A walk is highest with the body over the foot, a run lowest.
  assert.ok(poseOf('walk', 0.29).hips.y > poseOf('walk', 0.03).hips.y + 0.02);
  assert.ok(poseOf('run', 0.16).hips.y < poseOf('run', 0.41).hips.y - 0.03);
  // Steps a minute, as people's are.
  const steps = (c) => (120 * c.speed) / c.stride;
  assert.ok(steps(CYCLES.walk) > 100 && steps(CYCLES.walk) < 135 && steps(CYCLES.run) > 160 && steps(CYCLES.run) < 185);
  assert.equal(CYCLES.walk.speed, WALKS);
  assert.equal(CYCLES.run.speed, RUNS);
});

test('standing, the walk and the run are mixed by speed, and the steps lengthen with it', () => {
  for (const [sources, own] of [[sourcesOf({}), true], [sourcesOf(), false]]) {
    let last = 0;
    for (let v = 0; v <= 6; v += 0.1) {
      const g = gaitOf(v, sources);
      assert.ok(Math.abs(g.stand + g.walk + g.run - 1) < 1e-9 && g.stand >= 0 && g.walk >= 0 && g.run >= 0);
      // (The keyed cycles are made for each other. A clip of Mixamo's has
      // its own stride, so where it gives way to another the stride may
      // shorten a little; the steps a minute still stay a person's.)
      if (own) assert.ok(g.stride >= last - 1e-9, `the stride shortens at ${v.toFixed(1)} m/s`);
      if (v >= 0.7) assert.ok((120 * v) / g.stride > 60 && (120 * v) / g.stride < 200, `${((120 * v) / g.stride).toFixed(0)} steps a minute at ${v.toFixed(1)} m/s`);
      last = g.stride;
    }
    assert.equal(gaitOf(0, sources).stand, 1);
    assert.equal(gaitOf(WALKS, sources).walk, 1);
    assert.equal(gaitOf(RUNS, sources).run, 1);
    // (At a walk and at a run the feet on the ground go back as fast as the ground.)
    assert.ok(Math.abs(gaitOf(WALKS, sources).stride - sources.walk.stride * gaitOf(WALKS, sources).longer.walk) < 1e-9);
  }
});

test('walking and running on the flat: the feet on the ground are on it and stay put, and the knees bend forward', () => {
  for (const [name, run, most, least] of [['a walk', 0, 0.012, 40], ['a run', 1, 0.02, 12]]) {
    const planted = [null, null];
    let slid = 0, checked = 0;
    walked({ want: { x: 0, z: 1, run, jump: false }, from: 2, each: (walker, pose, figure, root) => {
      for (const [f, side] of ['L', 'R'].entries()) {
        const ankle = root.getObjectByName(`Foot_${side}`).getWorldPosition(new THREE.Vector3());
        const local = at(root, `Foot_${side}`), knee = at(root, `LowerLeg_${side}`), hip = at(root, `UpperLeg_${side}`);
        for (const v of [ankle, knee, hip]) assert.ok(Number.isFinite(v.x + v.y + v.z), `${name}: a joint is nowhere`);
        // (The knee ahead of the line from hip to ankle.)
        const along = (knee.y - local.y) / (hip.y - local.y);
        assert.ok(knee.z > local.z + (hip.z - local.z) * along - 0.01, `${name}: a knee bends backward`);
        const foot = pose.feet[f];
        if (foot.contact === 1 && Math.abs(foot.y - BODY.ankle) < 1e-6) {
          assert.ok(Math.abs(ankle.y - BODY.ankle) < 0.01, `${name}: a foot on the ground is ${ankle.y.toFixed(3)} m up`);
          if (planted[f]) slid = Math.max(slid, Math.abs(ankle.z - planted[f]));
          else planted[f] = ankle.z;
          checked++;
        } else planted[f] = null;
      }
    } });
    assert.ok(checked > least, `${name}: its feet were flat on the ground for only ${checked} frames`);
    assert.ok(slid < most, `${name}: a foot slid ${(slid * 100).toFixed(1)} cm on the ground`);
  }
});

test('on a slope each foot is on the ground where it is, tilted with it, and the body leans into the hill', () => {
  for (const slope of [0.3, -0.3]) {
    const ground = { heightAt: (x, z) => z * slope };
    let checked = 0, lean = 0;
    walked({ ground, from: 2, each: (walker, pose, figure, root) => {
      for (const [f, side] of ['L', 'R'].entries()) {
        const ankle = root.getObjectByName(`Foot_${side}`).getWorldPosition(new THREE.Vector3());
        const toes = root.getObjectByName(`Toes_${side}`).getWorldPosition(new THREE.Vector3());
        if (pose.feet[f].contact !== 1) continue;
        const over = ankle.y - ground.heightAt(ankle.x, ankle.z);
        assert.ok(over > 0.03 && over < 0.2, `slope ${slope}: an ankle ${over.toFixed(3)} m over the ground`);
        // (While the foot is keyed flat, the ball of it is on the ground too: the sole lies along the slope.)
        const own = (figure.state.phase + f * 0.5) % 1;
        if (own < CYCLES.walk.flat[0] + 0.02 || own > CYCLES.walk.flat[1] - 0.02) continue;
        assert.ok(Math.abs(toes.y - ground.heightAt(toes.x, toes.z)) < 0.04, `slope ${slope}: its toes ${(toes.y - ground.heightAt(toes.x, toes.z)).toFixed(3)} m off the ground`);
        checked++;
      }
      const chest = at(root, 'Neck'), hips = at(root, 'Hips');
      lean += chest.z - hips.z;
    } });
    assert.ok(checked > 30, `slope ${slope}: a foot flat on the ground for only ${checked} frames`);
    assert.ok(Math.sign(lean) === Math.sign(slope), `slope ${slope}: it leans the wrong way`);
  }
});

test('a jump: its feet leave the ground, and it sinks into its knees landing and comes up again', () => {
  let highest = 0, lowestHips = Infinity, standing = 0, after = null;
  walked({ want: (t) => ({ x: 0, z: 0, run: 0, jump: t > 1 && t < 1.03 }), seconds: 3, each: (walker, pose, figure, root, t) => {
    const ankle = root.getObjectByName('Foot_L').getWorldPosition(new THREE.Vector3());
    const hips = at(root, 'UpperLeg_L').y;
    if (t < 1) standing = hips;
    highest = Math.max(highest, ankle.y);
    if (walker.grounded && t > 1.2 && t < 2.2) lowestHips = Math.min(lowestHips, hips);
    if (t > 2.8) after = hips;
  } });
  assert.ok(highest > JUMPS, `its feet rose ${highest.toFixed(2)} m`);
  assert.ok(standing - lowestHips > 0.06 && standing - lowestHips < 0.25, `it sank ${((standing - lowestHips) * 100).toFixed(0)} cm landing`);
  assert.ok(Math.abs(after - standing) < 0.01, 'it didn\'t come up again');
});

test('Mixamo\'s clips are fitted whole, start as the left foot lands, and stand in for the keyed ones', () => {
  const bones = ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'UpperArm_L', 'LowerArm_L', 'Hand_L', 'UpperArm_R', 'LowerArm_R', 'Hand_R'];
  for (const [name, clip] of Object.entries(CLIPS)) {
    const n = clip.hips.length;
    assert.ok(n >= 2 && clip.feet.length === 2 && clip.feet.every((foot) => foot.length === n), `${name}: its feet`);
    for (const bone of bones) {
      assert.equal(clip.bones[bone]?.length, n, `${name}: no ${bone}`);
      for (const q of clip.bones[bone]) assert.ok(Math.abs(Math.hypot(...q) - 1) < 0.01, `${name}: ${bone} isn't a turn`);
    }
    assert.match(clip.from, /^Mixamo: [\w ]+$/, `${name}: where it's from`);
    if (clip.round && clip.speed > 0) {
      assert.equal(clip.feet[0][0][7], 1, `${name}: doesn't start with the left foot on the ground`);
      assert.equal(clip.feet[0][n - 1][7], 0, `${name}: doesn't start as the left foot lands`);
      assert.ok(Math.abs(clip.stride - clip.speed * clip.seconds) < 0.01 && clip.speed > 0.5 && clip.speed < 8);
      // Its legs are the figure's length: the hips over a foot on the ground are within its reach.
      for (let i = 0; i < n; i++) for (const foot of clip.feet) if (foot[i][7]) assert.ok(clip.hips[i][1] - foot[i][1] < BODY.thigh + BODY.shin + 0.03, `${name}: its hips too high over a foot`);
    }
  }
  const sources = sourcesOf();
  for (const name of ['stand', 'walk', 'run']) assert.equal(sources[name].from, CLIPS[name]?.round ? CLIPS[name].from : 'keyed by hand', name);
  assert.ok(Object.values(sourcesOf({})).every((source) => source.from === 'keyed by hand'));
  // With what's fitted, it walks too: nothing is nowhere, and its feet come down to the ground.
  let lowest = Infinity;
  walked({ sources, from: 2, each: (walker, pose, figure, root) => {
    for (const name of ['Foot_L', 'Foot_R', 'Hand_L', 'Head']) {
      const v = at(root, name);
      assert.ok(Number.isFinite(v.x + v.y + v.z), `${name} is nowhere`);
    }
    lowest = Math.min(lowest, at(root, 'Foot_L').y);
    assert.ok(at(root, 'Head').y > 1.4 && at(root, 'Foot_L').y > 0.04);
  } });
  assert.ok(lowest < BODY.ankle + 0.02, `its foot never came nearer the ground than ${lowest.toFixed(3)} m`);
});

test('Mixamo\'s own files stay out of TreeLab', () => {
  const ignored = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8').split(/\r?\n/);
  assert.ok(ignored.includes('.mixamo/') && ignored.includes('*.fbx'), 'add .mixamo/ and *.fbx to .gitignore');
  assert.doesNotMatch(readFileSync(new URL('../src/figureClips.js', import.meta.url), 'utf8'), /\.fbx|[A-Z]:\\|\/Users\//, 'a file\'s path in the clips');
});

test('the trunks to walk round: where each tree stands, and how thick it is', () => {
  const group = new THREE.Group();
  const records = [
    { x: 3, y: 0, z: -2, size: 1, turn: 0, tint: 0, kind: 'oak', seed: 5, variant: 0 },
    { x: -6, y: 0, z: 4, size: 1.2, turn: 1, tint: 0, kind: 'oak', seed: 5, variant: 0 },
    { x: 9, y: 0, z: 9, size: 1, turn: 0, tint: 0, kind: 'pine', seed: 5, variant: 0 },
    { x: -9, y: 0, z: -9, size: 0.8, turn: 2, tint: 0, kind: 'fir', seed: 5, variant: 1 },
  ];
  createPlanter().plant(group, records, DEFAULT_SHAPES);
  const trunks = trunksOf(group);
  assert.equal(trunks.length, records.length);
  for (const record of records) {
    const trunk = trunks.find((t) => t.x === record.x && t.z === record.z);
    assert.ok(trunk && trunk.r > 0.03 && trunk.r < 1.6, `${record.kind}: a trunk of ${trunk?.r}`);
  }
  const [first, second] = [trunks.find((t) => t.x === 3), trunks.find((t) => t.x === -6)];
  assert.ok(Math.abs(second.r / first.r - 1.2) < 1e-9, 'a bigger tree of the same growth has a thicker trunk');
  assert.ok(first.r >= OAK_SHAPE.girth[0] && first.r <= OAK_SHAPE.girth[1], 'the oak\'s is the girth it was grown with');
  assert.equal(trunkRadius({ layout: { wood: { girth: 0.4 } } }), 0.4);
});
