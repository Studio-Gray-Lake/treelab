import * as THREE from 'three';
import { createNoise } from './noise.js';

// The Forest tab's ground: seeded rolling hills, flat-shaded in facets like
// the workshop's ground, green on the gentle slopes and earthier on the
// steep ones. Its heightAt is exactly the drawn surface's, so a tree stands
// on what you see, and the wind (src/wind.js) reads it for the lee behind
// the hills.
//
//   seed: which hills; height: how high they rise and fall (m, 0: flat);
//   size: how wide a hill is (m); roughness: how much finer bumps add.

export const TERRAIN_HALF = 150; // m: the ground, each way from the middle
const CELLS = 200;               // facets' squares each way
const GRASS = new THREE.Color(0x7d8f55);  // the workshop's ground
const DRY = new THREE.Color(0x96945e);
const EARTH = new THREE.Color(0x7c6a4e);

export function createTerrain({ seed = 3, height = 6, size = 35, roughness = 0.45 } = {}, { half = TERRAIN_HALF, cells = CELLS } = {}) {
  const { fractal, noise } = createNoise(seed);
  const n = cells + 1;
  const step = (2 * half) / cells;
  const octaves = 5;
  // Hills fade out toward the far edge, so the horizon is level.
  const rim = (x, z) => {
    const d = Math.max(Math.abs(x), Math.abs(z)) / half;
    return d < 0.6 ? 1 : Math.max(0, 1 - (d - 0.6) / 0.4) ** 2;
  };
  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -half + i * step, z = -half + j * step;
      heights[j * n + i] = height > 0 ? height * fractal(x / size, z / size, octaves, roughness) * rim(x, z) : 0;
    }
  }
  const h = (i, j) => heights[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))];

  // Each grid square is two triangles split along the same diagonal as the
  // mesh below: (i, j)-(i, j+1)-(i+1, j) and (i+1, j+1)-(i+1, j)-(i, j+1).
  function heightAt(x, z) {
    const fx = Math.min(cells - 1e-9, Math.max(0, (x + half) / step));
    const fz = Math.min(cells - 1e-9, Math.max(0, (z + half) / step));
    const i = Math.floor(fx), j = Math.floor(fz);
    const u = fx - i, v = fz - j;
    const h00 = h(i, j), h10 = h(i + 1, j), h01 = h(i, j + 1), h11 = h(i + 1, j + 1);
    if (u + v <= 1) return h00 + u * (h10 - h00) + v * (h01 - h00);
    return h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11);
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
  const facet = (i0, j0, i1, j1, i2, j2) => {
    a.set(-half + i0 * step, h(i0, j0), -half + j0 * step);
    b.set(-half + i1 * step, h(i1, j1), -half + j1 * step);
    c.set(-half + i2 * step, h(i2, j2), -half + j2 * step);
    normal.subVectors(b, a).cross(ca.subVectors(c, a)).normalize();
    const steep = Math.min(1, Math.max(0, (1 - normal.y) / 0.25));
    const cx = (a.x + b.x + c.x) / 3, cz = (a.z + b.z + c.z) / 3;
    const dry = Math.min(1, Math.max(0, 0.5 + noise(cx / 23 + 40, cz / 23 - 40)));
    color.copy(GRASS).lerp(DRY, dry * 0.45).lerp(EARTH, steep * 0.75);
    color.multiplyScalar(0.94 + 0.12 * hash(i0 * 3 + i1, j0 * 7 + j2));
    for (const p of [a, b, c]) {
      positions[k] = p.x; positions[k + 1] = p.y; positions[k + 2] = p.z;
      colors[k] = color.r; colors[k + 1] = color.g; colors[k + 2] = color.b;
      k += 3;
    }
  };
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      facet(i, j, i, j + 1, i + 1, j);
      facet(i + 1, j + 1, i + 1, j, i, j + 1);
    }
  }
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
