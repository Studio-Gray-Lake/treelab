import { partOf, pushesOf } from './chance.js';
import { biggest, leafy, leastFor } from './crownLight.js';
import { MOST_LAYERS, NOISE_TYPES, patternFrom } from './leafNoise.js';
import { agedBy, markedAt, meshOak } from './oakMesh.js';

export { partOf, pushesOf };

// TreeLab's English oak (Quercus robur), grown at its real size.
//
// Unlike the workshop's trees (a fixed recipe: so many limbs from the top of
// the trunk), an oak's branches grow into the space of its crown and compete
// for it, so they branch unevenly and from all along their parents
// ("space colonisation", Runions, Lane and Prusinkiewicz, 2007):
//
//   1. the crown's space: an oak's broad dome, widest a little below its
//      middle, flatter underneath, lumpy, filled with points to grow toward.
//      Its outline can be drawn: how far the branches reach at its bottom,
//      a quarter, half and three quarters of the way up, and its top (see
//      outlineOf). The branches follow, since they grow into that space: a
//      young oak's narrow egg, a forest oak's crown wide only at the top,
//      an ancient one's low flat spread;
//   2. the trunk, bare up to the first limbs, then the big limbs, setting
//      off at different heights and turning in a spiral round it. The trunk
//      carries on as a leader toward where the crown is widest (so the
//      limbs of a crown that's widest high up leave it all the way up, not
//      in a bunch);
//   3. every branch tip grows a step toward the points near it, and points a
//      branch has reached are used up, until the crown is filled;
//   4. thickness from the tips down: a branch is as thick as the branches it
//      carries together (their cross-sections add up), scaled so the trunk
//      is the girth asked for, with a swollen foot;
//   5. long limbs sag with their length; the wood is thinned to what can be
//      drawn, and the twigs beyond it become clusters of leaves;
//   6. but only on twigs still growing, and where there's light for leaves.
//      A twig off the side of a branch that has since run on many times as
//      far as the twig ever grew stopped long ago, shaded out as the crown
//      closed over it: it's bare. Of the rest, the clusters in the crown's
//      top and outside keep their leaves; under them there are fewer, and
//      fewer still further in and further down (./crownLight.js);
//   7. and every cluster that keeps its leaves gets its twig drawn, from the
//      wood to its middle: leaves sit on twigs, not in the air.
//
// A slider changes what it names and nothing else. Each part of the tree
// (its height, each limb, the crown's lumps, the points, each cluster's
// lumps, its lean) has random numbers of its own, from the seed and the
// part's name, and the branches' zig-zag is a smooth pattern over the
// tree's own proportions, not a string of numbers used up in turn. So a
// taller oak is the same oak, taller; one more limb leaves the others where
// they were; a fuller crown keeps its limbs. (Branches still grow by
// competing for space, so where the crown itself changes, the finer
// branching rearranges with it: little for a little change.) The seed is
// the one way to another tree.
//
// A bigger crown gets more of everything: more points to grow toward, more
// wood drawn, more clusters of leaves, as many times more as its outline
// (height by width) is bigger than the biggest crown the usual settings grow
// (up to MOST times as wide and tall: 3.2 times as many). Without that, a
// 35 m oak is the 20 m oak's skeleton stretched, with the same few clusters
// spread over three times the crown.
//
// The layout is drawn by the oak's own mesher (./oakMesh.js): round wood,
// joints that swell, a foot that spreads into roots, and the trunk's marks
// (its gnarl, burrs, hollows and stubs: where each is, is decided here,
// each from the tree's own chance). What it gives is what the workshop's
// mesher gave, so the workshop's sway takes it. A side branch starts
// thinner than the wood it leaves: it can't break out through the bark.
//
// The trunk's marks come with age, and gather low down. An oak's burrs,
// flutes and hollows are an old tree's, and a trunk's thickness is its age:
// a thin trunk has few, a thick one many (as many as asked for at 0.6 m:
// agedBy, in ./oakMesh.js). And they're thickest at the foot, where the roots' ridges run
// up and the oldest wood is, thinning out up the trunk and the limbs: by
// half every few metres (more metres on a thicker tree), as far as
// "marksHigh" lets them. So a tall thin forest oak has a clean bole, and a
// short thick one in the open is marked all over.
//
// The trunk bends on its way up ("bends"): a smooth pattern of its own,
// none at the ground where it's rooted, carrying everything above with it.

// The shape: ranges are [least, most]; each tree draws its own value.
export const OAK_SHAPE = {
  age: 150,                // years: where the age slider stands. It grows nothing itself: moving it sets the other settings to an oak's of that age (src/age.js), and they can be moved again by hand
  height: [17, 22],        // m: to the top of the crown
  spread: [1, 1.3],        // the crown's width over the tree's height
  trunk: [2.5, 4],         // m: bare trunk, up to the first big limbs
  girth: [0.5, 0.7],       // m: the trunk's radius just above its foot
  lean: [0, 3],            // degrees
  bends: 0.4,              // how much the trunk itself bends on its way up (0 straight as a pole)
  limbs: [3, 5],           // big limbs the trunk divides into
  crooked: 0.35,           // how much the branches zig-zag (0 straight)
  droop: 0.2,              // how much long limbs sag (0 none)
  leafiness: 0.65,         // how full the crown is (how little light its leaves live on: 0 a thin crown, 1 a full one)
  crowded: 0,              // how near its neighbours stand (their crowns keep the low sky off its sides): 0 alone in the open, 1 crowns as tall as its own, its own width away
  reachBottom: 0,          // the crown's outline: how far its branches reach, as a share of half the crown's width, at its bottom (0: it closes to a point there)
  reachLow: 0.98,          // a quarter of the way up it
  reachMid: 0.98,          // halfway up
  reachHigh: 0.8,          // three quarters of the way up
  reachTop: 0,             // at its top (0: it closes to a point; more: a flat top)
  clumpSize: [1.6, 2.8],   // m: a cluster of leaves, its radius
  squash: 0.9,             // a cluster's height over its width
  rough: 0.25,             // how lumpy the clusters are
  sway: 0.04,              // m a branch tip bobs per m/s of wind
  gnarl: 0.15,             // how lumpy and fluted the trunk and the big limbs are (0 smooth, 1 an ancient oak's, 2 far past it)
  burrs: 0.2,              // burrs on the trunk (0 none, 1 many)
  hollows: 0,              // hollows in the trunk (0 none, 1 three)
  marksHigh: 0.3,          // how far up its gnarl, burrs and hollows go (0: at its foot, thinning out quickly; 1: evenly all the way up)
  stubs: 0.2,              // dead stubs on the trunk and the big limbs (0 none, 1 many)
  flare: 0.35,             // how far the trunk's foot spreads into its roots
  roots: 0.35,             // how far its roots run out over the ground (0 none)
  masses: 0,               // its leaves as separate clusters (0), or each limb's merged into one mass, hollow underneath (1): a test
  merge: 100,              // % : how many of the clusters near enough to run together do (100: all; 0: every cluster a mass of its own)
  noise: 0,                // % : how much 3D noise shapes the merged masses (0: the lumps as they are; 100: full; past it, more)
  noiseType: 0,            // what the noise is like: 0 smooth, 1 creased (puffs, sharp creases between), 2 ridged (sharp ridges), 3 cells (round clumps)
  noiseSize: 2.4,          // m: how big its broad billows are
  noiseDetail: 1,          // how many finer layers lie on the broad one
  noiseBend: 1.1,          // m: how far it carries the shapes out of round (at 100%)
  noiseBillow: 1,          // how strongly it thickens and thins the leaves (0: it only bends them)
  coarse: 0.9,             // m: how big the merged masses' facets are
};

// Each setting's slider: [least, most, step]. They reach well past any
// real oak (a 50 m one, a trunk 3 m thick, limbs hanging to the ground,
// sixteen burrs), so the outlying ones can be looked at; the generator
// copes with every end (tests/oak.test.js).
export const OAK_LIMITS = {
  height: [2, 50, 0.5], spread: [0.25, 2.5, 0.05], trunk: [0.3, 30, 0.1], girth: [0.03, 3, 0.01], lean: [0, 45, 0.5],
  limbs: [1, 12, 1], crooked: [0, 2, 0.01], droop: [0, 2, 0.01], leafiness: [0, 1, 0.01], crowded: [0, 3, 0.05], clumpSize: [0.2, 6, 0.05],
  squash: [0.15, 2.5, 0.01], rough: [0, 1, 0.01], sway: [0, 0.3, 0.002],
  gnarl: [0, 2, 0.01], burrs: [0, 2, 0.01], hollows: [0, 2, 0.01], stubs: [0, 2, 0.01], flare: [0, 2, 0.01], roots: [0, 2, 0.01],
  bends: [0, 2, 0.01], marksHigh: [0, 1, 0.01], age: [10, 800, 1],
  reachBottom: [0, 1.3, 0.01], reachLow: [0, 1.3, 0.01], reachMid: [0, 1.3, 0.01], reachHigh: [0, 1.3, 0.01], reachTop: [0, 1.3, 0.01],
  masses: [0, 1, 1], merge: [0, 100, 1], noise: [0, 200, 1], coarse: [0.3, 2, 0.05],
  noiseType: [0, NOISE_TYPES.length - 1, 1], noiseSize: [0.3, 12, 0.05], noiseDetail: [0, MOST_LAYERS, 1], noiseBend: [0, 5, 0.05], noiseBillow: [0, 3, 0.05],
};

// The settings that are a choice, not an amount: { setting: { name: value } }.
export const OAK_CHOICES = { noiseType: Object.fromEntries(NOISE_TYPES.map((name, i) => [name, i])) };

// (For a crown up to the biggest the usual settings grow; a bigger one gets
// more: see above.)
const STEPS = 34;          // a branch step is the tree's height over this
const MAX_NODES = 4000;    // growth stops here whatever happens
const DRAWN = 560;         // at most this many steps of wood are drawn (and the twigs to the clusters)
const CLUMPS = 84;         // and at most this many clusters of leaves
const CANDIDATES = 150;    // of at most this many places for one (those with too little light keep none)
const USUAL = 630;         // m2: the outline (height by width) of the biggest crown the usual settings grow
const MOST = 1.8;          // a crown is given detail as one at most this many times as wide and tall as that
const USUAL_OAK = { height: 19.5, width: 22.4, bare: 3.25 }; // m: the usual oak, as which every oak is grown before it's fitted to its own size
const PIPE = 2.2;          // thickness: a parent's radius^PIPE = the sum of its children's
const TWIG = 0.012;        // m: no wood is drawn thinner than about this
const KEEPS_UP = 0.25;     // a side twig keeps its leaves if it has grown at least this share of what its branch has grown on past it
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// The crown's outline: how far its branches reach (as a share of half the
// crown's width) at each height in it (t: 0 its bottom, 1 its top).
//
// An oak's own is a broad dome, widest at WIDEST of the way up, flatter
// underneath. The five settings (OUTLINE: the reach at the bottom, at each
// quarter, at the top) reshape it: the three in the middle stretch the
// dome in and out at their heights (each by its setting over the dome's own
// there, blended smoothly from one to the next), and the two at the ends
// open the bottom or the top out flat, fading to nothing a quarter of the
// way in. At the settings an oak starts with, that's the dome itself, to
// the last digit: the same oak for a seed as before the outline could be
// drawn.
export const OUTLINE = ['reachBottom', 'reachLow', 'reachMid', 'reachHigh', 'reachTop'];
const WIDEST = 0.38;
const dome = (t) => {
  const u = t < WIDEST ? (WIDEST - t) / WIDEST : (t - WIDEST) / (1 - WIDEST);
  return Math.pow(Math.max(0, 1 - Math.pow(u, t < WIDEST ? 3 : 2)), 0.5);
};
export function outlineOf(shape = OAK_SHAPE) {
  const [bottom, low, mid, high, top] = OUTLINE.map((key) => shape[key] ?? OAK_SHAPE[key]);
  // (The middle three over the dome's own, held to the ends.)
  const over = [low / OAK_SHAPE.reachLow, low / OAK_SHAPE.reachLow, mid / OAK_SHAPE.reachMid, high / OAK_SHAPE.reachHigh, high / OAK_SHAPE.reachHigh];
  return (t) => {
    if (!(t >= 0 && t <= 1)) return 0;
    const at = t * 4, i = Math.min(3, Math.floor(at)), f = at - i;
    const stretched = over[i] + (over[i + 1] - over[i]) * f * f * (3 - 2 * f);
    const open = t < 0.25 ? bottom * (1 - t * 4) ** 2 : t > 0.75 ? top * (t * 4 - 3) ** 2 : 0;
    return Math.min(1.3, dome(t) * stretched + open);
  };
}
// Where an outline is widest (t), and how much room it holds beside the
// dome's own (1: as much).
const SLICES = 100;
function measured(outline) {
  let widest = 0, most = -1, room = 0;
  for (let i = 0; i <= SLICES; i++) {
    const r = outline(i / SLICES);
    room += r * r;
    if (r > most) { most = r; widest = i / SLICES; }
  }
  return { widest, room };
}


export function buildOak(seed, shape = OAK_SHAPE) {
  return meshOak(layoutOak(seed, shape));
}

// The i-th of an endless row of shares of 1 that never bunch: 0, 1/2, 1/4,
// 3/4, 1/8, ... (so a limb added to a tree lands between the ones there).
const spreadOut = (i) => {
  let share = 0;
  for (let f = 0.5; i > 0; i >>= 1, f /= 2) if (i & 1) share += f;
  return share;
};

export function layoutOak(seed, shape = OAK_SHAPE) {
  const part = partOf(seed >>> 0);
  const one = (name, which) => part(name, which)();
  const between = ([a, b], name) => a + (b - a) * one(name);
  const count = ([a, b], name) => Math.round(a) + Math.floor(one(name) * (Math.round(b) - Math.round(a) + 1));

  const height = between(shape.height, 'height');
  const width = height * between(shape.spread, 'spread');
  const bare = Math.min(between(shape.trunk, 'trunk'), height * 0.75);
  const girth = between(shape.girth, 'girth');
  // (How many times as wide and tall as the usual biggest crown, for its
  // detail; and so how many times the points, the wood and the clusters.)
  const big = Math.min(MOST, Math.max(1, Math.sqrt((height * width) / USUAL)));
  const more = big * big;
  // Every oak is grown as the usual oak of its seed (USUAL_OAK's height,
  // width and bare trunk), and then fitted to its own. So its height, its
  // crown's width and its bare trunk stretch the tree, and regrow nothing.
  const grow = USUAL_OAK;
  // (More points in a crown still bigger for them: they lie a little
  // further apart, and a branch's step with them.)
  const step = grow.height / STEPS / Math.pow(big, 2 / 3);
  const crownBottom = Math.max(0.3, grow.bare * 0.95);
  const crownTop = grow.height;

  // --- 1. The crown's space ---------------------------------------------------------

  const lumps = part('crown');
  const lobes = Array.from({ length: 5 }, () => ({ k: 2 + Math.floor(lumps() * 4), phase: lumps() * Math.PI * 2, size: 0.06 + lumps() * 0.08 }));
  const outline = outlineOf(shape);
  const { widest, room } = measured(outline);
  const radiusAt = (y, angle) => {
    const t = (y - crownBottom) / (crownTop - crownBottom);
    if (t < 0 || t > 1) return 0;
    const lumpy = 1 + lobes.reduce((s, l) => s + l.size * Math.sin(l.k * angle + l.phase + t * 3), 0);
    return (grow.width / 2) * outline(t) * lumpy;
  };
  // (The same points, in the crown's own proportions, however many are
  // asked for: a fuller or bigger crown has these and more.)
  const points = [];
  const scatter = part('points');
  // (As many as the outline has room for, beside the dome's own: a slim
  // crown isn't packed with a broad one's branches.)
  const roomy = Math.min(2, Math.max(0.3, room / measured(outlineOf()).room));
  const wanted = Math.round((220 + 520 * shape.leafiness) * more * roomy);
  for (let tries = 0; points.length < wanted && tries < wanted * 40; tries++) {
    const x = (scatter() * 2 - 1) * grow.width * 0.65, z = (scatter() * 2 - 1) * grow.width * 0.65;
    const y = crownBottom + scatter() * (crownTop - crownBottom);
    if (Math.hypot(x, z) <= radiusAt(y, Math.atan2(z, x))) points.push({ p: [x, y, z], alive: true });
  }

  // --- 2. Trunk and limbs -----------------------------------------------------------

  const nodes = [];
  const node = (p, parent, grows = true) => {
    const n = { p, parent, children: [], grows, limb: parent?.limb ?? null, i: nodes.length };
    nodes.push(n);
    if (parent) parent.children.push(n);
    return n;
  };
  const crook = 0.08 + shape.crooked * 0.25;
  let tip = node([0, 0, 0], null, false);
  // The trunk carries on as a leader a little way into the crown, the
  // limbs leaving it at different heights (each limb at its own, whatever
  // the others do: the first lowest, the next halfway up, then between).
  // (As far as 0.3 of the way up the crown under the dome, whose widest is
  // at WIDEST; further under a crown that's widest higher up, less far
  // under one widest low down.)
  const leads = Math.min(0.8, Math.max(0.15, 0.3 + 0.79 * (widest - WIDEST)));
  const leaderTop = grow.bare + (crownTop - grow.bare) * leads;
  const limbCount = count(shape.limbs, 'limbs');
  const limbs = Array.from({ length: limbCount }, (_, i) => {
    const own = part('limb', i);
    const up = spreadOut(i) * 0.85 * (0.8 + own() * 0.4); // (how far up the leader, as a share of it)
    return { index: i, up, at: grow.bare + (leaderTop - grow.bare) * up, turn: (own() - 0.5) * 0.5, tilt: (own() - 0.5) * 12, phase: own() * Math.PI * 2 };
  });
  const limbAt = new Map();
  const wander = part('trunk');
  for (let y = step; y <= leaderTop + 1e-6; y += step) {
    const q = tip.p;
    const far = y > grow.bare ? crook * step : crook * step * 0.25;
    tip = node([q[0] + (wander() - 0.5) * far, y, q[2] + (wander() - 0.5) * far], tip, y >= grow.bare * 0.95);
    for (const limb of limbs) if (!limbAt.has(limb.index) && y >= limb.at) limbAt.set(limb.index, tip);
  }
  // Each limb: a few steps out at its own heading (a spiral), lower ones
  // nearer level, to start it growing that way.
  const first = one('heading') * Math.PI * 2;
  for (const limb of limbs) {
    const from = limbAt.get(limb.index) ?? tip;
    const heading = first + (limb.index + 1) * GOLDEN + limb.turn;
    const low = 1 - Math.min(1, limb.up / 0.85);
    const tilt = (35 + 35 * low + limb.tilt) * (Math.PI / 180);
    const dir = [Math.cos(heading) * Math.sin(tilt), Math.cos(tilt), Math.sin(heading) * Math.sin(tilt)];
    let n = from;
    const sways = { phase: limb.phase, heading, index: limb.index };
    for (let s = 0; s < 3; s++) {
      n = node([n.p[0] + dir[0] * step, n.p[1] + dir[1] * step, n.p[2] + dir[2] * step], n);
      n.limb = sways;
    }
  }

  // --- 3. Growing into the crown ------------------------------------------------------

  const reach = step * 9;     // a point pulls the nearest branch tip within this
  const used = step * 2.2;    // and is used up once a branch comes this near
  const cellOf = (v, size) => Math.floor(v / size) + 512;
  const keyOf = (x, y, z) => (x * 1024 + y) * 1024 + z;
  const into = (grid, n, size) => {
    const k = keyOf(cellOf(n.p[0], size), cellOf(n.p[1], size), cellOf(n.p[2], size));
    const cell = grid.get(k);
    if (cell) cell.push(n);
    else grid.set(k, [n]);
  };
  const grid = new Map();
  for (const n of nodes) if (n.grows) into(grid, n, reach);
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  // The nearest of a grid's nodes to p, within `within` (the grid's cells
  // are that wide), or none.
  const nearest = (grid, p, within) => {
    const cx = cellOf(p[0], within), cy = cellOf(p[1], within), cz = cellOf(p[2], within);
    let best = null, bestD = within * within;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const cell = grid.get(keyOf(cx + dx, cy + dy, cz + dz));
      if (!cell) continue;
      for (const n of cell) {
        const d = d2(p, n.p);
        if (d < bestD) { bestD = d; best = n; }
      }
    }
    return best ? { node: best, d: bestD } : null;
  };
  // The zig-zag: a smooth pattern of pushes over the tree, in steps (one
  // and a half of them between unrelated pushes), so the same place in the
  // same tree is pushed the same way whatever grew before it.
  const pushes = pushesOf(part('zig-zag')() * 2 ** 31);
  const push = [0, 0, 0];
  const grain = step * 1.5;
  const maxNodes = Math.round(MAX_NODES * more);

  for (let round = 0; round < 220 && nodes.length < maxNodes; round++) {
    const pulls = new Map();
    let alive = 0;
    for (const a of points) {
      if (!a.alive) continue;
      alive++;
      const found = nearest(grid, a.p, reach);
      if (!found) continue;
      const best = found.node, len = Math.sqrt(found.d) || 1;
      const v = pulls.get(best) ?? [0, 0, 0];
      v[0] += (a.p[0] - best.p[0]) / len; v[1] += (a.p[1] - best.p[1]) / len; v[2] += (a.p[2] - best.p[2]) / len;
      pulls.set(best, v);
    }
    if (!alive || !pulls.size) break;
    const grown = [];
    for (const [n, v] of pulls) {
      // A little toward the light, and a zig-zag.
      const l = Math.hypot(...v) || 1;
      pushes(n.p[0] / grain, n.p[1] / grain, n.p[2] / grain, push);
      const zig = shape.crooked * 1.6;
      const dir = [v[0] / l + push[0] * zig, v[1] / l + 0.12 + push[1] * zig * 0.6, v[2] / l + push[2] * zig];
      const dl = Math.hypot(...dir) || 1;
      const p = [n.p[0] + (dir[0] / dl) * step, n.p[1] + (dir[1] / dl) * step, n.p[2] + (dir[2] / dl) * step];
      if (n.children.some((c) => d2(c.p, p) < (step * 0.4) ** 2)) continue;
      const child = node(p, n);
      if (!child.limb) child.limb = n.limb;
      grown.push(child);
      if (nodes.length >= maxNodes) break;
    }
    if (!grown.length) break;
    const fresh = new Map();
    for (const g of grown) {
      into(grid, g, reach);
      into(fresh, g, used);
    }
    for (const a of points) if (a.alive && nearest(fresh, a.p, used)) a.alive = false;
  }

  // --- 4. Fitted to its own size, and thickness from the tips down ----------------------------

  // The usual oak's crown onto this one's: as wide as asked, from its own
  // bare trunk up to its own height; its trunk below, as long as asked.
  const foot = Math.max(0.3, bare * 0.95); // (where its own crown starts)
  const wider = width / grow.width, longer = foot / crownBottom, taller = (height - foot) / (crownTop - crownBottom);
  for (const n of nodes) {
    n.p[0] *= wider;
    n.p[2] *= wider;
    n.p[1] = n.p[1] <= crownBottom ? n.p[1] * longer : foot + (n.p[1] - crownBottom) * taller;
  }

  const order = nodes.slice().sort((a, b) => b.i - a.i); // children before parents
  for (const n of order) {
    n.r = n.children.length ? Math.pow(n.children.reduce((s, c) => s + c.r ** PIPE, 0), 1 / PIPE) : 1;
  }
  const root = nodes[0];
  const scale = girth / root.r;
  for (const n of nodes) {
    n.r *= scale;
    n.own = n.r; // (its own thickness: the mesher spreads the foot itself, by the "flare")
    if (n.p[1] < 1.2) n.r *= 1 + 0.35 * Math.exp(-n.p[1] / 0.45); // the swollen foot
  }
  // (As drawn: never thinner than a twig, and still thinner than what it grows from.)
  const thick = (n) => Math.hypot(n.r, TWIG);

  // --- 5. Sag, drawn wood, leaves ------------------------------------------------------------

  // Long limbs sag, more the further out they reach (their tips most).
  const halfWidth = width / 2;
  for (const n of nodes) {
    const out = Math.hypot(n.p[0], n.p[2]) / halfWidth;
    if (n.p[1] > bare) n.p[1] = Math.max(0.15, n.p[1] - shape.droop * 0.3 * width * Math.pow(Math.min(1.4, out), 2.2)); // (at most down to the ground)
  }
  // (How far it is from each step out to the farthest tip it carries, m:
  // little for young wood near the crown's edge, much for an old limb.)
  for (const n of order) {
    n.out = 0;
    for (const c of n.children) n.out = Math.max(n.out, c.out + Math.sqrt(d2(c.p, n.p)));
  }

  // Only the thickest DRAWN steps are wood; the twigs beyond become leaves.
  const radii = nodes.map((n) => n.r).sort((a, b) => b - a);
  const cut = radii[Math.min(radii.length - 1, Math.round(DRAWN * more))];
  for (const n of nodes) n.drawn = n === root || n.r > cut;
  for (const n of order) if (n.drawn && n.parent) n.parent.drawn = true;

  // How far out along its limb each step is (for the sway).
  const swayOf = (n) => {
    let along = 0;
    for (let m = n; m.parent && m.limb; m = m.parent) along += Math.sqrt(d2(m.p, m.parent.p));
    return shape.sway * Math.min(1, along / Math.max(1, halfWidth));
  };
  const limbOf = (n, r0, r1) => (n.limb ? { phase: n.limb.phase, heading: n.limb.heading, reach0: r0, reach1: r1 } : { phase: 0, heading: 0, reach0: 0, reach1: 0 });

  // Leaves: a cluster over every group of twigs too fine to draw, wherever
  // it leaves the drawn wood (all along the branches, not only at their
  // ends); clusters close together are merged until there are few enough.
  // Then only those with light enough keep their leaves, taken from the
  // top down (./crownLight.js): the rest of the twigs stay bare.
  // (On a small crown the clusters are smaller too: a sapling's leaves
  // don't come in 2 m balls.)
  const small = Math.min(1, width / 8);
  const [cLo, cHi] = shape.clumpSize.map((r) => r * small);
  let clusters = [];
  const stops = []; // (twigs that stopped growing long ago, and are bare: where, and which way they grew)
  const twigsOf = (start) => {
    const twigs = [];
    const stack = [start];
    while (stack.length) {
      const m = stack.pop();
      twigs.push(m);
      stack.push(...m.children);
    }
    return twigs;
  };
  // (A cluster can be no bigger than its own leaves allow light to its
  // underside: a group of twigs wider than that carries several, spread
  // over it.)
  const least = leastFor(shape.leafiness);
  const fill = 0.85 + 0.35 * shape.leafiness;
  const most = Math.min(cHi, biggest(least, shape.squash) / fill);
  const middle = (twigs) => [0, 1, 2].map((k) => twigs.reduce((s, m) => s + m.p[k], 0) / twigs.length);
  // (end: the twigs are a drawn branch's own end, not twigs off its side.)
  const cluster = (twigs, n, end) => {
    const centres = [middle(twigs)];
    for (let extra = 0; extra < 5; extra++) {
      let far = null, farthest = (most * 1.1) ** 2;
      for (const m of twigs) {
        const d = Math.min(...centres.map((q) => d2(m.p, q)));
        if (d > farthest) { farthest = d; far = m.p; }
      }
      if (!far) break;
      centres.push(far);
    }
    const groups = centres.map(() => []);
    for (const m of twigs) {
      let near = 0;
      for (let i = 1; i < centres.length; i++) if (d2(m.p, centres[i]) < d2(m.p, centres[near])) near = i;
      groups[near].push(m);
    }
    for (const group of groups) {
      if (!group.length) continue;
      // (A twig off the side of a branch that has since run on many times
      // as far as the twig ever grew stopped growing long ago, shaded out
      // as the crown closed over it: it's bare now. Most twigs low down
      // and deep inside the crown are such.)
      const far = Math.sqrt(Math.max(...group.map((m) => d2(m.p, n.p))));
      if (!end && far < KEEPS_UP * Math.max(0.5, n.out)) {
        stops.push({ n, toward: middle(group) });
        continue;
      }
      const c = middle(group);
      const extent = Math.sqrt(Math.max(...group.map((m) => d2(m.p, c))));
      // (Which of its branch's clusters it is: its lumps are its own.)
      n.clusters = (n.clusters ?? 0) + 1;
      clusters.push({ c, r: Math.min(most, Math.max(Math.min(cLo, most), extent + cLo * 0.5)), w: group.length, n, twigs: group, end, far, id: n.i * 8 + Math.min(7, n.clusters - 1) });
    }
  };
  for (const n of nodes) {
    if (!n.drawn) continue;
    const fine = n.children.filter((c) => !c.drawn);
    if (!n.children.some((c) => c.drawn)) cluster(twigsOf(n), n, true); // a drawn branch's end
    else for (const f of fine) if (n.p[1] > bare) cluster(twigsOf(f), n, false); // twigs off its side
  }
  const candidates = Math.round(CANDIDATES * more);
  for (let size = cLo; clusters.length > candidates; size *= 1.25) {
    const cells = new Map();
    for (const k of clusters) {
      const id = k.c.map((v) => Math.floor(v / size)).join(',');
      const held = cells.get(id);
      if (!held) { cells.set(id, { ...k }); continue; }
      const w = held.w + k.w;
      held.c = held.c.map((v, i) => (v * held.w + k.c[i] * k.w) / w);
      held.r = Math.min(most * 1.15, Math.max(held.r, k.r) * 1.08);
      held.w = w;
      held.twigs = held.twigs.concat(k.twigs);
      held.end = held.end || k.end;
      held.far = Math.max(held.far, k.far);
    }
    clusters = [...cells.values()];
  }
  const places = clusters.map((k) => {
    const r = k.r * fill;
    return { center: [k.c[0], k.c[1] + r * shape.squash * 0.25, k.c[2]], radius: r, squash: shape.squash, n: k.n, twigs: k.twigs, end: k.end, far: k.far, id: k.id };
  });
  // (Should more than can be drawn keep their leaves, the dimmest go without.)
  const neighbours = shape.crowded > 0 ? { top: height, away: width / shape.crowded } : null;
  const lit = leafy(places, least, neighbours).sort((a, b) => b.light - a.light).slice(0, Math.round(CLUMPS * more)).sort((a, b) => b.center[1] - a.center[1]);
  const clumps = lit.map((k) => {
    const sways = swayOf(k.n);
    const own = part('cluster', k.id);
    return {
      center: k.center, radius: k.radius, squash: shape.squash * (0.9 + own() * 0.2),
      turn: own() * Math.PI * 2, rough: shape.rough, seed: Math.floor(own() * 2 ** 31), shade: 0.9 + own() * 0.15,
      limb: limbOf(k.n, sways, sways),
    };
  });

  // Each of them on its twig: the twig nearest its middle is drawn, back
  // to the wood, and on into the cluster if it stops short of it.
  const stalks = [];
  for (const k of lit) {
    let twig = k.twigs[0];
    for (const m of k.twigs) if (d2(m.p, k.center) < d2(twig.p, k.center)) twig = m;
    for (let m = twig; m && !m.drawn; m = m.parent) m.drawn = true;
    const dy = twig.p[1] - k.center[1];
    const within = ((twig.p[0] - k.center[0]) ** 2 + (twig.p[2] - k.center[2]) ** 2) / k.radius ** 2 + (dy / (k.radius * k.squash * (dy < 0 ? 0.6 : 1))) ** 2;
    if (within > 0.5) stalks.push({ twig, to: k.center });
  }

  // The trunk's own bends: a smooth pattern up it (a broad one, and a finer
  // one on it where the trunk's steps are close enough to follow it), none
  // at the ground. Whatever is at a height goes with the trunk there; above
  // its top, with its top. It comes after the leaves are placed, so it
  // moves the tree and regrows nothing: the same wood, the same clusters.
  if (shape.bends > 0) {
    const pattern = pushesOf(part('bends')() * 2 ** 31);
    const apart = step * Math.max(longer, 1); // m: the trunk's steps
    const between = Math.max(2 + 3.5 * girth, 3 * apart); // m from one bend to the next
    const fine = between / 2.3 >= 2.5 * apart ? 0.35 : 0;
    const far = shape.bends * (0.7 + 0.6 * girth) * 3.2; // m, at most (the pattern's numbers are within a half, and mostly well within)
    const top = foot + (leaderTop - crownBottom) * taller;
    const a = [0, 0, 0], b = [0, 0, 0];
    const carry = (p) => {
      const y = Math.min(top, Math.max(0, p[1]));
      const rooted = Math.min(1, y / Math.max(0.8 + 2 * girth, 0.75 * between)); // (it leaves the ground upright, and bends away over this height)
      const held = far * rooted * rooted * (3 - 2 * rooted);
      pattern(y / between, 0.5, 0.5, a);
      pattern((y * 2.3) / between, 7.5, 0.5, b);
      p[0] += held * (a[0] + fine * b[0]);
      p[2] += held * (a[2] + fine * b[2]);
    };
    for (const n of nodes) carry(n.p);
    for (const k of lit) carry(k.center);
    for (const stop of stops) carry(stop.toward);
  }

  // The wood as runs: from each run's start, carry on through the thickest
  // drawn child; the others start runs of their own. Steps that barely turn
  // are merged, so a straight stretch is one piece.
  const segments = [];
  const runs = []; // (for the mesher: each run whole, { points: [{ p, r, reach, phase, heading }], side, parent (its thickness where the run leaves it), trunk })
  const joins = []; // (each side branch's first thickness, and its parent's there)
  const reachOf = new Map();
  // (A run that starts at a branch: its first step leaves its parent.)
  const starts = [{ from: null, to: root }];
  while (starts.length) {
    const { from, to } = starts.shift();
    emit(from ? [from, ...collect(to)] : collect(to), Boolean(from));
  }
  function collect(n) {
    const out = [n];
    for (;;) {
      const drawn = n.children.filter((c) => c.drawn).sort((a, b) => b.r - a.r || a.i - b.i);
      if (!drawn.length) return out;
      starts.push(...drawn.slice(1).map((c) => ({ from: n, to: c })));
      n = drawn[0];
      out.push(n);
    }
  }
  function emit(path, side) {
    // Keep a step where the run turns, every few steps, and its ends (a
    // twig's turns matter less than a limb's).
    const kept = [path[0]];
    let last = 0;
    for (let i = 1; i < path.length - 1; i++) {
      const a = kept.at(-1).p, b = path[i].p, c = path[i + 1].p;
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], bc = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
      const cos = (ab[0] * bc[0] + ab[1] * bc[1] + ab[2] * bc[2]) / ((Math.hypot(...ab) * Math.hypot(...bc)) || 1);
      const turn = path[i].r < 0.035 ? 26 : 9;
      if (cos < Math.cos((turn * Math.PI) / 180) || i - last >= 4) {
        kept.push(path[i]);
        last = i;
      }
    }
    kept.push(path.at(-1));
    const sways = kept.map((n, i) => (i === 0 ? reachOf.get(n) ?? swayOf(n) : swayOf(n)));
    runs.push({
      side, parent: side ? thick(kept[0]) : 0, trunk: !side && kept[0] === root,
      points: kept.map((n, i) => {
        const of = i === 0 && side ? kept[1] : n; // (a side run's first point is on its parent: the thickness and the limb are its own)
        const limb = limbOf(of, 0, 0);
        return { p: n.p, r: Math.hypot(of.own, TWIG), reach: sways[i], phase: limb.phase, heading: limb.heading };
      }),
    });
    for (let i = 0; i < kept.length - 1; i++) {
      const a = kept[i], b = kept[i + 1];
      // A side branch's first piece starts as thick as itself (a little
      // more, a collar), not as thick as the parent it leaves.
      const r0 = i === 0 && side ? Math.min(thick(b) * 1.08, (thick(a) + thick(b)) / 2) : thick(a);
      if (i === 0 && side) joins.push({ r0, parent: thick(a) });
      const reach0 = reachOf.get(a) ?? swayOf(a), reach1 = swayOf(b);
      reachOf.set(b, reach1);
      segments.push({ from: a.p, to: b.p, r0, r1: thick(b), limb: limbOf(b, reach0, reach1) });
    }
  }
  // (runs() in the mesher chains pieces whose ends are the same array: a
  // run's pieces share their nodes' positions, and each run comes whole.)
  for (const { twig, to } of stalks) {
    const sways = swayOf(twig), limb = limbOf(twig, sways, sways);
    segments.push({ from: twig.p, to, r0: thick(twig), r1: TWIG, limb });
    const end = { reach: sways, phase: limb.phase, heading: limb.heading };
    runs.push({ stalk: true, side: true, parent: 0, trunk: false, points: [{ p: twig.p, r: thick(twig), ...end }, { p: to, r: TWIG, ...end }] });
  }

  // --- 6. The trunk's marks -----------------------------------------------------------------

  // Its roots: five to seven, round its foot, each with its own strength
  // and width (as an angle), running out as far as "roots" says.
  const rooting = part('roots');
  const rootCount = 5 + Math.floor(rooting() * 3);
  const rootTurn = rooting() * Math.PI * 2;
  const roots = Array.from({ length: rootCount }, (_, i) => ({
    angle: rootTurn + ((i + (rooting() - 0.5) * 0.6) / rootCount) * Math.PI * 2,
    strength: 0.55 + rooting() * 0.45, wide: 0.3 + rooting() * 0.22,
    long: shape.roots * girth * (2.5 + rooting() * 4), seed: Math.floor(rooting() * 2 ** 31),
  }));
  // Its burrs and hollows: on the bare trunk, each at its own height and
  // side, sized by the trunk's thickness.
  // (Low down: a burr's own number puts it nearer the foot the less
  // "marksHigh" is; at 1, anywhere up the bare trunk, as likely here as
  // there. And the higher, the smaller.)
  const aged = agedBy(girth), high = Math.min(1, Math.max(0, shape.marksHigh));
  const low = (share) => Math.pow(share, 1 + 2 * (1 - high));
  const burrs = Array.from({ length: Math.round(shape.burrs * 8 * aged) }, (_, i) => {
    const own = part('burr', i);
    const y = 0.35 + low(own()) * Math.max(0.4, bare + girth - 0.35);
    const less = 0.55 + 0.45 * markedAt(y, girth, high);
    return { y, angle: own() * Math.PI * 2, size: girth * (0.22 + own() * 0.3) * less, tall: girth * (0.1 + own() * 0.2) * less };
  });
  const hollows = Array.from({ length: Math.round(shape.hollows * 3) }, (_, i) => {
    const own = part('hollow', i);
    const wide = girth * (0.5 + own() * 0.4);
    return { y: 0.45 + girth * 0.5 + low(own()) * Math.max(0.3, bare - 1), angle: own() * Math.PI * 2, wide, tall: wide * (1.4 + own() * 1.2), depth: girth * (0.45 + own() * 0.2) };
  });
  // Its stubs: what's left of branches long dead. On the limbs, where the
  // thickest wood carries a twig that stopped (the thicker the wood, the
  // sooner); on the bare trunk, at heights and sides of their own.
  const stubLike = (own, parent) => ({ r: Math.min(0.14, Math.max(0.018, parent * (0.13 + own() * 0.14))), long: 0.12 + own() * 0.4 + parent * 0.3, seed: Math.floor(own() * 2 ** 31) });
  const onLimbs = stops.filter(({ n }) => thick(n) > Math.max(0.05, girth * 0.14)).sort((a, b) => b.n.r - a.n.r || a.n.i - b.n.i).slice(0, Math.round(shape.stubs * 10 * more));
  const stubs = onLimbs.map(({ n, toward }) => {
    const sways = swayOf(n), limb = limbOf(n, sways, sways);
    const way = [toward[0] - n.p[0], toward[1] - n.p[1], toward[2] - n.p[2]];
    const far = Math.hypot(...way) || 1;
    return { p: n.p, toward: way.map((v) => v / far), parent: thick(n), reach: sways, phase: limb.phase, heading: limb.heading, ...stubLike(part('stub', n.i), thick(n)) };
  });
  const onTrunk = Math.round(shape.stubs * 5 * Math.min(2, Math.max(0.3, bare / 3)));
  for (let i = 0; i < onTrunk; i++) {
    const own = part('trunk stub', i);
    stubs.push({ y: bare * (0.3 + own() * 0.65), angle: own() * Math.PI * 2, rise: (10 + own() * 30) * (Math.PI / 180), ...stubLike(own, girth) });
  }

  const lean = { angle: (between(shape.lean, 'lean') * Math.PI) / 180, toward: one('lean toward') * Math.PI * 2 };
  // (Drawn by the workshop's mesher as its broadleaf: its bark colours.)
  const limbStarts = [...limbAt.values()].map((n) => n.p[1]);
  return {
    kind: 'broadleaf', segments, clumps, tiers: [], lean,
    // (How the leaves are drawn: as clusters, or as masses, ./leafMass.js.)
    leaves: { merged: shape.masses >= 0.5, cell: shape.coarse, rough: shape.rough, noise: shape.noise / 100, pattern: patternFrom({ type: NOISE_TYPES[Math.round(shape.noiseType)], size: shape.noiseSize, detail: shape.noiseDetail, bend: shape.noiseBend, billow: shape.noiseBillow }), merge: shape.merge / 100, seed: Math.floor(one('leaf noise') * 2 ** 31) },
    // (For the oak's own mesher, ./oakMesh.js.)
    // (gnarl: as asked, by the trunk's thickness; marks: how it thins out with height.)
    wood: { seed: Math.floor(one('wood') * 2 ** 31), girth, bare, height, gnarl: shape.gnarl * aged, marks: { high, girth }, flare: shape.flare, runs, roots, burrs, hollows, stubs },
    oak: {
      height, width, bare, girth, nodes: nodes.length, points: points.length, joins, limbStarts, places: places.length, stopped: stops.length, big,
      // (Each kept cluster: whether it's a branch's end, how far its wood is from the crown's edge, and the light under it.)
      kept: lit.map((k) => ({ end: k.end, out: k.n.out, far: k.far, light: k.light })),
    },
  };
}
