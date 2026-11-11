import * as THREE from 'three';
import { createNoise } from './noise.js';

// The Forest tab's ground: seeded rolling hills, flat-shaded in facets like
// the workshop's ground, green on the gentle slopes and earthier on the
// steep ones. Its heightAt is exactly the drawn surface's, so a tree stands
// on what you see, and the wind (src/wind.js) reads it for the lee behind
// the hills.
//
// Its facets are uneven. A grid of squares each cut in two the same way
// shows as rows of diamonds wherever the ground slopes; so each corner of
// the grid sits a little off its place (JITTER of a square, either way:
// its height is the hills' there), and each four-sided patch is cut across
// the way its corners differ least in height, as the ground's own creases
// run. The outline stays square.
//
//   seed: which hills; height: how high they rise and fall (m, 0: flat);
//   size: how wide a hill is (m); roughness: how much finer bumps add.

export const TERRAIN_HALF = 150; // m: the ground, each way from the middle (at least)
const CELLS = 200;               // facets' squares each way (at least)
const RIM = 0.75;                // the hills fade out beyond this share of the way to the edge
const JITTER = 0.22;             // a corner of the grid sits up to this share of a square off its place, each way (under a quarter, so no patch folds over)

// The ground's size for a forest reaching `reach` m from the middle: its
// hills whole under every tree, and some way beyond. { half, cells }:
// facets about 1.5 m across, up to 320 each way.
export function groundFor(reach) {
  const half = Math.max(TERRAIN_HALF, Math.ceil((reach + 40) / RIM / 10) * 10);
  return { half, cells: Math.min(320, Math.max(CELLS, Math.round((2 * half) / 1.5))) };
}
const GRASS = new THREE.Color(0x7d8f55);  // the workshop's ground
const DRY = new THREE.Color(0x96945e);
const EARTH = new THREE.Color(0x7c6a4e);
// The ground's colour at its flat edge, on average: the plain beyond it
// (src/main.js) carries it on to the horizon.
export const PLAIN = GRASS.clone().lerp(DRY, 0.225);

export function createTerrain({ seed = 3, height = 6, size = 35, roughness = 0.45 } = {}, { half = TERRAIN_HALF, cells = CELLS } = {}) {
  const { fractal, noise } = createNoise(seed);
  const n = cells + 1;
  const step = (2 * half) / cells;
  const octaves = 5;
  // Hills fade out over the last quarter toward the far edge, so the
  // horizon is level.
  const rim = (x, z) => {
    const d = Math.max(Math.abs(x), Math.abs(z)) / half;
    return d < RIM ? 1 : Math.max(0, 1 - (d - RIM) / (1 - RIM)) ** 2;
  };
  // The grid's corners: where each is (the inner ones a little off their
  // places), and the hills' height there.
  const xs = new Float32Array(n * n), zs = new Float32Array(n * n), heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const inner = i > 0 && i < cells && j > 0 && j < cells;
      const x = -half + (i + (inner ? (hash(i * 2 + 1, j * 2 + seed) - 0.5) * 2 * JITTER : 0)) * step;
      const z = -half + (j + (inner ? (hash(i * 2 + seed, j * 2 + 1) - 0.5) * 2 * JITTER : 0)) * step;
      xs[j * n + i] = x;
      zs[j * n + i] = z;
      heights[j * n + i] = height > 0 ? height * fractal(x / size, z / size, octaves, roughness) * rim(x, z) : 0;
    }
  }
  // Each square's two triangles, as corners' numbers: cut from (i+1, j) to
  // (i, j+1), or from (i, j) to (i+1, j+1), whichever two corners are nearer
  // in height (on level ground, either: by chance).
  const corners = new Int32Array(cells * cells * 6);
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const c00 = j * n + i, c10 = c00 + 1, c01 = c00 + n, c11 = c01 + 1;
      const across = Math.abs(heights[c10] - heights[c01]), along = Math.abs(heights[c00] - heights[c11]);
      const cut = Math.abs(across - along) > 1e-6 ? along < across : hash(i + 11, j + 5) < 0.5;
      corners.set(cut ? [c00, c01, c11, c00, c11, c10] : [c00, c01, c10, c11, c10, c01], (j * cells + i) * 6);
    }
  }

  // The surface's height at (x, z): of the triangle it's over. That's one
  // of its own square's, or (the corners being off their places) of a
  // square next to it.
  const NEAR = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  function heightAt(x, z) {
    const px = Math.min(half, Math.max(-half, x)), pz = Math.min(half, Math.max(-half, z));
    const i0 = Math.min(cells - 1, Math.floor((px + half) / step)), j0 = Math.min(cells - 1, Math.floor((pz + half) / step));
    let nearest = 0, miss = Infinity;
    for (const [di, dj] of NEAR) {
      const i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= cells || j >= cells) continue;
      for (let t = (j * cells + i) * 6, end = t + 6; t < end; t += 3) {
        const a = corners[t], b = corners[t + 1], c = corners[t + 2];
        const bx = xs[b] - xs[a], bz = zs[b] - zs[a], cx = xs[c] - xs[a], cz = zs[c] - zs[a];
        const det = bx * cz - cx * bz;
        const u = ((px - xs[a]) * cz - cx * (pz - zs[a])) / det, v = (bx * (pz - zs[a]) - (px - xs[a]) * bz) / det;
        const at = heights[a] + u * (heights[b] - heights[a]) + v * (heights[c] - heights[a]);
        const out = Math.max(0, -u, -v, u + v - 1);
        if (out <= 1e-9) return at;
        if (out < miss) { miss = out; nearest = at; } // (on an edge, by a hair: the nearest will do)
      }
    }
    return nearest;
  }

  // The surface's up direction at (x, z): of the facet it's on.
  function normalAt(x, z, out = new THREE.Vector3()) {
    const e = step * 0.25;
    const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
    const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    return out.set(-dx, 1, -dz).normalize();
  }

  // The slope at (x, z), degrees.
  const up = new THREE.Vector3();
  const slopeAt = (x, z) => THREE.MathUtils.radToDeg(Math.acos(normalAt(x, z, up).y));

  // The mesh: one colour per facet, from its slope, a patchy dryness, and a
  // little jitter (the workshop's low-poly ground).
  const positions = new Float32Array(cells * cells * 18);
  const colors = new Float32Array(cells * cells * 18);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ca = new THREE.Vector3(), normal = new THREE.Vector3();
  const color = new THREE.Color();
  let k = 0;
  const facet = (c0, c1, c2) => {
    a.set(xs[c0], heights[c0], zs[c0]);
    b.set(xs[c1], heights[c1], zs[c1]);
    c.set(xs[c2], heights[c2], zs[c2]);
    normal.subVectors(b, a).cross(ca.subVectors(c, a)).normalize();
    const steep = Math.min(1, Math.max(0, (1 - normal.y) / 0.25));
    const cx = (a.x + b.x + c.x) / 3, cz = (a.z + b.z + c.z) / 3;
    const dry = Math.min(1, Math.max(0, 0.5 + noise(cx / 23 + 40, cz / 23 - 40)));
    color.copy(GRASS).lerp(DRY, dry * 0.45).lerp(EARTH, steep * 0.75);
    color.multiplyScalar(0.94 + 0.12 * hash(c0 * 3 + c1, c0 * 7 + c2));
    for (const p of [a, b, c]) {
      positions[k] = p.x; positions[k + 1] = p.y; positions[k + 2] = p.z;
      colors[k] = color.r; colors[k + 1] = color.g; colors[k + 2] = color.b;
      k += 3;
    }
  };
  for (let t = 0; t < corners.length; t += 3) facet(corners[t], corners[t + 1], corners[t + 2]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); // (unshared vertices: one normal per facet)
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, flatShading: true }));
  mesh.receiveShadow = true;
  mesh.name = 'ground';

  function dispose() {
    geometry.dispose();
    mesh.material.dispose();
  }

  return { heightAt, normalAt, slopeAt, mesh, dispose, half };
}

// A number from 0 to 1 for a grid square, the same every time.
function hash(i, j) {
  let x = Math.imul(i, 374761393) ^ Math.imul(j, 668265263);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}
