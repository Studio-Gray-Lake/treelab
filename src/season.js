// The season: how much of their leaves the trees carry, how new those
// leaves are, and how far they have turned.
//
// A season is a place to start from, as a kind's age is: choosing one sets
// three settings in plain sight, and each can be moved by hand afterwards.
//
//   leaves (season.leaves): how much of its leaves a tree carries. 1: all
//     of them. Less, and clusters of leaves go, each at its own turn, and
//     those left are smaller: the tree is grown again that way, its bare
//     twigs drawn (src/oak/oak.js). 0: bare.
//   new leaves (season.fresh): how new the leaves are. 1: just out, a pale
//     yellow green, and uneven from limb to limb. 0: summer's own greens.
//   autumn (autumn.amount): how far the leaves have turned (src/colors.js).
//
// Not every kind keeps the same time. A hawthorn and a hazel are in leaf
// weeks before an oak, and an ash comes last; in autumn an ash is bare
// first, and an oak and a beech hold a share of their leaves, brown, far
// into winter. So each kind has its own timing (its frame's "leaf": how
// late it comes into leaf, how long it holds its leaves; src/oak), and the
// same "leaves" gives each kind its own share: leavesOf. An evergreen (the
// holly, every kind with needles) carries all of them the year round.
//
// Said plainly: the workshop's own broadleaf (its generator is not
// TreeLab's) is always grown in full leaf; only its colour follows the
// season. And a tree's leaves go by whole clusters, not leaf by leaf.

export const SEASONS = {
  'early spring': { leaves: 0.25, fresh: 1, autumn: 0 },   // the first leaves breaking: the early kinds half out, the late ones still bare
  'late spring': { leaves: 0.8, fresh: 0.6, autumn: 0 },
  'early summer': { leaves: 1, fresh: 0.3, autumn: 0 },    // a full crown, in shades of green
  'high summer': { leaves: 1, fresh: 0, autumn: 0 },       // TreeLab's own defaults
  'early autumn': { leaves: 1, fresh: 0, autumn: 0.45 },   // turning, nothing fallen yet
  'late autumn': { leaves: 0.5, fresh: 0, autumn: 1 },     // turned, and half fallen
  'mid winter': { leaves: 0.06, fresh: 0, autumn: 1 },     // nearly bare: a few brown leaves, most on the oaks and beeches
};

// What a season changes of the settings (as src/settings.js lays them out).
export const seasonChanges = (name) => ({ season: { leaves: SEASONS[name].leaves, fresh: SEASONS[name].fresh }, autumn: { amount: SEASONS[name].autumn } });

// Which season these settings are, if any ('custom' otherwise).
export function seasonOf(settings) {
  const same = (a, b) => Math.abs(a - b) < 1e-9;
  return Object.keys(SEASONS).find((name) => same(SEASONS[name].leaves, settings.season.leaves) && same(SEASONS[name].fresh, settings.season.fresh) && same(SEASONS[name].autumn, settings.autumn.amount)) ?? 'custom';
}

// A kind with no timing of its own.
export const USUAL_TIMING = { out: 0.5, holds: 0.5 };

// A number from 0 to 1 for a variant, the same every time.
const unit = (i) => {
  let x = Math.imul((i | 0) + 1, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
};

// How much of its leaves a tree of a kind carries, 0 to 1 (to the nearest
// hundredth: trees a hair apart are the same tree).
//   timing: the kind's ({ out: how late it comes into leaf, 0 first to 1
//     last; holds: how long it holds them in autumn, 0 first bare to 1
//     last });
//   season: { leaves }; autumn: { amount } (well turned, the leaves are
//     falling: before it, they are coming or all there);
//   variant: which of its kind's trees it is: each a little ahead of the
//     others or behind them.
// 1 and 0 are 1 and 0 for every kind: in full leaf, and bare.
export function leavesOf(timing, season, autumn, variant = 0) {
  const leaves = Math.min(1, Math.max(0, season.leaves));
  if (leaves >= 1) return 1;
  if (leaves <= 0) return 0;
  const { out, holds } = { ...USUAL_TIMING, ...timing };
  // (0: the last into leaf, or the first bare; 1: the first into leaf, or the last to hold them. From the one to
  // the other as autumn comes, between three and seven tenths turned, with no jump on the way.)
  const turned = Math.min(1, Math.max(0, (autumn.amount - 0.3) / 0.4));
  const ahead = 1 - out + (holds - (1 - out)) * turned * turned * (3 - 2 * turned);
  const own = Math.min(1, Math.max(0, leaves + (unit(variant) - 0.5) * 0.6 * leaves * (1 - leaves)));
  return Math.round(Math.pow(own, 1.6 - 1.2 * ahead) * 100) / 100;
}
