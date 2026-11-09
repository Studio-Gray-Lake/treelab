import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The trees' shapes, seeded: a handful of variants per kind, each one
// instanced many times (src/trees.js plants them).
//
// Three kinds:
//   - broadleaf: a trunk that splits into 2-4 branches, each carrying 1-3
//     clumps of leaves (squashed, roughened balls) at its tip and on short
//     twigs, so the crown is one canopy with lumps and dark gaps, and the
//     branches show under it;
//   - fir: tiers of drooping, jagged skirts, each turned against the last, on
//     a bit of bare trunk, the tree leaning a little;
//   - pine (a Scots pine): the broadleaf's branching on a tall, bare, slightly
//     crooked trunk, with flat dark clumps of needles at the top: a bridge
//     between the two.
//
// A tree is laid out first as plain numbers (layoutTree: segments of wood,
// clumps, tiers), then meshed (buildTree). Every vertex carries a "branch"
// attribute for the sway's second layer (src/treeSway.js): the phase of the
// limb it is on, how far it bobs (m per m/s of wind: 0 on the trunk, growing
// along a limb to its tip, the clumps moving with their limb's tip), and the
// limb's heading. The parts of one limb share a phase, so a clump never parts
// from its branch.

export const TREE_KINDS = ['broadleaf', 'fir', 'pine'];

// Ranges are [least, most]; counts are whole numbers in between. The
// defaults: taller trees, the broadleaves' crowns high on a long bare
// trunk, the firs and pines thicker.
export const TREE_SHAPES = {
  broadleaf: {
    trunk: [2.75, 4],        // m: the bare trunk, up to where it splits
    girth: 0.22,             // m: the trunk's radius at the ground
    lean: 4,                 // degrees, at most
    branches: [2, 4],
    length: [1, 1.8],        // m: a branch
    tilt: [25, 45],          // degrees from upright
    curl: 18,                // degrees: a branch's outer half turns this much more upright
    leader: 0.7,             // the chance one branch carries on nearly upright (3 or more)
    clumps: [2, 3],          // per branch: one at the tip, the others on twigs
    clumpSize: [1.2, 2],     // m: the tip clump's radius (twig clumps are smaller)
    core: 1.35,              // m: the radius of a clump over the split, tying the others into one crown (0: none)
    squash: 0.93,            // a clump's height over its width
    rough: 0.2,              // roughening, as a share of a clump's radius
    sway: 0.03,              // m a branch's tip bobs per m/s of wind
  },
  fir: {
    height: [7.4, 9],        // m: to the tip
    bare: [0.9, 3],          // m of bare trunk under the lowest tier
    girth: 0.3,
    lean: 3,
    tiers: [6, 8],
    radius: [1.75, 2.1],     // m: the lowest tier
    points: 7,               // branch tips round a tier
    droop: 0.3,              // m the tips hang below the tier's base (the lowest; higher ones less)
    jag: 0.3,                // how much shorter a tip can be, as a share
    sway: 0.026,             // m a tier's rim bobs per m/s of wind
  },
  pine: {
    height: [5.4, 9],        // m: the trunk, to its top
    girth: 0.33,
    lean: 5,
    crook: 0.52,             // m: how far the trunk wanders off straight
    crown: [0.6, 0.7],       // where the branches start, as a share of the height
    // (Two: a "least" of 3 over a "most" of 1 always drew two, and [2, 2]
    // draws the same trees, number for number.)
    branches: [2, 2],
    length: [1.1, 1.8],      // m: a branch (the higher ones shorter)
    tilt: [18, 72],          // degrees from upright: from steep to nearly level
    curl: 43,
    clumps: [1, 3],
    clumpSize: [0.65, 1.9],
    squash: 0.45,            // flat pads of needles
    rough: 0,
    stubs: [0, 3],           // dead stubs on the bare trunk
    sway: 0.02,
  },
};

const UP = new THREE.Vector3(0, 1, 0);
const deg = THREE.MathUtils.degToRad;

// Seeds for a kind's variants, from the forest's seed.
export function variantSeed(seed, kind, variant) {
  let h = (seed * 2654435761) ^ (TREE_KINDS.indexOf(kind) * 40503) ^ (variant * 2246822519);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  return (h ^ (h >>> 13)) >>> 0;
}

// --- Layout: the tree as numbers ------------------------------------------------

// A tree's skeleton: { kind, segments, clumps, tiers, lean }.
//   segment: { from, to ([x, y, z], m), r0, r1 (radius at each end), limb }
//   clump:   { center, radius, squash, turn, limb }
//   tier:    { base, height, radius, droop, turn, tips: [{ angle, length, drop }], limb } (firs)
//   limb:    { phase, heading, reach0, reach1 }: the sway's second layer
//            (reach at the segment's ends, m per m/s; a clump's reach is reach1)
//   lean:    { angle, toward } (radians): the whole tree tipped by angle toward a heading
export function layoutTree(kind, seed, shape = TREE_SHAPES[kind]) {
  const random = mulberry32(seed);
  const tree = { kind, segments: [], clumps: [], tiers: [], lean: { angle: deg(shape.lean) * random(), toward: random() * Math.PI * 2 } };
  if (kind === 'fir') layoutFir(tree, shape, random);
  else layoutBranching(tree, shape, random);
  return tree;
}

const still = { phase: 0, heading: 0, reach0: 0, reach1: 0 };

function layoutBranching(tree, shape, random) {
  const pine = tree.kind === 'pine';
  const between = ([a, b]) => a + (b - a) * random();
  const count = ([a, b]) => a + Math.floor(random() * (b - a + 1));

  // The trunk: a few straight pieces, each wandering a little off upright.
  const top = pine ? between(shape.height) : between(shape.trunk);
  const pieces = pine ? 3 : 2;
  const wander = pine ? shape.crook : 0.12;
  const trunk = [[0, 0, 0]];
  for (let i = 1; i <= pieces; i++) {
    const a = random() * Math.PI * 2, d = wander * random() * (i / pieces);
    trunk.push([Math.cos(a) * d, (top * i) / pieces, Math.sin(a) * d]);
  }
  const radiusAt = (y) => shape.girth * (1 - 0.55 * (y / top)) * (pine ? 1 - 0.35 * (y / top) : 1);
  for (let i = 0; i < pieces; i++) {
    tree.segments.push({ from: trunk[i], to: trunk[i + 1], r0: radiusAt(trunk[i][1]), r1: radiusAt(trunk[i + 1][1]), limb: still });
  }
  const trunkAt = (y) => {
    const i = Math.min(pieces - 1, Math.floor((y / top) * pieces));
    const f = (y - trunk[i][1]) / (trunk[i + 1][1] - trunk[i][1]);
    return trunk[i].map((v, k) => v + (trunk[i + 1][k] - v) * f);
  };

  // The branches, spread round evenly (with a little jitter), from just
  // under the split (broadleaf) or up the top third (pine).
  const n = count(shape.branches);
  const start = random() * Math.PI * 2;
  const leader = !pine && n >= 3 && random() < shape.leader ? Math.floor(random() * n) : -1;
  const crownBase = pine ? top * between(shape.crown) : 0;
  for (let b = 0; b < n; b++) {
    const heading = start + (b / n) * Math.PI * 2 + (random() - 0.5) * (Math.PI / n) * 0.8;
    const high = pine ? (b + 0.5 + (random() - 0.5) * 0.6) / n : 0; // pine: the share of the way up the crown
    const y = pine ? crownBase + (top * 0.94 - crownBase) * high : top - random() * 0.35;
    const tilt = deg(b === leader ? 4 + random() * 10 : between(shape.tilt));
    const length = between(shape.length) * (pine ? 1 - 0.45 * high : b === leader ? 0.8 : 1);
    const limb = { phase: random() * Math.PI * 2, heading, reach0: 0, reach1: shape.sway };
    const from = trunkAt(y);
    const bend = Math.max(0, tilt - deg(shape.curl) * (0.6 + 0.8 * random()));
    const mid = add(from, direction(heading, tilt), length * 0.55);
    const tip = add(mid, direction(heading, bend), length * 0.45);
    const r0 = radiusAt(y) * (pine ? 0.45 : 0.7), r1 = pine ? 0.03 : 0.045;
    const rm = r0 + (r1 - r0) * 0.55;
    const midLimb = { ...limb, reach1: shape.sway * 0.55 };
    tree.segments.push({ from, to: mid, r0, r1: rm, limb: midLimb });
    tree.segments.push({ from: mid, to: tip, r0: rm, r1, limb: { ...limb, reach0: shape.sway * 0.55 } });

    // The clumps: one at the tip (the branch running into its lower part),
    // the rest on twigs off the outer half.
    const clumps = count(shape.clumps);
    const size = between(shape.clumpSize) * (pine ? 1 - 0.3 * high : 1);
    tree.clumps.push(clump(add(tip, [0, 1, 0], size * shape.squash * 0.45), size, shape, random, { ...limb, reach0: shape.sway, reach1: shape.sway }));
    for (let c = 1; c < clumps; c++) {
      // A share f of the way along the branch, following its bend.
      const f = 0.45 + random() * 0.35;
      const at = f <= 0.55 ? lerp(from, mid, f / 0.55) : lerp(mid, tip, (f - 0.55) / 0.45);
      const side = (c % 2 ? 1 : -1) * deg(40 + random() * 35);
      const twigTilt = deg(pine ? 60 + random() * 25 : 50 + random() * 40);
      const twigLength = (pine ? 0.45 : 0.6) + random() * 0.5;
      const end = add(at, direction(heading + side, twigTilt), twigLength);
      const reach = shape.sway * f;
      tree.segments.push({ from: at, to: end, r0: 0.04, r1: 0.025, limb: { ...limb, reach0: reach, reach1: reach } });
      const small = size * (0.6 + random() * 0.25);
      tree.clumps.push(clump(add(end, [0, 1, 0], small * shape.squash * 0.4), small, shape, random, { ...limb, reach0: reach, reach1: reach }));
    }
  }

  if (!pine && shape.core > 0) {
    const size = shape.core * (0.9 + random() * 0.2);
    tree.clumps.push(clump(add(trunk[pieces], [0, 1, 0], size * shape.squash * 0.7), size, shape, random, still));
  }

  if (pine) {
    // A pad on the leader, and dead stubs down the bare trunk.
    const size = shape.clumpSize[0] * 0.95;
    tree.clumps.push(clump(add(trunk[pieces], [0, 1, 0], size * 0.2), size, { ...shape, squash: shape.squash * 1.3 }, random, still));
    const stubs = count(shape.stubs);
    for (let s = 0; s < stubs; s++) {
      const y = crownBase * (0.35 + random() * 0.6);
      const from = trunkAt(y);
      tree.segments.push({ from, to: add(from, direction(random() * Math.PI * 2, deg(70 + random() * 25)), 0.25 + random() * 0.35), r0: 0.035, r1: 0.015, limb: still });
    }
  }
}

function clump(center, radius, shape, random, limb) {
  return { center, radius, squash: shape.squash * (0.9 + random() * 0.2), turn: random() * Math.PI * 2, rough: shape.rough, seed: Math.floor(random() * 2 ** 31), shade: 0.9 + random() * 0.15, limb };
}

function layoutFir(tree, shape, random) {
  const between = ([a, b]) => a + (b - a) * random();
  const height = between(shape.height);
  const bare = between(shape.bare);
  const tiers = shape.tiers[0] + Math.floor(random() * (shape.tiers[1] - shape.tiers[0] + 1));
  const radius = between(shape.radius);
  tree.segments.push({ from: [0, 0, 0], to: [0, height * 0.85, 0], r0: shape.girth, r1: 0.05, limb: still });
  // Tier bases evenly up to three quarters of the height, each tier's tip
  // above the next one's base; the top tier is the spire, up to the tip.
  const last = height * 0.74;
  const spacing = (last - bare) / (tiers - 1);
  let turn = random() * Math.PI * 2;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const base = bare + spacing * i + (i > 0 && i < tiers - 1 ? (random() - 0.5) * spacing * 0.3 : 0);
    const r = (0.42 + (radius - 0.42) * Math.pow(1 - t, 1.05)) * (0.92 + random() * 0.16);
    const tierHeight = i === tiers - 1 ? height - base : spacing * (2.1 + random() * 0.3);
    turn += Math.PI / shape.points + (random() - 0.5) * 0.6; // against the one below
    const tips = [];
    for (let j = 0; j < shape.points; j++) {
      tips.push({
        angle: turn + (j / shape.points) * Math.PI * 2 + (random() - 0.5) * (Math.PI / shape.points) * 0.5,
        length: 1 - shape.jag * random(),
        drop: 0.6 + 0.8 * random(),
      });
    }
    tree.tiers.push({
      base, height: tierHeight, radius: r, droop: shape.droop * (r / radius), turn, tips,
      limb: { phase: random() * Math.PI * 2, heading: random() * Math.PI * 2, reach0: 0, reach1: shape.sway * (0.5 + 0.5 * (r / radius)) },
    });
  }
}

// --- Meshing ------------------------------------------------------------------------

const BARK = { broadleaf: [0x5c4d41, 0x5c4d41], fir: [0x4c3a2c, 0x4c3a2c], pine: [0x5a4a40, 0xa4643a] };

// A crown's effective radius for the wind's canopy (src/wind.js counts a
// full disc round the trunk), as a share of the foliage's farthest reach: a
// leaning or gappy crown covers less than its widest point. 0.8 gives the
// lanes the wind they had with the old trees' crowns (tests/trees.test.js).
export const CROWN_SHARE = 0.8;

// A tree's meshes: { wood, foliage (BufferGeometry, non-indexed, with
// position, normal, color and branch), height (m, its top), reach (m, the
// farthest its foliage reaches from the trunk's axis), crown (m, its
// effective radius for the wind: CROWN_SHARE of the reach), clumps
// ([{ x, y, z, r }], m, in the tree's own frame) }.
export function buildTree(kind, seed, shape = TREE_SHAPES[kind]) {
  const layout = layoutTree(kind, seed, shape);
  return meshTree(layout);
}

export function meshTree(layout) {
  const [low, high] = BARK[layout.kind].map((c) => new THREE.Color(c));
  const top = Math.max(...layout.segments.map((s) => s.to[1]));
  const bark = (y) => low.clone().lerp(high, THREE.MathUtils.smoothstep(y / top, 0.45, 0.7));
  // A run of pieces (a trunk, a limb's two halves) is one tube; a piece on
  // its own (a twig, a stub, a fir's trunk) its own cylinder.
  const wood = mergeGeometries(runs(layout.segments).map((run) => (run.length > 1 ? tubeGeometry(run, bark) : segmentGeometry(run[0], bark))));
  const foliage = mergeGeometries([
    ...layout.clumps.map(clumpGeometry),
    ...layout.tiers.map(tierGeometry),
  ]);
  const lean = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(Math.sin(layout.lean.toward), 0, -Math.cos(layout.lean.toward)), layout.lean.angle);
  wood.applyMatrix4(lean);
  foliage.applyMatrix4(lean);
  // The clumps' middles (leaned like the meshes) and radii, m: where leaves
  // can fall from (none on a fir).
  const clumps = layout.clumps.map((c) => {
    const p = new THREE.Vector3(...c.center).applyMatrix4(lean);
    return { x: p.x, y: p.y, z: p.z, r: c.radius };
  });
  const { height, reach } = measure(foliage, wood);
  return { wood, foliage, height, reach, crown: reach * CROWN_SHARE, clumps, layout };
}

// The top of a tree and how far its foliage reaches from the trunk's axis.
export function measure(foliage, wood) {
  let height = 0, reach = 0;
  for (const g of [foliage, wood]) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) height = Math.max(height, pos.getY(i));
  }
  const pos = foliage.attributes.position;
  for (let i = 0; i < pos.count; i++) reach = Math.max(reach, Math.hypot(pos.getX(i), pos.getZ(i)));
  return { height, reach };
}

// The segments in runs, each piece starting where the one before it ended
// (a trunk's pieces, a limb's two halves), in the order they were laid out.
function runs(segments) {
  const out = [];
  for (const s of segments) {
    const run = out.at(-1);
    if (run && run.at(-1).to === s.from) run.push(s);
    else out.push([s]);
  }
  return out;
}

// A run of pieces of wood as one tapered tube, so a trunk built of pieces
// shows no step where one meets the next, and no seam: a ring of
// sides (six, or four when thin, as a piece has) at its foot and at each
// joint, square to the bend's halfway direction there, its sides carried on
// from the ring before without turning about the tube; the far end closed.
// Its foot starts a little back, to sink into what it grows from, as a
// piece's does. twist: the most each ring may turn against the last, as a
// share of its sides' spacing; bulge: the most it may swell or pinch, as a
// share of its radius (both from random, seeded the same each time unless
// given; none for the forest).
function tubeGeometry(run, colorAt, { twist = 0, bulge = 0, random = mulberry32(741) } = {}) {
  const first = run[0];
  const from = new THREE.Vector3(...first.from), to = new THREE.Vector3(...first.to);
  const sink = Math.min(first.r0 * 1.5, from.distanceTo(to) * 0.3);
  const points = [from.clone().addScaledVector(to.clone().sub(from).normalize(), -sink)];
  const radii = [first.r0], reach = [first.limb.reach0], limbs = [first.limb];
  run.forEach((s, i) => {
    const next = run[i + 1];
    points.push(new THREE.Vector3(...s.to));
    radii.push(next ? (s.r1 + next.r0) / 2 : s.r1);
    reach.push(s.limb.reach1);
    limbs.push(s.limb);
  });
  const n = points.length;
  const sides = first.r0 > 0.08 ? 6 : 4;
  const tangents = points.map((p, i) => {
    const back = i > 0 ? p.clone().sub(points[i - 1]).normalize() : null;
    const ahead = i < n - 1 ? points[i + 1].clone().sub(p).normalize() : null;
    return (back && ahead ? back.add(ahead) : back ?? ahead).normalize();
  });
  const side = new THREE.Vector3().crossVectors(tangents[0], Math.abs(tangents[0].y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0)).normalize();
  const rings = [];
  let turn = 0;
  for (let i = 0; i < n; i++) {
    const t = tangents[i];
    side.addScaledVector(t, -side.dot(t)).normalize();
    const other = new THREE.Vector3().crossVectors(t, side);
    if (twist && i > 0) turn += (random() - 0.5) * twist * (2 * Math.PI / sides);
    const r = radii[i] * (bulge && i > 0 && i < n - 1 ? 1 + (random() - 0.5) * 2 * bulge : 1);
    const ring = [];
    for (let k = 0; k < sides; k++) {
      const a = turn + (k / sides) * Math.PI * 2;
      ring.push(points[i].clone().addScaledVector(side, Math.cos(a) * r).addScaledVector(other, Math.sin(a) * r).toArray());
    }
    rings.push(ring);
  }
  // Each triangle wound to face out from the tube's axis there; each corner
  // coloured and swayed as its ring.
  const position = [], color = [], branch = [];
  const triangle = (a, b, c, ia, ib, ic, middle) => {
    const ring = new Map([[a, ia], [b, ib], [c, ic]]);
    for (const p of orient(a, b, c, (x, y, z) => [x - middle.x, y - middle.y, z - middle.z])) {
      const i = ring.get(p);
      position.push(...p);
      color.push(...colorAt(points[i].y).toArray());
      branch.push(limbs[i].phase, reach[i], limbs[i].heading);
    }
  };
  for (let i = 0; i < n - 1; i++) {
    const middle = points[i].clone().add(points[i + 1]).multiplyScalar(0.5);
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      triangle(rings[i][k], rings[i][k1], rings[i + 1][k1], i, i, i + 1, middle);
      triangle(rings[i][k], rings[i + 1][k1], rings[i + 1][k], i, i + 1, i + 1, middle);
    }
  }
  // The far end, closed with a low point.
  const end = points[n - 1].clone().addScaledVector(tangents[n - 1], radii[n - 1] * 0.5).toArray();
  const inside = points[n - 1].clone().addScaledVector(tangents[n - 1], -radii[n - 1]);
  for (let k = 0; k < sides; k++) triangle(rings[n - 1][k], rings[n - 1][(k + 1) % sides], end, n - 1, n - 1, n - 1, inside);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  g.setAttribute('branch', new THREE.Float32BufferAttribute(branch, 3));
  g.computeVertexNormals();
  return g;
}

// A tapered six-sided piece of wood, a little longer at its foot so it sinks
// into what it grows from.
function segmentGeometry(s, colorAt) {
  const from = new THREE.Vector3(...s.from), to = new THREE.Vector3(...s.to);
  const dir = to.clone().sub(from);
  const length = dir.length();
  const sink = Math.min(s.r0 * 1.5, length * 0.3);
  const g = new THREE.CylinderGeometry(s.r1, s.r0, length + sink, s.r0 > 0.08 ? 6 : 4, 1).translate(0, (length - sink) / 2, 0).toNonIndexed();
  g.deleteAttribute('uv');
  const pos = g.attributes.position;
  const branch = new Float32Array(pos.count * 3);
  const color = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const f = THREE.MathUtils.clamp(pos.getY(i) / length, 0, 1);
    setLimb(branch, i, s.limb, s.limb.reach0 + (s.limb.reach1 - s.limb.reach0) * f);
    colorAt(s.from[1] + (s.to[1] - s.from[1]) * f).toArray(color, i * 3);
  }
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize())).translate(from.x, from.y, from.z);
  g.setAttribute('branch', new THREE.BufferAttribute(branch, 3));
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.computeVertexNormals();
  return g;
}

// A clump: a roughened ball, squashed, its underside flattened and darker.
function clumpGeometry(c) {
  const g = new THREE.IcosahedronGeometry(c.radius, 1);
  g.deleteAttribute('uv');
  roughen(g, c.rough * c.radius, mulberry32(c.seed));
  const pos = g.attributes.position;
  const branch = new Float32Array(pos.count * 3);
  const color = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) * c.squash;
    if (y < 0) y *= 0.6;
    pos.setY(i, y);
    const shade = c.shade * (0.62 + 0.38 * THREE.MathUtils.smoothstep(y / (c.radius * c.squash), -0.7, 0.8));
    color.fill(shade, i * 3, i * 3 + 3);
    setLimb(branch, i, c.limb, c.limb.reach1);
  }
  g.rotateY(c.turn).translate(...c.center);
  g.setAttribute('branch', new THREE.BufferAttribute(branch, 3));
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.computeVertexNormals();
  return g;
}

// A fir's tier: a skirt from its tip out to a jagged, drooping rim (the
// branch tips, with notches between them), concave so it hangs, and a
// shallow underside back to the trunk.
function tierGeometry(tier) {
  const { base, height: h, radius: r, droop, tips } = tier;
  const n = tips.length;
  const apex = [0, base + h, 0];
  const under = [0, base + 0.12 * h, 0];
  const at = (angle, dist, y) => [Math.cos(angle) * dist, y, Math.sin(angle) * dist];
  const shoulders = tips.map((t) => at(t.angle, r * 0.5 * t.length, base + h * 0.4));
  const rim = [];
  tips.forEach((t, j) => {
    const next = tips[(j + 1) % n];
    const gap = ((next.angle - t.angle + Math.PI * 4) % (Math.PI * 2));
    rim.push(at(t.angle, r * t.length, base - droop * t.drop));
    rim.push(at(t.angle + gap / 2, r * 0.62 * (t.length + next.length) / 2, base + h * 0.08));
  });
  const tris = [];
  const up = (a, b, c) => tris.push(orient(a, b, c, (cx, cy, cz) => [cx, r * 0.5, cz]));
  const down = (a, b, c) => tris.push(orient(a, b, c, () => [0, -1, 0]));
  for (let j = 0; j < n; j++) {
    const s0 = shoulders[j], s1 = shoulders[(j + 1) % n];
    const t0 = rim[2 * j], v = rim[2 * j + 1], t1 = rim[(2 * j + 2) % (2 * n)];
    up(apex, s0, s1);
    up(s0, t0, v);
    up(s0, v, s1);
    up(s1, v, t1);
    down(under, t0, v);
    down(under, v, t1);
  }
  const positions = new Float32Array(tris.flat(2));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const count = positions.length / 3;
  const branch = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const out = Math.hypot(x, z) / r;
    setLimb(branch, i, tier.limb, tier.limb.reach1 * Math.min(1, out));
    // Darker underneath and in toward the trunk.
    const lit = THREE.MathUtils.smoothstep((y - base) / h, -0.1, 0.5);
    color.fill((0.55 + 0.45 * lit) * (0.85 + 0.15 * Math.min(1, out)), i * 3, i * 3 + 3);
  }
  g.setAttribute('branch', new THREE.BufferAttribute(branch, 3));
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.computeVertexNormals();
  return g;
}

// The triangle a, b, c wound so its face points along outward(centroid).
function orient(a, b, c, outward) {
  const centroid = [0, 1, 2].map((k) => (a[k] + b[k] + c[k]) / 3);
  const o = outward(...centroid);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  return nrm[0] * o[0] + nrm[1] * o[1] + nrm[2] * o[2] >= 0 ? [a, b, c] : [a, c, b];
}

function setLimb(array, i, limb, reach) {
  array[i * 3] = limb.phase;
  array[i * 3 + 1] = reach;
  array[i * 3 + 2] = limb.heading;
}

// A unit direction at a heading (radians about y, 0 = +x) and a tilt from upright.
function direction(heading, tilt) {
  return [Math.cos(heading) * Math.sin(tilt), Math.cos(tilt), Math.sin(heading) * Math.sin(tilt)];
}
const add = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
const lerp = (a, b, f) => a.map((v, k) => v + (b[k] - v) * f);

// --- Shared helpers -----------------------------------------------------------------

// Push each vertex in or out a little (the same amount for vertices that
// share a place, so the surface doesn't tear), for a hand-cut look.
export function roughen(geometry, amount, random) {
  const pos = geometry.attributes.position;
  const offsets = new Map();
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    // (Whole millimetres: toFixed would write a hair below zero as "-0.000",
    // a different place from "0.000", and split a cone's seam open.)
    const key = `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)},${Math.round(p.z * 1000)}`;
    if (!offsets.has(key)) offsets.set(key, new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(amount));
    p.add(offsets.get(key));
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// A small seeded random number generator: the same trees every time.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
