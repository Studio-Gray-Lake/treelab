import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OAK_SHAPE, buildOak, layoutOak } from '../src/oak/oak.js';
import { agedBy, markedAt, meshOak, shaped, sidesFor, sidesOfTree, tubesOf } from '../src/oak/oakMesh.js';

// The oak's own mesher (src/oak/oakMesh.js): round wood, joints that swell,
// a foot that spreads into roots, and the trunk's marks.

const SEEDS = [11, 22, 33];
const plain = { ...OAK_SHAPE, lean: [0, 0], bends: 0, gnarl: 0, burrs: 0, hollows: 0, stubs: 0, flare: 0, roots: 0 };
const corners = (g) => {
  const p = g.attributes.position, c = g.attributes.color;
  return Array.from({ length: p.count }, (_, i) => ({ x: p.getX(i), y: p.getY(i), z: p.getZ(i), light: c.getX(i), red: c.getX(i), blue: c.getZ(i) }));
};
// How far the wood reaches from the trunk's axis between two heights (m).
const reachBetween = (tree, lo, hi) => Math.max(0, ...corners(tree.wood).filter((v) => v.y >= lo && v.y <= hi).map((v) => Math.hypot(v.x, v.z)));

test('thick wood is drawn round, a twig with three sides', () => {
  assert.equal(sidesFor(0.015), 3);
  assert.ok(sidesFor(0.6) >= 9, `a 0.6 m trunk: ${sidesFor(0.6)} sides`);
  assert.ok(sidesFor(1.3) >= 18 && sidesFor(1.3) <= 24, `an ancient trunk: ${sidesFor(1.3)} sides`);
  let last = 0;
  for (let r = 0.01; r < 2; r += 0.01) {
    assert.ok(sidesFor(r) >= last, `thicker wood with fewer sides at ${r.toFixed(2)} m`);
    last = sidesFor(r);
  }
});

test('the mesher gives what the planter and the sway take', () => {
  for (const seed of SEEDS) {
    const tree = buildOak(seed, OAK_SHAPE);
    for (const g of [tree.wood, tree.foliage]) {
      assert.equal(g.index, null, 'indexed');
      for (const name of ['position', 'normal', 'color', 'branch']) assert.ok(g.attributes[name], `no ${name}`);
      assert.equal(g.attributes.position.count % 3, 0);
      assert.ok(g.attributes.position.array.every(Number.isFinite) && g.attributes.normal.array.every(Number.isFinite), 'broken numbers');
    }
    assert.equal(tree.clumps.length, tree.layout.clumps.length);
    assert.ok(tree.height > 10 && tree.reach > 5 && tree.crown > 4);
    // (The trunk doesn't sway; the wood further out does.)
    const sways = tree.wood.attributes.branch;
    let most = 0;
    for (let i = 0; i < sways.count; i++) most = Math.max(most, sways.getY(i));
    assert.ok(most > 0.01, 'no wood sways');
  }
});

test('a branch is thicker where it leaves its parent, never as thick as it, and no wood thickens outward', () => {
  for (const seed of SEEDS) {
    const { wood } = layoutOak(seed, OAK_SHAPE);
    let collars = 0;
    for (const run of wood.runs) {
      const points = shaped(run, wood);
      for (let i = 1; i < points.length; i++) assert.ok(points[i].r <= points[i - 1].r + 1e-9, `seed ${seed}: wood thickens outward`);
      if (!run.side || run.stalk || run.points[0].r < 0.1 || points.length < 4) continue;
      collars++;
      assert.ok(points[0].r < run.parent, `seed ${seed}: a branch of ${points[0].r.toFixed(2)} m leaves wood of ${run.parent.toFixed(2)} m`);
      assert.ok(points[0].r > run.points[0].r * 1.15, `seed ${seed}: no collar (${points[0].r.toFixed(3)} m where the branch is ${run.points[0].r.toFixed(3)} m)`);
    }
    assert.ok(collars > 3, `seed ${seed}: only ${collars} branches with a collar`);
  }
});

test('the trunk\'s marks change the wood and nothing else', () => {
  const usual = layoutOak(11, plain);
  for (const change of [{ gnarl: 0.8 }, { burrs: 1 }, { hollows: 1 }, { stubs: 1 }, { flare: 0.8 }, { roots: 1 }]) {
    const other = layoutOak(11, { ...plain, ...change });
    assert.equal(other.oak.nodes, usual.oak.nodes, `${Object.keys(change)}: it grew another tree`);
    assert.deepEqual(other.clumps, usual.clumps, `${Object.keys(change)}: its leaves changed`);
    assert.deepEqual(other.segments, usual.segments, `${Object.keys(change)}: its branches changed`);
    assert.notDeepEqual(Array.from(meshOak(other).wood.attributes.position.array), Array.from(meshOak(usual).wood.attributes.position.array), `${Object.keys(change)}: the wood is the same`);
  }
});

test('each mark keeps its place whatever the other sliders do', () => {
  const a = layoutOak(11, { ...OAK_SHAPE, burrs: 1, hollows: 1, stubs: 0.5 }).wood;
  const b = layoutOak(11, { ...OAK_SHAPE, burrs: 1, hollows: 0.34, stubs: 1, gnarl: 0.9, leafiness: 0.3, roots: 1 }).wood;
  assert.deepEqual(b.burrs, a.burrs, 'the burrs moved');
  assert.deepEqual(b.hollows[0], a.hollows[0], 'the first hollow moved');
  assert.deepEqual(b.roots.map((root) => root.angle), a.roots.map((root) => root.angle), 'the roots turned');
  assert.ok(a.roots.length >= 5 && a.roots.length <= 7);
});

test('the foot spreads toward the ground, and roots run out from it', () => {
  for (const seed of SEEDS) {
    const none = buildOak(seed, plain), spread = buildOak(seed, { ...plain, flare: 0.7 }), rooted = buildOak(seed, { ...plain, flare: 0.7, roots: 0.8 });
    const girth = none.layout.oak.girth;
    assert.ok(reachBetween(none, 0, 0.1) < girth * 1.08, `seed ${seed}: a foot with no flare is ${reachBetween(none, 0, 0.1).toFixed(2)} m wide for a ${girth.toFixed(2)} m trunk`);
    assert.ok(reachBetween(spread, 0, 0.1) > girth * 1.6, `seed ${seed}: the foot doesn't spread`);
    assert.ok(reachBetween(spread, 1.8, 2.2) < reachBetween(spread, 0, 0.1) * 0.75, `seed ${seed}: the trunk is as wide 2 m up as at its foot`);
    assert.ok(reachBetween(rooted, -5, 0.2) > reachBetween(spread, -5, 0.2) + girth, `seed ${seed}: no roots run out`);
    assert.ok(Math.min(...corners(rooted.wood).map((v) => v.y)) < -0.05, `seed ${seed}: the roots don't sink into the ground`);
  }
});

test('burrs bulge out of the trunk, and a hollow goes deep into it, dark inside', () => {
  for (const seed of SEEDS) {
    const smooth = buildOak(seed, plain);
    const { bare, girth } = smooth.layout.oak;
    const burred = buildOak(seed, { ...plain, burrs: 1 });
    assert.equal(burred.layout.wood.burrs.length, Math.round(8 * agedBy(girth)), `seed ${seed}: eight burrs on a trunk 0.6 m thick, fewer on a thinner one`);
    assert.ok(reachBetween(burred, 0.3, bare) > reachBetween(smooth, 0.3, bare) + girth * 0.05, `seed ${seed}: no burr stands out`);

    const hollowed = buildOak(seed, { ...plain, hollows: 1 });
    assert.equal(hollowed.layout.wood.hollows.length, 3);
    const dark = corners(hollowed.wood).filter((v) => v.light < 0.1);
    assert.ok(dark.length > 12, `seed ${seed}: nothing dark inside the hollows`);
    assert.ok(Math.min(...dark.map((v) => Math.hypot(v.x, v.z))) < girth * 0.65, `seed ${seed}: the hollows aren't deep`);
    assert.ok(!corners(smooth.wood).some((v) => v.light < 0.1), `seed ${seed}: a trunk with no hollow has dark wood`);
  }
});

test('stubs: more as asked, on the trunk and the limbs, pale where they broke', () => {
  const pale = (tree) => corners(tree.wood).filter((v) => v.red > 0.55 && v.red - v.blue > 0.15).length;
  for (const seed of SEEDS) {
    const none = buildOak(seed, plain), some = buildOak(seed, { ...plain, stubs: 0.4 }), many = buildOak(seed, { ...plain, stubs: 1 });
    assert.equal(none.layout.wood.stubs.length, 0);
    assert.ok(many.layout.wood.stubs.length > some.layout.wood.stubs.length && some.layout.wood.stubs.length > 2, `seed ${seed}: ${some.layout.wood.stubs.length} then ${many.layout.wood.stubs.length} stubs`);
    assert.ok(many.layout.wood.stubs.some((stub) => stub.p) && many.layout.wood.stubs.some((stub) => !stub.p), `seed ${seed}: not on both the trunk and the limbs`);
    assert.equal(pale(none), 0, `seed ${seed}: pale wood with no stub`);
    assert.ok(pale(many) > pale(some) && pale(some) > 0, `seed ${seed}: the breaks aren't pale`);
    for (const stub of many.layout.wood.stubs) assert.ok(stub.r >= 0.018 && stub.r <= 0.14 && stub.long > 0.1, `seed ${seed}: a stub ${stub.r.toFixed(3)} m thick, ${stub.long.toFixed(2)} m long`);
  }
});

test('the usual oak, with its own mesher, is drawn in good time and not too heavily', () => {
  for (const seed of SEEDS) {
    const start = performance.now();
    const tree = buildOak(seed, OAK_SHAPE);
    const ms = performance.now() - start;
    const wood = tree.wood.attributes.position.count / 3;
    assert.ok(wood > 3000 && wood < 11000, `seed ${seed}: ${wood} triangles of wood`);
    assert.ok(ms < 600, `seed ${seed}: ${ms.toFixed(0)} ms`);
  }
});

test('wood drawn in more than one piece is whole: the pieces share the ring where they meet', () => {
  // (A run of wood is drawn as tubes, a new one of fewer sides each time
  // it has thinned enough. Each used to tilt its end ring by its own side
  // of a bend only, and on a bend a wedge opened between them.)
  for (const seed of SEEDS) {
    const { wood } = layoutOak(seed, { ...OAK_SHAPE, crooked: 1 });
    let joins = 0;
    for (const run of wood.runs) {
      const tubes = tubesOf(shaped(run, wood));
      assert.ok(tubes.at(-1).last && tubes.slice(0, -1).every((tube) => !tube.last), 'only the last piece is closed');
      for (let i = 1; i < tubes.length; i++) {
        const before = tubes[i - 1], after = tubes[i];
        const join = before.points.at(-1), way = before.ways.at(-1);
        joins++;
        assert.deepEqual(after.points[1].p, join.p, `seed ${seed}: the next piece doesn't start where the last ended`);
        assert.deepEqual(after.ways[1].toArray(), way.toArray(), `seed ${seed}: the two pieces' rings stand at different angles`);
        assert.ok(after.sides < before.sides, `seed ${seed}: the next piece has no fewer sides`);
        // (And it starts a little back, inside the piece before.)
        const back = after.points[0].p.map((v, k) => join.p[k] - v);
        const along = back[0] * way.x + back[1] * way.y + back[2] * way.z;
        assert.ok(along > 0.3 * join.r && along < join.r && after.points[0].r === join.r, `seed ${seed}: the next piece starts ${along.toFixed(3)} m back for wood ${join.r.toFixed(3)} m thick`);
      }
    }
    assert.ok(joins > 3, `seed ${seed}: only ${joins} places where pieces meet`);
  }
});

// The trunk's marks come with age and gather low down; the trunk bends;
// the roots run over the ground; the mesh is uneven, its facets of one size.

test('a trunk\'s marks come with its thickness, and thin out with height', () => {
  assert.equal(agedBy(0.6), 1);
  assert.ok(agedBy(0.3) < 0.4 && agedBy(1.2) > 1.5 && agedBy(3) <= 1.6);
  for (const girth of [0.2, 0.6, 1.5]) {
    assert.equal(markedAt(0, girth, 0.3), 1);
    assert.ok(markedAt(4, girth, 0.3) < markedAt(1, girth, 0.3) && markedAt(20, girth, 0) < 0.2, 'no fewer marks higher up');
    assert.equal(markedAt(20, girth, 1), 1, '"marks reach up" at 1: evenly all the way');
    assert.ok(markedAt(20, girth, 0.3) >= 0.3);
  }
  assert.ok(markedAt(6, 1.2, 0) > markedAt(6, 0.3, 0), 'a thick trunk isn\'t marked higher up than a thin one');
  // A tall trunk, with every burr asked for: thick, it has more than thin;
  // and they sit lower the less "marksHigh" is.
  const tall = { ...plain, height: [28, 28], trunk: [14, 14], burrs: 2 };
  const mean = (list) => list.reduce((sum, v) => sum + v, 0) / list.length;
  for (const seed of SEEDS) {
    const thick = layoutOak(seed, { ...tall, girth: [0.9, 0.9] }).wood, thin = layoutOak(seed, { ...tall, girth: [0.3, 0.3] }).wood;
    assert.ok(thick.burrs.length > 2 * thin.burrs.length, `seed ${seed}: ${thick.burrs.length} burrs on the thick trunk, ${thin.burrs.length} on the thin`);
    assert.ok(thin.gnarl < thick.gnarl || tall.gnarl === 0);
    const low = layoutOak(seed, { ...tall, girth: [0.9, 0.9], marksHigh: 0 }).wood.burrs, even = layoutOak(seed, { ...tall, girth: [0.9, 0.9], marksHigh: 1 }).wood.burrs;
    assert.equal(low.length, even.length);
    assert.ok(mean(low.map((b) => b.y)) < 0.6 * mean(even.map((b) => b.y)), `seed ${seed}: burrs at ${mean(low.map((b) => b.y)).toFixed(1)} m on average, ${mean(even.map((b) => b.y)).toFixed(1)} m spread evenly`);
    assert.deepEqual(low.map((b) => b.angle), even.map((b) => b.angle), 'the burrs turned round the trunk');
  }
});

test('gnarl is strongest at the foot of a tall trunk', () => {
  // How uneven the trunk's surface is between two heights: its corners' distances from its axis, their spread.
  const uneven = (tree, lo, hi) => {
    const far = corners(tree.wood).filter((v) => v.y >= lo && v.y <= hi && Math.hypot(v.x, v.z) < 1.2).map((v) => Math.hypot(v.x, v.z));
    const middle = far.reduce((sum, v) => sum + v, 0) / far.length;
    return Math.sqrt(far.reduce((sum, v) => sum + (v - middle) ** 2, 0) / far.length);
  };
  const tall = { ...plain, height: [28, 28], trunk: [14, 14], girth: [0.5, 0.5], stubs: 0 };
  for (const seed of SEEDS) {
    const gnarled = buildOak(seed, { ...tall, gnarl: 1 }), smooth = buildOak(seed, tall);
    const low = uneven(gnarled, 1.5, 3.5) - uneven(smooth, 1.5, 3.5), high = uneven(gnarled, 10, 12) - uneven(smooth, 10, 12);
    assert.ok(low > 0.01 && low > 1.6 * Math.max(0, high), `seed ${seed}: its lumps are ${low.toFixed(3)} m low down, ${high.toFixed(3)} m high up`);
    const even = buildOak(seed, { ...tall, gnarl: 1, marksHigh: 1 });
    assert.ok(uneven(even, 10, 12) - uneven(smooth, 10, 12) > 1.5 * Math.max(0.002, high), `seed ${seed}: "marks reach up" at 1 leaves the high trunk as it was`);
  }
});

test('the trunk bends on its way up, from a foot that stays where it is, and takes the crown with it', () => {
  const tall = { ...plain, height: [26, 26], trunk: [12, 12] };
  for (const seed of SEEDS) {
    const straight = layoutOak(seed, tall), bent = layoutOak(seed, { ...tall, bends: 1 });
    // (The trunk's run carries on into its thickest limb: only as far as the limbs start.)
    const trunk = (layout) => layout.wood.runs.find((run) => run.trunk).points.filter((point) => point.p[1] <= 12);
    const off = (points) => Math.max(...points.map((point) => Math.hypot(point.p[0], point.p[2])));
    assert.ok(off(trunk(straight)) < 0.25, `seed ${seed}: a straight trunk strays ${off(trunk(straight)).toFixed(2)} m`);
    assert.ok(off(trunk(bent)) > 0.35 && off(trunk(bent)) < 3, `seed ${seed}: a bent trunk strays ${off(trunk(bent)).toFixed(2)} m`);
    assert.ok(Math.hypot(trunk(bent)[0].p[0], trunk(bent)[0].p[2]) < 1e-9, 'its foot moved');
    // (Nothing regrown: the same wood, the same clusters, each where the trunk carried it.)
    assert.equal(bent.wood.runs.length, straight.wood.runs.length);
    assert.equal(bent.clumps.length, straight.clumps.length);
    assert.deepEqual(bent.clumps.map((c) => c.radius), straight.clumps.map((c) => c.radius));
    assert.deepEqual(bent.clumps.map((c) => +c.center[1].toFixed(6)), straight.clumps.map((c) => +c.center[1].toFixed(6)), 'a cluster changed height');
    // (No kinks: as bent as an oak's usually is, it turns little from one of its steps to the next.)
    const points = trunk(layoutOak(seed, { ...tall, bends: 0.4 }));
    for (let i = 2; i < points.length; i++) {
      const a = points[i - 2].p, b = points[i - 1].p, c = points[i].p;
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], bc = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
      const cos = (ab[0] * bc[0] + ab[1] * bc[1] + ab[2] * bc[2]) / (Math.hypot(...ab) * Math.hypot(...bc));
      assert.ok(cos > Math.cos((25 * Math.PI) / 180), `seed ${seed}: the trunk kinks by ${((Math.acos(cos) * 180) / Math.PI).toFixed(0)} degrees`);
    }
  }
});

test('roots show above the ground for most of their length, and go under at their ends', () => {
  for (const seed of SEEDS) {
    for (const roots of [0.5, 1, 2]) {
      const tree = buildOak(seed, { ...plain, flare: 1, roots });
      const { girth } = tree.layout.oak;
      const foot = girth * (1 + 1 * 1.6);
      const low = corners(tree.wood).filter((v) => v.y < 1 && Math.hypot(v.x, v.z) > foot);
      const goes = Math.max(...low.map((v) => Math.hypot(v.x, v.z))), shows = Math.max(...low.filter((v) => v.y > 0.01).map((v) => Math.hypot(v.x, v.z)));
      // (A short root is mostly inside the foot, and what's outside it is its end, going under.)
      assert.ok(shows - foot > (roots < 1 ? 0.4 : 0.6) * (goes - foot), `seed ${seed}, roots ${roots}: they run ${(goes - foot).toFixed(1)} m out of the foot and show for ${(shows - foot).toFixed(1)} m`);
      assert.ok(goes - shows > 0.05, `seed ${seed}, roots ${roots}: a root ends above the ground`);
      assert.ok(Math.max(...low.map((v) => v.y)) < 0.9 * girth, `seed ${seed}, roots ${roots}: a root stands ${Math.max(...low.map((v) => v.y)).toFixed(2)} m out of the ground`);
    }
  }
});

test('a limb\'s sides are about as wide as the trunk\'s it leaves', () => {
  for (const seed of SEEDS) {
    for (const change of [{}, { flare: 1.45, gnarl: 0.6 }, { hollows: 1 }]) {
      const w = layoutOak(seed, { ...OAK_SHAPE, ...change }).wood;
      const sidesOf = sidesOfTree(w);
      const facet = (r) => (2 * Math.PI * r) / sidesOf(r);
      const trunk = (2 * Math.PI * w.girth) / sidesOf(w.girth);
      for (const r of [w.girth * 0.9, w.girth * 0.7, w.girth * 0.5]) {
        assert.ok(facet(r) < trunk * 1.75, `seed ${seed}: a limb ${r.toFixed(2)} m thick has sides ${facet(r).toFixed(2)} m wide, the trunk's are ${trunk.toFixed(2)} m`);
        assert.ok(sidesOf(r) >= sidesFor(r) && sidesOf(r) <= sidesOf(w.girth));
      }
      assert.equal(sidesOf(0.02), 3, 'a twig got more sides');
    }
    // (A trunk with no marks has the sides its thickness asks for, and so have its limbs.)
    const bare = layoutOak(seed, plain).wood, sidesOf = sidesOfTree(bare);
    for (const r of [0.05, 0.2, 0.4, 0.6]) assert.equal(sidesOf(r), sidesFor(r));
  }
});

test('thick wood\'s mesh is uneven: its four-sided patches aren\'t all cut the same way', () => {
  for (const seed of SEEDS) {
    const tree = buildOak(seed, { ...plain, gnarl: 0.3 });
    const p = tree.wood.attributes.position;
    const at = (i) => [p.getX(i), p.getY(i), p.getZ(i)];
    const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    // Low on the trunk: each pair of triangles that makes a patch shares its first corner (cut one way) or doesn't (the other).
    let oneWay = 0, other = 0;
    for (let t = 0; t + 5 < p.count; t += 6) {
      const a = at(t), d = at(t + 3);
      if (a[1] < 0.6 || a[1] > 2.2 || Math.hypot(a[0], a[2]) > 1) continue;
      if (same(a, d)) oneWay++;
      else other++;
    }
    assert.ok(oneWay > 20 && other > 20, `seed ${seed}: ${oneWay} patches cut one way, ${other} the other`);
  }
});
