import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { StageShadow, createSun, shadowChunkPatched, stageDepths, FAR_UP, SUN_WIDE, sunWidth, underSunDisc } from '../src/sunShadow.js';

// The sun's shadows in two cascades fitted to the stage (src/sunShadow.js).

// A sun from `direction` and a camera at `from` looking at `at`, the stage
// a sphere round `center`.
function setUp({ from, at, center = [0, 6, 0], radius = 40, direction = [0.4, 0.6, -0.5], aspect = 1.4 }) {
  const sun = createSun(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.position.set(...direction).normalize();
  sun.updateMatrixWorld();
  sun.shadow.stage.center.set(...center);
  sun.shadow.stage.radius = radius;
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 2500);
  camera.position.set(...from);
  camera.lookAt(new THREE.Vector3(...at));
  camera.updateMatrixWorld();
  sun.shadow.updateMatrices(sun, camera);
  return { sun, shadow: sun.shadow, camera };
}

// Points of the stage the camera sees, seeded.
function seenPoints(camera, stage, count = 3000) {
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  let s = 7;
  const random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const points = [];
  while (points.length < count) {
    const p = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1);
    if (p.lengthSq() > 1) continue;
    p.multiplyScalar(stage.radius).add(stage.center);
    if (frustum.containsPoint(p)) points.push(p);
  }
  return points;
}

// The cascades the shader takes for a point (both, where one fades into the
// other), and where on the shadow texture the point falls in each.
function onMap(shadow, camera, p) {
  const depth = -p.clone().applyMatrix4(camera.matrixWorldInverse).z;
  return [0, 1].filter((i) => depth >= shadow._cascadeData[i].x && depth < shadow._cascadeData[i].y).map((i) => {
    const at = new THREE.Vector4(p.x, p.y, p.z, 1).applyMatrix4(shadow.getMatrix(i));
    return { i, u: at.x / at.w, v: at.y / at.w, z: at.z / at.w };
  });
}

const VIEWS = {
  'close by, inside the stage': { from: [6, 4, 30], at: [0, 3, 0], radius: 170 },
  'the Tree tab': { from: [14, 14, 31], at: [0, 8, 0], center: [0, 9, 0], radius: 30 },
  'from far above': { from: [205, 175, 409], at: [0, 3, 0], radius: 170 },
  'a low sun': { from: [20, 10, 60], at: [0, 2, 0], radius: 90, direction: [0.9, 0.08, 0.3] },
};

test('every point of the stage the camera sees falls on its own cascade\'s half of the shadow texture', () => {
  for (const [name, view] of Object.entries(VIEWS)) {
    const { shadow, camera } = setUp(view);
    for (const p of seenPoints(camera, shadow.stage)) {
      const cascades = onMap(shadow, camera, p);
      assert.ok(cascades.length > 0, `${name}: a point in no cascade`);
      for (const { i, u, v, z } of cascades) {
        assert.ok(u >= i / 2 && u <= (i + 1) / 2, `${name}: u ${u.toFixed(3)} off cascade ${i}'s half`);
        assert.ok(v >= 0 && v <= 1, `${name}: v ${v}`);
        assert.ok(z >= 0 && z <= 1, `${name}: depth ${z} outside the shadow camera`);
      }
    }
  }
});

test('the near cascade is the sharper, and neither is wider than the stage', () => {
  for (const [name, view] of Object.entries(VIEWS)) {
    const { shadow } = setUp(view);
    const [a, b] = [0, 1].map((i) => shadow.getCamera(i).right);
    assert.ok(a <= b + 1e-6, `${name}: near ${a.toFixed(1)} m, far ${b.toFixed(1)} m`);
    assert.ok(b <= view.radius * 1.01, `${name}: ${b.toFixed(1)} m across a stage of ${view.radius}`);
  }
});

test('the cascades span the depths the stage fills, and the near one reaches its middle', () => {
  for (const [name, view] of Object.entries(VIEWS)) {
    const { shadow, camera } = setUp(view);
    const { near, far, middle } = stageDepths(shadow.stage, camera);
    assert.ok(Math.abs(shadow._cascadeSplits[0] - near) < 1e-6 && Math.abs(shadow._cascadeData[1].y - far) < 1e-6, name);
    assert.ok(shadow._cascadeData[0].y >= Math.min(middle, (near + far) / 2) - 1e-6, `${name}: the near map stops at ${shadow._cascadeData[0].y.toFixed(1)} m`);
    assert.ok(shadow._cascadeData[1].x < shadow._cascadeData[0].y, `${name}: no overlap to blend over`);
  }
  // Close by, the near map is far sharper than one map over the whole stage.
  const { shadow } = setUp(VIEWS['close by, inside the stage']);
  assert.ok(shadow.getCamera(0).right < 170 / 3, `${shadow.getCamera(0).right.toFixed(1)} m`);
});

test('the sun is three.js\'s cascaded sun, and its shadow code takes a cascade only on its own half', () => {
  const sun = createSun(0xffffff, 1);
  assert.ok(sun.isSunLight && sun.shadow instanceof StageShadow);
  assert.equal(sun.shadow.getViewportCount(), 2);
  assert.ok(shadowChunkPatched, 'three.js\'s sun shadow code has changed');
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  assert.equal(chunk.split('cascadeOnMap < 0.0 || cascadeOnMap > 1.0 ? 1.0 : sunDiscShadow(').length, 2);
  assert.equal(chunk.split('sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition').length, 2, 'looked up twice');
  assert.ok(chunk.indexOf('vec4 cascadeCoord =') < chunk.indexOf('cascadeOnMap = cascadeCoord'));
});

test('the look-up knows the sun is a disc: soft by the crowns\' height, three.js\'s own where a material doesn\'t ask', () => {
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  // Defined once, before the sun's look-up uses it, and handed the place
  // and the cascade.
  assert.equal(chunk.split('float sunDiscShadow(').length, 2);
  assert.ok(chunk.indexOf('float sunDiscShadow(') < chunk.indexOf('float getSunShadow('));
  assert.match(chunk, /cascadeCoord, sunShadowMatrix\[ cascadeOffset \+ i \], shadowWorldPosition\.xyz, i/);
  // (A material that hasn't taken the uniforms has them at 0: three.js's look-up.)
  assert.match(chunk, /if \( sunDiscDeep\.x <= 0\.0 \) return mix\( 1\.0, plain, shadowIntensity \);/);
  // 9 mm a metre, and what counts as far.
  assert.ok(Math.abs(SUN_WIDE - Math.tan(THREE.MathUtils.degToRad(0.533 / 2))) < 2e-5);
  assert.ok(FAR_UP > 5 && FAR_UP < 30);

  // A material that asks gets the three values, on top of what patched it before.
  const material = new THREE.MeshStandardMaterial();
  let earlier = 0;
  material.customProgramCacheKey = () => 'sway';
  material.onBeforeCompile = () => { earlier++; };
  underSunDisc(material);
  const shader = { uniforms: {} };
  material.onBeforeCompile(shader, null);
  assert.equal(earlier, 1);
  assert.equal(shader.uniforms.sunDiscDeep, sunWidth.deep);
  assert.equal(shader.uniforms.sunDiscCrowns, sunWidth.crowns);
  assert.equal(shader.uniforms.sunDiscToSun, sunWidth.toSun);
  assert.equal(material.customProgramCacheKey(), 'sway|sun-disc');
});
