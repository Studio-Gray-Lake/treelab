import { limitsFor } from './limits.js';
import { PRESETS, presetOf, presetShape } from './presets.js';

// Grown in a wood: a tree hemmed in by others takes its kind's forest-grown
// shape.
//
// A tree alone in the open spreads: an oak there is as wide as it is tall.
// The same oak among others as tall grows up toward the light, its crown
// narrow and high on a long bare trunk, its low branches shaded out. Each
// kind of TreeLab's own has both shapes (src/presets.js: "open-grown" and
// "forest-grown"); a forest used to grow every tree as the Tree tab shows it,
// so a wood of 150-year oaks spread 21 m wide each, crowns through each other.
//
// Now, once the forest has placed its trees, each one is asked how hemmed in
// it is: round it, in eight directions, is there a neighbour near enough that
// their crowns meet, and at least SAME of its height? A tree closed in on at
// least CLOSED of the eight sides grows as it would in a wood. One at the
// wood's edge, in a clearing or above the rest grows in the open. A shrub
// under taller trees is hemmed in by them: it takes its kind's shape "under
// taller trees" (the hawthorn's, the hazel's and the holly's forest-grown
// shape is that).
//
// The forest-grown shape is the Tree tab's shape changed as the kind's own
// forest-grown shape differs from its open-grown one: a size by the same
// share (taller by a third, narrower by half, ...), anything else by the same
// amount. So what was changed by hand on the Tree tab carries into the wood,
// and a shape that is already forest-grown stays as it is.
//
// Said plainly: it is a rule of thumb at the moment of planting. Real trees
// grow into it over decades as their neighbours grow; here a tree's
// neighbours are the ones placed with it, and their crowns as they would be
// in the open.

export const SAME = 0.7;     // a neighbour at least this share of a tree's height hems it in
export const MEET = 1.8;     // nearer than this share of their two crowns' radii together, they shade each other
export const CLOSED = 6;     // of eight sides, closed in on at least this many: grown in a wood (a tree on a straight edge of a wood has five)
const SIDES = 8;

const BY_SIZE = new Set(['height', 'spread', 'trunk', 'girth', 'clumpSize', 'stool']);

// The kind's shape as it grows in a wood: `shape` (the Tree tab's), changed
// as the kind's forest-grown shape differs from its open-grown one. The same
// shape if the kind has no forest-grown shape, or if `shape` already is one.
export function closedShape(kind, shape) {
  const presets = PRESETS[kind];
  if (!presets || !presets['forest-grown']) return shape;
  if (presetOf(kind, shape) === 'forest-grown' || (shape.crowded ?? 0) >= 1) return shape;
  const open = presetShape(kind, presets['open-grown'] ? 'open-grown' : 'grown');
  const wood = presetShape(kind, 'forest-grown');
  const out = structuredClone(shape);
  for (const key of Object.keys(wood)) {
    if (!(key in shape) || key === 'age' || JSON.stringify(wood[key]) === JSON.stringify(open[key])) continue;
    const [lo, hi, step] = limitsFor(key, shape[key], kind);
    const carry = (mine, base, target) => {
      const v = Math.min(hi, Math.max(lo, BY_SIZE.has(key) && base > 0 ? mine * (target / base) : mine + (target - base)));
      return Number.isInteger(step) ? Math.round(v) : v;
    };
    out[key] = Array.isArray(wood[key])
      ? [0, 1].map((i) => carry(shape[key][i], open[key][i], wood[key][i])).sort((p, q) => p - q)
      : carry(shape[key], open[key], wood[key]);
  }
  return out;
}

// Which of the trees are hemmed in: a Set of their indices. trees: [{ x, z,
// height, crown }] (m: where each stands, how tall, its crown's radius).
export function hemmedIn(trees) {
  const closed = new Set();
  // (A grid of cells as wide as the widest reach, so a tree's neighbours are in its cell or the eight round it.)
  const reach = Math.max(1, ...trees.map((t) => t.crown)) * 2 * MEET;
  const cells = new Map();
  const cell = (x, z) => `${Math.floor(x / reach)},${Math.floor(z / reach)}`;
  trees.forEach((t, i) => {
    const key = cell(t.x, t.z);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(i);
  });
  trees.forEach((t, i) => {
    const sides = new Uint8Array(SIDES);
    const cx = Math.floor(t.x / reach), cz = Math.floor(t.z / reach);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (const j of cells.get(`${cx + dx},${cz + dz}`) ?? []) {
        if (j === i) continue;
        const o = trees[j];
        if (o.height < SAME * t.height) continue;
        const d = Math.hypot(o.x - t.x, o.z - t.z);
        if (d >= MEET * (t.crown + o.crown) || d === 0) continue;
        const a = Math.atan2(o.z - t.z, o.x - t.x);
        sides[((Math.floor(((a + Math.PI) / (2 * Math.PI)) * SIDES) % SIDES) + SIDES) % SIDES] = 1;
      }
    }
    if (sides.reduce((s, v) => s + v, 0) >= CLOSED) closed.add(i);
  });
  return closed;
}
