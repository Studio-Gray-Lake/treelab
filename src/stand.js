import * as THREE from 'three';

// Standing among the trees (the Forest tab's "stand among the trees"): where
// to stand, which way to look, and a step on the ground. The camera itself,
// and what turns and walks it, are src/main.js's.
//
// You stand on the side of the forest's middle away from the sun, so the
// middle (and the figure standing there) is ahead and the sun behind it:
// looking toward the sun, against shade, is where the light in the air
// shows. And where the trunks leave most room.

export const EYE = 1.7;     // m: the eye's height above the ground
export const PIVOT = 0.5;   // m ahead of the eye: the point the camera turns round
export const LOOK_UP = 11;  // degrees: the view's tilt to start with
export const PACE = 1.4;    // m a second: a walk
export const RUN = 3;       // times that, with Shift held
const BACK = 14;            // m: at most this far back from the forest's middle
const ROOM = 4;             // m: a spot this clear of trunks is clear enough

// trees: [{ x, z }]; toSun: { x, z }, which way the sun is on the map;
// radius: the forest's (m). Gives { x, z }.
export function standingSpot({ trees, toSun, radius }) {
  const length = Math.hypot(toSun.x, toSun.z);
  const sx = length > 1e-6 ? toSun.x / length : 0, sz = length > 1e-6 ? toSun.z / length : -1;
  const back = Math.min(BACK, Math.max(3, radius * 0.25));
  const reach = Math.min(4, back / 2); // (looked for this far round, in half metres)
  let best = null;
  for (let i = -reach; i <= reach; i += 0.5) {
    for (let j = -reach; j <= reach; j += 0.5) {
      const x = -sx * back + i, z = -sz * back + j;
      let clear = Infinity;
      for (const t of trees) clear = Math.min(clear, Math.hypot(t.x - x, t.z - z));
      const score = Math.min(clear, ROOM) - 0.1 * Math.hypot(i, j);
      if (!best || score > best.score) best = { x, z, score };
    }
  }
  return { x: best.x, z: best.z };
}

// The camera standing at `spot`, the ground there `ground` m high: its
// position, and its target, the point PIVOT m ahead it turns round, toward
// the sun and a little up.
export function standingView({ spot, toSun, ground }) {
  const length = Math.hypot(toSun.x, toSun.z);
  const sx = length > 1e-6 ? toSun.x / length : 0, sz = length > 1e-6 ? toSun.z / length : -1;
  const up = THREE.MathUtils.degToRad(LOOK_UP);
  const position = new THREE.Vector3(spot.x, ground + EYE, spot.z);
  const target = new THREE.Vector3(sx * Math.cos(up), Math.sin(up), sz * Math.cos(up)).multiplyScalar(PIVOT).add(position);
  return { position, target };
}

// A step on the ground: `ahead` m the way the camera faces on the map
// (from `position` toward `target`), `aside` m to its right. Nothing while
// it looks straight up or down.
export function stepOnGround(position, target, ahead, aside, out = new THREE.Vector3()) {
  const fx = target.x - position.x, fz = target.z - position.z;
  const length = Math.hypot(fx, fz);
  if (length < 1e-6) return out.set(0, 0, 0);
  return out.set((fx * ahead - fz * aside) / length, 0, (fz * ahead + fx * aside) / length);
}
