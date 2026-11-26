import * as THREE from 'three';
import { CROWN_SHARE, measure, mulberry32 } from '@workshop/treeShapes.js';
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
// look like is here. The leaves are masses (./leafMass.js): each big limb's
// clusters merged into billowing surfaces, hollow underneath.
//
// What comes out is what the workshop's mesher gave, so the workshop's sway
// and TreeLab's planter take it: { wood, foliage (BufferGeometry, not
// indexed, with position, normal, color and branch), height, reach, crown,
// clumps, layout }.

const BARK_FOOT = [0.3, 0.25, 0.2];     // grey-brown, darker and browner at the foot
const BARK_LIMBS = [0.43, 0.38, 0.31];  // greyer up the limbs
const BROKEN = [0.62, 0.55, 0.42];      // wood without bark, where a branch broke off
const MARK = [0, 0, 0];                 // (where the bark's marks' pattern is worked out)
const FACET = 0.4;                      // m: about how wide a side of thick wood is
const CURVED = [0.14, 0.28];            // wood is drawn as a curve through its steps if it's at least this thick: m, and as a share of the trunk's thickness (the more of the two)
const COLLARED = 0.1;                   // m: a branch at least this thick has its collar drawn (a thinner one's is too small to see)
const INSIDE = 0.6;                     // a branch's first ring, at its parent's middle, is at most this share of its parent's thickness
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
// (at: the thickness at which this kind of tree is as marked as its sliders say; an oak's unless its frame says otherwise.)
export const agedBy = (girth, at = MARKED) => Math.min(1.6, Math.pow(Math.max(0, girth) / at, 1.5));
// Over how many metres of height a trunk's marks thin out to about a third.
export const fadesOver = (girth) => 1.5 + 6 * girth;
// How much of its marks is left at a height above the ground (high: 0 at
// the foot only, 1 evenly all the way up).
export const markedAt = (y, girth, high) => high + (1 - high) * Math.exp(-Math.max(0, y) / fadesOver(girth));

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const around = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b)); // (the angle from b round to a, -π to π)

// A tree's bark, and the lumps of its wood: { bark, lumps }.
function barkOf(layout) {
  const w = layout.wood;
  const lumps = pushesOf(w.seed);
  // The bark's colour at a height (y, m), darkened by `shade`; r: how thick
  // the wood is there (its radius, m), and at: where on it (for the marks).
  // The kind's own bark, if it has one (a frame's "bark", ./oak.js): the
  // oak's otherwise. A bark may also say:
  // - how high its foot's colour reaches ("footRise": [m, and m more for
  //   each metre the trunk is thick]): an old birch's foot is black for a
  //   metre or two, a young one's hardly at all. Otherwise: half the
  //   tree's height, as an oak's;
  // - what colour its thin wood is ("thin": { color, below (m) }): a
  //   birch's twigs and thin branches are dark, and whiten as they thicken;
  // - that its thick wood has dark marks ("marks": { color, share }): a
  //   birch's black scars, in streaks across the trunk.
  const own = w.bark ?? {};
  const footReach = own.footRise ? Math.max(0.05, own.footRise[0] + own.footRise[1] * w.girth) : Math.max(1, w.height * 0.5);
  const bark = (y, shade = 1, r = Infinity, at = null) => {
    const t = clamp(y / footReach), f = t * t * (3 - 2 * t);
    const foot = own.foot ?? BARK_FOOT, limbs = own.limbs ?? BARK_LIMBS;
    const color = [0, 1, 2].map((k) => foot[k] + (limbs[k] - foot[k]) * f);
    if (own.thin) {
      // (From its own colour at 0.6 of that thickness to the thick wood's at 1.6 of it.)
      const thin = 1 - clamp((r / own.thin.below - 0.6) / 1);
      if (thin > 0) for (let k = 0; k < 3; k++) color[k] += (own.thin.color[k] - color[k]) * thin * thin * (3 - 2 * thin);
      if (own.marks && at && thin < 0.5) {
        // (Streaks: a pattern stretched round the trunk, close together up it.)
        const streak = lumps(at[0] * 1.3, at[1] * 7, at[2] * 1.3, MARK)[1] + 0.5 * lumps(at[0] * 4, at[1] * 19, at[2] * 4, MARK)[2];
        const dark = clamp((streak - (0.42 - own.marks.share)) / 0.08) * (1 - 2 * thin);
        if (dark > 0) for (let k = 0; k < 3; k++) color[k] += (own.marks.color[k] - color[k]) * dark;
      }
    }
    return color.map((c) => c * shade);
  };
  return { bark, lumps };
}

// The tree's roots are drawn last, on level ground: rootsFrom (in what it
// returns) is how many of the wood's corners come before them, so whoever
// plants the tree on ground that isn't level can draw the wood without
// them and draw each tree's own roots on its own ground (rootsOf, below;
// src/tree.js).
export function meshOak(layout) {
  const w = layout.wood;
  const out = { position: [], color: [], branch: [] };
  const { bark, lumps } = barkOf(layout);
  const trunk = w.runs.find((run) => run.trunk);
  const look = { bark, lumps, sidesOf: sidesOfTree(w) };
  for (const run of w.runs) runInto(out, run, w, look);
  for (const stub of stubsOf(w, trunk)) stubInto(out, stub, bark);
  // (A pine's twigs, bare below their plumes of needles.)
  for (const bough of layout.leaves?.boughs ?? []) if (bough.style === 'brushes') for (const twig of twigsOf(bough)) stickInto(out, twig, bark);
  const rootsFrom = out.position.length / 3;
  for (const root of w.roots) rootInto(out, root, w, look);

  const wood = geometryOf(out);
  // The leaves: each limb's clusters as masses (./leafMass.js); a kind with needles, twigs with needles.
  const foliage = layout.leaves?.boughs?.length ? needlesGeometry(layout.leaves.boughs)
    : !layout.clumps.length ? geometryOf({ position: [], color: [], branch: [] })
    : massGeometry(layout.clumps, layout.leaves);
  const lean = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(Math.sin(layout.lean.toward), 0, -Math.cos(layout.lean.toward)), layout.lean.angle);
  wood.applyMatrix4(lean);
  foliage.applyMatrix4(lean);
  // The clusters' middles (leaned like the meshes) and radii, m: where
  // leaves can fall from.
  const clumps = layout.clumps.map((c) => {
    const p = new THREE.Vector3(...c.center).applyMatrix4(lean);
    return { x: p.x, y: p.y, z: p.z, r: c.radius };
  });
  const measured = measure(foliage, wood);
  // (How far it reaches is measured on its leaves. A tree that has dropped some or all of them, the season's,
  // reaches as far as its crown does all the same: a bare tree is not a tree of no width.)
  const height = measured.height, reach = layout.oak?.carried < 1 ? Math.max(measured.reach, layout.oak.width / 2) : measured.reach;
  return { wood, foliage, height, reach, crown: reach * CROWN_SHARE, clumps, layout, rootsFrom };
}

// A tree's roots alone, run over a ground of its own: ground(x, z) is how
// high the ground lies at a place (m, in the tree's own measures: 0 where
// the foot stands). With no ground they are the roots meshOak draws.
//
// Said plainly: the ground only drapes them. Where a root runs, how it
// wanders and where it forks are grown as on level ground; the ground sets
// how high each step of it lies, and the root rises and dips about that as
// it does about level ground. A root that meets something it cannot grow
// through (a rock) and turns is not drawn. And a leaning tree's roots don't
// lean with it: they lie on the ground.
//
// bare: 0 to 1, how much the slope has a say in what shows. On a slope a
// tree dams the loose ground above it, and the ground below it is carried
// off: so a root on the uphill side lies covered, and one on the downhill
// side bare. At 0 a root rides the same on every side. (A rule of thumb:
// it goes by which side of the tree a root is on, not by how the ground
// was worn.)
export function rootsOf(layout, ground = null, { bare = 0 } = {}) {
  const w = layout.wood;
  const out = { position: [], color: [], branch: [] };
  const { bark, lumps } = barkOf(layout);
  const slope = ground && bare > 0 ? { bare, foot: ground(0, 0) } : null;
  for (const root of w.roots) rootInto(out, root, w, { bark, lumps, sidesOf: sidesOfTree(w) }, ground, slope);
  return geometryOf(out);
}

// The roots' middle lines, as rootsOf draws them: [[{ p: [x, y, z], r }]], a
// line for each root and each fork. For measuring them, and for drawings.
export function rootLinesOf(layout, ground = null, { bare = 0 } = {}) {
  const w = layout.wood;
  const out = { position: [], color: [], branch: [], lines: [] };
  const { bark, lumps } = barkOf(layout);
  const slope = ground && bare > 0 ? { bare, foot: ground(0, 0) } : null;
  for (const root of w.roots) rootInto(out, root, w, { bark, lumps, sidesOf: sidesOfTree(w) }, ground, slope);
  return out.lines.map((line) => line.map(({ p, r }) => ({ p: [...p], r })));
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
  const collared = run.side && run.parent > 0 && points[0].r >= COLLARED;
  if (collared) {
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
    // Its first ring is at its parent's middle and well inside its wood, so
    // the tube's open end is never seen. (It was a little way out along
    // the branch, at the collar's full width: where a branch leaves its
    // parent at a slant, that ring's rim stood out of the parent's side,
    // an open wedge beside the joint.)
    points = [{ ...pointAt(points, lengths, 0), r: Math.min(through[0].r, run.parent * INSIDE) }, ...through];
  }
  // (Never thicker further out, past where a branch's collar is widest; and
  // its last step thins to a twig, where the twigs too fine to draw carry on.)
  for (let i = collared ? 2 : 1; i < points.length; i++) points[i].r = Math.min(points[i].r, points[i - 1].r);
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
  // (A branch with a collar: by the collar's width, not by its narrower first ring inside its parent.)
  const sides = run.trunk ? trunkSides(points[0].r, w) : sidesOf(Math.max(points[0].r, points[1].r));
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
export function tubesOf(points, sides = sidesFor(Math.max(points[0].r, points[1]?.r ?? 0)), sidesOf = sidesFor) {
  const centres = points.map((point) => new THREE.Vector3(...point.p));
  const ways = centres.map((c, i) => {
    const back = i > 0 ? c.clone().sub(centres[i - 1]).normalize() : null;
    const ahead = i < centres.length - 1 ? centres[i + 1].clone().sub(c).normalize() : null;
    // (Where a run doubles back on itself the two cancel: the way ahead, then.)
    const both = back && ahead ? back.clone().add(ahead) : null;
    return (both && both.lengthSq() > 0.01 ? both : ahead ?? back).normalize();
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
      ring.push({ v: v.toArray(), color: bark(v.y, shade, point.r, v.toArray()), sway });
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
    const tip = { v: end.toArray(), color: bark(end.y, 1, points[n - 1].r), sway: rings[n - 1][0].sway };
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
// (ground: how high the ground lies at (x, z), if it isn't level: the root
// rides on it, rising and dipping about it as it does about level ground.)
// (slope: { bare, foot }: on a slope, how much lower a root lies uphill of
// the tree and how much higher downhill of it, and the ground's height at
// the tree's middle. See rootsOf.)
const BARE_AT = 0.27;  // the ground falling away from the tree this steeply (15 degrees), a root is as bare as it gets; rising as steeply, as covered
const ROOT_COVERED = 0.9;   // of its own thickness: how much lower a root lies, fully covered
const ROOT_BARED = 0.6;     // and how much higher, fully bare
const ROOT_RIDES = 0.75;    // of its own thickness: its middle is never higher above the ground than this (it never leaves it)
function rootInto(out, root, w, look, ground = null, slope = null) {
  if (!(root.long > 0.05)) return;
  const thick = Math.max(0.02, w.girth * 0.38 * root.strength * (0.6 + 0.8 * Math.min(1.2, w.flare)));
  // (It starts just inside the foot, where the foot's ridge for it ends.)
  const start = w.girth * (1 + w.flare * (0.7 + 0.9 * root.strength)) * 0.75;
  // (Its colour is the foot's: on a ground of its own, whatever height that carries it to.)
  const flat = (y, shade) => look.bark(ground ? 0 : Math.max(0, y), shade);
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
      const floor = ground ? ground(x, z) : 0;
      let rides = -0.35 * r + free * 1.8 * r * push[1];
      if (slope) {
        // (How steeply the ground falls from the tree's middle to here: downhill of the tree, bare; uphill, covered.)
        const falls = clamp((slope.foot - floor) / (Math.max(0.1, Math.hypot(x, z)) * BARE_AT), -1, 1);
        rides = Math.min(ROOT_RIDES * r, rides + slope.bare * free * r * (falls > 0 ? ROOT_BARED : ROOT_COVERED) * falls);
      }
      const y = floor + rides - (2.6 * last + 0.08) * under * under * (3 - 2 * under);
      points.push({ p: [x, y, z], r, reach: 0, phase: 0, heading: 0 });
      if (forks && !fork && t >= forks.at) fork = { x, z, angle: heading + forks.turn, long: (1 - t) * long * 0.75, thick: r * 0.62, seed: seed + 1 };
      x += Math.cos(heading) * (long / steps);
      z += Math.sin(heading) * (long / steps);
    }
    out.lines?.push(points); // (its middle line, for whoever asks: rootLinesOf)
    tubeInto(out, points, Math.max(5, sidesOf(r0)), { bark: flat, lumps: look.lumps, shape: null, w, trunk: false, capped: true });
    if (fork && fork.long > 0.4) draw(fork);
  };
  // (A root longer than 2 m forks, somewhere in its first half, to one side.)
  const own = mulberry32(root.seed);
  const at = 0.25 + own() * 0.25, turn = (own() < 0.5 ? -1 : 1) * (0.5 + own() * 0.4);
  draw({ x: Math.cos(root.angle) * start, z: Math.sin(root.angle) * start, angle: root.angle, long: root.long, thick, seed: root.seed, forks: root.long > 2 ? { at, turn } : null });
}

// --- Needles ------------------------------------------------------------------------------

// A kind with needles carries twigs along every branch (a bough: the
// branch with its twigs and their needles), from a little way out to its
// end, longest about two thirds along. Two ways, by the kind:
//
// - fronds (a fir's): the twigs leave the branch left and right, level,
//   pointing forward, and the needles are one sheet draped over them
//   (drapeInto): the branch is a flat spray with a toothed edge. (The
//   leader's twigs, all round an upright shoot, are each a blade of
//   needles.)
// - brushes (a pine's): the twigs leave the branch all round it and turn
//   up, bare (they're drawn as wood), each ending in a plume of needles:
//   crowns of needles round the shoot, each crown's needles joined at
//   their feet into one piece with a zigzag edge (crownsOf).
//
// A simplification, said plainly: a blade is a branchlet's needles drawn as
// one piece, and a pine's needle is a bundle of needles drawn as one,
// thicker than life (true needles are too thin to draw at a tree's
// distance). They move with their branch in the wind.

const GOLDEN_TURN = Math.PI * (3 - Math.sqrt(5));
const BLADE = 1.4; // m: a fir's twig longer than this carries blades of its own
const SHORTEST = 0.4; // m: no twig is shorter than this (a short branch near the top still carries a spray)

// How long a bough's twigs are along it (t: 0 where its needles start, 1
// its tip), as a share of the longest: quickly out, longest two thirds
// along, drawn in to its tip.
const boughProfile = (t) => (t < 0.65 ? 0.08 + 0.92 * Math.pow(t / 0.65, 0.7) : 1 - 0.8 * Math.pow((t - 0.65) / 0.35, 1.6));

const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const along = (p, d, far) => [p[0] + d[0] * far, p[1] + d[1] * far, p[2] + d[2] * far];
const mixed = (a, ka, b, kb) => [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
// Level and across a direction (for one that stands upright: any level way).
const acrossOf = (d) => (Math.hypot(d[0], d[2]) > 1e-4 ? unit([-d[2], 0, d[0]]) : [1, 0, 0]);

// A triangle put the way round that faces `toward`.
function facing(out, a, b, c, toward) {
  const u = [b.v[0] - a.v[0], b.v[1] - a.v[1], b.v[2] - a.v[2]], v = [c.v[0] - a.v[0], c.v[1] - a.v[1], c.v[2] - a.v[2]];
  const n = cross(u, v);
  if (n[0] * toward[0] + n[1] * toward[1] + n[2] * toward[2] < 0) triangle(out, a, c, b);
  else triangle(out, a, b, c);
}

// A bough's twigs: [{ base, dir, length, sway, way, side }], each from the
// branch at `base`, `length` m toward `dir` (`way`: the way the branch
// goes there; `side`: level, across it); the last is the branch's own end.
export function twigsOf(bough) {
  const points = bough.points, lengths = lengthsOf(points), whole = lengths.at(-1);
  const from = whole * bough.bare, leafy = whole - from;
  const brushes = bough.style === 'brushes';
  const count = Math.max(brushes ? 3 : 4, Math.round(leafy * bough.twigs * (bough.leader ? 2.5 : 1)));
  const chance = (i, k) => cornerChance(i, k, bough.seed);
  const high = bough.high ?? 0.5;
  const twigs = [];
  let side = [1, 0, 0];
  const wayAt = (at) => {
    const a = pointAt(points, lengths, Math.max(0, at - 0.3)), b = pointAt(points, lengths, Math.min(whole, at + 0.3));
    return unit([b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]]);
  };
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5 + (chance(i, 1) - 0.5) * 0.5) / count;
    const at = pointAt(points, lengths, from + leafy * t), way = wayAt(from + leafy * t);
    if (Math.hypot(way[0], way[2]) > 1e-3) side = acrossOf(way); // (where the branch stands upright: as the twig before)
    const lift = cross(side, way);
    const length = Math.max(SHORTEST * (brushes ? 0.6 : 1), bough.half * boughProfile(t) * (0.8 + 0.4 * chance(i, 2)));
    let dir;
    if (brushes) {
      // All round the branch, in a spiral; forward, and turning up.
      const turn = i * GOLDEN_TURN + chance(i, 3), out = mixed(side, Math.cos(turn), lift, Math.sin(turn));
      if (out[1] < 0) out[1] *= -0.35; // (a shoot from under the branch turns out to the side and up: none hangs below it)
      dir = mixed(way, 0.72, unit(out), 0.69);
      dir[1] += 0.55;
    } else if (Math.abs(way[1]) > 0.8) {
      // (An upright shoot, the leader: its twigs all round it, rising.)
      const turn = i * GOLDEN_TURN + chance(i, 3), out = mixed(side, Math.cos(turn), lift, Math.sin(turn));
      dir = mixed(way, 0.5, out, 0.87);
    } else {
      // Left and right by turns, level; forward, more so toward the bough's tip; hanging a little.
      const angle = ((62 - 18 * t + 10 * (chance(i, 3) - 0.5)) * Math.PI) / 180;
      dir = mixed(way, Math.cos(angle), side, (i % 2 ? 1 : -1) * Math.sin(angle));
      dir[1] += -0.08 + 0.55 * (chance(i, 4) - 0.5); // (hanging a little, some above the frond's plane, some below: a frond has depth)
      // (And by its kind's habit: a branchlet hangs with its years, so most low in the crown and near the trunk; a sun shoot at the top stands a little.)
      dir[1] += (bough.sun ?? 0) * 0.18 * high - (bough.sag ?? 0) * (0.25 + 0.75 * (1 - high)) * (1 - 0.6 * t) * Math.min(1, length / 0.9);
    }
    twigs.push({ base: at.p, dir: unit(dir), length, sway: [at.phase, at.reach, at.heading], way, side });
  }
  // (The branch's own end carries on as a twig.)
  const last = points.at(-1), way = wayAt(whole), onward = [...way];
  if (brushes) onward[1] += 0.35;
  twigs.push({ base: last.p, dir: unit(onward), length: Math.max(0.25, bough.half * 0.3), sway: [last.phase, last.reach, last.heading], way, side });
  return twigs;
}

function needlesGeometry(boughs) {
  const out = { position: [], color: [], branch: [] };
  for (const bough of boughs) {
    const twigs = twigsOf(bough);
    // (A pine's: each twig a plume, crowns of needles round its outer part.)
    if (bough.style === 'brushes') twigs.forEach((twig, i) => { for (const crown of crownsOf(twig, bough, i)) crownInto(out, crown, twig.sway); });
    // (The leader: twigs all round an upright shoot, each a blade, and the shoot's own needles.)
    else if (bough.leader) { twigs.forEach((twig, i) => frondInto(out, twig, bough, i)); spineInto(out, bough); }
    // (A frond: one sheet draped over its twigs.)
    else drapeInto(out, bough, twigs);
  }
  return geometryOf(out);
}

// A fir's frond as one draped sheet: its twigs are the ribs, and the needles
// are drawn as a single piece laid over them, thick over the branch and
// thinning to nothing at its hem, where it hangs as far as the twigs do.
// The hem is ragged: out to each twig's tip, and in again between one twig
// and the next (now and then nearly to the branch: a gap, where the sky
// shows from underneath). Its underside is flat and dark.
//
// The oak's leaves are joined the same way in spirit (./leafMass.js), in
// their own shape: a broadleaf's clusters fill a volume, a fir's frond is a
// sheet. A simplification, said plainly: a frond's needles drawn as one
// surface, its body simplified and its edge kept where the twigs put it.
const GAP = 0.15; // of the hem's notches, the share that run nearly to the branch
const WIDE = 1.1; // m: a sheet wider than this, from the branch to its hem, has a row of corners between
function drapeInto(out, bough, twigs) {
  const end = twigs.at(-1), ribs = twigs.slice(0, -1);
  if (ribs.length < 2) { twigs.forEach((twig, i) => frondInto(out, twig, bough, i)); return; }
  const points = bough.points, lengths = lengthsOf(points);
  const start = pointAt(points, lengths, lengths.at(-1) * bough.bare);
  const sun = bough.sun ?? 0, high = bough.high ?? 0.5;
  // (Sun needles at the top of the tree stand up off the twig and are short: a thicker, narrower frond.
  // Shade needles low down are long and combed flat: a thinner, wider one.)
  const thick = bough.needle * (0.55 + sun * (0.5 * high - 0.2));
  const longer = 1 + sun * (0.2 - 0.45 * high);
  const chance = (i, k) => cornerChance(i, k, bough.seed);
  const tips = ribs.map((twig) => along(twig.base, twig.dir, twig.length * longer));
  const endTip = along(end.base, end.dir, end.length);
  const between = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const shade = (light) => { const v = light * bough.shade; return [v, v, v]; };
  const up = [0, 1, 0], down = [0, -1, 0];
  const n = ribs.length;
  for (const side of [0, 1]) {
    // Along the branch: where its needles start, each twig's foot, its end. On this side of it, at each:
    // the frond's hem (a twig of this side: its tip; a twig of the other: the notch between this side's
    // tips either side of it), and how thick the needles lie over the branch there.
    const row = [{ axis: start.p, hem: start.p, thick: 0, sway: [start.phase, start.reach, start.heading] }];
    for (let i = 0; i < n; i++) {
      let hem;
      if (i % 2 === side) hem = tips[i];
      else {
        const before = i > 0 ? tips[i - 1] : start.p, after = i < n - 1 ? tips[i + 1] : endTip;
        const deep = chance(i, 11) < GAP ? 0.88 : 0.2 + 0.4 * chance(i, 12);
        hem = between(between(before, after, 0.5), ribs[i].base, deep);
        hem[1] -= 0.08 * ribs[i].length * (1 - deep); // (the sheet sags a little between its ribs)
      }
      row.push({ axis: ribs[i].base, hem, thick: thick * Math.min(1, 0.45 + (i + 1) / 3), sway: ribs[i].sway });
    }
    row.push({ axis: end.base, hem: endTip, thick: thick * 0.5, sway: end.sway });
    row.forEach((at, j) => {
      const wide = dist(at.axis, at.hem), part = 0.42 + 0.2 * chance(j * 2 + side, 13);
      at.mid = between(along(at.axis, up, at.thick), at.hem, part);
      at.mid[1] += 0.1 * wide;
    });
    for (let j = 0; j + 1 < row.length; j++) {
      const a = row[j], b = row[j + 1];
      const corner = (v, light, sway) => ({ v, color: shade(light), sway });
      const ridgeA = corner(along(a.axis, up, a.thick), 1, a.sway), ridgeB = corner(along(b.axis, up, b.thick), 1, b.sway);
      const hemA = corner(a.hem, 0.8, a.sway), hemB = corner(b.hem, 0.8, b.sway);
      if (Math.max(dist(a.axis, a.hem), dist(b.axis, b.hem)) > WIDE) {
        // (A wide sheet has a row of corners between the branch and its hem, a little above the straight
        // line between them: cloth over a branch is rounded, and falls away toward its edge.)
        const midA = corner(a.mid, 0.92, a.sway), midB = corner(b.mid, 0.92, b.sway);
        facing(out, ridgeA, midA, midB, up);
        facing(out, ridgeA, midB, ridgeB, up);
        facing(out, midA, hemA, hemB, up);
        facing(out, midA, hemB, midB, up);
      } else {
        facing(out, ridgeA, hemA, hemB, up);
        facing(out, ridgeA, hemB, ridgeB, up);
      }
      const underA = corner(a.axis, 0.5, a.sway), underB = corner(b.axis, 0.5, b.sway), darkA = corner(a.hem, 0.55, a.sway), darkB = corner(b.hem, 0.55, b.sway);
      facing(out, underA, darkA, darkB, down);
      facing(out, underA, darkB, underB, down);
    }
  }
}

// A fir's branch carries needles on its own shoot too. Where its twigs are
// long their blades cover it; where they're short (toward its tip, where
// its needles start, and all along a short branch near the tree's top) it's
// drawn: blades end to end along the branch, joining its twigs into one
// spray.
const COVERED = 0.8; // m: twigs this long cover the branch they leave
function spineInto(out, bough) {
  const points = bough.points, lengths = lengthsOf(points), whole = lengths.at(-1);
  const from = whole * bough.bare, leafy = whole - from;
  const count = Math.max(1, Math.ceil(leafy / 0.7));
  for (let i = 0; i < count; i++) {
    if (bough.half * boughProfile((i + 0.5) / count) > COVERED) continue;
    const a = pointAt(points, lengths, from + (leafy * i) / count), b = pointAt(points, lengths, from + (leafy * (i + 1)) / count);
    const length = dist(a.p, b.p);
    if (length < 1e-3) continue;
    const dir = unit([b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]]);
    bladeInto(out, a.p, dir, length * 1.2, Math.min(bough.needle, 0.7 * length) * 0.8, [a.phase, a.reach, a.heading], bough.shade);
  }
}

// A blade of needles: level across, from `base` `length` m toward `dir`,
// `width` m at its widest (a little short of halfway), with body: a ridge
// along its top (a fir's needles stand up off the twig: `high` times its
// width), flat underneath; lighter on top, dark underneath. Seen from the side it's a
// wedge, not a line.
function bladeInto(out, base, dir, length, width, sway, shade, high = 0.55) {
  const across = acrossOf(dir), over = cross(across, dir);
  const middle = along(base, dir, length * 0.45);
  const corner = (v, light) => ({ v, color: [light * shade, light * shade, light * shade], sway });
  const start = corner(base, 0.8), tip = corner(along(base, dir, length), 0.95), ridge = corner(along(middle, over, high * width), 1);
  const left = corner(along(middle, across, -width / 2), 0.86), right = corner(along(middle, across, width / 2), 0.86);
  facing(out, start, left, ridge, over);
  facing(out, left, tip, ridge, over);
  facing(out, tip, right, ridge, over);
  facing(out, right, start, ridge, over);
  const under = [-over[0], -over[1], -over[2]];
  const dark = (c) => corner(c.v, 0.55);
  facing(out, dark(start), dark(left), dark(tip), under);
  facing(out, dark(start), dark(tip), dark(right), under);
}

// A fir's twig: a blade; a long one, a small frond: a narrow blade along
// it, and blades of its own left and right, shorter toward its end.
function frondInto(out, twig, bough, which) {
  const shade = bough.shade * (0.92 + 0.16 * cornerChance(which, 7, bough.seed));
  // (Sun needles at the top of the tree: shorter, standing up off the twig, so a narrower blade with a
  // high ridge. Shade needles low down: longer, combed flat left and right, so a wider, flatter one.)
  const sun = bough.sun ?? 0, high = bough.high ?? 0.5;
  const ridge = 0.55 + sun * (0.5 * high - 0.2);
  const widthOf = (length) => Math.min(bough.needle, 0.7 * length) * (1 + sun * (0.2 - 0.45 * high)); // (a short twig's blade is stubby)
  const hangs = (bough.sag ?? 0) * (0.25 + 0.75 * (1 - high));
  if (twig.length <= BLADE) {
    bladeInto(out, twig.base, twig.dir, twig.length, widthOf(twig.length), twig.sway, shade, ridge);
    return;
  }
  bladeInto(out, twig.base, twig.dir, twig.length, widthOf(twig.length) * 0.6, twig.sway, shade, ridge);
  const across = acrossOf(twig.dir);
  const count = Math.max(2, Math.round(twig.length * bough.twigs));
  for (let i = 0; i < count; i++) {
    const t = (i + 0.6) / (count + 0.4);
    const angle = ((58 - 14 * t) * Math.PI) / 180;
    const dir = mixed(twig.dir, Math.cos(angle), across, (i % 2 ? 1 : -1) * Math.sin(angle));
    dir[1] -= 0.06 + hangs * 0.4 * t; // (a long twig's own blades hang too, those toward its end most)
    const length = twig.length * 0.55 * (1 - 0.6 * t) * (0.85 + 0.3 * cornerChance(which * 31 + i, 8, bough.seed));
    bladeInto(out, along(twig.base, twig.dir, twig.length * t * 0.9), unit(dir), length, widthOf(length), twig.sway, shade, ridge);
  }
}

// A pine's shoot carries its needles along its outer part, all round it,
// pointing forward: a plume, the twig bare behind it. Here a plume is
// crowns of needles: rings round the shoot, the rear one opened wide, the
// one near its end narrower, each ring one piece. Its needles are joined
// from their feet to a little under halfway up by a web, so its edge runs
// tip, notch, tip, notch (a zigzag), and seen from its end it's a star.
// Nothing in it is round: the solid part is where the needles lie close,
// near the shoot, as a real plume is dense there.
//
// The fir's frond has a toothed hem in the same spirit. A simplification,
// said plainly: a needle here is a bundle of needles drawn as one, thicker
// than life, and a crown's web stands for the needles too close to tell
// apart.
const CROWNS = [{ at: 0.45, open: 46, needles: 5 }, { at: 0.82, open: 24, needles: 4 }]; // each: where along the twig, how far its needles open from the shoot (degrees), how many
const SMALL = { under: 0.45, at: 0.75, open: 36, needles: 5 }; // a twig shorter than this (m) carries one crown
const WEB = 0.34;                                           // the web between two needles reaches this far up the shorter
// A twig's crowns: [{ foot, back, front, tips, notches, shade }] (back and front: on the shoot, behind and ahead of
// the foot: where the crown's outer and inner sides come to a point).
export function crownsOf(twig, bough, which) {
  const needle = Math.max(0.22, Math.min(bough.needle, 1.2 * twig.length)); // (little longer than the twig that carries it: a sapling's are short)
  const side = acrossOf(twig.dir), lift = cross(side, twig.dir);
  const rings = twig.length < SMALL.under ? [SMALL] : CROWNS;
  return rings.map((ring, c) => {
    const n = ring.needles, open = (ring.open * Math.PI) / 180;
    const foot = along(twig.base, twig.dir, twig.length * ring.at);
    const turn = which * GOLDEN_TURN + (c * Math.PI) / n + cornerChance(which, 30 + c, bough.seed) * 0.6;
    const way = (round) => unit(mixed(twig.dir, Math.cos(open), mixed(side, Math.cos(round), lift, Math.sin(round)), Math.sin(open)));
    const lengths = Array.from({ length: n }, (_, k) => needle * (0.85 + 0.3 * cornerChance(which * 13 + k, 40 + c, bough.seed)));
    return {
      foot,
      back: along(foot, twig.dir, -0.08 * needle),
      front: along(foot, twig.dir, 0.3 * needle * Math.cos(open)),
      tips: lengths.map((length, k) => along(foot, way(turn + (k * 2 * Math.PI) / n), length)),
      notches: lengths.map((length, k) => along(foot, way(turn + ((k + 0.5) * 2 * Math.PI) / n), WEB * Math.min(length, lengths[(k + 1) % n]))),
      shade: bough.shade * (0.9 + 0.2 * cornerChance(which, 50 + c, bough.seed)),
    };
  });
}
// A crown: its outer side (from its point behind the foot out to its zigzag edge) and its inner side (from its
// point ahead of the foot, darker: the inside of the funnel), four triangles a needle.
function crownInto(out, crown, sway) {
  const { back, front, tips, notches, shade } = crown, n = tips.length;
  const corner = (v, light) => ({ v, color: [light * shade, light * shade, light * shade], sway });
  const from = (apex, a, b) => [(apex[0] + a[0] + b[0]) / 3, (apex[1] + a[1] + b[1]) / 3, (apex[2] + a[2] + b[2]) / 3];
  const away = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  for (let k = 0; k < n; k++) {
    const tip = tips[k], before = notches[(k + n - 1) % n], after = notches[k];
    for (const [a, b] of [[before, tip], [tip, after]]) {
      const tipLight = (v) => (v === tip ? 1 : 0.8);
      facing(out, corner(back, 0.62), corner(a, tipLight(a)), corner(b, tipLight(b)), away(from(back, a, b), front));
      facing(out, corner(front, 0.5), corner(a, v6(a === tip)), corner(b, v6(b === tip)), away(from(front, a, b), back));
    }
  }
}
// (How light a corner of a crown's inner side is: its needle's tip, or the web's notch.)
const v6 = (tip) => (tip ? 0.88 : 0.6);

// A pine's twigs are bare below their plumes: thin sticks of wood, three-sided.
function stickInto(out, twig, bark) {
  const p = acrossOf(twig.dir), q = cross(p, twig.dir);
  const end = along(twig.base, twig.dir, twig.length);
  const ring = (c, r) => [0, 1, 2].map((j) => ({ v: along(along(c, p, Math.cos((j * 2 * Math.PI) / 3) * r), q, Math.sin((j * 2 * Math.PI) / 3) * r), color: bark(c[1]), sway: twig.sway }));
  const a = ring(twig.base, Math.min(0.03, 0.012 + 0.012 * twig.length)), b = ring(end, 0.01);
  for (let j = 0; j < 3; j++) {
    const k = (j + 1) % 3;
    const outward = [(a[j].v[0] + a[k].v[0]) / 2 - twig.base[0], (a[j].v[1] + a[k].v[1]) / 2 - twig.base[1], (a[j].v[2] + a[k].v[2]) / 2 - twig.base[2]];
    facing(out, a[j], a[k], b[k], outward);
    facing(out, a[j], b[k], b[j], outward);
  }
}

// --- Leaves -------------------------------------------------------------------------------
