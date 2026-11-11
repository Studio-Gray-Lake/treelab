import { mulberry32 } from '@workshop/treeShapes.js';

// The oak's chance: random numbers for each part of a tree, and smooth
// patterns over space. All come from the tree's seed alone, so the same
// seed always gives the same oak, and a part's numbers don't depend on what
// any other part used.

// Random numbers for one part of a tree: from the tree's seed, the part's
// name and, of several alike (the limbs, the clusters), which one.
export function partOf(seed) {
  return (name, which = 0) => {
    let h = (seed ^ 0x9e3779b9) >>> 0;
    for (let k = 0; k < name.length; k++) h = Math.imul(h ^ name.charCodeAt(k), 0x01000193) >>> 0;
    h = Math.imul(h ^ (which + 0x7f4a7c15), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    return mulberry32((h ^ (h >>> 16)) >>> 0);
  };
}

// A number from 0 to 1 for each corner of a grid of whole numbers (the
// k'th of several there), from a seed.
const cornersOf = (seed) => (x, y, z, k) => {
  let h = (Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f) ^ Math.imul(k + 1, 0x9e3779b1) ^ seed) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};
const ease = (t) => t * t * (3 - 2 * t);
// The k'th number at a place: its grid cell's corners' numbers, blended by
// how near each is (u, v, w: how far across the cell, eased), less a half.
function blended(corner, xi, yi, zi, u, v, w, k) {
  let sum = 0;
  for (let c = 0; c < 8; c++) {
    const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
    sum += corner(xi + dx, yi + dy, zi + dz, k) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
  }
  return sum - 0.5;
}

// A smooth pattern of small pushes over space: at each place three numbers,
// each between -0.5 and 0.5, changing little from a place to one near it
// (about 1 apart they're unrelated). The same seed gives the same pattern.
export function pushesOf(seed) {
  const corner = cornersOf(seed);
  return (x, y, z, out = [0, 0, 0]) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = ease(x - xi), v = ease(y - yi), w = ease(z - zi);
    for (let k = 0; k < 3; k++) out[k] = blended(corner, xi, yi, zi, u, v, w, k);
    return out;
  };
}

// The first of those three numbers alone (the same number, for less work).
export function pushOf(seed) {
  const corner = cornersOf(seed);
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    return blended(corner, xi, yi, zi, ease(x - xi), ease(y - yi), ease(z - zi), 0);
  };
}

// A pattern of cells over space: one point somewhere in every cell of a
// grid of whole numbers, and at each place how far the nearest of them is
// (0 at a point, about 0.55 on average, never more than 1). The same seed
// gives the same pattern.
export function cellsOf(seed) {
  const corner = cornersOf(seed);
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let nearest = 1;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx, cy = yi + dy, cz = zi + dz;
      const ax = cx + corner(cx, cy, cz, 0) - x, ay = cy + corner(cx, cy, cz, 1) - y, az = cz + corner(cx, cy, cz, 2) - z;
      const d = ax * ax + ay * ay + az * az;
      if (d < nearest) nearest = d;
    }
    return Math.sqrt(nearest);
  };
}
