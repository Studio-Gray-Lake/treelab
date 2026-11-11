import * as THREE from 'three';
import { TwoBoneIK } from '@workshop/ik.js';
import CLIPS from './figureClips.js';
import { BODY, CYCLES, poseOf, reachOver } from './figureKeys.js';
import { GRAVITY, JUMPS, RUNS, WALKS } from './walker.js';

// The figure walking: the workshop's character (vendor/workshop/rig.glb)
// moved by its clips as fast as it goes over the ground (src/walker.js),
// with its feet put on the ground under them.
//
// - Its clips are Mixamo's, fitted to it (.mixamo/figureClips.js on the
//   computer they were fitted on, in place of the empty src/figureClips.js:
//   vite.config.js; written by
//   scripts/bake-clips.mjs); for any that isn't there, a cycle keyed by
//   hand stands in (src/figureKeys.js). Standing, a walk and a run are
//   mixed by its speed.
// - The stride's moment goes on by how far it has gone over the ground, and
//   its steps are longer or shorter by its speed, so a foot on the ground
//   goes back as fast as the ground does.
// - Each foot is put on the ground where it is (the ground's own height
//   there, and its slope under the sole), and the hips sink as far as the
//   lower foot needs. That part is worked out, not keyed.
// - Each leg is bent to put its ankle where the pose says (the workshop's
//   two-bone solver, vendor/workshop/ik.js); the other bones are turned as
//   the pose says.
// - In the air it leaves the stride: legs out as it leaves the ground,
//   drawn up at the top, out again to land, and it sinks into its knees as
//   it lands, the harder the faster it came down. (Keyed by hand.)
//
// What isn't as in life: the feet aren't held where they landed (between a
// walk and a run, where two clips are mixed, they slide a little), and
// nothing here knows about balance.
//
// A pose, as this file passes it round: { hips: { x, y, z } (m: the hip
// joints' middle, from the ground under the figure), feet: [left, right]
// (each { x, y, z (its ankle), q, contact (1 on the ground) }), bones:
// { name: q } }, every q how that part is turned from its rest, seen from
// the figure's own space (x its left, y up, z the way it faces).

const DEEPEST = 0.35;   // m: a foot follows the ground at most this far up or down from the body's
const SETTLES = 18;     // a second: how fast the hips sink to what the feet need, and rise again
const LEAVES = 16;      // a second: how fast it goes into its pose in the air, and out of it
const SINKS = 0.045;    // m the hips sink landing, for each m a second it came down at
const SINKS_MOST = 0.2; // m, at most
const STRAIGHTEST = 4;  // degrees: a knee on the ground is never straighter

const rad = (degrees) => (degrees * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (lo, hi, v) => {
  const t = clamp((v - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};

// The bones turned by a pose, each after the one it hangs from; and the legs'.
const TURNED = [
  ['Hips', null], ['Spine', 'Hips'], ['Chest', 'Spine'], ['Neck', 'Chest'], ['Head', 'Neck'],
  ['UpperArm_L', 'Chest'], ['LowerArm_L', 'UpperArm_L'], ['Hand_L', 'LowerArm_L'],
  ['UpperArm_R', 'Chest'], ['LowerArm_R', 'UpperArm_R'], ['Hand_R', 'LowerArm_R'],
];
const LEGS = ['UpperLeg_L', 'LowerLeg_L', 'Foot_L', 'UpperLeg_R', 'LowerLeg_R', 'Foot_R'];
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

const blankPose = () => ({
  hips: { x: 0, y: 0, z: 0 },
  feet: [0, 1].map(() => ({ x: 0, y: 0, z: 0, q: new THREE.Quaternion(), contact: 0 })),
  bones: Object.fromEntries(TURNED.map(([name]) => [name, new THREE.Quaternion()])),
});

// `pose` added into `sum`, `much` of it (the amounts given to one sum add
// up to 1; finish with settled()).
function addPose(sum, pose, much) {
  if (!(much > 0)) return sum;
  const turn = (into, q) => {
    const way = into.x * q.x + into.y * q.y + into.z * q.z + into.w * q.w < 0 ? -much : much;
    into.set(into.x + q.x * way, into.y + q.y * way, into.z + q.z * way, into.w + q.w * way);
  };
  for (const k of ['x', 'y', 'z']) sum.hips[k] += pose.hips[k] * much;
  for (const [i, foot] of pose.feet.entries()) {
    const into = sum.feet[i];
    for (const k of ['x', 'y', 'z', 'contact']) into[k] += foot[k] * much;
    turn(into.q, foot.q);
  }
  for (const name of Object.keys(sum.bones)) turn(sum.bones[name], pose.bones[name]);
  return sum;
}
const emptySum = () => {
  const sum = blankPose();
  for (const foot of sum.feet) foot.q.set(0, 0, 0, 0);
  for (const q of Object.values(sum.bones)) q.set(0, 0, 0, 0);
  return sum;
};
function settled(sum) {
  for (const foot of sum.feet) foot.q.normalize();
  for (const q of Object.values(sum.bones)) q.normalize();
  return sum;
}

// A hand-keyed pose (src/figureKeys.js's: angles) as a pose of this file's.
const _a = new THREE.Quaternion(), _b = new THREE.Quaternion();
const about = (axis, degrees, out) => out.setFromAxisAngle(axis, rad(degrees));
function fromKeyed(keys, out = blankPose()) {
  const { bones } = out;
  out.hips.x = keys.hips.x;
  out.hips.y = keys.hips.y;
  out.hips.z = 0;
  about(Y, keys.hips.turn, bones.Hips);
  bones.Spine.copy(bones.Hips).multiply(about(X, keys.lean * 0.6, _a)); // (a lean forward is a turn round its left-to-right)
  bones.Chest.copy(bones.Spine).multiply(about(X, keys.lean * 0.4, _a)).multiply(about(Y, keys.chest, _b));
  // (The head stays up, looking where it goes.)
  bones.Neck.identity().slerp(bones.Chest, 0.35);
  bones.Head.identity().slerp(bones.Chest, 0.15);
  for (const [i, side] of ['L', 'R'].entries()) {
    bones[`UpperArm_${side}`].copy(bones.Chest).multiply(about(X, -keys.arms[i].shoulder, _a)); // (an arm forward is a turn the other way)
    bones[`LowerArm_${side}`].copy(bones[`UpperArm_${side}`]).multiply(about(X, -keys.arms[i].elbow, _a));
    bones[`Hand_${side}`].copy(bones[`LowerArm_${side}`]);
    const foot = keys.feet[i];
    Object.assign(out.feet[i], { x: foot.x, y: foot.y, z: foot.z, contact: foot.contact });
    about(X, -foot.tilt, out.feet[i].q); // (toes up)
  }
  return out;
}

// What the figure moves by: for standing, a walk and a run, each
// { speed, stride, from, pose(p, out) } (p: the moment of the stride, 0 to
// 1, 0 as the left foot lands). Mixamo's clip fitted to the figure where
// there is one, the hand-keyed cycle where there isn't.
export function sourcesOf(clips = CLIPS) {
  const keyed = (name) => ({ speed: CYCLES[name].speed, stride: CYCLES[name].stride, from: 'keyed by hand', pose: (p, out) => fromKeyed(poseOf(name, p), out) });
  const fitted = (clip) => {
    const n = clip.hips.length;
    const q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
    const turn = (list, i, j, t, out) => out.copy(q.fromArray(list[i])).slerp(q2.fromArray(list[j]), t);
    return {
      speed: clip.speed, stride: clip.stride, from: clip.from,
      pose(p, out = blankPose()) {
        const at = (p - Math.floor(p)) * n, i = Math.floor(at) % n, j = (i + 1) % n, t = at - Math.floor(at);
        for (const [k, key] of ['x', 'y', 'z'].entries()) out.hips[key] = mix(clip.hips[i][k], clip.hips[j][k], t);
        for (const [f, foot] of out.feet.entries()) {
          const a = clip.feet[f][i], b = clip.feet[f][j];
          foot.x = mix(a[0], b[0], t);
          foot.y = mix(a[1], b[1], t);
          foot.z = mix(a[2], b[2], t);
          foot.q.set(a[3], a[4], a[5], a[6]).slerp(q2.set(b[3], b[4], b[5], b[6]), t);
          foot.contact = mix(a[7], b[7], t);
        }
        for (const name of Object.keys(out.bones)) turn(clip.bones[name], i, j, t, out.bones[name]);
        return out;
      },
    };
  };
  return Object.fromEntries(['stand', 'walk', 'run'].map((name) => [name, clips[name]?.round ? fitted(clips[name]) : keyed(name)]));
}

// How standing, the walk and the run are mixed at a speed over the ground
// (m a second), and how far a stride goes then: { stand, walk, run (they
// add up to 1), stride, longer: { walk, run } }. A slow walk takes shorter
// steps and a quick one longer, and so a run (`longer`: by how much each
// one's steps are stretched), so the feet on the ground go back as fast as
// the ground does.
export function gaitOf(speed, sources) {
  const moving = smooth(0.05, 0.5, speed);
  const running = smooth(WALKS * 1.25, RUNS * 0.8, speed);
  const longer = {
    walk: clamp(0.55 + 0.45 * (speed / sources.walk.speed), 0.55, 1.3),
    run: clamp(speed / sources.run.speed, 0.7, 1.3),
  };
  return {
    stand: 1 - moving, walk: moving * (1 - running), run: moving * running,
    stride: mix(sources.walk.stride * longer.walk, sources.run.stride * longer.run, running),
    longer,
  };
}

// The pose in the air, as the hand-keyed cycles give theirs, by how fast
// it's rising (1 as it leaves the ground, 0 at the top, -1 as it lands on
// ground as high as it left).
function inAir(rising) {
  const up = clamp(rising, -1, 1);
  const drawn = 1 - up * up; // (the legs drawn up: most at the top)
  const foot = (x, ahead) => ({ x, y: BODY.ankle + 0.13 * drawn, z: ahead * drawn, tilt: up > 0 ? -40 * up - 12 * drawn : 6 * -up - 12 * drawn, contact: 0 });
  const arm = { shoulder: 30 + 40 * up, elbow: 35 };
  return { hips: { x: 0, y: 0.97 - 0.03 * drawn, turn: 0 }, feet: [foot(0.09, 0.12), foot(-0.09, -0.08)], chest: 0, lean: 4 - 5 * Math.min(0, up), arms: [arm, { ...arm }] };
}

// root: the rig (its own +z the way it faces, standing at rest). It's left
// where it is: whoever owns it puts it at the walker's place, facing its
// way, before update().
export function createFigure(root, { sources = sourcesOf() } = {}) {
  root.updateWorldMatrix(true, true);
  const toFigure = root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const bones = {};
  for (const name of [...TURNED.map(([one]) => one), ...LEGS]) {
    const bone = root.getObjectByName(name);
    if (!bone) throw new Error(`The figure has no ${name}.`);
    // (Its turn at rest, and what it hangs from's, seen from the figure's own space.)
    bones[name] = {
      bone, at: bone.position.clone(),
      rest: toFigure.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion())),
      under: toFigure.clone().multiply(bone.parent.getWorldQuaternion(new THREE.Quaternion())),
      now: new THREE.Quaternion(),
    };
  }
  const legs = ['L', 'R'].map((side) => new TwoBoneIK(root, bones[`UpperLeg_${side}`].bone, bones[`LowerLeg_${side}`].bone, bones[`Foot_${side}`].bone));
  // (The hips' bone above the hip joints' middle.)
  const hipsOver = root.worldToLocal(bones.Hips.bone.getWorldPosition(new THREE.Vector3())).y - root.worldToLocal(bones.UpperLeg_L.bone.getWorldPosition(new THREE.Vector3())).y;

  const state = { phase: 0, sunk: 0, air: 0, pose: null, gait: null };
  const parts = { stand: blankPose(), walk: blankPose(), run: blankPose(), air: blankPose() };
  const _q = new THREE.Quaternion(), _lean = new THREE.Quaternion(), _target = new THREE.Vector3(), _pole = new THREE.Vector3(), _rootQ = new THREE.Quaternion();

  // A moment on. walker: src/walker.js's (how fast it goes, whether it's on
  // the ground); ground: { heightAt(x, z) } (optional: flat without).
  function update(dt, walker, ground = null) {
    const gait = gaitOf(walker.speed, sources);
    state.gait = gait;
    if (walker.grounded && walker.speed > 0.05) state.phase = (state.phase + (dt * walker.speed) / Math.max(0.3, gait.stride)) % 1;
    state.air += ((walker.grounded ? 0 : 1) - state.air) * (1 - Math.exp(-dt * LEAVES));

    // Standing, the walk and the run, each as much as its speed says (the
    // steps stretched to its speed), and its pose in the air while it's up.
    const onGround = 1 - state.air;
    const pose = emptySum();
    addPose(pose, sources.stand.pose(state.phase, parts.stand), gait.stand * onGround);
    for (const name of ['walk', 'run']) {
      if (!(gait[name] > 0)) continue;
      const part = sources[name].pose(state.phase, parts[name]);
      for (const foot of part.feet) foot.z *= gait.longer[name];
      addPose(pose, part, gait[name] * onGround);
    }
    if (state.air > 0) addPose(pose, fromKeyed(inAir(walker.grounded ? -1 : walker.vy / Math.sqrt(2 * GRAVITY * JUMPS)), parts.air), state.air);
    settled(pose);

    // Landing: it sinks into its knees, quickly, and comes up again.
    const landed = walker.since ?? 1;
    const sink = Math.min(SINKS_MOST, SINKS * (walker.landing ?? 0)) * (landed < 0.07 ? landed / 0.07 : 1 - smooth(0.07, 0.45, landed));
    pose.hips.y -= sink;
    // It leans into a hill, and back going down one; and forward as it lands.
    const lean = sink * 90 + clamp((Math.atan(walker.slope ?? 0) * 180) / Math.PI, -20, 24) * 0.5 * smooth(0.2, 1, walker.speed);

    // The feet on the ground where they are: as much higher or lower as
    // the ground is there, and tilted as it slopes (not in the air).
    root.updateWorldMatrix(true, false);
    root.getWorldQuaternion(_rootQ);
    const tilts = [0, 0];
    if (ground && onGround > 0.01) {
      const here = root.getWorldPosition(_target).y;
      for (const [i, foot] of pose.feet.entries()) {
        _target.set(foot.x, 0, foot.z).applyMatrix4(root.matrixWorld);
        const under = ground.heightAt(_target.x, _target.z);
        _pole.set(foot.x, 0, foot.z + 0.15).applyMatrix4(root.matrixWorld);
        foot.y += clamp(under - here, -DEEPEST, DEEPEST) * onGround;
        tilts[i] = ((Math.atan((ground.heightAt(_pole.x, _pole.z) - under) / 0.15) * 180) / Math.PI) * onGround * Math.min(1, foot.contact + 0.3);
      }
    }
    // The hips no higher than the feet on the ground reach.
    let reach = pose.hips.y;
    for (const foot of pose.feet) if (foot.contact > 0.5) reach = Math.min(reach, reachOver(foot, Math.abs(foot.x), STRAIGHTEST));
    state.sunk += (pose.hips.y - reach - state.sunk) * (1 - Math.exp(-dt * SETTLES));
    pose.hips.y -= state.sunk;
    state.pose = pose;

    // Onto the bones. The hips, the spine, the head and the arms are turned
    // as the pose says (each from what it hangs from)...
    bones.Hips.bone.position.set(bones.Hips.at.x + pose.hips.x, pose.hips.y + hipsOver, bones.Hips.at.z + pose.hips.z);
    for (const [name, parent] of TURNED) {
      const b = bones[name];
      b.now.copy(pose.bones[name]).multiply(b.rest);
      if (name !== 'Hips' && lean) b.now.premultiply(about(X, name === 'Neck' || name === 'Head' ? lean * 0.5 : lean, _lean));
      b.bone.quaternion.copy(parent ? bones[parent].now : b.under).invert().multiply(b.now);
    }
    // ...and each leg bent to put its ankle where the pose has it, the knee
    // ahead, the foot turned as the pose says and tilted as the ground is.
    for (const [i, leg] of legs.entries()) {
      const foot = pose.feet[i];
      _target.set(foot.x, foot.y, foot.z).applyMatrix4(root.matrixWorld);
      _pole.set(foot.x * 1.2, foot.y + 0.4, foot.z + 3).applyMatrix4(root.matrixWorld);
      leg.solve(_target, _pole, _q.copy(_rootQ).multiply(about(X, -tilts[i], _lean)).multiply(foot.q));
    }
    return pose;
  }

  return { update, state, bones, legs, root, sources };
}
