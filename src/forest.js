import { mulberry32 } from '@workshop/treeShapes.js';
import { KINDS } from './kinds.js';
import { createNoise, quantile, smoothstep } from './noise.js';
import { areaOf, inArea, scatter } from './patterns.js';
import { MAX_TREES } from './settings.js';
import { coveredBy } from './cover.js';
import { fitOf, siteOf, standingOf } from './site.js';

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
//      of the area as its share of the mix;
//   5. the rules (src/site.js; `standing` given, and any of forest.rules
//      above 0): a kind is given fewer of the places on ground it doesn't
//      like, and the kinds that like it more; then a tree with no room
//      beside its neighbours is crowded out, and one under a taller tree's
//      crown is shaded out unless its kind bears the shade. With every
//      rule at 0 (or no `standing`) the forest is planted as it was before
//      there were rules: the same trees in the same places.
//
//
// The mix is set one of two ways (forest.mixBy):
//   'by count': as above: a kind's share is its share of the seeds, and
//     "seeds per hectare" says how many fall.
//   'by cover': by layer and by ground covered (src/cover.js). The kinds
//     are in two layers, the canopy and the underwood (src/site.js: a
//     kind's layer). Each layer is asked for a share of the ground under
//     its crowns, and a kind's share is its share of its layer's crowns.
//     How many seeds fall is then worked out, layer by layer, so that what
//     stands after the rules covers what was asked, as nearly as the rules
//     and the ground allow; "seeds per hectare" has no say.
//
// The same settings and ground always give the same forest.

const SINK = 0.3; // m a tree stands sunk into the ground, as in the workshop (it may slope under the trunk)

// standing(kind, variant): how tall a tree of that kind stands and how far
// its crown reaches, at size 1 ({ height, crown }, m: src/site.js standOf):
// what the rules reckon with.
export function placeForest(forest, terrain, standing = null) {
  const area = { shape: forest.area, radius: forest.radius };
  const report = { area: areaOf(area), candidates: 0, clearings: 0, steep: 0, capped: 0, thinnedTo: 0, crowded: 0, shaded: 0 };
  const rules = standing ? { room: forest.rules?.room ?? 0, light: forest.rules?.light ?? 0, ground: forest.rules?.ground ?? 0 } : { room: 0, light: 0, ground: 0 };
  if (standing && forest.mixBy === 'by cover') return coveredBy(forest, terrain, standing, { area, rules, report, sow });
  // Over MAX_TREES, the forest is planted thinner all over (not cut off at
  // the end of its rows), and the report says to what.
  let density = forest.density / 10000; // per m²
  if (density * report.area > MAX_TREES) {
    density = (MAX_TREES * 0.97) / report.area;
    report.thinnedTo = density * 10000;
  }
  const kinds = KINDS.filter((k) => forest.mix[k]?.on && forest.mix[k].share > 0);
  const records = sow(forest, terrain, { area, rules, report, density, kinds });
  // Room and light: the trees that stand, of those a seed fell for.
  return { records: standing ? standingOf(records, rules, standing, report) : records, report };
}

// The trees a seed fell for, before room and light are reckoned: steps 1
// to 4 above and the ground's part of 5, for some of the kinds, at a
// density (seeds per m²).
//   salt: a number of its own for a second sowing over the same ground
//     (the underwood's), so its seeds fall elsewhere than the first's;
//   keep(kind): the share of a kind's seeds kept (by cover: a kind with
//     wide crowns needs fewer trees than one with narrow crowns to cover
//     as much ground).
// Counts into the report what it leaves out.
function sow(forest, terrain, { area, rules, report, density, kinds, salt = 0, keep = null }) {
  const random = mulberry32(forest.seed + salt);
  // (Kinds, sizes and turns from their own stream, so the places stay put
  // when only the mix changes.)
  const pick = mulberry32(forest.seed + salt + 101);

  let points = scatter(forest.pattern, { area, density, random, jitter: forest.jitter, clumpTrees: forest.clumpTrees, clumpSpread: forest.clumpSpread, rowAngle: forest.rowAngle });
  report.candidates += points.length;

  if (forest.patches) {
    const { fractal } = createNoise(forest.seed + 11);
    const value = (p) => fractal(p.x / forest.patchSize, p.z / forest.patchSize, 3, 0.5);
    const threshold = quantile(sample(area, 48).map(value), 1 - forest.cover);
    const before = points.length;
    points = points.filter((p) => random() < smoothstep(threshold - 0.06, threshold + 0.06, value(p)));
    report.clearings += before - points.length;
  }

  const before = points.length;
  points = points.filter((p) => terrain.slopeAt(p.x, p.z) <= forest.maxSlope);
  report.steep += before - points.length;

  if (points.length > MAX_TREES) {
    // (Should the pattern still overshoot, every so many is left out, all over.)
    report.capped += points.length - MAX_TREES;
    points = Array.from({ length: MAX_TREES }, (_, k) => points[Math.floor((k * points.length) / MAX_TREES)]);
  }

  const total = kinds.reduce((sum, k) => sum + forest.mix[k].share, 0);
  if (!kinds.length) return [];
  const byMix = forest.grouping === 'in stands' ? standsOf(forest, area, kinds, total, salt) : () => {
    let r = pick() * total;
    return kinds.find((k) => (r -= forest.mix[k].share) < 0) ?? kinds[kinds.length - 1];
  };
  // The ground: how high a place lies on the hills, as the share of the
  // forest's ground that lies lower (0 its lowest ground to 1 its highest:
  // so a kind's stretch is a share of the ground, however the hills are
  // shaped), and each kind's share of the places there by how it likes
  // that. (Flat ground: every kind as content as another.)
  let kindOf = byMix;
  if (rules.ground > 0) {
    const heights = sample(area, 48).map((p) => terrain.heightAt(p.x, p.z));
    const sorted = heights.slice().sort((a, b) => a - b);
    const low = sorted[0], high = sorted[sorted.length - 1];
    // (How much of the ground lies lower than a height.)
    const lower = (h) => {
      let a = 0, b = sorted.length;
      while (a < b) {
        const m = (a + b) >> 1;
        if (sorted[m] < h) a = m + 1;
        else b = m;
      }
      return a / sorted.length;
    };
    const sites = kinds.map((k) => siteOf(k));
    if (high - low > 0.5) {
      kindOf = (p, draw) => {
        const t = lower(terrain.heightAt(p.x, p.z));
        const likes = sites.map((site) => 1 + (fitOf(site, t) - 1) * Math.min(1, rules.ground));
        // (In stands: the stand's own kind, if it likes the ground well enough; otherwise, as when mixed, one that does.)
        if (forest.grouping === 'in stands') {
          const kind = byMix(p, draw);
          if (draw() < likes[kinds.indexOf(kind)]) return kind;
        }
        const weights = kinds.map((k, i) => forest.mix[k].share * likes[i]);
        let r = draw() * weights.reduce((sum, w) => sum + w, 0);
        return kinds[weights.findIndex((w) => (r -= w) < 0)] ?? kinds[kinds.length - 1];
      };
    }
  }

  const [least, most] = forest.size;
  let records = points.map((p) => {
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
  // (By cover: each kind's seeds thinned to its share of them, a number of its own for each seed.)
  if (keep) records = records.filter((r) => pick() < keep(r.kind));
  // (A kind sized by its age, src/main.js: its own size before the rules reckon with it.)
  if (forest.sizeOf) for (const r of records) r.size = forest.sizeOf(r.kind, r.size);
  return records;
}

// "In stands": a noise field, cut at the mix's shares (by how much of the
// area falls under each cut), so each kind gets its own patches and about
// its share of the trees. Ragged at the edges, where two kinds meet.
function standsOf(forest, area, kinds, total, salt = 0) {
  const { fractal } = createNoise(forest.seed + salt + 23);
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
