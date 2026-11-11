import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GAP, MOST, crownGaps, gapFor, gapNoise, gapUniforms, gapsIn } from '../src/crownGaps.js';
import { RANGES, normalize } from '../src/settings.js';

// The gaps in the crowns' shadows (src/crownGaps.js). (How they look is
// checked in the browser.)

test('the noise lets through the share asked for, repeats, and is the same every time', () => {
  const noise = gapNoise();
  const { data, width: n } = noise.image;
  assert.equal(data.length, n ** 3);
  for (const share of [0.1, 0.25, 0.5, 0.7]) {
    let below = 0;
    for (const v of data) if (v / 255 < share) below++;
    assert.ok(Math.abs(below / data.length - share) < 0.01, `${share}: ${(below / data.length).toFixed(3)} of the texels`);
  }
  assert.equal(noise.wrapS, THREE.RepeatWrapping);
  assert.equal(noise.wrapR, THREE.RepeatWrapping);
  assert.deepEqual(Array.from(gapNoise().image.data.slice(0, 500)), Array.from(data.slice(0, 500)));
  // Smooth: neighbours differ little on the whole (gaps are patches, not
  // specks; values at random would differ by 85 on average).
  let sum = 0, count = 0;
  for (let i = 0; i < data.length - 1; i++) {
    if ((i + 1) % n === 0) continue; // (the end of a row)
    sum += Math.abs(data[i + 1] - data[i]);
    count++;
  }
  assert.ok(sum / count < 30, `neighbours differ by ${(sum / count).toFixed(1)} of 255 on average`);
});

test('a gap is at least five texels wide in whichever shadow map it is drawn in, in whole doublings', () => {
  assert.equal(gapFor(0.01), GAP);
  assert.equal(gapFor(0.083), GAP);
  for (const texel of [0.1, 0.17, 0.3, 0.7]) {
    const gap = gapFor(texel);
    assert.ok(gap >= 5 * texel - 1e-9, `${texel} m texels: gaps ${gap} m`);
    assert.ok(Number.isInteger(Math.log2(gap / GAP)), `${texel}: not a doubling of ${GAP}`);
    assert.ok(gap < 10 * texel + GAP, `${texel}: gaps of ${gap} m, wider than need be`);
  }
});

// A shader as three.js hands it over, with the parts the patches look for.
const fakeShader = () => ({
  uniforms: {},
  vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
  fragmentShader: '#include <common>\nvoid main() {\n}',
});

function foliage() {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial();
  mesh.customDepthMaterial.customProgramCacheKey = () => 'tree-leaves-depth';
  mesh.customDepthMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n// swayed');
  };
  return mesh;
}

test('the gaps go on top of the sway\'s shadow, cut in the tree\'s own frame', () => {
  const mesh = foliage();
  gapsIn(mesh, 1);
  const shader = fakeShader();
  mesh.customDepthMaterial.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /\/\/ swayed/, 'the sway\'s patch is gone');
  assert.match(shader.vertexShader, /vGap = position;/);
  assert.match(shader.fragmentShader, /texture\( gapNoise, vGap \/ \( gapCell \* 16\.0 \) \)\.r < gapOn \* 1\.000 \) discard;/);
  assert.equal(shader.uniforms.gapOn, gapUniforms.gapOn);
  assert.equal(shader.uniforms.gapNoise.value.isData3DTexture, true);
  assert.match(mesh.customDepthMaterial.customProgramCacheKey(), /^tree-leaves-depth\|/);
  // Patched once, however often the mesh is given its gaps.
  const patched = mesh.customDepthMaterial.onBeforeCompile;
  gapsIn(mesh, 1);
  assert.equal(mesh.customDepthMaterial.onBeforeCompile, patched);
  // Needles let half as much through.
  const fir = foliage();
  gapsIn(fir, 0.5);
  const firShader = fakeShader();
  fir.customDepthMaterial.onBeforeCompile(firShader);
  assert.match(firShader.fragmentShader, /gapOn \* 0\.500/);
});

test('the gaps are on only while a shadow map is drawn', () => {
  const mesh = foliage();
  gapsIn(mesh, 1);
  crownGaps.share = 0.5;
  crownGaps.shadow = { mapSize: new THREE.Vector2(2048, 2048) };
  assert.equal(gapUniforms.gapOn.value, 0, 'on before any shadow is drawn');
  const fine = new THREE.OrthographicCamera(-20, 20, 20, -20), coarse = new THREE.OrthographicCamera(-170, 170, 170, -170);
  mesh.onBeforeShadow(null, mesh, null, fine);
  assert.ok(Math.abs(gapUniforms.gapOn.value - 0.5 * MOST) < 1e-9);
  assert.equal(gapUniforms.gapCell.value, GAP);
  mesh.onAfterShadow();
  assert.equal(gapUniforms.gapOn.value, 0, 'left on after the shadow');
  mesh.onBeforeShadow(null, mesh, null, coarse);
  assert.equal(gapUniforms.gapCell.value, GAP * 2, 'not widened for a coarse map');
  mesh.onAfterShadow();
  crownGaps.share = 0;
  mesh.onBeforeShadow(null, mesh, null, fine);
  assert.equal(gapUniforms.gapOn.value, 0, 'gaps with the setting at 0');
  mesh.onAfterShadow();
  // A mesh with no shadow material of its own is left alone.
  const bare = new THREE.Mesh();
  const hook = bare.onBeforeShadow;
  gapsIn(bare, 1);
  assert.equal(bare.onBeforeShadow, hook);
});

test('settings keep the gaps in range', () => {
  const start = normalize({}).settings.light.gaps;
  assert.ok(start > 0 && start < 0.6);
  assert.equal(normalize({ light: { gaps: 5 } }).settings.light.gaps, RANGES['light.gaps'][1]);
  assert.equal(normalize({ light: { gaps: -1 } }).settings.light.gaps, RANGES['light.gaps'][0]);
});
