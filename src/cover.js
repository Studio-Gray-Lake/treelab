import { KINDS } from './kinds.js';
import { inArea } from './patterns.js';
import { MAX_TREES } from './settings.js';
import { siteOf, standingOf } from './site.js';

// The forest's mix set by layer and by ground covered (forest.mixBy: 'by
// cover'; src/forest.js plants by it), beside the mix by count, which a forest starts with.
//
// A wood stands in layers: the canopy, its tall trees, and under and
// between them the underwood, its small trees and shrubs. Which layer a
// kind is of is part of what the kind is (src/site.js: a hazel, a hawthorn
// and a holly are underwood, every other kind canopy).
//
//   forest.layers.canopy, .underwood: how much of the ground that layer's
//     crowns cover, in percent of the forest's area (a crown counted as a
//     circle, as wide as the rules reckon it: src/site.js standOf; ground
//     under two crowns counts once);
//   forest.mix[kind].share: the kind's share of its layer's crowns,
//     against the layer's other kinds (by their area, not by their number:
//     one oak 12 m wide is as much canopy as four birches 6 m wide).
//
// How many seeds fall is not asked: it is worked out. The canopy is sown
// first, at the density at which what stands of it after the rules covers
// what was asked; then the underwood the same way, among and under the
// canopy's trees. And the share of each kind's seeds kept is worked out
// the same way, round by round, until its crowns are its share of its
// layer. Where the rules, the ground or the most trees a forest may hold
// (MAX_TREES) don't allow what was asked, the layer and the kind get what
// they do allow, and the report says both: asked and stands.
//
// Said plainly: a crown here is a circle, not the tree's own leaves (the
// "canopy cover" the forest's numbers give is measured on the trees as
// grown, every layer together, and is not the same number). The seeds'
// places change with what is asked, as they do with "seeds per hectare".

export const LAYERS = ['canopy', 'underwood'];
export const layerOf = (kind) => siteOf(kind).layer;

// The kinds growing in the forest, by their layer: { canopy: [...], underwood: [...] }.
export function layersOf(forest) {
  const on = KINDS.filter((k) => forest.mix[k]?.on && forest.mix[k].share > 0);
  return Object.fromEntries(LAYERS.map((name) => [name, on.filter((k) => layerOf(k) === name)]));
}

// The area as cells, to measure cover on: how much of it lies under at
// least one of some trees' crowns ([{ x, z, crown }], crown: its reach, m).
function cellsOf(area) {
  const n = Math.min(256, Math.max(64, Math.ceil((2 * area.radius) / 0.75)));
  const step = (2 * area.radius) / n;
  const inside = new Uint8Array(n * n);
  let cells = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!inArea(area, -area.radius + (i + 0.5) * step, -area.radius + (j + 0.5) * step)) continue;
    inside[j * n + i] = 1;
    cells++;
  }
  const at = (v) => Math.floor((v + area.radius) / step);
  return (trees) => {
    const hit = new Uint8Array(n * n);
    let under = 0;
    for (const t of trees) {
      for (let j = Math.max(0, at(t.z - t.crown)); j <= Math.min(n - 1, at(t.z + t.crown)); j++) {
        const dz = -area.radius + (j + 0.5) * step - t.z;
        for (let i = Math.max(0, at(t.x - t.crown)); i <= Math.min(n - 1, at(t.x + t.crown)); i++) {
          const dx = -area.radius + (i + 0.5) * step - t.x;
          if (dx * dx + dz * dz >= t.crown * t.crown || !inside[j * n + i] || hit[j * n + i]) continue;
          hit[j * n + i] = 1;
          under++;
        }
      }
    }
    return cells ? under / cells : 0;
  };
}

const ROUNDS = 5;     // times, at most, each kind's share of the seeds is put right by what stood
const NEAR = 0.005;   // of the ground: a layer this near what was asked is there

// The forest's trees, by cover. Given by src/forest.js what it plants
// with: the area, the rules in force, the report to count into, and sow
// (a layer's seeds at a density, before room and light).
export function coveredBy(forest, terrain, standing, { area, rules, report, sow }) {
  const cover = cellsOf(area);
  const [least, most] = forest.size;
  const sizeOf = forest.sizeOf ?? ((_, size) => size);
  // A kind's crown, on average over its shapes and sizes (m²).
  const crownOf = (kind) => {
    let sum = 0;
    for (let v = 0; v < forest.variants; v++) sum += standing(kind, v).crown ** 2;
    const a = sizeOf(kind, least), b = sizeOf(kind, most);
    return (Math.PI * (sum / forest.variants) * (a * a + a * b + b * b)) / 3;
  };
  const reach = (r) => standing(r.kind, r.variant).crown * r.size;
  const crowns = (records, kinds) => records.filter((r) => kinds.includes(r.kind)).map((r) => ({ x: r.x, z: r.z, crown: reach(r) }));
  const byLayer = layersOf(forest);
  report.layers = {};
  let below = []; // (the seeds of the layers already settled)
  let budget = MAX_TREES * 0.97;
  for (const [index, name] of LAYERS.entries()) {
    const kinds = byLayer[name];
    const asked = Math.min(1, Math.max(0, (forest.layers?.[name] ?? 0) / 100));
    const told = report.layers[name] = { asked, stands: 0, seeds: 0, full: false, kinds: {} };
    if (!kinds.length) continue;
    const total = kinds.reduce((sum, k) => sum + forest.mix[k].share, 0);
    const area1 = Object.fromEntries(kinds.map((k) => [k, crownOf(k)]));
    // (As many seeds of each kind as its share of the layer's crowns takes: fewer of a kind with wide crowns.)
    const weight = Object.fromEntries(kinds.map((k) => [k, 1 / area1[k]]));
    const most1 = budget / report.area; // seeds per m², at the most trees a forest may hold
    const salt = index * 211;
    let best = null;
    if (asked > 0) {
      for (let round = 0; round < ROUNDS; round++) {
        const top = Math.max(...kinds.map((k) => weight[k]));
        const share = Object.fromEntries(kinds.map((k) => [k, weight[k] / top])); // (this round's own: the weights move on)
        const keep = (kind) => share[kind];
        const kept = kinds.reduce((sum, k) => sum + (forest.mix[k].share / total) * keep(k), 0);
        const mean = kinds.reduce((sum, k) => sum + (forest.mix[k].share / total) * keep(k) * area1[k], 0) / kept;
        const at = (density) => {
          const seeds = sow(forest, terrain, { area, rules, report: { candidates: 0, clearings: 0, steep: 0, capped: 0 }, density, kinds, salt, keep });
          const stood = standingOf(below.concat(seeds), rules, standing);
          return { density, keep, seeds, stood, cover: cover(crowns(stood, kinds)) };
        };
        // (Where to start looking: were the crowns dropped at random, this many seeds would cover it.)
        const guess = -Math.log(1 - Math.min(0.98, asked)) / (mean * kept);
        let lo = 0, hi = Math.min(most1, guess * 2), got = at(hi);
        while (got.cover < asked && hi < most1) {
          lo = hi;
          hi = Math.min(most1, hi * 2);
          got = at(hi);
        }
        let found = got;
        const nearer = (one) => { if (Math.abs(one.cover - asked) < Math.abs(found.cover - asked)) found = one; };
        for (let step = 0; step < 9 && Math.abs(found.cover - asked) > NEAR && got.cover >= asked; step++) {
          const mid = at((lo + hi) / 2);
          nearer(mid);
          if (mid.cover < asked) lo = mid.density;
          else hi = mid.density;
        }
        // (A few wide trees: one more or one fewer is a good deal of cover, and a little more seed can as well
        // give less of it. So a look round where it settled, for a nearer one.)
        if (Math.abs(found.cover - asked) > 4 * NEAR && got.cover >= asked) {
          const centre = found.density;
          for (let k = 0; k < 10; k++) nearer(at(Math.min(most1, centre * (0.7 + 0.06 * k + (k >= 5 ? 0.06 : 0)))));
        }
        found.full = found.cover < asked - NEAR && found.density >= most1;
        // Each kind's crowns as a share of the layer's, against what was asked.
        const got1 = sharesOf(found.stood, kinds, reach);
        let off = 0;
        for (const k of kinds) off = Math.max(off, Math.abs(got1[k] - forest.mix[k].share / total));
        // (The round kept: the one nearest in both, the layer's cover and its kinds' shares of it.)
        found.off = Math.abs(found.cover - asked) + off / 2;
        if (!best || found.off < best.off) best = found;
        if (off < 0.03 || kinds.length < 2) break;
        // Each kind's seeds put right by what stood of it.
        for (const k of kinds) {
          const want = forest.mix[k].share / total;
          weight[k] *= Math.min(3, Math.max(1 / 3, want / Math.max(got1[k], want / 3)));
        }
      }
    }
    if (best) {
      // (The layer as found, sown once more for the report's own count of what was left out.)
      const seeds = sow(forest, terrain, { area, rules, report, density: best.density, kinds, salt, keep: best.keep });
      below = below.concat(seeds);
      told.seeds = seeds.length;
      told.full = best.full;
      budget = Math.max(0, budget - standingOf(below, rules, standing).length);
    }
  }
  const records = standingOf(below, rules, standing, report);
  for (const name of LAYERS) {
    const kinds = byLayer[name], told = report.layers[name];
    told.stands = cover(crowns(records, kinds));
    const total = kinds.reduce((sum, k) => sum + forest.mix[k].share, 0);
    const got = sharesOf(records, kinds, reach);
    for (const k of kinds) told.kinds[k] = { asked: forest.mix[k].share / total, stands: got[k], trees: records.filter((r) => r.kind === k).length };
  }
  return { records, report };
}

// Each kind's crowns as a share of all the crowns of some kinds, by area.
function sharesOf(records, kinds, reach) {
  const sums = Object.fromEntries(kinds.map((k) => [k, 0]));
  let all = 0;
  for (const r of records) {
    if (!(r.kind in sums)) continue;
    const a = reach(r) ** 2;
    sums[r.kind] += a;
    all += a;
  }
  return Object.fromEntries(kinds.map((k) => [k, all ? sums[k] / all : 0]));
}
