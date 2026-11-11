// Turns Mixamo's clips into the figure's own (.mixamo/figureClips.js: kept
// out of git, and used in place of the empty src/figureClips.js when
// TreeLab runs or is built on this computer; see vite.config.js).
//
//   npm run bake:clips                 reads .mixamo/ in TreeLab's folder
//   npm run bake:clips -- some/folder  reads another folder
//   npm run bake:clips -- some/folder some/file.js   and writes somewhere else (to try clips out)
//
// The folder holds the clips as Mixamo gives them (.fbx, "without skin",
// "in place" ticked for the walk and the run): Walking.fbx, Running.fbx,
// Jump.fbx, Idle.fbx. Any that's missing is left out, and the figure keeps
// its hand-keyed stand-in for it (src/figureKeys.js). The .fbx files
// themselves are never part of TreeLab: the folder is kept out of git, and
// what's written is the motion fitted to the workshop's figure, which has
// other bones, other proportions and another rest pose.
//
// How a clip is fitted (per moment of it):
// - the legs by where the ankles are, from the ground and from the hips,
//   scaled by the legs' length: the figure's own legs are then bent to
//   reach them (src/figure.js), so its feet land where the clip's do;
// - every other bone by how it's turned from its rest, as seen from
//   outside the body (so it doesn't matter which way each skeleton's bones
//   point); Mixamo's rest has the arms straight out, the figure's has them
//   down, so the arms' rest is turned down first;
// - a walk or a run is cut to start as the left foot lands, and its speed
//   over the ground is read from how fast its feet go back while they're
//   on it.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { BODY } from '../src/figureKeys.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const folder = path.resolve(process.argv[2] ?? path.join(here, '..', '.mixamo'));
const out = process.argv[3] ? path.resolve(process.argv[3]) : path.join(here, '..', '.mixamo', 'figureClips.js'); // (somewhere else, to try a clip out)

// The clips looked for: the figure's name for each, the file, and whether it
// goes round (a stride) or runs once (a jump).
const WANTED = [
  { name: 'stand', file: 'Idle.fbx', round: true, still: true },
  { name: 'walk', file: 'Walking.fbx', round: true },
  { name: 'run', file: 'Running.fbx', round: true },
  { name: 'jump', file: 'Jump.fbx', round: false },
];
const FRAMES = 32; // moments kept of a stride (of a clip that runs once: 30 a second)

// The figure's bones, and Mixamo's that move each.
const TURNED = {
  Hips: 'Hips', Spine: 'Spine', Chest: 'Spine2', Neck: 'Neck', Head: 'Head',
  UpperArm_L: 'LeftArm', LowerArm_L: 'LeftForeArm', Hand_L: 'LeftHand',
  UpperArm_R: 'RightArm', LowerArm_R: 'RightForeArm', Hand_R: 'RightHand',
};
// Mixamo's rest pose turned to the figure's: the arms from straight out to
// straight down (round the way it faces).
const ARM_DOWN = { L: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2), R: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2) };
const restTurn = (ours) => (/Arm_|Hand_/.test(ours) ? ARM_DOWN[ours.at(-1)] : null);

const round4 = (v) => Math.round(v * 1e4) / 1e4 || 0;
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function bake({ name, file, round, still = false }) {
  const data = readFileSync(path.join(folder, file));
  const group = new FBXLoader().parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  const clip = group.animations[0];
  if (!clip) throw new Error(`${file} holds no clip.`);
  const bone = (short) => {
    const found = group.getObjectByName(`mixamorig${short}`);
    if (!found) throw new Error(`${file} has no mixamorig${short}: is it a Mixamo clip?`);
    return found;
  };
  const worldQ = (o) => o.getWorldQuaternion(new THREE.Quaternion());
  const worldAt = (o) => o.getWorldPosition(new THREE.Vector3());

  // At rest: each bone's turn (the arms' turned down), and the legs' measures.
  group.updateWorldMatrix(true, true);
  const rest = Object.fromEntries(Object.entries(TURNED).map(([ours, theirs]) => {
    const q = worldQ(bone(theirs));
    const fix = restTurn(ours);
    return [ours, (fix ? fix.clone().multiply(q) : q).invert()];
  }));
  const legs = ['Left', 'Right'].map((side) => ({ hip: bone(`${side}UpLeg`), knee: bone(`${side}Leg`), ankle: bone(`${side}Foot`), ball: bone(`${side}ToeBase`) }));
  const footRest = legs.map((leg) => worldQ(leg.ankle).invert());
  const length = worldAt(legs[0].hip).distanceTo(worldAt(legs[0].knee)) + worldAt(legs[0].knee).distanceTo(worldAt(legs[0].ankle));
  const scale = (BODY.thigh + BODY.shin) / length; // (theirs are in centimetres)
  const ankleRest = worldAt(legs[0].ankle).y;
  const wide = BODY.apart / (Math.abs(worldAt(legs[0].hip).x) * scale); // (the figure's hips are wider, or narrower)

  // The clip, moment by moment.
  const mixer = new THREE.AnimationMixer(group);
  mixer.clipAction(clip).play();
  const count = round ? FRAMES : Math.max(2, Math.round(clip.duration * 30) + 1);
  const moments = [];
  for (let i = 0; i < count; i++) {
    mixer.setTime(round ? (clip.duration * i) / count : (clip.duration * i) / (count - 1));
    group.updateWorldMatrix(true, true);
    const hips = worldAt(legs[0].hip).add(worldAt(legs[1].hip)).multiplyScalar(0.5);
    moments.push({
      hips,
      feet: legs.map((leg, k) => ({ ankle: worldAt(leg.ankle), ball: worldAt(leg.ball), q: worldQ(leg.ankle).multiply(footRest[k]) })),
      bones: Object.fromEntries(Object.entries(TURNED).map(([ours, theirs]) => [ours, worldQ(bone(theirs)).multiply(rest[ours])])),
    });
  }

  // Where it stands, on average (a clip made "in place" stays about there).
  const middle = round ? moments.reduce((sum, m) => sum + m.hips.z, 0) / count : moments[0].hips.z;
  const side = round ? moments.reduce((sum, m) => sum + m.hips.x, 0) / count : moments[0].hips.x;

  // Each foot on the ground or off it. On it, it goes back as fast as the
  // ground does (a stride), and its sole is down.
  const dt = clip.duration / (round ? count : count - 1);
  const near = (i) => (round ? ((i % count) + count) % count : Math.min(count - 1, Math.max(0, i)));
  const back = (k, i) => -(moments[near(i + 1)].feet[k].ankle.z - moments[near(i - 1)].feet[k].ankle.z) / (2 * dt); // cm a second, backward
  const low = (k, i) => Math.min(moments[i].feet[k].ball.y, moments[i].feet[k].ankle.y - ankleRest);
  let speed = 0;
  if (round && !still) {
    const flat = [];
    for (let k = 0; k < 2; k++) for (let i = 0; i < count; i++) if (moments[i].feet[k].ankle.y - ankleRest < 1.5 && moments[i].feet[k].ball.y < 2) flat.push(back(k, i));
    if (flat.length < 4) throw new Error(`${file}: its feet are hardly ever flat on the ground. Was "in place" ticked?`);
    speed = median(flat);
    if (!(speed > 10)) throw new Error(`${file}: its feet don't go back over the ground (${speed.toFixed(0)} cm/s). Was "in place" ticked?`);
  }
  const contact = (k, i) => (still ? 1 : round ? Number(low(k, i) < 4.5 && back(k, i) > speed * 0.35) : Number(low(k, i) < 3));

  // A stride starts as the left foot lands.
  let first = 0;
  if (round && !still) {
    first = [...Array(count).keys()].find((i) => contact(0, i) && !contact(0, near(i - 1))) ?? 0;
  }
  const order = [...Array(count).keys()].map((i) => (round ? (i + first) % count : i));

  const flatQ = (q) => [round4(q.x), round4(q.y), round4(q.z), round4(q.w)];
  const baked = {
    from: `Mixamo: ${path.basename(file, '.fbx')}`,
    round,
    seconds: round4(clip.duration),
    speed: round4((speed * scale)),
    stride: round4(speed * scale * clip.duration),
    hips: order.map((i) => [round4((moments[i].hips.x - side) * scale), round4((moments[i].hips.y - ankleRest) * scale + BODY.ankle), round4((moments[i].hips.z - middle) * scale)]),
    feet: [0, 1].map((k) => order.map((i) => {
      const foot = moments[i].feet[k];
      return [round4((foot.ankle.x - side) * scale * wide), round4((foot.ankle.y - ankleRest) * scale + BODY.ankle), round4((foot.ankle.z - middle) * scale), ...flatQ(foot.q), contact(k, i)];
    })),
    bones: Object.fromEntries(Object.keys(TURNED).map((ours) => [ours, order.map((i) => flatQ(moments[i].bones[ours]))])),
  };
  if (!round) {
    // A jump: when both feet have left the ground, and when one is back.
    const off = order.findIndex((i) => !contact(0, i) && !contact(1, i));
    const land = order.findIndex((i, n) => n > off && (contact(0, i) || contact(1, i)));
    baked.leaves = off < 0 ? 0 : round4(off / (count - 1));
    baked.lands = land < 0 ? 1 : round4(land / (count - 1));
  }
  const onGround = [0, 1].map((k) => order.filter((i) => contact(k, i)).length / count);
  console.log(`${name.padEnd(6)} from ${file}: ${clip.duration.toFixed(2)} s, ${count} moments${round && !still ? `, ${baked.speed.toFixed(2)} m/s, a stride of ${baked.stride.toFixed(2)} m, each foot on the ground ${(onGround[0] * 100).toFixed(0)}% and ${(onGround[1] * 100).toFixed(0)}% of it` : ''}${round ? '' : `, in the air from ${(baked.leaves * 100).toFixed(0)}% to ${(baked.lands * 100).toFixed(0)}% of it`}`);
  return baked;
}

if (!existsSync(folder)) {
  console.error(`No folder ${folder}. Put Mixamo's clips there (Walking.fbx, Running.fbx, Jump.fbx, Idle.fbx), or name another folder.`);
  process.exit(1);
}
const clips = {};
const missing = [];
for (const wanted of WANTED) {
  if (existsSync(path.join(folder, wanted.file))) clips[wanted.name] = bake(wanted);
  else missing.push(wanted.file);
}
if (missing.length) console.log(`Not there, so hand-keyed still: ${missing.join(', ')}.`);

const text = `// Written by scripts/bake-clips.mjs (npm run bake:clips): don't edit it.
//
// The figure's clips: Mixamo's motion fitted to the workshop's figure, a
// moment at a time. hips: [x, y, z] (m: the hip joints' middle, from the
// ground under the figure); feet: [left, right], each moment [x, y, z (the
// ankle), then how the foot is turned from rest (a quaternion), then 1 on
// the ground or 0 off it]; bones: how each is turned from rest (a
// quaternion, in the figure's own space). A clip that goes round starts as
// the left foot lands. What reads them: src/figure.js.

export default ${JSON.stringify(clips)};
`;
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, text);
console.log(`Written: ${path.relative(path.join(here, '..'), out)} (${Object.keys(clips).join(', ') || 'no clips'}; ${(text.length / 1024).toFixed(0)} KB).`);
