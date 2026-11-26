import { FRAMES } from './kinds.js';

// Where each kind of tree grows: the forest's rules (src/forest.js plants
// by them).
//
// Three things decide whether a tree stands where a seed fell:
//
//   the ground: each kind has a stretch of ground it likes, from the lowest
//     ground of the hills (0: the hollows, where it's damp and sheltered) to
//     the highest (1: the ridges, dry and in the wind), counted as a share
//     of the forest's ground: 0.25 is ground a quarter of it lies below. An ash keeps to the
//     lower slopes, a birch and a pine to the higher ground, a hawthorn
//     grows anywhere. Where a kind doesn't like the ground it is given
//     fewer of the places there, and the kinds that do like it more: the
//     mix's shares are of the whole forest, not of every slope. (On flat
//     ground every kind is as content as another.)
//   room: two trees of about the same height can't stand nearer than their
//     crowns allow (a little over half of their two crown radii: crowns in
//     a wood touch and interlock, they don't sit one inside another). The
//     taller tree was there first, and the other is crowded out. A small
//     tree under a tall one needs only to be clear of its trunk.
//   light: a tree under a taller tree's crown lives or not by how much
//     shade its kind bears. A holly and a beech grow in deep shade, a hazel
//     and a hawthorn in a good deal of it; a birch, a pine and an ash need
//     the open sky, and under a crown they are shaded out.
//
// What each kind wants is in its frame ("site": { ground: [from, to],
// shade: 0 none to 1 any }; src/oak), and for the workshop's own three
// kinds here. How strongly each rule holds is a setting (forest.rules:
// ground, room, light): at 0 a rule is off, and with all three at 0 the
// forest is planted as it was before there were rules.
//
// Said plainly: these are rules of thumb for a planted picture, not a
// model of a wood growing up. Nothing here grows, seeds, or dies over
// years; a tree's shape doesn't answer to its neighbours (a kind's
// "forest-grown" shape is chosen by hand); and the ground is only its
// height on the hills: there is no water, soil or aspect.

// A kind's layer in a wood: the canopy, its tall trees, or the underwood,
// the small trees and shrubs under and between them ("layer" in its
// frame's site; canopy unless it says underwood). The mix by cover
// (src/cover.js) is set a layer at a time.
const WORKSHOP = { broadleaf: { ground: [0, 0.6], shade: 0.5 }, fir: { ground: [0.3, 1], shade: 0.8 }, pine: { ground: [0.5, 1], shade: 0.1 } };
export const USUAL_SITE = { ground: [0, 1], shade: 0.5, layer: 'canopy' };
export const siteOf = (kind) => ({ ...USUAL_SITE, ...(FRAMES[kind]?.site ?? WORKSHOP[kind] ?? {}) });

// What a kind wants, in a sentence for its panel: which ground, and how
// much shade under taller trees.
export function siteSays(site) {
  const [from, to] = site.ground;
  const share = (v) => `${Math.round(v * 100)}%`;
  const ground = from <= 0 && to >= 1 ? 'on any ground'
    : from <= 0 ? `on the lower ground (the lowest ${share(to)} of it)`
    : to >= 1 ? `on the higher ground (the highest ${share(1 - from)} of it)`
    : `on the middle ground (from ${share(from)} to ${share(to)} of the way up)`;
  const shade = site.shade >= 0.75 ? 'bears deep shade'
    : site.shade >= 0.5 ? 'bears a good deal of shade'
    : site.shade >= 0.25 ? 'bears some shade'
    : 'needs the open sky';
  return `It grows ${ground}, and under taller trees it ${shade}.`;
}

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const mid = (v) => (Array.isArray(v) ? (v[0] + v[1]) / 2 : v);
const FADE = 0.3; // how far outside its stretch of ground (as a share of the hills' height) a kind still grows at all

// How well a kind likes the ground at a height (t: 0 the hills' lowest
// ground to 1 their highest): 1 on its own stretch, less and less outside
// it, and never quite nothing.
export function fitOf(site, t) {
  const [from, to] = site.ground;
  const outside = t < from ? from - t : t > to ? t - to : 0;
  return clamp(1 - outside / FADE, 0.04, 1);
}

// How tall a tree of a kind stands and how far its crown reaches from its
// trunk (m), from its shape's settings: what the rules reckon with. (The
// workshop's kinds have other settings than TreeLab's own: near enough.)
export function standOf(shape) {
  if ('spread' in shape) {
    const height = mid(shape.height);
    return { height, crown: (height * mid(shape.spread)) / 2 };
  }
  if ('radius' in shape) return { height: mid(shape.height), crown: mid(shape.radius) }; // the workshop's fir
  if ('height' in shape) return { height: mid(shape.height), crown: mid(shape.length) * 0.9 + mid(shape.clumpSize) * 0.5 }; // its pine
  const reach = mid(shape.length);
  return { height: mid(shape.trunk) + reach * 1.1 + mid(shape.clumpSize), crown: reach * 0.9 + mid(shape.clumpSize) * 0.6 }; // its broadleaf
}

// A number from 0 to 1 for a spot, the same every time.
function unit(x, z, salt) {
  let h = Math.imul(Math.round(x * 100) | 0, 374761393) ^ Math.imul(Math.round(z * 100) | 0, 668265263) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const SAME = 0.6;     // a tree at least this share of another's height is of its height: they need room of each other
const ROOM = 0.55;    // of their two crown radii together, between trees of a height
const UNDER = 0.85;   // of a taller tree's crown radius: nearer than this, a tree is under its crown
const TALLER = 1.15;  // times a tree's height: a tree this much taller shades it

// The trees that stand, of those a seed fell for: room and light.
//   records: the forest's trees ([{ x, z, kind, variant, size }]);
//   rules: { room, light } (0: that rule is off);
//   standing(kind, variant): { height, crown } of that tree at size 1 (m).
// The tallest are settled first: a tree is there before the smaller ones
// round it. Gives the records that stand, in the order they were given, and
// counts the rest into `report` (crowded, shaded).
export function standingOf(records, rules, standing, report = {}) {
  report.crowded = 0;
  report.shaded = 0;
  if (!(rules.room > 0) && !(rules.light > 0)) return records;
  const stand = records.map((r) => {
    const s = standing(r.kind, r.variant);
    return { height: s.height * (r.size ?? 1), crown: s.crown * (r.size ?? 1), shade: siteOf(r.kind).shade };
  });
  const order = records.map((_, i) => i).sort((a, b) => stand[b].height - stand[a].height || a - b);
  const widest = stand.reduce((most, s) => Math.max(most, s.crown), 0);
  // (Cells as wide as the furthest any two trees can matter to each other: the widest crown's reach twice over,
  // or the room the rule asks, whichever is more. A tree's neighbours are then in its cell or the eight round it.)
  const cell = Math.max(2, widest * 2, Math.max(ROOM * 2 * widest, 1.2, 0.5 + 0.3 * widest) * (rules.room || 0));
  const grid = new Map();
  const key = (cx, cz) => `${cx},${cz}`;
  const kept = new Array(records.length).fill(false);
  for (const i of order) {
    const r = records[i], s = stand[i];
    const cx = Math.floor(r.x / cell), cz = Math.floor(r.z / cell);
    let crowded = false, under = false;
    for (let dx = -1; dx <= 1 && !crowded; dx++) {
      for (let dz = -1; dz <= 1 && !crowded; dz++) {
        for (const j of grid.get(key(cx + dx, cz + dz)) ?? []) {
          const o = records[j], t = stand[j];
          const d = Math.hypot(o.x - r.x, o.z - r.z);
          // (Of a height: room between their crowns. Far shorter: clear of the taller one's trunk.)
          const needs = s.height >= SAME * t.height ? ROOM * (s.crown + t.crown) : Math.max(1.2, 0.5 + 0.3 * s.crown);
          if (d < needs * (rules.room || 0)) { crowded = true; break; }
          if (t.height > TALLER * s.height && d < UNDER * t.crown) under = true;
        }
      }
    }
    if (crowded) { report.crowded++; continue; }
    // (Under a crown: it lives if its kind bears the shade. Each place has a number of its own: the less
    // shade the kind bears, and the more the rule holds, the more places are too dark for it.)
    if (under && rules.light > 0 && unit(r.x, r.z, 7) < rules.light * (1 - s.shade)) { report.shaded++; continue; }
    kept[i] = true;
    const k = key(cx, cz);
    if (grid.has(k)) grid.get(k).push(i);
    else grid.set(k, [i]);
  }
  return records.filter((_, i) => kept[i]);
}
