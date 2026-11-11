import * as THREE from 'three';

// Gaps in the crowns. A real crown is full of holes, so its shade is
// dappled: dark, with spots of sun. TreeLab's crowns are solid clumps, so
// their shadows were solid too. Here the foliage is drawn into the sun's
// shadow maps with patches left out, so sun gets through: spots on the
// ground, on the leaves and trunks inside, and shafts in the air (they read
// the same shadow maps, src/lightShafts.js). The crowns look as they did.
//
// - Which patches: a noise that repeats, in a small 3D texture, read at each
//   point of the foliage in the tree's own frame, so the gaps sway with the
//   leaves. Where clumps overlap, one clump's gaps are closed by the next,
//   so a crown's middle stays dark and its edges are dappled.
// - Only in the shadow maps: three.js calls a mesh's onBeforeShadow and
//   onAfterShadow round its drawing there; the gaps are on only between
//   them (the light shafts' depth draws the same material, whole).
// - Each gap several texels wide in whichever shadow map it's drawn in
//   (twice, four times... as wide in a coarse one), so the shade doesn't
//   flicker as the trees sway.

export const GAP = 0.45;      // m: about how wide a gap is, in a fine shadow map
export const MOST = 0.7;      // the share of the foliage's shadow left out with the setting at 1
const TEXELS = 5;             // a gap is at least this many shadow texels wide
const CELLS = 16, PER = 4;    // the noise: 16 cells a side before it repeats, 4 texels a cell
export const NOISE_CELLS = CELLS;

// The setting's share (0 to 1), and the sun's shadow (for its maps' size):
// set by src/main.js.
export const crownGaps = { share: 0, shadow: null };

// What the shader reads: gapOn, the share left out while a shadow map is
// drawn (0 at any other time); gapCell, how wide a gap is in that map, m.
const uniforms = { gapNoise: { value: null }, gapOn: { value: 0 }, gapCell: { value: GAP } };

// How wide the gaps are in a shadow map whose texels are `texel` m: GAP, or
// twice, four times... that, so they're at least TEXELS texels.
export function gapFor(texel) {
  return GAP * 2 ** Math.max(0, Math.ceil(Math.log2((TEXELS * texel) / GAP)));
}

// The gaps in a foliage mesh's shadow (strength: its share of the setting;
// needles let less through than leaves), on top of whatever patched its
// shadow material before (the sway).
export function gapsIn(mesh, strength = 1) {
  const material = mesh.customDepthMaterial;
  if (!material) return;
  if (!material.userData.gaps) {
    material.userData.gaps = true;
    uniforms.gapNoise.value ??= gapNoise();
    const before = material.onBeforeCompile;
    const key = material.customProgramCacheKey();
    material.customProgramCacheKey = () => `${key}|gaps`;
    material.onBeforeCompile = (shader, renderer) => {
      before?.call(material, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGap;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGap = position; // (in the tree\'s own frame, before it sways)');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${PARS}`)
        .replace('void main() {', `void main() {\n${cut(strength)}`);
    };
    material.needsUpdate = true;
  }
  mesh.onBeforeShadow = (renderer, object, camera, shadowCamera) => {
    const size = crownGaps.shadow?.mapSize.x ?? 2048;
    uniforms.gapOn.value = crownGaps.share * MOST;
    uniforms.gapCell.value = gapFor((shadowCamera.right - shadowCamera.left) / size);
  };
  mesh.onAfterShadow = () => {
    uniforms.gapOn.value = 0;
  };
}

const PARS = /* glsl */ `
  precision highp sampler3D;
  uniform sampler3D gapNoise;
  uniform float gapOn;
  uniform float gapCell;
  varying vec3 vGap;
`;

// (The noise is spread evenly from 0 to 1, so "below the share" leaves out
// just that share of the surface.)
const cut = (strength) => /* glsl */ `
  if ( gapOn > 0.0 && texture( gapNoise, vGap / ( gapCell * ${CELLS.toFixed(1)} ) ).r < gapOn * ${strength.toFixed(3)} ) discard;
`;

// The noise: a smooth value at every point, repeating every CELLS cells each
// way, its values spread evenly from 0 to 1. The same every time.
export function gapNoise() {
  const n = CELLS * PER;
  const lattice = new Float32Array(CELLS ** 3);
  let s = 20261110;
  for (let i = 0; i < lattice.length; i++) {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    lattice[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const at = (i, j, k) => lattice[(((k % CELLS) * CELLS) + (j % CELLS)) * CELLS + (i % CELLS)];
  const ease = (t) => t * t * (3 - 2 * t);
  const values = new Float32Array(n ** 3);
  for (let z = 0; z < n; z++) {
    const k = Math.floor(z / PER), w = ease((z % PER) / PER);
    for (let y = 0; y < n; y++) {
      const j = Math.floor(y / PER), v = ease((y % PER) / PER);
      for (let x = 0; x < n; x++) {
        const i = Math.floor(x / PER), u = ease((x % PER) / PER);
        const a = at(i, j, k) + (at(i + 1, j, k) - at(i, j, k)) * u;
        const b = at(i, j + 1, k) + (at(i + 1, j + 1, k) - at(i, j + 1, k)) * u;
        const c = at(i, j, k + 1) + (at(i + 1, j, k + 1) - at(i, j, k + 1)) * u;
        const d = at(i, j + 1, k + 1) + (at(i + 1, j + 1, k + 1) - at(i, j + 1, k + 1)) * u;
        values[(z * n + y) * n + x] = (a + (b - a) * v) + ((c + (d - c) * v) - (a + (b - a) * v)) * w;
      }
    }
  }
  // Spread evenly: each value becomes the share of the values below it.
  const BINS = 65536;
  const below = new Uint32Array(BINS + 1);
  const bin = (v) => Math.min(BINS - 1, Math.floor(v * BINS));
  for (const v of values) below[bin(v) + 1]++;
  for (let b = 0; b < BINS; b++) below[b + 1] += below[b];
  const data = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) data[i] = Math.min(255, Math.floor((below[bin(values[i])] / values.length) * 256));
  const texture = new THREE.Data3DTexture(data, n, n, n);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

// The one noise texture, made once: the mist is uneven by it too
// (src/lightShafts.js).
export const evenNoise = () => (uniforms.gapNoise.value ??= gapNoise());

// The gaps switched on by hand, for a depth map whose texels are `texel` m
// (the sky's light is stopped as the sun's is: src/skyShade.js); null: off
// again.
export function gapsDrawn(texel) {
  uniforms.gapOn.value = texel === null ? 0 : crownGaps.share * MOST;
  if (texel !== null) uniforms.gapCell.value = gapFor(texel);
}

// For the tests: what the shader is reading now.
export const gapUniforms = uniforms;
