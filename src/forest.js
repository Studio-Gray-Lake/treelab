import { TREE_KINDS, mulberry32 } from '@workshop/treeShapes.js';
import { createNoise, quantile, smoothstep } from './noise.js';
import { areaOf, inArea, scatter } from './patterns.js';
import { MAX_TREES } from './settings.js';

// The Forest tab's trees: where each stands, its kind, variant, size, turn
// and tint, as the workshop's tree records (src/trees.js), from the
// forest's settings (src/settings.js) and the ground (src/terrain.js).
//
//   1. the pattern's points in the area, at the density;
//   2. patches (if on): noise splits the area into groves and clearings,
//      `cover` of it groves, and trees stand only in the groves;
//   3. none on a slope steeper than maxSlope;
//   4. each tree's kind by the mix: drawn at random ("mixed"), or "in
//      stands", where noise gives each kind its own patches, as big a share
//      of the area as its share of the mix.
//
// The same settings and ground always give the same forest.

const SINK = 0.3; // m a tree stands sunk into the ground, as in the workshop (it may slope under the trunk)

export function placeForest(forest, terrain) {
  const area = { shape: forest.area, radius: forest.radius };
  const density = forest.density / 10000; // per m²
  const random = mulberry32(forest.seed);
  // (Kinds, sizes and turns from their own stream, so the places stay put
  // when only the mix changes.)
  const pick = mulberry32(forest.seed + 101);

  const report = { area: areaOf(area), candidates: 0, clearings: 0, steep: 0, capped: 0 };
  let points = scatter(forest.pattern, { area, density, random, jitter: forest.jitter, clumpTrees: forest.clumpTrees, clumpSpread: forest.clumpSpread, rowAngle: forest.rowAngle });
  report.candidates = points.length;

  if (forest.patches) {
    const { fractal } = createNoise(forest.seed + 11);
    const value = (p) => fractal(p.x / forest.patchSize, p.z / forest.patchSize, 3, 0.5);
    const threshold = quantile(sample(area, 48).map(value), 1 - forest.cover);
    const before = points.length;
    points = points.filter((p) => random() < smoothstep(threshold - 0.06, threshold + 0.06, value(p)));
    report.clearings = before - points.length;
  }

  const before = points.length;
  points = points.filter((p) => terrain.slopeAt(p.x, p.z) <= forest.maxSlope);
  report.steep = before - points.length;

  if (points.length > MAX_TREES) {
    report.capped = points.length - MAX_TREES;
    points = points.slice(0, MAX_TREES);
  }

  const kinds = TREE_KINDS.filter((k) => forest.mix[k]?.on && forest.mix[k].share > 0);
  const total = kinds.reduce((sum, k) => sum + forest.mix[k].share, 0);
  if (!kinds.length) return { records: [], report };
  const kindOf = forest.grouping === 'in stands' ? standsOf(forest, area, kinds, total) : () => {
    let r = pick() * total;
    return kinds.find((k) => (r -= forest.mix[k].share) < 0) ?? kinds[kinds.length - 1];
  };

  const [least, most] = forest.size;
  const records = points.map((p) => {
    const kind = kindOf(p, pick);
    return {
      x: p.x,
      z: p.z,
      y: terrain.heightAt(p.x, p.z) - SINK,
      size: least + pick() * (most - least),
      turn: pick() * Math.PI * 2,
      tint: pick(),
      kind,
      variant: Math.floor(pick() * forest.variants),
    };
  });
  return { records, report };
}

// "In stands": a noise field, cut at the mix's shares (by how much of the
// area falls under each cut), so each kind gets its own patches and about
// its share of the trees. Ragged at the edges, where two kinds meet.
function standsOf(forest, area, kinds, total) {
  const { fractal } = createNoise(forest.seed + 23);
  const value = (p) => fractal(p.x / forest.standSize, p.z / forest.standSize, 3, 0.45);
  const values = sample(area, 48).map(value);
  let sum = 0;
  const cuts = kinds.map((k) => quantile(values, (sum += forest.mix[k].share) / total));
  return (p, pick) => {
    const v = value(p) + (pick() - 0.5) * 0.08;
    const i = cuts.findIndex((cut) => v <= cut);
    return kinds[i < 0 ? kinds.length - 1 : i];
  };
}

// Points on an n × n grid over the area (inside it only).
function sample(area, n) {
  const points = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const p = { x: -area.radius + ((i + 0.5) / n) * 2 * area.radius, z: -area.radius + ((j + 0.5) / n) * 2 * area.radius };
      if (inArea(area, p.x, p.z)) points.push(p);
    }
  }
  return points;
}
