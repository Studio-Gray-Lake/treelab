import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CROWN_SHARE, measure, mulberry32, roughen } from '@workshop/treeShapes.js';
import { pushesOf } from './chance.js';
import { massGeometry } from './leafMass.js';

// The oak's own mesher: its wood and leaves drawn from its layout
// (./oak.js), where the workshop's mesher (tubes of six sides that sink into
// their parents, and balls) drew them before.
//
// The wood:
// - round. A piece of wood has as many sides as its thickness asks for:
//   three for a twig, up to 28 for an ancient trunk, where every piece had
//   six (or four);
// - joints that swell. A branch is thicker where it leaves its parent (its
//   collar) and thins to its own thickness within a parent's width or two;
//   and a run of wood thins gradually toward and past each fork, not in
//   one step after it;
// - limbs that sweep. Thick wood is drawn as a curve through its steps,
//   not as straight pieces between them;
// - a foot that spreads into roots: the trunk widens toward the ground,
//   most where its roots leave it, and the roots run out over the ground
//   and sink into it;
// - gnarl: lumps and flutes on the trunk, the big limbs and the roots,
//   most at the foot and less the higher (as its burrs and hollows are);
// - burrs: bulges on the trunk;
// - hollows: deep dents in the trunk, dark inside, with a raised rim (a
//   dent, not a hole through to a cavity);
// - stubs: what is left of branches that died, on the trunk and the limbs,
//   broken off short, pale at the break;
// - an uneven mesh. Thick wood's rings aren't drawn as a grid of squares
//   each cut the same way (which shows as rows of diamonds): each ring is
//   turned a little against the last, each corner sits a little off its
//   place, round the wood and along it, and every four-sided patch is cut
//   across its shorter way. The corners are still on the wood's surface;
// - facets of one size. A limb is drawn with sides about as wide as the
//   trunk's it leaves, so a finely drawn trunk doesn't carry a limb of a
//   few broad sides.
//
// Where each burr, hollow, root and stub is, the layout says (each from the
// tree's own chance, so none moves when another slider does); what they
// look like is here. The leaves are still clusters as the workshop's mesher
// drew them (a roughened ball, squashed, its underside flattened and
// darker), for now.
//
// What comes out is what the workshop's mesher gave, so the workshop's sway
// and TreeLab's planter take it: { wood, foliage (BufferGeometry, not
// indexed, with position, normal, color and branch), height, reach, crown,
// clumps, layout }.

const BARK_FOOT = [0.3, 0.25, 0.2];     // grey-brown, darker and browner at the foot
const BARK_LIMBS = [0.43, 0.38, 0.31];  // greyer up the limbs
const BROKEN = [0.62, 0.55, 0.42];      // wood without bark, where a branch broke off
const FACET = 0.4;                      // m: about how wide a side of thick wood is
const CURVED = [0.14, 0.28];            // wood is drawn as a curve through its steps if it's at least this thick: m, and as a share of the trunk's thickness (the more of the two)
const COLLARED = 0.1;                   // m: a branch at least this thick has its collar drawn (a thinner one's is too small to see)
const UNEVEN = 8;                       // wood of at least this many sides is drawn with an uneven mesh
const WIDER = 1.3;                      // a limb's sides may be this many times as wide as the trunk's

// How many sides a piece of wood this thick is drawn with (r: its radius, m).
export const sidesFor = (r) => (r < 0.03 ? 3 : r < 0.09 ? 4 : r < 0.18 ? 5 : r < 0.32 ? 6 : r < 0.5 ? 8 : Math.min(24, Math.max(10, Math.round((2 * Math.PI * r) / FACET))));

// Whether a trunk has marks to show (and so finer sides and closer rings).
const marked = (w) => w.burrs.length + w.hollows.length > 0 || w.gnarl > 0.05 || w.flare > 0.05;
// How many sides this tree's trunk is drawn with (r: its radius, m).
const trunkSides = (r, w) => (marked(w) ? Math.min(28, Math.max(sidesFor(r), Math.round((2 * Math.PI * r * (1 + w.flare)) / (w.hollows.length ? 0.22 : 0.27)))) : sidesFor(r));
// How many sides a piece of this tree's wood is drawn with: as its
// thickness asks, and at least enough for its sides to be about as wide as
// the trunk's (WIDER times, at most).
export function sidesOfTree(w) {
  const sides = trunkSides(w.girth, w);
  const facet = ((2 * Math.PI * w.girth) / sides) * WIDER;
  return (r) => Math.max(sidesFor(r), Math.min(sides, Math.round((2 * Math.PI * r) / facet)));
}

// A number from 0 to 1 for a corner of a mesh (its ring, its place in it), the same every time.
function cornerChance(i, k, salt) {
  let x = Math.imul(i + 1, 374761393) ^ Math.imul(k + 1, 668265263) ^ Math.imul(salt + 1, 2246822519);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// The trunk's marks (its gnarl, burrs, hollows) come with age and gather
// low down (see ./oak.js).
const MARKED = 0.6; // m: a trunk this thick (its radius) is as marked as its sliders say; a thinner one less, a thicker one more
// How marked a trunk of this thickness is (1 at MARKED).
export const agedBy = (girth) => Math.min(1.6, Math.pow(Math.max(0, girth) / MARKED, 1.5));
// Over how many metres of height a trunk's marks thin out to about a third.
export const fadesOver = (girth) => 1.5 + 6 * girth;
// How much of its marks is left at a height above the ground (high: 0 at
// the foot only, 1 evenly all the way up).
export const markedAt = (y, girth, high) => high + (1 - high) * Math.exp(-Math.max(0, y) / fadesOver(girth));

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const around = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b)); // (the angle from b round to a, -π to π)

export function meshOak(layout) {
  const w = layout.wood;
  const out = { position: [], color: [], branch: [] };
  const lumps = pushesOf(w.seed);
  const bark = (y, shade = 1) => {
    const t = clamp(y / Math.max(1, w.height * 0.5)), f = t * t * (3 - 2 * t);
    return [0, 1, 2].map((k) => (BARK_FOOT[k] + (BARK_LIMBS[k] - BARK_FOOT[k]) * f) * shade);
  };
  const trunk = w.runs.find((run) => run.trunk);
  const look = { bark, lumps, sidesOf: sidesOfTree(w) };
  for (const run of w.runs) runInto(out, run, w, look);
  for (const stub of stubsOf(w, trunk)) stubInto(out, stub, bark);
  for (const root of w.roots) rootInto(out, root, w, look);

  const wood = geometryOf(out);
  // The leaves: each limb's clusters as one mass (./leafMass.js: a test,
  // for now), or every cluster a ball of its own.
  const foliage = !layout.clumps.length ? geometryOf({ position: [], color: [], branch: [] })
    : layout.leaves?.merged ? massGeometry(layout.clumps, layout.leaves)
    : mergeGeometries(layout.clumps.map(clumpGeometry));
  const lean = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(Math.sin(layout.lean.toward), 0, -Math.cos(layout.lean.toward)), layout.lean.angle);
  wood.applyMatrix4(lean);
  foliage.applyMatrix4(lean);
  // The clusters' middles (leaned like the meshes) and radii, m: where
  // leaves can fall from.
  const clumps = layout.clumps.map((c) => {
    const p = new THREE.Vector3(...c.center).applyMatrix4(lean);
    return { x: p.x, y: p.y, z: p.z, r: c.radius };
  });
  const { height, reach } = measure(foliage, wood);
  return { wood, foliage, height, reach, crown: reach * CROWN_SHARE, clumps, layout };
}

function geometryOf({ position, color, branch }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  g.setAttribute('branch', new THREE.Float32BufferAttribute(branch, 3));
  g.computeVertexNormals();
  return g;
}

// A triangle of corners { v: [x, y, z], color: [r, g, b], sway: [phase, reach, heading] }.
function triangle(out, a, b, c) {
  for (const corner of [a, b, c]) {
    out.position.push(...corner.v);
    out.color.push(...corner.color);
    out.branch.push(...corner.sway);
  }
}

// --- A run of wood ---------------------------------------------------------------------

// The point `along` m from the start of a line of points (each { p, r,
// reach, phase, heading }; `lengths`: how far each is from the first).
function pointAt(points, lengths, along) {
  let i = 1;
  while (i < points.length - 1 && lengths[i] < along) i++;
  const a = points[i - 1], b = points[i];
  const t = clamp((along - lengths[i - 1]) / Math.max(1e-6, lengths[i] - lengths[i - 1]));
  return { p: [0, 1, 2].map((k) => lerp(a.p[k], b.p[k], t)), r: lerp(a.r, b.r, t), reach: lerp(a.reach, b.reach, t), phase: b.phase, heading: b.heading };
}
const lengthsOf = (points) => points.reduce((sum, point, i) => (sum.push(i ? sum[i - 1] + dist(point.p, points[i - 1].p) : 0), sum), []);

// A run as the layout gives it, made ready to draw: its collar where it
// leaves its parent, its thickness eased along it, its thick wood curved.
export function shaped(run, w) {
  let points = run.points.map((point) => ({ ...point, p: [...point.p] }));
  if (run.stalk || points.length < 2) return points;

  // Its thickness eased: the layout's is in steps (a branch is as thick as
  // what it carries, so it thins at once where a side branch leaves); wood
  // thins toward a fork and past it.
  for (let pass = 0; pass < 2; pass++) {
    const r = points.map((point) => point.r);
    for (let i = 1; i < points.length - 1; i++) points[i].r = 0.25 * r[i - 1] + 0.5 * r[i] + 0.25 * r[i + 1];
  }

  // Thick wood as a curve through its steps (one point more between each
  // two), so a limb sweeps where its steps turn.
  const curve = Math.max(CURVED[0], CURVED[1] * w.girth);
  if (points[0].r >= curve && points.length > 2) {
    const curved = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
      curved.push(b);
      if (b.r < curve) continue;
      curved.push({
        p: [0, 1, 2].map((k) => 0.5625 * (b.p[k] + c.p[k]) - 0.0625 * (a.p[k] + d.p[k])),
        r: (b.r + c.r) / 2, reach: (b.reach + c.reach) / 2, phase: c.phase, heading: c.heading,
      });
    }
    curved.push(points.at(-1));
    points = curved;
  }

  // The trunk, in rings close enough together for its foot, its burrs and
  // its hollows to show.
  if (run.trunk) {
    const lengths = lengthsOf(points), whole = lengths.at(-1);
    const marked = w.burrs.length + w.hollows.length > 0 || w.gnarl > 0.05;
    const gap = clamp((w.hollows.length ? 0.22 : marked ? 0.3 : 0.5) * Math.sqrt(Math.max(0.05, w.girth) / 0.6), 0.08, 0.6);
    const top = Math.min(whole, w.bare + 2.5 * w.girth + 1);
    const fine = [];
    // (Close together near the ground, where the foot spreads: in a curve,
    // not as a block. And one ring under the ground, so no edge shows there.)
    const under = pointAt(points, lengths, 0);
    under.p = [under.p[0], -(0.15 + 0.3 * w.girth), under.p[2]];
    fine.push(under);
    for (let along = 0; along < top; along += along < 0.7 * (0.3 + 0.45 * w.girth) * 2 ? Math.max(0.05, gap * 0.3) : gap) fine.push(pointAt(points, lengths, along));
    points = [...fine, ...points.filter((_, i) => lengths[i] >= top)];
  }

  // Thick wood in rings close enough together for its lumps to show, and
  // for its sides not to be long slivers (the layout's steps can be a
  // couple of metres apart where a limb runs straight).
  {
    const close = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const thick = Math.max(a.r, b.r);
      const pieces = thick >= curve ? Math.min(6, Math.ceil(dist(a.p, b.p) / Math.max(0.4, 1.5 * thick) - 0.15)) : 1;
      for (let j = 1; j < pieces; j++) {
        const t = j / pieces;
        close.push({ p: [0, 1, 2].map((k) => lerp(a.p[k], b.p[k], t)), r: lerp(a.r, b.r, t), reach: lerp(a.reach, b.reach, t), phase: b.phase, heading: b.heading });
      }
      close.push(b);
    }
    points = close;
  }

  // Its collar: where it leaves its parent it's thicker (never as thick
  // as the parent), and thins to itself within a parent's width or two.
  // It's drawn from inside the parent's wood, out.
  if (run.side && run.parent > 0 && points[0].r >= COLLARED) {
    const lengths = lengthsOf(points), whole = lengths.at(-1);
    const marks = [0.55, 1, 1.45, 2.1].map((share) => share * run.parent).filter((along) => along < whole * 0.92);
    if (!marks.length) return points; // (too short to leave its parent's wood: as it is)
    const from = marks[0];
    const through = [...marks.map((along) => ({ ...pointAt(points, lengths, along), along })), ...points.map((point, i) => ({ ...point, along: lengths[i] })).filter((point) => point.along > from + 1e-6 && !marks.some((along) => Math.abs(along - point.along) < 0.04))];
    through.sort((a, b) => a.along - b.along);
    for (const point of through) {
      const out = Math.max(0, point.along - run.parent);
      point.r = Math.min(run.parent * 0.88, point.r * (1 + 0.55 * Math.exp(-out / (0.45 * run.parent + 0.05))));
    }
    points = through;
  }
  // (Never thicker further out; and its last step thins to a twig, where
  // the twigs too fine to draw carry on.)
  for (let i = 1; i < points.length; i++) points[i].r = Math.min(points[i].r, points[i - 1].r);
  points.at(-1).r = Math.max(0.012, points.at(-1).r * 0.4);
  return points;
}

// The run into `out`, as tubes: one for each stretch of about one
// thickness (a new one, of fewer sides, each time it has thinned to wood
// that needs half as many).
function runInto(out, run, w, look) {
  const points = shaped(run, w);
  if (points.length < 2) return;
  // (A trunk with marks on it gets finer sides, for them to show; a limb,
  // sides about as wide as the trunk's.)
  const sidesOf = look.sidesOf ?? sidesFor;
  const sides = run.trunk ? trunkSides(points[0].r, w) : sidesOf(points[0].r);
  // (Each hollow's middle on a corner of the trunk's mesh, the nearest: a
  // hollow between corners would be missed, or lopsided.)
  let shape = null;
  if (run.trunk) {
    const turn = (2 * Math.PI) / sides;
    const hollows = w.hollows.map((hollow) => ({
      ...hollow,
      y: points.reduce((best, point) => (Math.abs(point.p[1] - hollow.y) < Math.abs(best - hollow.y) ? point.p[1] : best), points[0].p[1]),
      angle: Math.round(hollow.angle / turn) * turn,
      wide: Math.max(hollow.wide, 2.4 * turn * points[0].r),
    }));
    shape = trunkShape({ ...w, hollows }, look.lumps);
  }
  for (const tube of tubesOf(points, sides, sidesOf)) tubeInto(out, tube.points, tube.sides, { ...look, shape, w, trunk: run.trunk, capped: tube.last, ways: tube.ways });
}

// A run's points as the tubes it's drawn with: [{ points, ways (the way the
// run heads at each point), sides, last }]. A new tube, of fewer sides,
// starts each time the wood has thinned to what needs half as many. Two
// tubes that meet share the ring where they meet, the run's own (each
// used to tilt its end ring by its own side of a bend only, and a wedge
// opened between them); and the later one starts a little back inside the
// earlier, so no notch shows where their sides differ.
export function tubesOf(points, sides = sidesFor(points[0].r), sidesOf = sidesFor) {
  const centres = points.map((point) => new THREE.Vector3(...point.p));
  const ways = centres.map((c, i) => {
    const back = i > 0 ? c.clone().sub(centres[i - 1]).normalize() : null;
    const ahead = i < centres.length - 1 ? centres[i + 1].clone().sub(c).normalize() : null;
    return (back && ahead ? back.add(ahead) : back ?? ahead).normalize();
  });
  const tubes = [];
  let from = 0, lap = null;
  for (let i = 1; i < points.length; i++) {
    const last = i === points.length - 1;
    if (!last && sidesOf(points[i].r) > sides / 2) continue;
    const through = points.slice(from, i + 1), heading = ways.slice(from, i + 1);
    if (lap) {
      through.unshift(lap.point);
      heading.unshift(lap.way);
    }
    tubes.push({ points: through, ways: heading, sides, last });
    from = i;
    sides = sidesOf(points[i].r);
    lap = { point: { ...points[i], p: centres[i].clone().addScaledVector(ways[i], -0.6 * points[i].r).toArray() }, way: ways[i] };
  }
  return tubes;
}

// A tube through `points`, of `sides` sides: a ring at each point, square to
// the way the tube bends there, its sides carried on from the ring before
// without turning about the tube; the far end closed with a low point if
// `capped`. (Seen along a vertical tube from above, its first side faces
// +x, and the sides go round toward +z: so an angle about the trunk is the
// same in every ring.)
//
// Wood of UNEVEN sides or more is drawn with an uneven mesh: each ring but
// a tube's first and last is turned a little against the others, and each
// of its corners sits a little off its place round the wood and along it
// (where the wood's surface is, there: the marks are asked about where the
// corner really is); and each four-sided patch between two rings is cut
// across its shorter way.
function tubeInto(out, points, sides, { bark, lumps, shape, w, trunk, capped, ways = null }) {
  const n = points.length;
  const centres = points.map((point) => new THREE.Vector3(...point.p));
  const tangents = ways ?? centres.map((c, i) => {
    const back = i > 0 ? c.clone().sub(centres[i - 1]).normalize() : null;
    const ahead = i < n - 1 ? centres[i + 1].clone().sub(c).normalize() : null;
    return (back && ahead ? back.add(ahead) : back ?? ahead).normalize();
  });
  const side = new THREE.Vector3(1, 0, 0);
  if (Math.abs(tangents[0].x) > 0.9) side.set(0, 0, 1);
  const other = new THREE.Vector3(), v = new THREE.Vector3(), push = [0, 0, 0];
  const grain = 0.3 + 0.55 * w.girth; // m: about how far apart the wood's lumps are
  const uneven = sides >= UNEVEN, turn = (2 * Math.PI) / sides, salt = (w.seed ?? 0) + sides;
  const centre = new THREE.Vector3();
  const rings = [];
  for (let i = 0; i < n; i++) {
    const t = tangents[i], point = points[i];
    side.addScaledVector(t, -side.dot(t)).normalize();
    other.crossVectors(t, side);
    // (Lumps only on thick wood: a twig is smooth. And fewer the higher.)
    const gnarled = w.gnarl * clamp((point.r / Math.max(0.02, w.girth) - 0.12) / 0.3) * (w.marks ? markedAt(point.p[1], w.marks.girth, w.marks.high) : 1);
    const sway = [point.phase, point.reach, point.heading];
    const inner = uneven && i > 0 && i < n - 1;
    const turned = inner ? (cornerChance(i, -1, salt) - 0.5) * 0.5 * turn : 0;
    const room = inner ? Math.min(centres[i].distanceTo(centres[i - 1]), centres[i].distanceTo(centres[i + 1])) : 0;
    const ring = [];
    for (let k = 0; k < sides; k++) {
      const a = k * turn + turned + (inner ? (cornerChance(i, k, salt) - 0.5) * 0.4 * turn : 0);
      centre.copy(centres[i]);
      if (inner) centre.addScaledVector(t, (cornerChance(k, i + 7, salt) - 0.5) * 0.5 * room);
      v.copy(centre).addScaledVector(side, Math.cos(a) * point.r).addScaledVector(other, Math.sin(a) * point.r);
      let more = 1, shade = 1;
      if (gnarled > 0) {
        // (Big lumps, and smaller ones on them.)
        more += gnarled * 1.2 * lumps(v.x / grain, v.y / grain, v.z / grain, push)[0];
        more += gnarled * 0.55 * lumps((v.x * 2.3) / grain, (v.y * 2.3) / grain, (v.z * 2.3) / grain, push)[1];
      }
      if (trunk) {
        const marks = shape(centre.y, a, point.r);
        more += marks.more;
        shade = marks.shade;
      }
      more = Math.max(0.2, more);
      v.copy(centre).addScaledVector(side, Math.cos(a) * point.r * more).addScaledVector(other, Math.sin(a) * point.r * more);
      ring.push({ v: v.toArray(), color: bark(v.y, shade), sway });
    }
    rings.push(ring);
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      const a = rings[i][k], b = rings[i][k1], c = rings[i + 1][k1], d = rings[i + 1][k];
      if (uneven && dist(b.v, d.v) < dist(a.v, c.v)) {
        triangle(out, a, b, d);
        triangle(out, b, c, d);
      } else {
        triangle(out, a, b, c);
        triangle(out, a, c, d);
      }
    }
  }
  if (capped) {
    const end = centres[n - 1].clone().addScaledVector(tangents[n - 1], points[n - 1].r * 0.5);
    const tip = { v: end.toArray(), color: bark(end.y), sway: rings[n - 1][0].sway };
    for (let k = 0; k < sides; k++) triangle(out, rings[n - 1][k], rings[n - 1][(k + 1) % sides], tip);
  }
}

// --- The trunk's own marks --------------------------------------------------------------

// What the trunk's surface does at a height y (m), an angle about it and
// its thickness there: { more: how much further out (or in) it lies, as a
// share of its radius; shade: how dark (1: as the bark) }.
function trunkShape(w, lumps) {
  const push = [0, 0, 0];
  return (y, angle, r) => {
    let more = 0, shade = 1;
    // Its foot spreads toward the ground, most where a root leaves it; and
    // the roots' ridges run on up it as flutes, fading (more, gnarled).
    let ridge = 0;
    for (const root of w.roots) ridge = Math.max(ridge, root.strength * Math.exp(-((around(angle, root.angle) / (root.wide * 1.4)) ** 2)));
    more += w.flare * Math.exp(-Math.max(0, y) / (0.3 + 0.45 * w.girth)) * (0.7 + 0.9 * ridge);
    more += w.gnarl * 0.3 * (ridge - 0.4) * Math.exp(-Math.max(0, y) / (1 + 2.5 * w.girth));
    // Burrs: each a bulge, lumpy itself.
    for (const burr of w.burrs) {
      const d = ((y - burr.y) ** 2 + (around(angle, burr.angle) * r) ** 2) / burr.size ** 2;
      if (d > 5) continue;
      lumps(angle * 3 + burr.angle * 7, y / (burr.size * 0.5), burr.y, push);
      more += (burr.tall / r) * Math.exp(-d) * (1 + 0.9 * push[0]);
    }
    // Hollows: each a deep dent, dark inside, its rim a little raised.
    for (const hollow of w.hollows) {
      const q = ((y - hollow.y) / (hollow.tall / 2)) ** 2 + ((around(angle, hollow.angle) * r) / (hollow.wide / 2)) ** 2;
      if (q < 1) {
        const deep = Math.pow(1 - q, 0.55);
        more -= Math.min(0.72, hollow.depth / r) * deep;
        shade *= 1 - 0.8 * deep;
      } else if (q < 2) more += 0.1 * (2 - q) * (2 - q);
    }
    return { more, shade };
  };
}

// --- Stubs --------------------------------------------------------------------------------

// The stubs to draw: the limbs' (where the layout found a twig long dead)
// and the trunk's (by height and angle: placed on its wood here).
function stubsOf(w, trunk) {
  const stubs = w.stubs.filter((stub) => stub.p);
  if (!trunk) return stubs;
  const points = trunk.points;
  for (const stub of w.stubs) {
    if (stub.p) continue;
    let i = 1;
    while (i < points.length - 1 && points[i].p[1] < stub.y) i++;
    const a = points[i - 1], b = points[i], t = clamp((stub.y - a.p[1]) / Math.max(1e-6, b.p[1] - a.p[1]));
    const up = Math.sin(stub.rise), level = Math.cos(stub.rise);
    stubs.push({
      ...stub, p: [0, 1, 2].map((k) => lerp(a.p[k], b.p[k], t)), parent: lerp(a.r, b.r, t),
      toward: [Math.cos(stub.angle) * level, up, Math.sin(stub.angle) * level], phase: 0, reach: 0, heading: 0,
    });
  }
  return stubs;
}

// A stub: a short piece from inside its parent's wood, out to a ragged
// break, pale where the wood shows.
function stubInto(out, stub, bark) {
  const sides = Math.max(5, sidesFor(stub.r));
  const dir = new THREE.Vector3(...stub.toward).normalize();
  const side = new THREE.Vector3(1, 0, 0);
  if (Math.abs(dir.x) > 0.9) side.set(0, 0, 1);
  side.addScaledVector(dir, -side.dot(dir)).normalize();
  const other = new THREE.Vector3().crossVectors(dir, side);
  const from = new THREE.Vector3(...stub.p);
  const random = mulberry32(stub.seed);
  const sway = [stub.phase, stub.reach, stub.heading];
  // (At its parent's skin it's thicker, as a living branch's collar is.)
  const rings = [[stub.parent * 0.5, 1.5], [stub.parent * 1.02, 1.3], [stub.parent + stub.long * 0.55, 1], [stub.parent + stub.long, 0.92]].map(([along, thick], i) =>
    Array.from({ length: sides }, (_, k) => {
      const a = (k / sides) * Math.PI * 2;
      // (The break: no two sides end at the same length.)
      const far = along + (i === 3 ? (random() - 0.5) * stub.long * 0.5 : 0);
      const v = from.clone().addScaledVector(dir, far).addScaledVector(side, Math.cos(a) * stub.r * thick).addScaledVector(other, Math.sin(a) * stub.r * thick);
      return { v: v.toArray(), color: bark(v.y, i === 3 ? 0.9 : 1), sway };
    }));
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      triangle(out, rings[i][k], rings[i][k1], rings[i + 1][k1]);
      triangle(out, rings[i][k], rings[i + 1][k1], rings[i + 1][k]);
    }
  }
  // (The break itself: bare wood, sunk a little in its middle.)
  const middle = { v: from.clone().addScaledVector(dir, stub.parent + stub.long * 0.82).toArray(), color: BROKEN.map((c) => c * 0.8), sway };
  const end = rings.at(-1).map((corner) => ({ ...corner, color: BROKEN }));
  for (let k = 0; k < sides; k++) triangle(out, end[k], end[(k + 1) % sides], middle);
}

// --- Roots --------------------------------------------------------------------------------

// A root: from the trunk's foot out over the ground, a third of it in the
// ground, thinning as it goes. It wanders a little to either side, and it
// rises and dips as roots do, here riding high, there under the ground and
// out again; over its last third it goes under for good. A long one forks
// once. It's gnarled where it's thick, as the trunk is at its foot.
//
// (Its turns and its dips are a smooth pattern along it, by the metre, so a
// longer root is the same root carried on.)
function rootInto(out, root, w, look) {
  if (!(root.long > 0.05)) return;
  const thick = Math.max(0.02, w.girth * 0.38 * root.strength * (0.6 + 0.8 * Math.min(1.2, w.flare)));
  // (It starts just inside the foot, where the foot's ridge for it ends.)
  const start = w.girth * (1 + w.flare * (0.7 + 0.9 * root.strength)) * 0.75;
  const flat = (y, shade) => look.bark(Math.max(0, y), shade);
  const sidesOf = look.sidesOf ?? sidesFor;
  const draw = ({ x, z, angle, long, thick: r0, seed, forks }) => {
    const pattern = pushesOf(seed), push = [0, 0, 0];
    const steps = Math.round(clamp(long / Math.max(0.3, 1.3 * r0), 6, 20));
    const last = 0.3 * r0; // (it thins to a third)
    const points = [];
    let fork = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, along = t * long, r = r0 * (1 - 0.7 * t);
      pattern(along / 1.5, 0.5, 0.5, push);
      // (As it leaves the foot it's where the foot's ridge is, and heads as it does; then it wanders, rises and dips; then under.)
      const free = clamp(t / 0.15), under = clamp((t - 0.68) / 0.32);
      const heading = angle + 1.1 * free * push[0];
      const y = -0.35 * r + free * 1.8 * r * push[1] - (2.6 * last + 0.08) * under * under * (3 - 2 * under);
      points.push({ p: [x, y, z], r, reach: 0, phase: 0, heading: 0 });
      if (forks && !fork && t >= forks.at) fork = { x, z, angle: heading + forks.turn, long: (1 - t) * long * 0.75, thick: r * 0.62, seed: seed + 1 };
      x += Math.cos(heading) * (long / steps);
      z += Math.sin(heading) * (long / steps);
    }
    tubeInto(out, points, Math.max(5, sidesOf(r0)), { bark: flat, lumps: look.lumps, shape: null, w, trunk: false, capped: true });
    if (fork && fork.long > 0.4) draw(fork);
  };
  // (A root longer than 2 m forks, somewhere in its first half, to one side.)
  const own = mulberry32(root.seed);
  const at = 0.25 + own() * 0.25, turn = (own() < 0.5 ? -1 : 1) * (0.5 + own() * 0.4);
  draw({ x: Math.cos(root.angle) * start, z: Math.sin(root.angle) * start, angle: root.angle, long: root.long, thick, seed: root.seed, forks: root.long > 2 ? { at, turn } : null });
}

// --- Leaves -------------------------------------------------------------------------------

// A cluster of leaves: a roughened ball, squashed, its underside flattened
// and darker (as the workshop's mesher draws a clump).
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
    branch[i * 3] = c.limb.phase;
    branch[i * 3 + 1] = c.limb.reach1;
    branch[i * 3 + 2] = c.limb.heading;
  }
  g.rotateY(c.turn).translate(...c.center);
  g.setAttribute('branch', new THREE.BufferAttribute(branch, 3));
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.computeVertexNormals();
  return g;
}
