import { OAK_CHOICES, OAK_LIMITS, OAK_SHAPE } from './oak.js';

// TreeLab's other broadleaves: the beech, the hawthorn, the hazel, the
// holly, the ash, the birch and the linden.
//
// (Each frame's "leaf" is when in the year the kind has its leaves, beside
// the others: "out", how late it comes into leaf, 0 the first to 1 the
// last; "holds", how long it holds them in autumn, 0 the first bare to 1
// the last. Hawthorn and hazel are out first, then birch, beech, oak, and
// ash last; ash is bare first, then birch, hazel, hawthorn, and beech and
// oak last, holding brown leaves into winter. src/season.js.)
//
// (And each frame's "site" is where the kind grows: "ground", the stretch
// of the hills' height it likes, 0 their lowest ground to 1 their highest;
// "shade", how much shade it bears, 0 none to 1 any. A beech and a holly
// grow in deep shade, a hazel and a hawthorn in a good deal, an oak and an
// ash in some, a birch in none; an ash keeps to the lower slopes, a birch
// to the higher ground. src/site.js.)
//
// They grow by the same code as the oak (./oak.js: layoutOak), branches
// growing into the space of a crown and competing for it, with leaves in
// clusters that run together into masses (./leafMass.js). What makes each
// one itself is its settings and its frame: how tall and wide, how its
// limbs leave the trunk, its crown's outline, how its leaves lie, its bark.
// A shape here has every setting the oak has (it starts from the oak's and
// changes what differs), and may add its own.
//
// The beech (Fagus sylvatica, the common beech; in the forests of Turkey's
// Black Sea coast its near twin, the Oriental beech, doğu kayını, Fagus
// orientalis, which grows the same way).
//
// In the open, grown: 24 to 30 m, a great dense dome nearly as wide as it's
// tall, on a short thick trunk that divides low into many limbs. The upper
// ones set off steeply. The lowest leave it nearly level, sweep out and
// down almost to the ground under their own length, and turn up again at
// their tips. Its branches curve; they don't zig-zag as an oak's do. Its
// leaves lie in flat layers, each spray held level, one above the other,
// and so close that little grows under a beech. Its bark is thin, smooth
// and silver-grey all its life: no furrows, hardly a burr, no stubs (a
// branch it sheds leaves a scar, not a snag). Its roots are shallow and
// run out over the ground from a flared foot. In autumn it turns copper.
//
// In a wood, among others as tall: a smooth straight column, bare for 15
// to 20 m, with a narrow crown of steep limbs at the top.
//
// Old (250 to 300 years, about as long as a beech lives): thicker than it
// is taller, its lowest limbs resting on the ground, its foot wide and
// buttressed, a hollow or two where a limb was lost.

// The beech, grown (a hundred and twenty years, in the open).
export const BEECH_SHAPE = {
  ...OAK_SHAPE,
  age: 120,
  height: [24, 30],
  spread: [0.8, 0.95],
  trunk: [2, 3.5],
  girth: [0.5, 0.65],
  lean: [0, 2],
  bends: 0.12,             // a beech's trunk stands straight
  limbs: [5, 7],           // more than an oak has
  leader: 0.4,             // and the trunk carries on further up among them
  riseTop: 70,             // the upper limbs steep
  riseBottom: 22,          // the lowest set off low
  crooked: 0.15,           // curved, not zig-zag
  droop: 0.36,             // and sweep down with their length
  tipRise: 0.3,            // and turn up again at their tips
  leafiness: 0.95,         // a dense crown: beech leaves live on little light
  reachBottom: 0.5,        // the crown's outline: a tall dome, wide low down
  reachLow: 1.02,
  reachMid: 1,
  reachHigh: 0.82,
  reachTop: 0,
  clumpSize: [2, 3.2],
  // Its crown is a layered dome (BEECH_CROWNS, below): flat layers of leaves, spread wide, that run together across
  // its limbs and add up to one dome. (Until 24 November 2026 it was "cushions": rounder clusters, limb by limb.)
  squash: 0.42,            // flat: its leaves lie in layers, each spray held level
  clumpWide: 1.25,         // and spread wide
  rough: 0.12,
  gnarl: 0.03,             // smooth
  burrs: 0,
  hollows: 0,
  marksHigh: 0.2,
  stubs: 0,
  flare: 0.5,
  roots: 0.55,             // shallow roots, out over the ground
  merge: 100,              // all of its clusters that can run together do,
  across: 1,               // across its limbs too,
  leafReach: 0.42,         // and they reach far toward each other: a beech shows little sky through its crown
  coarse: 1.1,             // bigger facets on a bigger tree
};
// (Its frame: the usual beech, 27 m by 23.6 m; a little finer steps than an
// oak's, for its slimmer branches; less lumpy an outline; silver-grey bark.
// "outline" is set below the biggest crown its settings grow (855 m2), so a
// grown beech gets about a quarter more points, wood and clusters than an
// oak: its crown is half again an oak's size, and denser.)
export const BEECH_FRAME = {
  usual: { height: 27, width: 23.6, bare: 2.75 }, outline: 500, steps: 40, kind: 'broadleaf', needles: false, lumps: 0.8, leaf: { out: 0.6, holds: 0.8 }, site: { ground: [0.25, 0.9], shade: 0.9 },
  bark: { foot: [0.37, 0.37, 0.35], limbs: [0.52, 0.53, 0.51] },
};

// Its stages: young, and old (grown is the shape above).
export const BEECH_STAGES = {
  // A young beech keeps a clear leader and a slim, pointed crown.
  young: {
    age: 20, height: [6, 9], spread: [0.5, 0.65], trunk: [0.8, 1.5], girth: [0.06, 0.1], lean: [0, 2], bends: 0.08, limbs: [5, 7], leader: 0.8, riseTop: 70, riseBottom: 25,
    crooked: 0.1, droop: 0.08, tipRise: 0.1, clumpSize: [0.6, 1], gnarl: 0, flare: 0.15, roots: 0.05,
    reachBottom: 0.1, reachLow: 0.8, reachMid: 1, reachHigh: 0.7, reachTop: 0.05,
  },
  old: {
    age: 300, height: [28, 34], spread: [0.9, 1.1], trunk: [2, 3.5], girth: [0.9, 1.15], lean: [0, 4], bends: 0.2, limbs: [7, 9], leader: 0.45, riseTop: 62, riseBottom: 0,
    crooked: 0.25, droop: 0.5, tipRise: 0.45, leafiness: 0.88, clumpSize: [2.3, 3.6], gnarl: 0.25, burrs: 0.1, hollows: 0.33, marksHigh: 0.25, stubs: 0.15, flare: 0.8, roots: 0.9,
    reachBottom: 0.5, reachLow: 1.1, reachMid: 1, reachHigh: 0.85, reachTop: 0.15,
  },
};

// The beech grown in a wood, among others as tall (a hundred and twenty
// years): a clean column and a narrow crown at its top. (Not a stage of its
// age: what its neighbours do to it.)
export const BEECH_FOREST = {
  height: [30, 38], spread: [0.3, 0.4], trunk: [14, 20], girth: [0.35, 0.45], lean: [0, 1], bends: 0.08, limbs: [5, 7], leader: 0.6, riseTop: 72, riseBottom: 40,
  crooked: 0.12, droop: 0.08, tipRise: 0.1, crowded: 1, clumpSize: [1.8, 2.8], flare: 0.4, roots: 0.4,
  reachBottom: 0, reachLow: 0.2, reachMid: 0.7, reachHigh: 1, reachTop: 0.3,
};

// The forms its crown can take: each a few of its settings, set together (the panel's "crown form" row; a slider
// moved afterwards makes it "custom"). The first is the one it starts with. A form's settings: how flat a cluster is,
// how much wider it is drawn than it grew, how lumpy, how many clusters run together, whether across limbs, how far
// they reach toward each other, how many of the twigs off a branch's side keep their leaves, and how far a cluster's
// leaves hang below their twigs.
export const BEECH_CROWNS = {
  'layered dome': { squash: 0.42, clumpWide: 1.25, rough: 0.12, merge: 100, across: 1, leafReach: 0.42, sideLeaves: 1, hang: 0 },
  cushions: { squash: 0.75, clumpWide: 1, rough: 0.15, merge: 90, across: 0, leafReach: 0.28, sideLeaves: 1, hang: 0 },
};

// Its sliders: the oak's, and its limbs' tips.
export const BEECH_LIMITS = { ...OAK_LIMITS, tipRise: [-1, 1, 0.01] };
export const BEECH_CHOICES = OAK_CHOICES;

// The hawthorn (Crataegus monogyna, the common hawthorn: the may, the
// quickthorn, the whitethorn).
//
// A small tree: 6 to 9 m grown, seldom over 10, with a dense rounded crown
// about as wide as it's tall, on a short trunk. Its twigs are stiff, thorny
// and many, and turn at every bud, so its branches are a tangle and its
// crown is full to the inside. Its trunk is seldom straight and seldom
// round: it leans, it twists, and it's fluted (grooves running up it) from
// early on, so a hawthorn a foot thick looks as old as an oak a yard thick.
// Its bark is grey-brown, turning pinkish-brown and cracking into small
// scales. It lives 250 years, sometimes 400.
//
// Under taller trees: thinner and taller for its thickness, its crown open
// and lopsided. On a hill or a coast, in the wind: low, its trunk bowed
// over and its crown streaming to the lee (the wind kills the buds that
// face it). Old: no taller, wider, its trunk thick, hollow and deeply
// fluted, its crown flat-topped and thinning.
//
// Left out, said plainly: its thorns, its white blossom in May and its red
// haws in autumn. And a hawthorn often has several stems from one foot,
// which this code can't grow yet: the trunk here is always one.

// The hawthorn, grown (sixty years, in the open).
export const HAWTHORN_SHAPE = {
  ...OAK_SHAPE,
  age: 60,
  height: [6, 9],
  spread: [0.85, 1.1],
  trunk: [1.2, 2],
  girth: [0.13, 0.19],
  lean: [2, 10],           // seldom upright
  bends: 1,                // nor straight
  swept: 0,                // wind-swept: how far a wind from one side has shaped it
  limbs: [4, 6],
  leader: 0.2,             // the trunk gives way to its limbs at once
  riseTop: 60,
  riseBottom: 25,
  crooked: 0.75,           // a tangle
  droop: 0.2,
  leafiness: 0.95,         // dense to the inside
  reachBottom: 0.5,        // the crown's outline: round
  reachLow: 0.95,
  reachMid: 1,
  reachHigh: 0.8,
  reachTop: 0.15,
  clumpSize: [0.75, 1.15],
  squash: 0.95,
  rough: 0.55,
  sway: 0.03,              // stiff twigs
  gnarl: 1,                // fluted and twisted
  burrs: 0.15,
  hollows: 0,
  marksHigh: 0.5,
  stubs: 0.3,
  flare: 0.4,
  roots: 0.2,
  merge: 88,               // its clusters run together: one dense crown,
  leafReach: 0.26,         // with little sky through it
  coarse: 0.5,             // small facets on small clusters
};
// (Its frame: the usual hawthorn, 7.5 m by 7.7 m; a rougher outline than an
// oak's; grey-brown bark with a little pink in it. "marked": a hawthorn's
// trunk is as fluted at 25 cm (its radius) as an oak's is at 60: it shows
// its age on far less wood.)
export const HAWTHORN_FRAME = {
  usual: { height: 7.5, width: 7.7, bare: 1.6 }, outline: 95, steps: 34, kind: 'broadleaf', needles: false, lumps: 1.3, marked: 0.25, leaf: { out: 0.1, holds: 0.5 }, site: { ground: [0, 1], shade: 0.55, layer: 'underwood' },
  bark: { foot: [0.3, 0.25, 0.22], limbs: [0.42, 0.36, 0.33] },
};

// Its stages: young, and old (grown is the shape above).
export const HAWTHORN_STAGES = {
  // A young hawthorn: a thin upright bush of a tree.
  young: {
    age: 10, height: [2.5, 4], spread: [0.6, 0.8], trunk: [0.4, 0.8], girth: [0.03, 0.05], lean: [0, 6], bends: 0.35, limbs: [3, 5], leader: 0.5, riseTop: 70, riseBottom: 30,
    crooked: 0.5, droop: 0.05, clumpSize: [1, 1.5], gnarl: 0.2, burrs: 0, stubs: 0, flare: 0.15, roots: 0,
    reachBottom: 0.2, reachLow: 0.8, reachMid: 1, reachHigh: 0.75, reachTop: 0.1,
  },
  old: {
    age: 250, height: [7, 10], spread: [1, 1.2], trunk: [1.2, 2], girth: [0.24, 0.32], lean: [5, 15], bends: 1.3, limbs: [4, 6], riseTop: 55, riseBottom: 15,
    crooked: 0.95, droop: 0.35, leafiness: 0.8, clumpSize: [0.85, 1.3], gnarl: 1.5, burrs: 0.4, hollows: 0.5, marksHigh: 0.6, stubs: 0.6, flare: 0.7, roots: 0.5,
    reachBottom: 0.3, reachLow: 1.05, reachMid: 1, reachHigh: 0.9, reachTop: 0.4,
  },
};

// The hawthorn where it stands (sixty years; not stages of its age). Under
// taller trees: drawn up thin toward the light, its crown open, its leaves
// at the top. In the wind, on a hill: low, bowed over, its crown to the lee.
export const HAWTHORN_PLACES = {
  'forest-grown': {
    height: [6, 10], spread: [0.6, 0.8], trunk: [2, 3.5], girth: [0.08, 0.12], lean: [4, 14], bends: 1, limbs: [3, 4], leader: 0.4, riseTop: 70, riseBottom: 30,
    leafiness: 0.6, crowded: 1.5, merge: 80, leafReach: 0.22, stubs: 0.6, flare: 0.3, roots: 0.1,
    reachBottom: 0, reachLow: 0.5, reachMid: 0.9, reachHigh: 1, reachTop: 0.4,
  },
  'wind-swept': {
    height: [3.5, 6], spread: [1.1, 1.5], trunk: [1.4, 2.2], girth: [0.15, 0.22], lean: [8, 18], bends: 1.2, swept: 0.9, limbs: [3, 5], riseTop: 45, riseBottom: 15,
    crooked: 0.9, droop: 0.03, leafiness: 0.85, merge: 85, squash: 0.75, gnarl: 1.2, stubs: 0.5, flare: 0.6, roots: 0.5,
    reachBottom: 0.1, reachLow: 0.8, reachMid: 1, reachHigh: 0.95, reachTop: 0.5,
  },
};

// Its sliders: the oak's, and the wind.
export const HAWTHORN_LIMITS = { ...OAK_LIMITS, swept: [0, 1.5, 0.01] };
export const HAWTHORN_CHOICES = OAK_CHOICES;

// The hazel (Corylus avellana, the common hazel).
//
// A shrub, not a tree: it has no trunk. Many stems rise side by side from
// one woody foot at the ground (the stool), steeply in the middle and
// leaning out round it, and arch over under their own length, so a hazel
// is about as wide as it's tall: 4 to 6 m, to 8 or 10 left alone for long
// or drawn up under taller trees. Its stems are slender (a rod 5 m long is
// 4 to 8 cm through), smooth and brown, greying with age; new ones keep
// coming from the stool as old ones die, so a hazel has stems of every
// thickness. Its leaves are big, round and soft, a lighter green than an
// oak's, in open layers. A stem lives some decades; the stool far longer.
//
// It is the underwood of an English oak wood. For centuries it was cut to
// the stool every seven years or so for its rods ("coppiced"): a cut stool
// grows a sheaf of straight rods, close together, all the same age. Left
// uncut for long: fewer, thicker stems, leaning apart, dead ones among
// them.
//
// It grows by the oak's code, as stems (./oak.js: a frame's "stems"): its
// limbs are its stems, each from its own place on the stool. So it has no
// bare trunk, leader, rings of limbs, bends of the trunk, burrs or hollows,
// and its shape leaves those settings out. "girth" is its thickest stem's
// radius, and "stool" its stool's.
//
// Left out, said plainly: its catkins and its nuts. And every stem here
// starts on the stool's top, where a real hazel's also come up from its
// sides and from the ground beside it.
const { trunk: _trunk, leader: _leader, whorl: _whorl, bends: _bends, burrs: _burrs, hollows: _hollows, marksHigh: _marksHigh, ...STEMMED } = OAK_SHAPE;

// The hazel, grown (twenty-five years uncut, in the open or at a wood's edge).
export const HAZEL_SHAPE = {
  ...STEMMED,
  age: 25,
  height: [4.5, 6.5],
  spread: [0.9, 1.15],
  girth: [0.035, 0.05],    // m: its thickest stem's radius
  stool: 0.3,              // m: the stool's radius
  lean: [0, 4],
  limbs: [7, 10],          // its stems
  riseTop: 84,             // the steepest of them, in the middle
  riseBottom: 60,          // and those that lean out most
  crooked: 0.2,
  droop: 0.26,             // they arch over
  leafiness: 0.7,
  reachBottom: 0,          // the crown's outline: a vase, widest near the top, its stems bare low down
  reachLow: 0.45,
  reachMid: 0.95,
  reachHigh: 1,
  reachTop: 0.5,
  clumpSize: [0.6, 0.9],
  squash: 0.75,
  rough: 0.3,
  sway: 0.05,              // slender stems
  gnarl: 0,
  stubs: 0.1,
  flare: 0.3,
  roots: 0,
  merge: 70,
  leafReach: 0.22,
  coarse: 0.5,
};
// (Its frame: the usual hazel, 5.5 m by 5.7 m, on its stool; stems; wood
// far more slender than an oak's may be; brown bark, greyer at the foot.)
export const HAZEL_FRAME = {
  usual: { height: 5.5, width: 5.7, bare: 0.3 }, outline: 50, steps: 34, kind: 'broadleaf', needles: false, lumps: 1.2, stems: true, slender: 260, leaf: { out: 0.15, holds: 0.45 }, site: { ground: [0, 0.6], shade: 0.7, layer: 'underwood' },
  bark: { foot: [0.33, 0.29, 0.24], limbs: [0.45, 0.37, 0.28] },
};

// Its stages: young, and old (grown is the shape above).
export const HAZEL_STAGES = {
  // A young hazel: a few thin rods.
  young: {
    age: 5, height: [2, 3], spread: [0.6, 0.8], girth: [0.012, 0.018], stool: 0.1, lean: [0, 3], limbs: [3, 5], riseTop: 86, riseBottom: 68,
    crooked: 0.1, droop: 0.1, clumpSize: [1.1, 1.6], stubs: 0, flare: 0.1,
    reachBottom: 0.1, reachLow: 0.7, reachMid: 1, reachHigh: 0.85, reachTop: 0.3,
  },
  // Long uncut: fewer, thicker stems leaning apart, dead ones among them, on a wide old stool.
  old: {
    age: 70, height: [7, 9.5], spread: [0.85, 1.05], girth: [0.08, 0.11], stool: 0.55, lean: [0, 8], limbs: [4, 6], riseTop: 82, riseBottom: 55,
    crooked: 0.3, droop: 0.38, leafiness: 0.55, clumpSize: [0.75, 1.1], gnarl: 0.6, stubs: 0.8, flare: 0.5, roots: 0.3,
    reachBottom: 0, reachLow: 0.45, reachMid: 0.9, reachHigh: 1, reachTop: 0.6,
  },
};

// The hazel as it's found (not stages of its age). Coppiced: cut to the
// stool seven years ago, a sheaf of straight rods of one age, their leaves
// at the top. Forest-grown: under taller trees, drawn up and thin, its
// stems leaning out for the light, its crown open.
export const HAZEL_PLACES = {
  coppiced: {
    age: 7, height: [3.5, 4.5], spread: [0.5, 0.65], girth: [0.016, 0.024], stool: 0.45, lean: [0, 2], limbs: [12, 14], riseTop: 88, riseBottom: 74,
    crooked: 0.06, droop: 0.08, leafiness: 0.8, clumpSize: [0.8, 1.1], stubs: 0, flare: 0.4,
    reachBottom: 0, reachLow: 0.35, reachMid: 0.8, reachHigh: 1, reachTop: 0.6,
  },
  'forest-grown': {
    height: [5.5, 8], spread: [0.8, 1], girth: [0.035, 0.05], lean: [0, 8], limbs: [5, 7], riseTop: 84, riseBottom: 56,
    droop: 0.34, leafiness: 0.5, crowded: 1.5, stubs: 0.4,
    reachBottom: 0, reachLow: 0.2, reachMid: 0.7, reachHigh: 1, reachTop: 0.5,
  },
};

// Its sliders: the oak's, where they share a setting; its own for its
// stems (more of them, far thinner), its stool, and its size and age (a
// shrub's).
export const HAZEL_LIMITS = {
  ...OAK_LIMITS, height: [1, 15, 0.1], girth: [0.005, 0.3, 0.005], limbs: [1, 16, 1], stool: [0.05, 1.5, 0.01], age: [2, 150, 1], clumpSize: [0.2, 6, 0.05],
};
export const HAZEL_CHOICES = OAK_CHOICES;

// The holly (Ilex aquifolium, the common holly).
//
// A small evergreen tree: 8 to 12 m grown, seldom over 15, a dense, dark
// pyramid on a straight trunk, with branches nearly to the ground: the
// lowest leave it level, sag, and turn up at their tips. Its leaves are
// thick, glossy and very dark, and it keeps them the year round: in a
// winter wood it is the one green thing. They live on very little light,
// so a holly is leafy to the inside, and it grows under oaks where little
// else will. Its bark is thin, smooth and silver-grey, with small warts in
// age. It lives 250 to 300 years.
//
// Under taller trees: thinner, leaning, its crown open and uneven, still
// leafy low down. Old: taller, its top rounded off, its trunk clear for a
// couple of metres, its lowest branches hanging.
//
// It grows as the oak does, by its own settings. What is new with it is
// that it's evergreen (its frame says so): a broadleaf that doesn't turn
// in autumn.
//
// Left out, said plainly: its prickles and its red berries. And a holly
// often stands as several stems, or in a thicket of its own suckers: this
// one is always one trunk.

// The holly, grown (sixty years, in the open).
export const HOLLY_SHAPE = {
  ...OAK_SHAPE,
  age: 60,
  height: [8, 12],
  spread: [0.45, 0.6],
  trunk: [0.5, 1.2],       // branches nearly to the ground
  girth: [0.13, 0.19],
  lean: [0, 3],
  bends: 0.15,             // a straight trunk,
  limbs: [9, 12],
  leader: 0.85,            // that carries on up through its crown
  riseTop: 55,
  riseBottom: 5,           // the lowest limbs leave it level,
  crooked: 0.3,
  droop: 0.2,              // sag,
  tipRise: 0.25,           // and turn up at their tips
  leafiness: 0.95,         // dense: its leaves live on very little light
  reachBottom: 0.75,       // the crown's outline: a pyramid
  reachLow: 1,
  reachMid: 0.85,
  reachHigh: 0.55,
  reachTop: 0,
  clumpSize: [0.75, 1.15],
  // Its crown is tiers (HOLLY_CROWNS, below): each limb's leaves one flat skirt, drawn wider than it grew, and the skirts
  // stacked into a dense dark pyramid with shadow between them. (Until 24 November 2026 it was "cushions": rounder
  // clusters, many to a limb.)
  squash: 0.55,            // flat: a skirt to a limb
  clumpWide: 1.25,         // and spread wide
  rough: 0.35,
  sway: 0.025,             // stiff
  gnarl: 0.05,             // smooth
  burrs: 0,
  hollows: 0,
  marksHigh: 0.3,
  stubs: 0.1,
  flare: 0.3,
  roots: 0.15,
  merge: 100,              // all of a limb's clusters that can run together do: one mass to a limb,
  leafReach: 0.42,         // and they reach far toward each other
  coarse: 0.55,
};
// (Its frame: the usual holly, 10 m by 5.3 m; finer steps than an oak's,
// for its narrow crown; evergreen; smooth silver-grey bark.)
export const HOLLY_FRAME = {
  usual: { height: 10, width: 5.3, bare: 0.85 }, outline: 110, steps: 42, kind: 'broadleaf', needles: false, evergreen: true, lumps: 0.9, site: { ground: [0, 1], shade: 0.95, layer: 'underwood' },
  bark: { foot: [0.33, 0.34, 0.32], limbs: [0.47, 0.48, 0.45] },
};

// Its stages: young, and old (grown is the shape above).
export const HOLLY_STAGES = {
  // A young holly: a narrow cone, leafy to the ground.
  young: {
    age: 12, height: [2.2, 3.5], spread: [0.5, 0.65], trunk: [0.3, 0.4], girth: [0.03, 0.05], lean: [0, 2], bends: 0.1, limbs: [8, 10], leader: 0.95, riseTop: 60, riseBottom: 15,
    crooked: 0.2, droop: 0.05, tipRise: 0.1, clumpSize: [1.2, 1.7], stubs: 0, flare: 0.1, roots: 0,
    reachBottom: 0.9, reachLow: 1, reachMid: 0.7, reachHigh: 0.4, reachTop: 0,
  },
  old: {
    age: 250, height: [12, 17], spread: [0.55, 0.75], trunk: [1.8, 3], girth: [0.3, 0.4], lean: [0, 6], bends: 0.4, limbs: [9, 12], leader: 0.7, riseTop: 55, riseBottom: -5,
    crooked: 0.4, droop: 0.35, tipRise: 0.4, leafiness: 0.85, clumpSize: [0.9, 1.4], gnarl: 0.35, burrs: 0.3, stubs: 0.4, flare: 0.6, roots: 0.4,
    reachBottom: 0.5, reachLow: 1, reachMid: 0.95, reachHigh: 0.7, reachTop: 0.15,
  },
};

// The holly under taller trees (sixty years; not a stage of its age):
// thinner, leaning, its crown open and uneven, still leafy low down.
export const HOLLY_FOREST = {
  height: [6, 10], spread: [0.5, 0.7], trunk: [1, 2], girth: [0.07, 0.11], lean: [2, 10], bends: 0.5, limbs: [7, 9], leader: 0.75, riseTop: 60, riseBottom: 10,
  droop: 0.3, leafiness: 0.7, crowded: 1, squash: 0.9, clumpWide: 1, rough: 0.45, merge: 80, leafReach: 0.24, stubs: 0.3, flare: 0.2, roots: 0.1, // (its crown open and uneven, as it was: no form of its kind's)
  reachBottom: 0.3, reachLow: 0.8, reachMid: 1, reachHigh: 0.75, reachTop: 0.1,
};

// The forms its crown can take (the panel's "crown form" row): the first is the one it starts with.
export const HOLLY_CROWNS = {
  tiers: { squash: 0.55, clumpWide: 1.25, rough: 0.35, merge: 100, across: 0, leafReach: 0.42, sideLeaves: 1, hang: 0 },
  cushions: { squash: 0.9, clumpWide: 1, rough: 0.45, merge: 92, across: 0, leafReach: 0.3, sideLeaves: 1, hang: 0 },
};

// Its sliders: the oak's, and its limbs' tips.
export const HOLLY_LIMITS = { ...OAK_LIMITS, tipRise: [-1, 1, 0.01] };
export const HOLLY_CHOICES = OAK_CHOICES;

// The ash (Fraxinus excelsior, the common ash).
//
// A tall tree: 22 to 28 m grown in the open, to 35 in a wood, with a domed,
// open crown: you see sky through an ash. Its limbs rise steeply; the
// lower ones sweep out and down with their length and turn up again at
// their tips, more than any other tree's here. Its twigs are stout and
// leave in pairs, and each shoot holds its leaves at its end; but a grown
// ash has so many shoots that, in the open, their ends fill its dome: a
// full crown of many small lumps, its openness in its fine leaves and the
// small gaps all through it, not in big holes (photos of grown ashes, 25
// November 2026: one in Wales, 16 m, in July; one in the Ardennes; two
// in Moscow, from below). Only in a wood is it thin, a few tufts at the
// top of a long pole. It needs light: its leaves live only
// where there's plenty, and it's the last to come into leaf and among the
// first to drop them. Its bark is pale grey, smooth for decades, then
// ridged in a net of shallow furrows. It lives about two hundred years.
//
// In a wood: a long clean pole with a small crown at the top. Old: broader,
// its lower limbs sweeping low, dead wood in its crown, its trunk hollow.
//
// It grows as the oak does, by its own settings.
//
// Left out, said plainly: its feathered leaves (each of several leaflets:
// its clusters are the oak's masses, set thinner and further apart), its
// bunches of keys, its black buds, and the pairs its twigs leave in (its
// limbs here leave the trunk one by one, as an oak's: grown in pairs they
// stood up the trunk like a ladder's rungs, which a grown ash's don't).

// The ash, grown (a hundred years, in the open).
export const ASH_SHAPE = {
  ...OAK_SHAPE,
  age: 100,
  height: [22, 28],
  spread: [0.65, 0.8],
  trunk: [3, 5],
  girth: [0.4, 0.55],
  lean: [0, 3],
  bends: 0.2,
  limbs: [5, 7],
  leader: 0.4,             // the trunk carries on a little further up among them than an oak's
  riseTop: 78,             // they rise steeply,
  riseBottom: 48,
  crooked: 0.2,
  droop: 0.15,             // the lower ones sweep out with their length
  tipRise: 0.6,            // and turn well up at their tips
  leafiness: 0.75,         // grown in the open, its crown is full: as full as an oak's, in smaller clusters, so more of them
  // Its crown is a full dome (ASH_CROWNS, below): many small clusters, along its branches as well as at their ends,
  // run together, with small gaps between. (From 24 November 2026 it was "tufts", leaves only at its branches'
  // ends in bigger clumps, sky between them: it was found too sparse, and photos of grown ashes agreed. An
  // ash in a wood keeps the tufts: ASH_FOREST. Before 24 November it was "cushions".)
  sideLeaves: 1,
  reachBottom: 0.2,        // the crown's outline: a tall dome
  reachLow: 0.8,
  reachMid: 1,
  reachHigh: 0.85,
  reachTop: 0.2,
  clumpSize: [1, 1.6],     // smaller clusters than an oak's, more of them: its fine leaves
  squash: 0.85,
  clumpWide: 1.2,          // each drawn a fifth wider than it grew, so they touch
  rough: 0.35,
  sway: 0.045,
  gnarl: 0.1,
  burrs: 0.1,
  hollows: 0,
  marksHigh: 0.3,
  stubs: 0.2,
  flare: 0.35,
  roots: 0.3,
  merge: 75,               // its clusters run together, with small gaps
  leafReach: 0.24,
  coarse: 0.9,             // (as it was: finer facets, at 0.7, cost a fifth more triangles than its budget)
};
// (Its frame: the usual ash, 25 m by 18 m; a little finer steps than an
// oak's, for its taller crown; pale grey bark.)
export const ASH_FRAME = {
  usual: { height: 25, width: 18, bare: 4 }, outline: 780, steps: 38, kind: 'broadleaf', needles: false, lumps: 0.9, leaf: { out: 1, holds: 0.1 }, site: { ground: [0, 0.45], shade: 0.4 },
  bark: { foot: [0.35, 0.35, 0.32], limbs: [0.5, 0.5, 0.46] },
};

// Its stages: young, and old (grown is the shape above).
export const ASH_STAGES = {
  // A young ash: a straight pole with a few rising branches.
  young: {
    age: 15, height: [6, 9], spread: [0.4, 0.55], trunk: [1.5, 2.5], girth: [0.05, 0.08], lean: [0, 2], bends: 0.08, limbs: [6, 8], leader: 0.9, riseTop: 72, riseBottom: 48,
    crooked: 0.1, droop: 0.05, tipRise: 0.3, clumpSize: [0.8, 1.2], gnarl: 0, burrs: 0, stubs: 0, flare: 0.15, roots: 0,
    reachBottom: 0.1, reachLow: 0.7, reachMid: 1, reachHigh: 0.75, reachTop: 0.1,
  },
  // Old: broader and airier than grown, still full (the Ardennes ash).
  old: {
    age: 220, height: [26, 33], spread: [0.75, 0.95], trunk: [3, 5], girth: [0.8, 1], lean: [0, 5], bends: 0.35, limbs: [6, 8], leader: 0.35, riseTop: 72, riseBottom: 25,
    crooked: 0.3, droop: 0.35, tipRise: 0.75, leafiness: 0.6, clumpSize: [1.3, 2], gnarl: 0.45, burrs: 0.4, hollows: 0.33, stubs: 0.8, flare: 0.6, roots: 0.5,
    reachBottom: 0.3, reachLow: 0.95, reachMid: 1, reachHigh: 0.9, reachTop: 0.3,
  },
};

// The ash grown in a wood, among others as tall (a hundred years): a long
// clean pole with a small, thin crown at its top, its leaves in tufts at
// its branches' ends, sky between them (the ash at Le Roeulx). (Not a
// stage of its age.)
export const ASH_FOREST = {
  height: [28, 35], spread: [0.3, 0.42], trunk: [12, 18], girth: [0.3, 0.4], lean: [0, 2], bends: 0.12, limbs: [4, 6], leader: 0.65, riseTop: 75, riseBottom: 45,
  droop: 0.1, tipRise: 0.3, crowded: 1, stubs: 0.4, flare: 0.3, roots: 0.25,
  reachBottom: 0, reachLow: 0.3, reachMid: 0.75, reachHigh: 1, reachTop: 0.3,
  leafiness: 0.45, clumpSize: [1.5, 2.4],
  squash: 0.85, clumpWide: 1.1, rough: 0.3, merge: 30, across: 0, leafReach: 0.18, sideLeaves: 0, hang: 0, // (its crown's form: tufts)
};

// The forms its crown can take (the panel's "crown form" row): the first is the one it starts with.
export const ASH_CROWNS = {
  'full dome': { squash: 0.85, clumpWide: 1.2, rough: 0.35, merge: 75, across: 0, leafReach: 0.24, sideLeaves: 1, hang: 0 },
  tufts: { squash: 0.85, clumpWide: 1.1, rough: 0.3, merge: 30, across: 0, leafReach: 0.18, sideLeaves: 0, hang: 0 },
  cushions: { squash: 0.85, clumpWide: 1, rough: 0.3, merge: 62, across: 0, leafReach: 0.18, sideLeaves: 1, hang: 0 },
};

// Its sliders: the oak's, and its limbs' tips.
export const ASH_LIMITS = { ...OAK_LIMITS, tipRise: [-1, 1, 0.01] };
export const ASH_CHOICES = OAK_CHOICES;

// The birch (Betula pendula, the silver birch; on wetter, higher ground its
// near twin the downy birch, Betula pubescens, which weeps less).
//
// A slim tree: 15 to 21 m grown, seldom over 25, a third to a half as wide
// as it's tall, on a thin trunk that carries on up through a light, open
// crown. Its limbs rise steeply; their ends are long, fine, dark twigs
// that hang, so the crown's outside weeps. Its bark is white and papery,
// with black scars; its twigs and its thin branches are dark purple-brown
// (a branch whitens as it thickens, so a sapling is brown all over); and
// on an old tree the foot turns black and rugged. Its leaves are small and
// a light green, and turn clear yellow. It needs light, grows fast on open
// ground, and is old at eighty.
//
// In a wood: a thin white pole with a small crown at the top. Old: taller,
// its lower limbs weeping low, its foot black, dead wood in its crown.
//
// It grows as the oak does, by its own settings. What is new with it is in
// how its wood is drawn (./oakMesh.js: a frame's bark may say what colour
// its thin wood is, how high its foot's colour reaches, and that its thick
// wood has dark marks).
//
// Left out, said plainly: its catkins; the peeling of its bark; and its
// hanging twigs are not drawn one by one: its limbs' tips are turned down a
// little ("tips turn up" below 0) and the leaves at its branches' ends hang
// below their twigs, longer than the rest ("ends hang").
//
// What a silver birch is, looked up on 24 November 2026 (tree guides and
// nursery and university plant pages): an upright trunk; a crown pyramidal
// when young and oval when grown, loose and half-open, on spreading
// branches; and only the thin twigs at the branches' ends hang. A crown of
// long drops from its top to the ground is a weeping garden form
// ('Youngii') or a willow. The birch had drifted there twice: its limbs'
// ends were turned far down, and then every cluster was hung as a strand.

// The birch, grown (forty years, in the open).
const BIRCH_WIDE = 0.85; // (its clusters, drawn narrower than they grew: about two thirds of the leaf it carried as cushions)
export const BIRCH_SHAPE = {
  ...OAK_SHAPE,
  age: 40,
  height: [15, 21],
  spread: [0.4, 0.55],
  trunk: [2.5, 4.5],
  girth: [0.13, 0.19],
  lean: [0, 6],
  bends: 0.35,
  limbs: [6, 9],
  leader: 0.8,             // the trunk carries on up through the crown
  riseTop: 70,             // its limbs rise steeply,
  riseBottom: 40,
  crooked: 0.3,
  droop: 0.2,              // spread, arching a little,
  tipRise: -1,             // and their ends turn down (they were turned far further, -2.2, and the whole limb wept, as a willow's)
  leafiness: 0.55,         // a light, open crown: it needs light
  reachBottom: 0.15,       // the crown's outline: an egg
  reachLow: 0.75,
  reachMid: 1,
  reachHigh: 0.75,
  reachTop: 0.15,
  clumpSize: [0.65, 1.05], // many small ones,
  // Its crown is hanging ends (BIRCH_CROWNS, below): small clusters along its branches, and at each branch's end one
  // that hangs below its twigs, longer than the rest. (Until 24 November 2026 it was "cushions": every cluster half
  // again as tall as wide, sitting on its twigs.)
  squash: 1.1,             // a cluster along a branch: about as tall as wide
  hang: 0.45,              // one at a branch's end: nearly half of it below its twigs, and three quarters longer
  clumpWide: BIRCH_WIDE,   // drawn narrower than they grew: a light crown, half-open
  rough: 0.35,
  sway: 0.07,              // fine twigs: they move in the least wind
  gnarl: 0.05,
  burrs: 0,
  hollows: 0,
  marksHigh: 0.15,
  stubs: 0.15,
  flare: 0.25,
  roots: 0.15,
  merge: 35,               // its tresses hang apart
  leafReach: 0.16,
  coarse: 0.6,
};
// (Its frame: the usual birch, 18 m by 8.6 m; finer steps than an oak's,
// for its narrow crown; more clusters to a crown than an oak has, each
// smaller; slender wood; and its bark: white, black at the
// foot of a thick trunk, dark purple-brown where the wood is thinner than
// 4.5 cm, with black marks on the white.)
export const BIRCH_FRAME = {
  usual: { height: 18, width: 8.6, bare: 3.5 }, outline: 170, steps: 44, kind: 'broadleaf', needles: false, lumps: 1, slender: 130, leaf: { out: 0.3, holds: 0.3 }, site: { ground: [0.55, 1], shade: 0.05 },
  bark: { foot: [0.13, 0.12, 0.11], limbs: [0.86, 0.85, 0.8], footRise: [0, 5], thin: { color: [0.24, 0.17, 0.16], below: 0.045 }, marks: { color: [0.1, 0.09, 0.09], share: 0.34 } },
};

// Its stages: young, and old (grown is the shape above).
export const BIRCH_STAGES = {
  // A young birch: a thin brown pole with a few rising branches.
  young: {
    age: 8, height: [4, 6.5], spread: [0.35, 0.5], trunk: [1, 1.8], girth: [0.025, 0.04], lean: [0, 4], bends: 0.2, limbs: [5, 7], leader: 0.9, riseTop: 72, riseBottom: 50,
    crooked: 0.2, droop: 0.1, tipRise: -0.4, clumpSize: [1, 1.5], stubs: 0, flare: 0.1, roots: 0,
    reachBottom: 0.1, reachLow: 0.7, reachMid: 1, reachHigh: 0.7, reachTop: 0.1,
  },
  old: {
    age: 90, height: [20, 26], spread: [0.42, 0.58], trunk: [3, 5], girth: [0.3, 0.4], lean: [0, 10], bends: 0.6, limbs: [6, 9], leader: 0.65, riseTop: 65, riseBottom: 25,
    crooked: 0.4, droop: 0.35, tipRise: -1.6, leafiness: 0.48, clumpSize: [0.8, 1.25], coarse: 0.8, gnarl: 0.6, stubs: 0.7, flare: 0.5, roots: 0.4,
    reachBottom: 0.3, reachLow: 0.9, reachMid: 1, reachHigh: 0.85, reachTop: 0.25,
  },
};

// The birch grown in a wood, among others as tall (forty years): a thin
// white pole with a small crown at its top. (Not a stage of its age.)
export const BIRCH_FOREST = {
  height: [20, 27], spread: [0.2, 0.28], trunk: [8, 13], girth: [0.11, 0.16], lean: [0, 4], bends: 0.25, limbs: [5, 7], leader: 0.85, riseTop: 75, riseBottom: 50,
  droop: 0.15, tipRise: -0.6, crowded: 1, stubs: 0.4, flare: 0.2, roots: 0.1,
  reachBottom: 0, reachLow: 0.3, reachMid: 0.8, reachHigh: 1, reachTop: 0.3,
};

// The forms its crown can take (the panel's "crown form" row): the first is the one it starts with.
export const BIRCH_CROWNS = {
  'hanging ends': { squash: 1.1, clumpWide: BIRCH_WIDE, rough: 0.35, merge: 35, across: 0, leafReach: 0.16, sideLeaves: 1, hang: 0.45 },
  cushions: { squash: 1.6, clumpWide: 1, rough: 0.35, merge: 35, across: 0, leafReach: 0.16, sideLeaves: 1, hang: 0 },
};

// Its sliders: the oak's, and its limbs' tips, which hang far.
export const BIRCH_LIMITS = { ...OAK_LIMITS, tipRise: [-4, 1, 0.01] };
export const BIRCH_CHOICES = OAK_CHOICES;

// The linden (Tilia cordata, the small-leaved linden: in England "lime",
// which has nothing to do with the fruit; ıhlamur).
//
// A tall tree: 22 to 28 m grown in the open, to 35 and more in a wood,
// with a high, dense, domed crown, narrower than an oak's: an egg, widest
// below its middle. Its trunk stands straight and carries on well up into
// the crown; its limbs rise, the lower ones arch out and down with their
// length and sweep up again at their tips. Its bark is grey and smooth for
// decades, then grey-brown with shallow furrows running up it; old trunks
// are burry. Its leaves are small, heart-shaped and dark, and so many that
// little sky shows through; they turn yellow. It bears shade, and it lives
// for several hundred years.
//
// In a wood: a tall straight trunk with a narrow crown at its top. Old:
// broader, its trunk thick, burry and hollow, its lowest limbs sweeping
// low.
//
// It grows as the oak does, by its own settings.
//
// Left out, said plainly: its flowers and their bracts; and the shoots a
// linden sends up round its foot, which this code can't grow on a tree
// with a trunk (a kind grows on a trunk or as stems, ./oak.js, not both).
// How burry its trunk is, and how much shade it bears, are as I know the
// tree, not from a source.

// The linden, grown (a hundred and twenty years, in the open).
export const LINDEN_SHAPE = {
  ...OAK_SHAPE,
  age: 120,
  height: [22, 28],
  spread: [0.55, 0.7],
  trunk: [2.5, 4],
  girth: [0.45, 0.6],
  lean: [0, 2],
  bends: 0.15,             // a straight trunk,
  limbs: [6, 8],
  leader: 0.55,            // that carries on well up into its crown
  riseTop: 65,
  riseBottom: 25,
  crooked: 0.2,
  droop: 0.4,              // the lower limbs arch out and down
  tipRise: 0.45,           // and sweep up again at their tips
  leafiness: 0.9,          // dense: little sky through it
  reachBottom: 0.45,       // the crown's outline: an egg, widest below its middle
  reachLow: 0.95,
  reachMid: 1,
  reachHigh: 0.75,
  reachTop: 0.1,
  clumpSize: [1.6, 2.6],
  // Its crown is billows (LINDEN_CROWNS, below): each limb's leaves one big rounded lobe, drawn a little wider than it
  // grew, with clefts between the lobes. (Until 24 November 2026 it was "cushions": smaller clusters, many to a limb.)
  squash: 0.95,
  clumpWide: 1.15,
  rough: 0.25,
  gnarl: 0.2,
  burrs: 0.5,              // a burry trunk
  hollows: 0,
  marksHigh: 0.2,
  stubs: 0.1,
  flare: 0.45,
  roots: 0.3,
  merge: 100,              // all of a limb's clusters that can run together do: one lobe to a limb,
  leafReach: 0.42,         // reaching far toward each other: little sky through it
  coarse: 1,
};
// (Its frame: the usual linden, 25 m by 15.6 m; a little finer steps than
// an oak's, for its taller crown; grey-brown bark; in leaf about when a
// beech is, and bare before an oak; it likes the lower ground and bears a
// good deal of shade.)
export const LINDEN_FRAME = {
  usual: { height: 25, width: 15.6, bare: 3.25 }, outline: 800, steps: 38, kind: 'broadleaf', needles: false, lumps: 0.8, leaf: { out: 0.5, holds: 0.4 }, site: { ground: [0, 0.7], shade: 0.8 },
  bark: { foot: [0.28, 0.26, 0.23], limbs: [0.43, 0.41, 0.37] },
};

// Its stages: young, and old (grown is the shape above).
export const LINDEN_STAGES = {
  // A young linden: a neat cone, its trunk clear to the top.
  young: {
    age: 20, height: [7, 10], spread: [0.45, 0.6], trunk: [1.2, 2], girth: [0.07, 0.11], lean: [0, 2], bends: 0.08, limbs: [7, 9], leader: 0.9, riseTop: 68, riseBottom: 35,
    crooked: 0.12, droop: 0.1, tipRise: 0.2, clumpSize: [0.9, 1.3], gnarl: 0.02, burrs: 0, stubs: 0, flare: 0.15, roots: 0,
    reachBottom: 0.4, reachLow: 0.95, reachMid: 0.8, reachHigh: 0.5, reachTop: 0.05,
  },
  old: {
    age: 400, height: [26, 33], spread: [0.65, 0.85], trunk: [2.5, 4], girth: [1, 1.3], lean: [0, 4], bends: 0.3, limbs: [7, 9], leader: 0.45, riseTop: 60, riseBottom: 10,
    crooked: 0.3, droop: 0.55, tipRise: 0.55, leafiness: 0.8, clumpSize: [1.8, 2.9], gnarl: 0.7, burrs: 1.2, hollows: 0.67, marksHigh: 0.3, stubs: 0.4, flare: 0.8, roots: 0.6,
    reachBottom: 0.5, reachLow: 1.05, reachMid: 1, reachHigh: 0.8, reachTop: 0.2,
  },
};

// The linden grown in a wood, among others as tall (a hundred and twenty
// years): a tall straight trunk with a narrow crown at its top. (Not a
// stage of its age.)
export const LINDEN_FOREST = {
  height: [28, 35], spread: [0.26, 0.34], trunk: [12, 18], girth: [0.35, 0.45], lean: [0, 1], bends: 0.1, limbs: [5, 7], leader: 0.65, riseTop: 72, riseBottom: 40,
  droop: 0.1, tipRise: 0.2, crowded: 1, burrs: 0.3, stubs: 0.3, flare: 0.35, roots: 0.25,
  reachBottom: 0, reachLow: 0.25, reachMid: 0.7, reachHigh: 1, reachTop: 0.3,
};

// Its sliders: the oak's, and its limbs' tips.
// The forms its crown can take (the panel's "crown form" row): the first is the one it starts with.
export const LINDEN_CROWNS = {
  billows: { squash: 0.95, clumpWide: 1.15, rough: 0.25, merge: 100, across: 0, leafReach: 0.42, sideLeaves: 1, hang: 0 },
  cushions: { squash: 0.95, clumpWide: 1, rough: 0.25, merge: 85, across: 0, leafReach: 0.26, sideLeaves: 1, hang: 0 },
};

export const LINDEN_LIMITS = { ...OAK_LIMITS, tipRise: [-1, 1, 0.01] };
export const LINDEN_CHOICES = OAK_CHOICES;
