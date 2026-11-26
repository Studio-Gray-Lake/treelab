import * as THREE from 'three';
import { evergreen, leafy } from './kinds.js';

// The foliage's colours: each kind's two greens (a tree's tint picks
// between them), turned toward autumn.
//
// The season first (src/season.js): new leaves are a pale yellow green,
// and uneven from limb to limb; and what is left on a tree when most of
// its leaves have fallen is brown.
//
// Autumn turns the broadleaves (and, if asked, the needles, as a larch's)
// from green through a yellowed green to a colour from the palette. Each
// tree has its own pace and its own colour, from where it stands, so the
// same forest always turns the same way. "spread" is how unevenly: at 0
// every tree turns together; at 1 a tree may not start until 80% of the way
// into autumn. Evergreens that don't turn only dull a little.

export const PALETTES = {
  maple: ['#f2b134', '#e8862a', '#d4552a', '#b03028'],
  birch: ['#f4d24c', '#e9be3a', '#d9a531', '#c8962c'],
  oak: ['#c79a3a', '#a8662c', '#8a4b28', '#6f3d26'],
};
// (A beech wood's copper. Not among the mixed ones: a forest that turned in the mixed colours keeps the colours it had.)
const BEECH = ['#d6a03c', '#c8792c', '#b5602a', '#9a4e28'];
PALETTES.mixed = [...PALETTES.maple, ...PALETTES.birch, ...PALETTES.oak];
PALETTES.beech = BEECH;
const LARCH = ['#d9b13a', '#c99a32', '#b8862c'];
const TURNING = new THREE.Color('#a3a238'); // a yellowed green, on the way
const DULL = new THREE.Color('#4f5038');    // what an evergreen dulls toward
const FRESH = new THREE.Color('#a9c94c');   // new leaves: a pale yellow green
const BROWN = new THREE.Color('#6e4c2b');   // the last leaves left on a tree
const SUMMER = { leaves: 1, fresh: 0 };     // (no season given: high summer, as before there were seasons)
const GROUND = new THREE.Color('#f2dca2');  // what the ground's colour is multiplied toward

const tmp = new THREE.Color();
const smooth = (t) => {
  const s = Math.min(1, Math.max(0, t));
  return s * s * (3 - 2 * s);
};

// A number from 0 to 1 for a spot, the same every time.
export function hashAt(x, z, salt) {
  let h = Math.imul(Math.round(x * 100) | 0, 374761393) ^ Math.imul(Math.round(z * 100) | 0, 668265263) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Whether a kind's foliage turns in autumn: leaves do, unless the kind is
// evergreen (a holly never turns); needles only if asked.
export const turns = (kind, autumn) => (leafy(kind) ? !evergreen(kind) : autumn.evergreens);

// How far a tree has turned (0 to 1).
export function progressOf(record, autumn) {
  if (autumn.amount <= 0 || !turns(record.kind, autumn)) return 0;
  const start = hashAt(record.x, record.z, 1) * autumn.spread * 0.8;
  return smooth((autumn.amount - start) / Math.max(0.15, 1 - start));
}

// A tree's foliage colour (into out).
export function foliageColor(record, colors, autumn, out = new THREE.Color(), season = SUMMER) {
  const c = colors[record.kind];
  out.set(c.dark).lerp(tmp.set(c.light), record.tint);
  // (New leaves: an evergreen's new shoots are a little of its crown only.)
  if (season.fresh > 0) out.lerp(FRESH, (evergreen(record.kind) ? 0.12 : 0.45) * Math.min(1, season.fresh));
  if (autumn.amount <= 0) return out;
  if (!turns(record.kind, autumn)) return out.lerp(DULL, 0.15 * autumn.amount);
  const p = progressOf(record, autumn);
  if (p <= 0) return out;
  const palette = leafy(record.kind) ? PALETTES[autumn.palette] ?? PALETTES.mixed : LARCH;
  const target = tmp.set(palette[Math.floor(hashAt(record.x, record.z, 2) * palette.length)]);
  // (The fewer leaves are left, the browner they are: the last ones hang on dead.)
  if (season.leaves < 1) target.lerp(BROWN, 0.95 * (1 - Math.max(0, season.leaves)));
  if (p < 0.5) return out.lerp(TURNING, p * 2);
  return out.copy(TURNING).lerp(target, (p - 0.5) * 2);
}

// How much a kind's limbs differ from each other in autumn (0 to 0.6): the
// mottled look of a tree turning limb by limb.
// And in new leaf: some limbs a little ahead of others.
export const mottleOf = (kind, autumn, season = SUMMER) => Math.max(turns(kind, autumn) ? 0.6 * Math.min(1, autumn.amount * 1.5) : 0, evergreen(kind) ? 0 : 0.35 * Math.min(1, season.fresh));

// The ground's colour in autumn: a drier, golden cast.
export const groundColor = (autumn, out = new THREE.Color()) => out.set(0xffffff).lerp(GROUND, 0.55 * autumn.amount);
