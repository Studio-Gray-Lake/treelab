import * as THREE from 'three';

// Analytic two-bone IK for a hip -> knee -> ankle chain.
//
// Given where the ankle should be and a pole point the knee should point
// toward, there is exactly one answer, found with the law of cosines. No
// iterations, no jitter.
//
// The solver never assumes which local axis a bone points along. At setup it
// records, in each bone's own local space, "this way points down the bone" and
// "this way is the knee hinge". Solving then means turning those two local
// directions into the wanted world directions. That is why the same code will
// drive the Blender rig, whose bones point along their own +Y.

// Keep the leg from locking fully straight: at 100% the knee direction is
// undefined and the solution flips.
const MAX_REACH = 0.999;

const _hip = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _bend = new THREE.Vector3();
const _hinge = new THREE.Vector3();
const _knee = new THREE.Vector3();
const _ankle = new THREE.Vector3();
const _along = new THREE.Vector3();
const _side = new THREE.Vector3();
const _parentQ = new THREE.Quaternion();
const _upperQ = new THREE.Quaternion();
const _lowerQ = new THREE.Quaternion();
const _endQ = new THREE.Quaternion();
const _basis = new THREE.Matrix4();

export class TwoBoneIK {
  // Call while the character is still in its rest pose. `root` is the
  // character root; its +Z is "forward", which is where the knee points at rest.
  constructor(root, upper, lower, end) {
    if (lower.parent !== upper || end.parent !== lower) {
      throw new Error(`TwoBoneIK expects ${upper.name} -> ${lower.name} -> ${end.name} as direct parent/child`);
    }
    this.upper = upper;
    this.lower = lower;
    this.end = end;

    root.updateWorldMatrix(true, true);
    const rootQ = root.getWorldQuaternion(new THREE.Quaternion());
    const hip = upper.getWorldPosition(new THREE.Vector3());
    const knee = lower.getWorldPosition(new THREE.Vector3());
    const ankle = end.getWorldPosition(new THREE.Vector3());

    this.upperLength = hip.distanceTo(knee);
    this.lowerLength = knee.distanceTo(ankle);
    this.maxReach = (this.upperLength + this.lowerLength) * MAX_REACH;
    this.minReach = Math.abs(this.upperLength - this.lowerLength) + 1e-4;

    // At rest the knee hinge is perpendicular to the leg and to forward.
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rootQ);
    const legDir = ankle.clone().sub(hip);
    const hinge = new THREE.Vector3().crossVectors(legDir, forward).normalize();

    this.upperRest = restBasis(upper, knee.clone().sub(hip), hinge);
    this.lowerRest = restBasis(lower, ankle.clone().sub(knee), hinge);

    // The end bone's rest rotation relative to the root. A foot target with
    // no rotation then means "foot as in the rest pose".
    this.endRest = rootQ.clone().invert().multiply(end.getWorldQuaternion(new THREE.Quaternion()));

    // Fallback bend direction for when the pole lies on the hip-ankle line.
    this.lastBend = forward.clone();
  }

  // Where the knee would go for the ankle at `target`, the knee toward
  // `pole`, from where the hip is now; the same answer solve() gives, with
  // no bones moved. Into `out`.
  knee(target, pole, out) {
    this.place(target, pole);
    return out.copy(_knee);
  }

  // target: world position for the end joint (ankle).
  // pole: world point the knee should point toward.
  // endRotation (optional): world rotation for the end bone (foot).
  solve(target, pole, endRotation) {
    const a = this.upperLength;
    const b = this.lowerLength;
    const { wanted, dist } = this.place(target, pole);
    this.lastBend.copy(_bend);
    _hinge.crossVectors(_dir, _bend);

    // Turn joint positions into bone rotations. A bone's local rotation is its
    // world rotation "minus" its parent's: inverse(parentWorld) * world.
    this.upper.parent.getWorldQuaternion(_parentQ);
    aim(this.upperRest, _along.subVectors(_knee, _hip).normalize(), _hinge, _upperQ);
    this.upper.quaternion.copy(_parentQ).invert().multiply(_upperQ);

    aim(this.lowerRest, _along.subVectors(_ankle, _knee).normalize(), _hinge, _lowerQ);
    this.lower.quaternion.copy(_upperQ).invert().multiply(_lowerQ);

    if (endRotation) {
      _endQ.copy(endRotation).multiply(this.endRest);
      this.end.quaternion.copy(_lowerQ).invert().multiply(_endQ);
    }

    const cosKnee = (a * a + b * b - dist * dist) / (2 * a * b);
    return {
      reach: wanted / (a + b),
      reached: wanted <= this.maxReach && wanted >= this.minReach,
      kneeBend: Math.PI - Math.acos(THREE.MathUtils.clamp(cosKnee, -1, 1)),
    };
  }

  // The joints for the ankle at `target`, the knee toward `pole`, from where
  // the hip is now: fills _hip, _dir, _bend, _knee and _ankle. Moves nothing.
  place(target, pole) {
    const a = this.upperLength;
    const b = this.lowerLength;

    this.upper.getWorldPosition(_hip);
    _dir.subVectors(target, _hip);
    const wanted = _dir.length();
    if (wanted < 1e-6) _dir.copy(this.lastBend).negate(); else _dir.divideScalar(wanted);
    const dist = THREE.MathUtils.clamp(wanted, this.minReach, this.maxReach);

    // The bend plane holds the hip, the target and the pole. _bend is the
    // direction inside that plane, at right angles to the leg, toward the pole.
    _bend.subVectors(pole, _hip);
    _bend.addScaledVector(_dir, -_bend.dot(_dir));
    if (_bend.lengthSq() < 1e-8) {
      _bend.copy(this.lastBend).addScaledVector(_dir, -this.lastBend.dot(_dir));
    }
    _bend.normalize();

    // Law of cosines: the angle at the hip between the hip->target line and
    // the thigh. Push the knee out by that angle toward the pole.
    const cosHip = (a * a + dist * dist - b * b) / (2 * a * dist);
    const hipAngle = Math.acos(THREE.MathUtils.clamp(cosHip, -1, 1));
    _knee.copy(_hip)
      .addScaledVector(_dir, a * Math.cos(hipAngle))
      .addScaledVector(_bend, a * Math.sin(hipAngle));
    _ankle.copy(_hip).addScaledVector(_dir, dist);
    return { wanted, dist };
  }
}

// Inverse of the bone's rest "frame": its along and hinge directions expressed
// in its own local space.
function restBasis(bone, alongWorld, hingeWorld) {
  const toLocal = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
  const along = alongWorld.clone().normalize().applyQuaternion(toLocal);
  const hinge = hingeWorld.clone().applyQuaternion(toLocal);
  hinge.addScaledVector(along, -hinge.dot(along)).normalize(); // exactly at right angles
  const side = new THREE.Vector3().crossVectors(along, hinge);
  const basis = new THREE.Matrix4().makeBasis(along, hinge, side);
  return new THREE.Quaternion().setFromRotationMatrix(basis).invert();
}

// World rotation that carries the bone's rest along/hinge onto the wanted ones.
function aim(restInverse, along, hinge, out) {
  _side.crossVectors(along, hinge);
  _basis.makeBasis(along, hinge, _side);
  return out.setFromRotationMatrix(_basis).multiply(restInverse);
}
