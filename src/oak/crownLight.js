// Leaves where there's light.
//
// A crown isn't full of leaves. Leaves live where enough light reaches
// them, so they sit in the crown's top and outside; under that layer there
// are fewer, and fewer still further in and further down, where the leaves
// above have taken the light. The inner and lower branches are bare. What
// has been measured in real oaks (mostly sessile oak in forests, the
// nearest there is):
//
// - the upper 40 to 55% of a tree's height holds 79 to 88% of its leaf
//   area, most of it a quarter to a third of the way down the crown;
// - the lowest leaves live on about 6% of full light (sessile oak; the
//   English oak asks a little more), against 1% in beech;
// - a layer of leaves stops light as Beer and Lambert's law says, with
//   oak's k of 0.48: a square metre of leaf over a square metre of ground
//   passes 62% of the light. An oak ends up carrying about 5.5 m2 of leaf
//   for each m2 of ground under it, which is just what that light limit
//   allows (ln(1 / 0.07) / 0.48);
// - leaf clouds fill only about a tenth of the crown's space in a mapped
//   oak, and from under a crown 7 to 24% of the sky shows through.
//
// (Hagemeier and Leuschner 2019, two papers in Forests 10; Fleck 2002,
// Bayreuth; Raumonen et al. 2017. Read for TreeLab on 2026-11-10.)
//
// Here: the clusters of leaves are taken from the top down. For each, the
// share of the sky's light that reaches its underside, through its own
// leaves and the clusters already kept (above it and round it), is worked
// out by Beer and Lambert's law along 26 ways up into the sky. Leaves need
// at least that least light, so a cluster is no thicker than its own
// leaves allow (on its own under the open sky, a ball about 2.8 m in
// radius, for the usual leafiness), smaller under
// others, and under too many it keeps none: its twigs stay bare.
//
// A tree grown among others gets no light from the low sky: its
// neighbours' crowns stand in the way (`crowded`: how near they stand, as
// crowns as tall as its own, the tree's own width away at 1). So a
// forest-grown oak carries its leaves at the top and is bare below, where
// one in the open is leafy down its sides.
//
// TreeLab's clusters are low-poly lumps, bigger than a real leaf cloud, so
// they fill more of the crown than real ones do; the layer of leaves, its
// gaps and the bare inside are the real thing.

export const K = 0.48;          // how much light leaves stop: oak's, in Beer and Lambert's law
export const LEAF_AREA = 1.8;   // m2 of leaf in each m3 of a cluster (a real oak's sun crown: 2.8; its shade crown: 0.5)
export const LEAST = [0.14, 0.05]; // the least light leaves live on, as a share of full light: a thin crown's, and a full one's (leafiness 0 and 1)
const SMALLEST = 0.45;          // a cluster with too little light for its size is tried smaller, down to this share of it

// 26 ways up into the sky (rings 78.75, 56.25, 33.75 and 11.25 degrees up,
// as src/skyShade.js looks), each weighing what its band of an even sky
// gives a level leaf.
const SKY = (() => {
  const ways = [[78.75, 4], [56.25, 6], [33.75, 8], [11.25, 8]].flatMap(([degrees, count], ring) => {
    const e = (degrees * Math.PI) / 180;
    return Array.from({ length: count }, (_, k) => {
      const a = ((k + ring * 0.37) / count) * Math.PI * 2;
      return { d: [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)], w: Math.sin(2 * e) / count, rise: Math.tan(e) };
    });
  });
  const sum = ways.reduce((s, r) => s + r.w, 0);
  for (const r of ways) r.w /= sum;
  return ways;
})();

// How far a ray from p along d (a unit way) runs inside a clump: a ball of
// `radius`, `squash` times as tall as wide, round `center`.
export function through(p, d, clump) {
  const s = clump.squash, r = clump.radius, c = clump.center;
  const ox = p[0] - c[0], oy = (p[1] - c[1]) / s, oz = p[2] - c[2];
  const vy = d[1] / s;
  const a = d[0] * d[0] + vy * vy + d[2] * d[2];
  const b = ox * d[0] + oy * vy + oz * d[2];
  const q = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - a * q;
  if (disc <= 0) return 0;
  const root = Math.sqrt(disc);
  const from = Math.max(0, (-b - root) / a), to = (-b + root) / a;
  return to > from ? to - from : 0;
}

// The share of the sky's light that reaches p through the clumps (1: all
// of it). own: a clump not to count. neighbours: { top (m: how high the
// crowns round about stand), away (m: how far off) }, or none: a way up
// that passes under their tops is shut.
export function lightAt(p, clumps, own = null, neighbours = null) {
  // (Only clumps reaching above p can stand in an upward way.)
  const over = clumps.filter((c) => c !== own && c.center[1] + c.radius * c.squash > p[1]);
  let light = 0;
  for (const { d, w, rise } of SKY) {
    if (neighbours && p[1] + rise * neighbours.away < neighbours.top) continue;
    let leaves = 0;
    for (const clump of over) leaves += through(p, d, clump);
    light += w * Math.exp(-K * LEAF_AREA * leaves);
  }
  return light;
}

// The least light leaves live on, for a crown this full (leafiness 0 to 1).
export const leastFor = (leafiness) => LEAST[0] + (LEAST[1] - LEAST[0]) * Math.min(1, Math.max(0, leafiness));

// The biggest a clump can be, on its own under the open sky, for its
// underside still to get `least` of the light through its own leaves
// (its radius, m).
export function biggest(least, squash) {
  let lo = 0.1, hi = 8;
  for (let i = 0; i < 12; i++) {
    const radius = (lo + hi) / 2, one = { center: [0, 0, 0], radius, squash };
    if (lightAt([0, -radius * squash, 0], [one]) >= least) lo = radius; else hi = radius;
  }
  return lo;
}

// The clumps that keep their leaves, from the top down. Each { center,
// radius, squash, ... } is kept at the biggest size (its own, or less, down
// to SMALLEST of it) at which its underside still gets `least` of the
// sky's light, through its own leaves and the clumps kept before it; at
// none of those sizes: it keeps no leaves. Each kept one gets `light`
// (what its underside gets).
export function leafy(clumps, least, neighbours = null) {
  const kept = [];
  const fits = (clump, size) => {
    const one = { ...clump, radius: clump.radius * size };
    kept.push(one);
    one.light = lightAt([one.center[0], one.center[1] - one.radius * one.squash, one.center[2]], kept, null, neighbours);
    kept.pop();
    return one.light >= least ? one : null;
  };
  // (From the top down; those level with each other in a set order, so the
  // same clumps keep their leaves however they're given.)
  const down = (a, b) => b.center[1] - a.center[1] || a.center[0] - b.center[0] || a.center[2] - b.center[2];
  for (const clump of clumps.slice().sort(down)) {
    let best = fits(clump, 1);
    if (!best) {
      // (The biggest size that fits, found by halving: none if the smallest doesn't.)
      let lo = SMALLEST, hi = 1;
      best = fits(clump, lo);
      for (let i = 0; best && i < 3; i++) {
        const mid = (lo + hi) / 2, at = fits(clump, mid);
        if (at) { best = at; lo = mid; } else hi = mid;
      }
    }
    if (best) kept.push(best);
  }
  return kept;
}
