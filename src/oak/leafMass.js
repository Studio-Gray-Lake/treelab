import * as THREE from 'three';
import { mulberry32 } from '@workshop/treeShapes.js';
import { pushesOf } from './chance.js';
import { NOISE, USUAL_PATTERN, bendOf, layersOf, patternFrom } from './leafNoise.js';

// The oak's leaves as masses: the clusters on one big limb merged into a
// single billowing surface, hollow underneath.
//
// A cluster of leaves used to be drawn as a ball of its own, and a crown as
// a pile of balls: a crease wherever two crossed, each lit as a ball, and
// from below a flat lid under each. A bough's leaves are one mass: lumps
// of every size run together, with valleys between them, and under them
// the leafy layer ends and the branches show.
//
// How:
// - each cluster becomes lumps: its own (the size the light allows it,
//   ./crownLight.js, some a little smaller), and a few small ones on its
//   upper side, each cluster's its own (from its seed);
// - a cluster's lumps are added up as a field over space, each strongest
//   at its middle and fading to nothing a little past its edge; and the
//   cluster takes away from its own field under its middle, which hollows
//   it out from below (a cap of leaves over its twigs, not a ball round
//   them). Only from its own: a cluster's hollow doesn't eat into the cap
//   of the cluster beside it, which is how holes came through the masses;
// - the clusters' fields are added up, and the surface is where the sum
//   passes a set level, found on a grid of cells: one corner of the
//   surface in each cell it passes through, and a four-sided face across
//   each edge of the grid it crosses ("surface nets"). The cells' size is
//   the facets' size: the "coarseness";
// - the clusters of one big limb are one field, those of another another:
//   each limb bobs on its own in the wind (the sway reads the limb from
//   every corner), and a real bough carries its own mass, with sky between
//   it and the next.
//
// Noise (0 to 1, and past it): the lumps are the base, and noise shapes
// them (./leafNoise.js: what its pattern is like can be chosen). A slow
// pattern over space carries every place a little way off before the
// lumps are asked about it, which bends the round shapes; and a pattern in
// layers, a broad one and finer ones, swells the leaves in one place and
// thins them in the next, so a mass billows, and where it runs thin it
// opens. At 0 the masses are the lumps as they are. The noise only ever
// shapes what the lumps put there: it makes no leaves where there is no
// twig. Bits it pinches off the masses are left out.
//
// Merging (0 to 1): how many of the clusters near enough to run together
// do. With all of them merged a limb's leaves are one sculpted thing, and
// move as one; with some left on their own, a bough is several masses
// that overlap and slide against each other as it bobs, as the separate
// balls did. Each cluster may join the mass of the nearest cluster near
// it that came before it, and does if its own chance (from its seed and
// the tree's, the same every time) falls under the setting. So raising
// the setting only adds merges, and never reshuffles the ones made; at 1
// every cluster that can join does, and at 0 each is a mass of its own.
//
// The masses are closed surfaces (the hollow is a dent, with a surface of
// its own), so they shade themselves and each other as any solid does.
// What isn't as in life: a mass is a skin round where the leaves are, not
// leaves.

const LEVEL = 0.2;                                    // the field's value at the surface
const REACH = 1 / Math.sqrt(1 - Math.cbrt(LEVEL));    // a lump's field reaches this many times its radius (so a lump on its own is as big as itself)
const HOLLOW = { under: 1, wide: 1.45, strong: 1.25 }; // the hollow: its middle this far under the cluster's (as a share of its half-height), reaching this many times its radius, this strong. (So the leaves end about a third of the way down from a cluster's middle to where a ball's underside would be.)
const SMALLER = [0.8, 1];                             // a cluster's own lump, as a share of the size the light allows it
const SMALL = { count: [3, 6], size: [0.35, 0.7], out: 0.75 }; // the small lumps on it: how many, how big (shares of its radius), how far out from its middle
const CRUMPLED = 0.6;                                 // the most a corner is pushed about, as a share of what "lumpy" asks (pushed further, faces fold over)

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (lo, hi, v) => { const t = clamp((v - lo) / (hi - lo)); return t * t * (3 - 2 * t); };

// A cluster's lumps: [{ c, r, squash, weight (1, or less than 0 for the
// hollow, whose r is how far it reaches) }]. clump: { center, radius,
// squash, seed } (a clump of the oak's layout).
export function lumpsOf(clump) {
  const random = mulberry32(clump.seed);
  const r = clump.radius * (SMALLER[0] + (SMALLER[1] - SMALLER[0]) * random());
  const [x, y, z] = clump.center;
  const lumps = [{ c: [x, y, z], r, squash: clump.squash, weight: 1 }];
  const count = SMALL.count[0] + Math.floor(random() * (SMALL.count[1] - SMALL.count[0] + 1));
  for (let i = 0; i < count; i++) {
    // (On its upper side: from near its top to just under its widest.)
    const round = random() * Math.PI * 2, down = (0.1 + 0.45 * random()) * Math.PI;
    const out = SMALL.out * r;
    lumps.push({
      c: [x + Math.cos(round) * Math.sin(down) * out, y + Math.cos(down) * out * clump.squash, z + Math.sin(round) * Math.sin(down) * out],
      r: r * (SMALL.size[0] + (SMALL.size[1] - SMALL.size[0]) * random()), squash: clump.squash, weight: 1,
    });
  }
  lumps.push({ c: [x, y - HOLLOW.under * r * clump.squash, z], r: r * HOLLOW.wide, squash: clump.squash, weight: -HOLLOW.strong });
  return lumps;
}

// The clusters of each limb together: [[clump, ...], ...] (those on no limb,
// round the trunk's top, together too).
export function byLimb(clumps) {
  const limbs = new Map();
  for (const clump of clumps) {
    const key = `${clump.limb.phase}|${clump.limb.heading}`;
    if (!limbs.has(key)) limbs.set(key, []);
    limbs.get(key).push(clump);
  }
  return [...limbs.values()];
}

// One limb's clusters in the groups that run together: [[clump, ...], ...].
// merge (0 to 1): the share of the clusters that could join another's mass
// that do; seed: the tree's; noise and pattern: as massGeometry's (the
// noise carries the leaves a little further, so clusters a little further
// apart can meet).
export function groupsOf(clumps, { merge = 1, seed = 1, noise = 0, pattern } = {}) {
  const n = clumps.length;
  const middle = clumps.map((clump) => clump.center);
  const apart = (i, j) => Math.hypot(middle[i][0] - middle[j][0], middle[i][1] - middle[j][1], middle[i][2] - middle[j][2]);
  // (How far a cluster's leaves can reach from its middle: its lumps'
  // fields, and the noise's bends.)
  const far = clumps.map((clump) => Math.max(...lumpsOf(clump).filter((lump) => lump.weight > 0)
    .map((lump) => Math.hypot(lump.c[0] - clump.center[0], lump.c[1] - clump.center[1], lump.c[2] - clump.center[2]) + lump.r * REACH)) + Math.max(0, noise) * patternFrom(pattern).bend);
  const near = (i, j) => apart(i, j) < far[i] + far[j];
  // The clusters in an order in which each, but the first of those that
  // hang together, comes after one near it: outward from the first.
  const order = [], placed = new Uint8Array(n);
  for (let first = 0; first < n; first++) {
    if (placed[first]) continue;
    placed[first] = 1;
    const queue = [first];
    while (queue.length) {
      const i = queue.shift();
      order.push(i);
      const next = [];
      for (let j = 0; j < n; j++) {
        if (placed[j] || !near(i, j)) continue;
        placed[j] = 1;
        next.push(j);
      }
      queue.push(...next.sort((a, b) => apart(i, a) - apart(i, b) || a - b));
    }
  }
  const groups = [], group = new Int32Array(n), before = [];
  for (const i of order) {
    let nearest = -1;
    for (const j of before) if (near(i, j) && (nearest < 0 || apart(i, j) < apart(i, nearest))) nearest = j;
    before.push(i);
    if (nearest >= 0 && chanceOf(clumps[i].seed, seed) < merge) {
      group[i] = group[nearest];
      groups[group[i]].push(clumps[i]);
    } else {
      group[i] = groups.length;
      groups.push([clumps[i]]);
    }
  }
  return groups;
}

// A cluster's own chance (0 to 1), from its seed and the tree's.
function chanceOf(own, seed) {
  let h = (Math.imul(own ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

// The leaves' geometry: every limb's clusters as one mass. cell: the
// facets' size, m; rough: how crumpled the surface is (a share of a cell).
// Not indexed, with position, normal, color (grey: how light, as the
// clusters') and branch (the sway's: each corner's limb and how far out
// along it), as the workshop's mesher gives a tree's foliage.
// noise: how much noise shapes the masses (0: the lumps as they are; 1:
// full); pattern: what the noise is like ({ type, size, detail, bend,
// billow }: ./leafNoise.js; the usual one if none is given); merge: how
// many of the clusters near enough to run together do (1: all, 0: none);
// seed: the tree's (for the noise, and for which merge).
export function massGeometry(clumps, { cell = 0.9, rough = 0.25, noise = 0, merge = 1, seed = 1, pattern = USUAL_PATTERN } = {}) {
  const out = { position: [], color: [], branch: [] };
  const whole = patternFrom(pattern);
  for (const limb of byLimb(clumps)) {
    for (const group of groupsOf(limb, { merge, seed, noise, pattern: whole })) massInto(out, group, cell, rough, Math.max(0, noise), seed, whole);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(out.color, 3));
  g.setAttribute('branch', new THREE.Float32BufferAttribute(out.branch, 3));
  g.computeVertexNormals();
  return g;
}

// How strong a lump's field is at a place (0 outside its reach R).
function fieldOf(lump, R, x, y, z) {
  const dx = (x - lump.c[0]) / R, dy = (y - lump.c[1]) / (R * lump.squash), dz = (z - lump.c[2]) / R;
  const q = dx * dx + dy * dy + dz * dz;
  return q < 1 ? (1 - q) * (1 - q) * (1 - q) : 0;
}

function massInto(out, clumps, cell, rough, noise, seed, pattern) {
  const all = clumps.map((clump) => {
    const lumps = lumpsOf(clump);
    return { clump, full: lumps.filter((lump) => lump.weight > 0), hollow: lumps.find((lump) => lump.weight < 0) };
  });
  const { phase, heading } = clumps[0].limb;

  // The grid: round all the lumps and a cell more, its corners on whole
  // cells of the tree's space (so the same leaves give the same facets
  // wherever the grid starts).
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const boxOf = (lump) => [lump.r * REACH, lump.r * REACH * lump.squash, lump.r * REACH];
  for (const { full } of all) {
    for (const lump of full) {
      const far = boxOf(lump);
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], lump.c[k] - far[k]);
        hi[k] = Math.max(hi[k], lump.c[k] + far[k]);
      }
    }
  }
  // The noise: how far its bends may carry a place off (m, in a pattern
  // `over` m across), and its billowing's layers.
  const { far: bends, over } = bendOf(pattern, noise, cell);
  const layers = noise > 0 && pattern.billow > 0 ? layersOf(pattern, cell, seed) : [];
  const from = lo.map((v) => (Math.floor((v - bends) / cell) - 1) * cell);
  const [nx, ny, nz] = hi.map((v, k) => Math.ceil((v + bends - from[k]) / cell) + 3);
  const at = (i, j, k) => (k * ny + j) * nx + i;
  const field = new Float32Array(nx * ny * nz), weight = new Float32Array(nx * ny * nz);
  const reach = new Float32Array(nx * ny * nz), shade = new Float32Array(nx * ny * nz);

  // The noise's bends: for every corner of the grid, the place the lumps
  // are asked about in its stead.
  let carried = null;
  if (bends > 0) {
    const pushes = pushesOf(seed >>> 0), push = [0, 0, 0];
    carried = new Float32Array(nx * ny * nz * 3);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = from[0] + i * cell, y = from[1] + j * cell, z = from[2] + k * cell;
      pushes(x / over, y / over, z / over, push);
      const p = at(i, j, k) * 3;
      carried[p] = x + 2 * bends * push[0];
      carried[p + 1] = y + 2 * bends * push[1];
      carried[p + 2] = z + 2 * bends * push[2];
    }
  }

  // Each cluster's own field (its lumps, less its hollow, never less than
  // nothing), added to the limb's.
  for (const { clump, full, hollow } of all) {
    const a = [Infinity, Infinity, Infinity], b = [-Infinity, -Infinity, -Infinity];
    for (const lump of full) {
      const far = boxOf(lump);
      for (let k = 0; k < 3; k++) {
        a[k] = Math.min(a[k], lump.c[k] - far[k]);
        b[k] = Math.max(b[k], lump.c[k] + far[k]);
      }
    }
    const i0 = Math.max(0, Math.floor((a[0] - bends - from[0]) / cell)), i1 = Math.min(nx - 1, Math.ceil((b[0] + bends - from[0]) / cell));
    const j0 = Math.max(0, Math.floor((a[1] - bends - from[1]) / cell)), j1 = Math.min(ny - 1, Math.ceil((b[1] + bends - from[1]) / cell));
    const k0 = Math.max(0, Math.floor((a[2] - bends - from[2]) / cell)), k1 = Math.min(nz - 1, Math.ceil((b[2] + bends - from[2]) / cell));
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const spot = at(i, j, k) * 3;
      const x = carried ? carried[spot] : from[0] + i * cell, y = carried ? carried[spot + 1] : from[1] + j * cell, z = carried ? carried[spot + 2] : from[2] + k * cell;
      let here = 0;
      for (const lump of full) here += fieldOf(lump, lump.r * REACH, x, y, z);
      if (here <= 0) continue;
      here += hollow.weight * fieldOf(hollow, hollow.r, x, y, z);
      if (here <= 0) continue;
      const p = at(i, j, k);
      field[p] += here;
      weight[p] += here;
      reach[p] += here * clump.limb.reach1;
      shade[p] += here * clump.shade;
    }
  }

  // The noise's billowing: the leaves thicker in one place and thinner in
  // the next, by its layers together (never more than nothing: where there
  // are none, none are made).
  if (layers.length) {
    const much = noise * pattern.billow;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const p = at(i, j, k);
      if (field[p] <= 0) continue;
      const x = from[0] + i * cell, y = from[1] + j * cell, z = from[2] + k * cell;
      let swell = 0;
      for (const layer of layers) swell += layer.strength * 2 * layer.value(x / layer.size, y / layer.size, z / layer.size);
      field[p] *= Math.max(0, 1 + much * swell);
    }
  }

  // One corner of the surface in every cell it passes through: the middle
  // of where it crosses the cell's edges, crumpled a little.
  const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const corner = new Int32Array(cx * cy * cz).fill(-1);
  const corners = []; // [x, y, z, reach, shade] each
  const cellAt = (i, j, k) => (k * cy + j) * cx + i;
  const value = new Float32Array(8), index = new Int32Array(8);
  const crumple = Math.min(CRUMPLED, rough) * cell * 0.7;
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) {
      index[c] = at(i + CORNERS[c][0], j + CORNERS[c][1], k + CORNERS[c][2]);
      value[c] = field[index[c]];
      if (value[c] > LEVEL) inside++;
    }
    if (inside === 0 || inside === 8) continue;
    let x = 0, y = 0, z = 0, crossings = 0, w = 0, far = 0, light = 0;
    for (const [a, b] of EDGES) {
      if ((value[a] > LEVEL) === (value[b] > LEVEL)) continue;
      const t = (LEVEL - value[a]) / (value[b] - value[a]);
      x += CORNERS[a][0] + (CORNERS[b][0] - CORNERS[a][0]) * t;
      y += CORNERS[a][1] + (CORNERS[b][1] - CORNERS[a][1]) * t;
      z += CORNERS[a][2] + (CORNERS[b][2] - CORNERS[a][2]) * t;
      crossings++;
    }
    for (let c = 0; c < 8; c++) {
      w += weight[index[c]];
      far += reach[index[c]];
      light += shade[index[c]];
    }
    // (Each cell's corner pushed its own way: from where the cell is, so
    // the faces round it agree on it.)
    const push = mulberry32((Math.imul(i + Math.round(from[0] / cell), 73856093) ^ Math.imul(j + Math.round(from[1] / cell), 19349663) ^ Math.imul(k + Math.round(from[2] / cell), 83492791)) >>> 0);
    corner[cellAt(i, j, k)] = corners.length;
    corners.push([
      from[0] + (i + x / crossings) * cell + (push() - 0.5) * crumple,
      from[1] + (j + y / crossings) * cell + (push() - 0.5) * crumple,
      from[2] + (k + z / crossings) * cell + (push() - 0.5) * crumple,
      w > 0 ? far / w : 0, w > 0 ? light / w : 1,
    ]);
  }

  // A four-sided face across every edge of the grid the surface crosses,
  // between the corners of the four cells round that edge. Which way it
  // faces follows from the grid alone (the four cells go round the edge
  // one way; the face is turned over if the leaves are on the edge's far
  // end), never from where the corners happen to lie: judged from those,
  // a face lying nearly along the edge came out facing in now and then,
  // and showed as a hole.
  const u = new THREE.Vector3(), v = new THREE.Vector3(), normal = new THREE.Vector3();
  const faces = [];
  const face = (a, b, c, d, over) => faces.push(over ? [a, d, c, b] : [a, b, c, d]);
  const draw = (face) => {
    const quad = face.map((i) => corners[i]);
    for (const [p, q, r] of [[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]]) {
      u.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
      v.set(r[0] - p[0], r[1] - p[1], r[2] - p[2]);
      normal.crossVectors(u, v).normalize();
      // (Darker where it faces down, as a cluster's underside is.)
      const facing = 0.62 + 0.38 * smooth(-0.7, 0.6, normal.y);
      for (const s of [p, q, r]) {
        out.position.push(s[0], s[1], s[2]);
        const grey = s[4] * facing;
        out.color.push(grey, grey, grey);
        out.branch.push(phase, s[3], heading);
      }
    }
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const here = field[at(i, j, k)] > LEVEL;
    // (Round an edge along x, the four cells go round as +x; along y, as
    // -y; along z, as +z.)
    if (here !== field[at(i + 1, j, k)] > LEVEL) face(corner[cellAt(i, j - 1, k - 1)], corner[cellAt(i, j, k - 1)], corner[cellAt(i, j, k)], corner[cellAt(i, j - 1, k)], !here);
    if (here !== field[at(i, j + 1, k)] > LEVEL) face(corner[cellAt(i - 1, j, k - 1)], corner[cellAt(i, j, k - 1)], corner[cellAt(i, j, k)], corner[cellAt(i - 1, j, k)], here);
    if (here !== field[at(i, j, k + 1)] > LEVEL) face(corner[cellAt(i - 1, j - 1, k)], corner[cellAt(i, j - 1, k)], corner[cellAt(i, j, k)], corner[cellAt(i - 1, j, k)], !here);
  }
  if (!(bends > 0) && !layers.length) {
    for (const one of faces) draw(one);
    return;
  }
  // Shaped by noise: the bits it pinched off the masses (pieces of only a
  // few faces, hanging in the air by themselves) are left out.
  const piece = corners.map((_, i) => i);
  const of = (i) => {
    while (piece[i] !== i) i = piece[i] = piece[piece[i]];
    return i;
  };
  for (const [a, b, c, d] of faces) for (const other of [b, c, d]) piece[of(other)] = of(a);
  const size = new Map();
  for (const [a] of faces) size.set(of(a), (size.get(of(a)) ?? 0) + 1);
  for (const one of faces) if (size.get(of(one[0])) >= NOISE.least) draw(one);
}
