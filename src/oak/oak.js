import { meshTree, mulberry32 } from '@workshop/treeShapes.js';

// TreeLab's English oak (Quercus robur), grown at its real size.
//
// Unlike the workshop's trees (a fixed recipe: so many limbs from the top of
// the trunk), an oak's branches grow into the space of its crown and compete
// for it, so they branch unevenly and from all along their parents
// ("space colonisation", Runions, Lane and Prusinkiewicz, 2007):
//
//   1. the crown's space: an oak's broad dome, widest a little below its
//      middle, flatter underneath, lumpy, filled with points to grow toward;
//   2. the trunk, bare up to the first limbs, then the big limbs, setting
//      off at different heights and turning in a spiral round it;
//   3. every branch tip grows a step toward the points near it, and points a
//      branch has reached are used up, until the crown is filled;
//   4. thickness from the tips down: a branch is as thick as the branches it
//      carries together (their cross-sections add up), scaled so the trunk
//      is the girth asked for, with a swollen foot;
//   5. long limbs sag with their length; the wood is thinned to what can be
//      drawn, and the twigs beyond it become clusters of leaves.
//
// The layout it makes is in the workshop's own format, so the workshop's
// mesher (src/treeShapes.js meshTree, an exact copy) draws it: tubes that
// sink into their parents, shaded leaf clumps, and the numbers the sway reads.
// A side branch starts as thick as itself, never as its parent: it can't
// break out through the bark.

// The shape: ranges are [least, most]; each tree draws its own value.
export const OAK_SHAPE = {
  height: [17, 22],        // m: to the top of the crown
  spread: [1, 1.3],        // the crown's width over the tree's height
  trunk: [2.5, 4],         // m: bare trunk, up to the first big limbs
  girth: [0.5, 0.7],       // m: the trunk's radius just above its foot
  lean: [0, 3],            // degrees
  limbs: [3, 5],           // big limbs the trunk divides into
  crooked: 0.35,           // how much the branches zig-zag (0 straight)
  droop: 0.2,              // how much long limbs sag (0 none)
  leafiness: 0.65,         // how full the crown is
  clumpSize: [1.6, 2.8],   // m: a cluster of leaves, its radius
  squash: 0.9,             // a cluster's height over its width
  rough: 0.25,             // how lumpy the clusters are
  sway: 0.04,              // m a branch tip bobs per m/s of wind
};

// Each setting's slider: [least, most, step].
export const OAK_LIMITS = {
  height: [2, 35, 0.5], spread: [0.4, 1.8, 0.05], trunk: [0.3, 15, 0.1], girth: [0.03, 1.5, 0.01], lean: [0, 25, 0.5],
  limbs: [2, 8, 1], crooked: [0, 1, 0.01], droop: [0, 1, 0.01], leafiness: [0, 1, 0.01], clumpSize: [0.3, 4, 0.05],
  squash: [0.3, 1.5, 0.01], rough: [0, 0.6, 0.01], sway: [0, 0.15, 0.002],
};

const STEPS = 34;          // a branch step is the tree's height over this
const MAX_NODES = 4000;    // growth stops here whatever happens
const DRAWN = 560;         // at most this many steps of wood are drawn
const CLUMPS = 84;         // and at most this many clusters of leaves
const PIPE = 2.2;          // thickness: a parent's radius^PIPE = the sum of its children's
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export function buildOak(seed, shape = OAK_SHAPE) {
  const tree = meshTree(layoutOak(seed, shape));
  barkOak(tree.wood, tree.height);
  return tree;
}

// An oak's bark: grey-brown, darker and browner at the foot, greyer up the
// limbs (the mesher colours it as the workshop's broadleaf).
const BARK_FOOT = [0.3, 0.25, 0.2];
const BARK_LIMBS = [0.43, 0.38, 0.31];
function barkOak(wood, height) {
  const position = wood.attributes.position, color = wood.attributes.color;
  for (let i = 0; i < color.count; i++) {
    const t = Math.min(1, Math.max(0, position.getY(i) / Math.max(1, height * 0.5)));
    const f = t * t * (3 - 2 * t);
    color.setXYZ(i, ...[0, 1, 2].map((k) => BARK_FOOT[k] + (BARK_LIMBS[k] - BARK_FOOT[k]) * f));
  }
  color.needsUpdate = true;
}

export function layoutOak(seed, shape = OAK_SHAPE) {
  const random = mulberry32(seed >>> 0);
  const between = ([a, b]) => a + (b - a) * random();
  const count = ([a, b]) => Math.round(a) + Math.floor(random() * (Math.round(b) - Math.round(a) + 1));

  const height = between(shape.height);
  const width = height * between(shape.spread);
  const bare = Math.min(between(shape.trunk), height * 0.75);
  const girth = between(shape.girth);
  const step = Math.max(0.12, height / STEPS);
  const crownBottom = Math.max(0.3, bare * 0.95);
  const crownTop = height;

  // --- 1. The crown's space ---------------------------------------------------------

  const lobes = Array.from({ length: 5 }, () => ({ k: 2 + Math.floor(random() * 4), phase: random() * Math.PI * 2, size: 0.06 + random() * 0.08 }));
  const radiusAt = (y, angle) => {
    const t = (y - crownBottom) / (crownTop - crownBottom);
    if (t < 0 || t > 1) return 0;
    const c = 0.38; // widest here
    const u = t < c ? (c - t) / c : (t - c) / (1 - c);
    const profile = Math.pow(Math.max(0, 1 - Math.pow(u, t < c ? 3 : 2)), 0.5);
    const lumpy = 1 + lobes.reduce((s, l) => s + l.size * Math.sin(l.k * angle + l.phase + t * 3), 0);
    return (width / 2) * profile * lumpy;
  };
  const points = [];
  const wanted = Math.round(220 + 520 * shape.leafiness);
  for (let tries = 0; points.length < wanted && tries < wanted * 40; tries++) {
    const x = (random() * 2 - 1) * width * 0.65, z = (random() * 2 - 1) * width * 0.65;
    const y = crownBottom + random() * (crownTop - crownBottom);
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
  // limbs leaving it at different heights.
  const leaderTop = bare + (crownTop - bare) * 0.3;
  const limbCount = count(shape.limbs);
  const limbHeights = Array.from({ length: limbCount }, (_, i) => bare + (leaderTop - bare) * (i / Math.max(1, limbCount)) * (0.8 + random() * 0.4));
  const limbAt = new Map();
  let heading = random() * Math.PI * 2;
  for (let y = step; y <= leaderTop + 1e-6; y += step) {
    const q = tip.p;
    const wander = y > bare ? crook * step : crook * step * 0.25;
    tip = node([q[0] + (random() - 0.5) * wander, y, q[2] + (random() - 0.5) * wander], tip, y >= bare * 0.95);
    for (let i = 0; i < limbCount; i++) {
      if (!limbAt.has(i) && y >= limbHeights[i]) limbAt.set(i, tip);
    }
  }
  // Each limb: a few steps out at its own heading (a spiral), lower ones
  // nearer level, to start it growing that way.
  for (let i = 0; i < limbCount; i++) {
    const from = limbAt.get(i) ?? tip;
    heading += GOLDEN + (random() - 0.5) * 0.5;
    const low = 1 - i / Math.max(1, limbCount - 1);
    const tilt = (35 + 35 * low + (random() - 0.5) * 12) * (Math.PI / 180);
    const dir = [Math.cos(heading) * Math.sin(tilt), Math.cos(tilt), Math.sin(heading) * Math.sin(tilt)];
    let n = from;
    const limb = { phase: random() * Math.PI * 2, heading, index: i };
    for (let s = 0; s < 3; s++) {
      n = node([n.p[0] + dir[0] * step, n.p[1] + dir[1] * step, n.p[2] + dir[2] * step], n);
      n.limb = limb;
    }
  }

  // --- 3. Growing into the crown ------------------------------------------------------

  const reach = step * 9;     // a point pulls the nearest branch tip within this
  const used = step * 2.2;    // and is used up once a branch comes this near
  const cell = reach;
  const grid = new Map();
  const key = (p) => `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
  const index = (n) => {
    const k = key(n.p);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(n);
  };
  for (const n of nodes) if (n.grows) index(n);
  const near = (p) => {
    const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell);
    const out = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const n of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) out.push(n);
    }
    return out;
  };
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

  for (let round = 0; round < 160 && nodes.length < MAX_NODES; round++) {
    const pulls = new Map();
    let alive = 0;
    for (const a of points) {
      if (!a.alive) continue;
      alive++;
      let best = null, bestD = reach * reach;
      for (const n of near(a.p)) {
        const d = d2(a.p, n.p);
        if (d < bestD) { bestD = d; best = n; }
      }
      if (!best) continue;
      const len = Math.sqrt(bestD) || 1;
      const v = pulls.get(best) ?? [0, 0, 0];
      v[0] += (a.p[0] - best.p[0]) / len; v[1] += (a.p[1] - best.p[1]) / len; v[2] += (a.p[2] - best.p[2]) / len;
      pulls.set(best, v);
    }
    if (!alive || !pulls.size) break;
    const grown = [];
    for (const [n, v] of pulls) {
      // A little toward the light, and a zig-zag.
      const l = Math.hypot(...v) || 1;
      const dir = [v[0] / l + (random() - 0.5) * shape.crooked, v[1] / l + 0.12 + (random() - 0.5) * shape.crooked * 0.6, v[2] / l + (random() - 0.5) * shape.crooked];
      const dl = Math.hypot(...dir) || 1;
      const p = [n.p[0] + (dir[0] / dl) * step, n.p[1] + (dir[1] / dl) * step, n.p[2] + (dir[2] / dl) * step];
      if (n.children.some((c) => d2(c.p, p) < (step * 0.4) ** 2)) continue;
      const child = node(p, n);
      if (!child.limb) child.limb = n.limb;
      grown.push(child);
      if (nodes.length >= MAX_NODES) break;
    }
    if (!grown.length) break;
    for (const g of grown) index(g);
    for (const a of points) {
      if (!a.alive) continue;
      for (const g of grown) {
        if (d2(a.p, g.p) < used * used) { a.alive = false; break; }
      }
    }
  }

  // --- 4. Thickness, from the tips down ---------------------------------------------------

  const order = nodes.slice().sort((a, b) => b.i - a.i); // children before parents
  for (const n of order) n.leaves = n.children.length ? 0 : 1;
  for (const n of order) if (n.parent) n.parent.leaves += n.leaves;
  for (const n of order) {
    n.r = n.children.length ? Math.pow(n.children.reduce((s, c) => s + c.r ** PIPE, 0), 1 / PIPE) : 1;
  }
  const root = nodes[0];
  const scale = girth / root.r;
  for (const n of nodes) {
    n.r *= scale;
    if (n.p[1] < 1.2) n.r *= 1 + 0.35 * Math.exp(-n.p[1] / 0.45); // the swollen foot
  }

  // --- 5. Sag, drawn wood, leaves ------------------------------------------------------------

  // Long limbs sag, more the further out they reach (their tips most).
  const halfWidth = width / 2;
  for (const n of nodes) {
    const out = Math.hypot(n.p[0], n.p[2]) / halfWidth;
    n.p[1] -= shape.droop * 0.3 * width * Math.pow(Math.min(1.4, out), 2.2) * (n.p[1] > bare ? 1 : 0);
  }

  // Only the thickest DRAWN steps are wood; the twigs beyond become leaves.
  const radii = nodes.map((n) => n.r).sort((a, b) => b - a);
  const cut = radii[Math.min(radii.length - 1, DRAWN)];
  for (const n of nodes) n.drawn = n === root || n.r > cut;
  for (const n of order) if (n.drawn && n.parent) n.parent.drawn = true;

  // How far out along its limb each step is (for the sway).
  const swayOf = (n) => {
    let along = 0;
    for (let m = n; m.parent && m.limb; m = m.parent) along += Math.sqrt(d2(m.p, m.parent.p));
    return shape.sway * Math.min(1, along / Math.max(1, halfWidth));
  };
  const limbOf = (n, r0, r1) => (n.limb ? { phase: n.limb.phase, heading: n.limb.heading, reach0: r0, reach1: r1 } : { phase: 0, heading: 0, reach0: 0, reach1: 0 });

  // The wood as runs: from each run's start, carry on through the thickest
  // drawn child; the others start runs of their own. Steps that barely turn
  // are merged, so a straight stretch is one piece.
  const segments = [];
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
      const drawn = n.children.filter((c) => c.drawn).sort((a, b) => b.r - a.r);
      if (!drawn.length) return out;
      starts.push(...drawn.slice(1).map((c) => ({ from: n, to: c })));
      n = drawn[0];
      out.push(n);
    }
  }
  function emit(path, side) {
    // Keep a step where the run turns, every few steps, and its ends.
    const kept = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
      const a = kept.at(-1).p, b = path[i].p, c = path[i + 1].p;
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], bc = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
      const cos = (ab[0] * bc[0] + ab[1] * bc[1] + ab[2] * bc[2]) / ((Math.hypot(...ab) * Math.hypot(...bc)) || 1);
      if (cos < Math.cos((9 * Math.PI) / 180) || Math.sqrt(d2(a, b)) > step * 3.5) kept.push(path[i]);
    }
    kept.push(path.at(-1));
    for (let i = 0; i < kept.length - 1; i++) {
      const a = kept[i], b = kept[i + 1];
      // A side branch's first piece starts as thick as itself (a little
      // more, a collar), not as thick as the parent it leaves.
      const r0 = i === 0 && side ? b.r * 1.08 : a.r;
      if (i === 0 && side) joins.push({ r0, parent: a.r });
      const reach0 = reachOf.get(a) ?? swayOf(a), reach1 = swayOf(b);
      reachOf.set(b, reach1);
      segments.push({ from: a.p, to: b.p, r0, r1: b.r, limb: limbOf(b, reach0, reach1) });
    }
  }
  // (runs() in the mesher chains pieces whose ends are the same array: a
  // run's pieces share their nodes' positions, and each run comes whole.)

  // Leaves: a cluster over every group of twigs too fine to draw, wherever
  // it leaves the drawn wood (all along the branches, not only at their
  // ends); clusters close together are merged until there are few enough.
  // (On a small crown the clusters are smaller too: a sapling's leaves
  // don't come in 2 m balls.)
  const small = Math.min(1, width / 8);
  const [cLo, cHi] = shape.clumpSize.map((r) => r * small);
  let clusters = [];
  const twigsOf = (start) => {
    const twigs = [];
    const stack = [start];
    while (stack.length) {
      const m = stack.pop();
      twigs.push(m.p);
      stack.push(...m.children);
    }
    return twigs;
  };
  const cluster = (twigs, n) => {
    const c = [0, 1, 2].map((k) => twigs.reduce((s, p) => s + p[k], 0) / twigs.length);
    const extent = Math.sqrt(Math.max(...twigs.map((p) => d2(p, c))));
    clusters.push({ c, r: Math.min(cHi, Math.max(cLo, extent + cLo * 0.5)), w: twigs.length, n });
  };
  for (const n of nodes) {
    if (!n.drawn) continue;
    const fine = n.children.filter((c) => !c.drawn);
    if (!n.children.some((c) => c.drawn)) cluster(twigsOf(n), n); // a drawn branch's end
    else for (const f of fine) if (n.p[1] > bare) cluster(twigsOf(f), n); // twigs off its side
  }
  for (let size = cLo; clusters.length > CLUMPS; size *= 1.25) {
    const cells = new Map();
    for (const k of clusters) {
      const id = k.c.map((v) => Math.floor(v / size)).join(',');
      const into = cells.get(id);
      if (!into) { cells.set(id, { ...k }); continue; }
      const w = into.w + k.w;
      into.c = into.c.map((v, i) => (v * into.w + k.c[i] * k.w) / w);
      into.r = Math.min(cHi * 1.25, Math.max(into.r, k.r) * 1.08);
      into.w = w;
    }
    clusters = [...cells.values()];
  }
  const fill = 0.85 + 0.35 * shape.leafiness;
  const clumps = clusters.map((k) => {
    const r = k.r * fill;
    const reach = swayOf(k.n);
    return {
      center: [k.c[0], k.c[1] + r * shape.squash * 0.25, k.c[2]], radius: r, squash: shape.squash * (0.9 + random() * 0.2),
      turn: random() * Math.PI * 2, rough: shape.rough, seed: Math.floor(random() * 2 ** 31), shade: 0.9 + random() * 0.15,
      limb: limbOf(k.n, reach, reach),
    };
  });

  const lean = { angle: (between(shape.lean) * Math.PI) / 180, toward: random() * Math.PI * 2 };
  // (Drawn by the workshop's mesher as its broadleaf: its bark colours.)
  const limbStarts = [...limbAt.values()].map((n) => n.p[1]);
  return { kind: 'broadleaf', segments, clumps, tiers: [], lean, oak: { height, width, bare, girth, nodes: nodes.length, points: points.length, joins, limbStarts } };
}
