import { inArea } from './patterns.js';

// Canopy cover: the share of the forest's ground that lies under a crown,
// looking straight down. A forester's measure: a closed wood is about 85 to
// 95% covered, and the sun reaches the floor through the rest.
//
// Each tree's crown is its clumps of leaves, as discs seen from above (a fir
// has none: one disc, its crown's radius). They're marked on a grid of
// cells over the forest's area.
//
//   group: the planted trees (src/tree.js: userData.species, each variant's
//   trees and grown model). area: { shape, radius } (src/patterns.js).
//   Returns { cover (0 to 1), cells (1 where covered), n (cells a side),
//   cell (m), half (m: the grid reaches this far each way) }.
export function canopyCover(group, area, { cell = 0.5 } = {}) {
  const half = area.radius;
  const n = Math.max(1, Math.ceil((2 * half) / cell));
  const cells = new Uint8Array(n * n);
  const mark = (x, z, r) => {
    const i0 = Math.max(0, Math.floor((x - r + half) / cell)), i1 = Math.min(n - 1, Math.floor((x + r + half) / cell));
    const j0 = Math.max(0, Math.floor((z - r + half) / cell)), j1 = Math.min(n - 1, Math.floor((z + r + half) / cell));
    for (let j = j0; j <= j1; j++) {
      const dz = -half + (j + 0.5) * cell - z;
      for (let i = i0; i <= i1; i++) {
        const dx = -half + (i + 0.5) * cell - x;
        if (dx * dx + dz * dz <= r * r) cells[j * n + i] = 1;
      }
    }
  };
  for (const species of Object.values(group.userData.species ?? {})) {
    for (const variant of species.variants) {
      const { clumps = [], crown } = variant.model?.tree ?? variant;
      for (const t of variant.trees) {
        if (!clumps.length) {
          mark(t.x, t.z, crown * t.size);
          continue;
        }
        // (As the tree stands: turned about the vertical, sized, placed.)
        const c = Math.cos(t.turn), s = Math.sin(t.turn);
        for (const k of clumps) mark(t.x + (k.x * c + k.z * s) * t.size, t.z + (-k.x * s + k.z * c) * t.size, k.r * t.size);
      }
    }
  }
  let inside = 0, covered = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (!inArea(area, -half + (i + 0.5) * cell, -half + (j + 0.5) * cell)) continue;
      inside++;
      covered += cells[j * n + i];
    }
  }
  return { cover: inside ? covered / inside : 0, cells, n, cell, half };
}
