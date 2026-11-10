// What each row of the panel does, in a line or two: shown when a row is
// hovered, focused, or its name tapped (src/main.js). Keys are the
// setting's path; {kind} is filled in with the tree's kind.

export const TIPS = {
  // The Tree tab.
  'tree.kind': 'Which kind of tree: TreeLab\'s English oak, at its real size, or the workshop\'s broadleaf, fir or pine.',
  'tree.seed': 'Picks which trees of this kind you get. The same seed always grows the same trees; the forest grows from it too.',
  'tree.variant': 'Each seed has many variants: siblings grown from the same seed. The forest mixes variants 0 and up.',
  'action.newSeed': 'A random seed: a new set of trees.',
  'tree.tint': 'The foliage colour, from the kind\'s dark green (0) to its light green (1).',
  'tree.show': 'One tree on its own, or a grid of trees to compare side by side.',
  'tree.rows': 'Rows in the grid.',
  'tree.cols': 'Columns in the grid.',
  'tree.vary': 'What changes from tree to tree in the grid: the variant, the seed, or the kind (a row per kind).',
  'tree.gap': 'Space between the widest crowns in the grid, in metres.',
  'tree.labels': 'Name each tree in the grid by its variant or seed.',
  'shape.kind': 'Which kind\'s shape the sliders below change. Every tree of that kind changes, in both tabs.',
  'preset.startFrom': 'Start this kind from a ready-made shape. The oak: in the open, young, in a forest, or ancient. The workshop\'s trees: "workshop" is the game\'s own.',

  // The Forest tab.
  'readout.trees': 'How many trees the forest holds now.',
  'forest.seed': 'Picks where the trees stand. The same seed always plants the same forest.',
  'action.newLayout': 'A random layout: the same kinds and density, standing elsewhere.',
  'forest.area': 'The forest\'s outline: a circle, or a square.',
  'forest.radius': 'How big the forest is, in metres: the circle\'s radius, or half the square\'s side. At most 40 m, as far as the wind reaches.',
  'forest.density': 'Trees per hectare (100 × 100 m). 400 is about one tree every 5 m; 2,500 is one every 2 m.',
  'forest.pattern': 'How trees are spread: even spacing (the most natural), random, a jittered grid, clumps, or plantation rows.',
  'forest.jitter': 'How far each tree is nudged off its grid spot, as a share of a cell. 0 is a perfect grid.',
  'forest.clumpTrees': 'About how many trees grow in each clump.',
  'forest.clumpSpread': 'How far a clump\'s trees stray from its middle, in metres.',
  'forest.rowAngle': 'Which way the plantation rows run, in degrees.',
  'forest.patches': 'Split the area into groves and clearings: trees grow only in the groves.',
  'forest.patchSize': 'About how wide a grove or a clearing is, in metres.',
  'forest.cover': 'How much of the area is groves (1: all of it).',
  'mix.on': 'Whether {kind} trees grow in the forest.',
  'mix.share': 'The {kind} trees\' share of the forest, against the other kinds that grow (shares are scaled to add up to 100%).',
  'forest.grouping': 'Mixed: every tree\'s kind drawn at random. In stands: each kind grows in its own patches.',
  'forest.standSize': 'About how wide a stand of one kind is, in metres.',
  'forest.variants': 'How many different trees of each kind the forest uses. More look less alike; fewer draw faster.',
  'forest.size': 'Each tree\'s size, as a share of the tree grown: a random size between least and most.',
  'terrain.seed': 'Picks which hills. The same seed always gives the same hills.',
  'action.newHills': 'Random hills.',
  'terrain.height': 'How high the hills rise and fall, in metres. 0 is flat ground.',
  'terrain.size': 'How wide a hill is, in metres.',
  'terrain.roughness': 'How much smaller bumps add to the hills.',
  'forest.maxSlope': 'No tree grows on ground steeper than this, in degrees.',

  // The sway and the wind (the wind's rows are the workshop's own).
  'sway.on': 'The trees bend and bob in the wind. Off, they stand still.',
  'sway.branch': 'How much the limbs bob on their own, as a multiple of the workshop\'s tuning.',
  'sway.flutter': 'How much the leaves and needles flutter, as a multiple of the workshop\'s tuning.',
  'clock.paused': 'Stop time: the trees freeze mid-sway. P does the same.',
  'sway.timeScale': 'How fast time runs: 1 is real time, 0.5 slow motion.',
  'wind.on': 'Wind or a calm.',
  'wind.speed': 'The mean wind 2 m above the ground, in metres a second. 2 is a light breeze, 8 a strong one.',
  'wind.from': 'Where the wind blows from, in degrees: 90 is from +x, 0 from ahead.',
  'wind.gust': 'How much a gust adds at its heart, in metres a second.',
  'wind.gustEvery': 'About how often a gust passes any spot, in seconds.',
  'wind.turbulence': 'Small swirls in the wind, as a share of its speed.',
  'wind.seed': 'Picks which gusts and swirls. The same seed blows the same way.',
  'windView.show': 'Draw the wind: arrows, gusts, and a heat map on the ground. V does the same.',

  // The view.
  'ui.textSize': 'How big the text is here. Kept in this browser only: not saved with settings or in links.',
  'view.wireframe': 'Show the trees\' triangles as lines.',
  'view.grid': 'A grid of 1 m squares on the ground.',
  'view.edge': 'A line round the forest\'s area.',
  'view.person': 'The workshop\'s own figure, standing by the trees for scale.',
  'view.spin': 'Turn the view slowly round the trees.',
  'action.frame': 'Move the camera back to see everything.',

  // Saving and sharing.
  'action.save': 'Download every setting as a .json file, to load again later or share.',
  'action.load': 'Open a TreeLab .json settings file.',
  'action.copy': 'Copy a link that opens TreeLab on exactly these trees.',
  'shot.scale': 'The screenshot\'s size, as a multiple of your screen. 4× suits printing.',
  'shot.mark': 'Put "TreeLab · Studio Gray Lake" in the screenshot\'s corner.',
  'action.take': 'Download a picture of the view as a PNG (without the panels).',
  'action.share': 'Share a picture of the view, with a link back to it.',
  'model.ground': 'Include the forest\'s ground in the model (cut to the forest).',
  'model.instancing': 'Instanced is the smallest file (three.js, Babylon.js, Godot, Blender 3.6+). One node a tree opens in every 3D tool.',
  'action.glb': 'Download the trees shown as a .glb 3D model, standing still. Yours to use (CC0).',
  'action.startOver': 'Put every setting back to TreeLab\'s defaults.',

  // Colour.
  'colors.dark': 'The {kind} foliage\'s darkest green (tint 0).',
  'colors.light': 'The {kind} foliage\'s lightest green (tint 1).',
  'autumn.amount': 'How far into autumn: 0 is summer green, 1 every broadleaf turned.',
  'autumn.palette': 'Autumn\'s colours: maple reds and oranges, birch golds, oak russets, or all mixed.',
  'autumn.spread': 'How unevenly the trees turn: 0 all together, 1 some still green while others are red.',
  'autumn.evergreens': 'Let the firs and pines turn too (as larches do). Otherwise they stay green, a little duller.',
};

// The generator's settings (src/treeShapes.js, the workshop's), by kind.
const BRANCHING = {
  girth: 'How thick the trunk is: its radius at the ground, in metres.',
  lean: 'How far the whole tree may lean, in degrees.',
  branches: 'How many main limbs the trunk splits into.',
  length: 'How long a main limb is, in metres.',
  tilt: 'How far a limb leans out from upright, in degrees: 0 straight up, 90 level, past 90 hanging.',
  curl: 'How much more upright a limb\'s outer half turns, in degrees. Below 0 it bends down, weeping.',
  clumps: 'Foliage clumps on each limb: one at the tip, the others on side twigs.',
  clumpSize: 'How big a limb\'s tip clump is: its radius, in metres (twig clumps are smaller).',
  squash: 'A clump\'s height over its width: below 1 flat, above 1 tall.',
  rough: 'How lumpy the clumps are, as a share of their size.',
  sway: 'How far a limb\'s tip bobs in the wind, in metres for each m/s.',
};
export const SHAPE_TIPS = {
  // TreeLab's own English oak, at its real size.
  oak: {
    height: 'How tall the oak grows, to the top of its crown, in metres. A mature oak in the open is 17–22 m.',
    spread: 'The crown\'s width over the tree\'s height. Above 1 the crown is wider than tall, as an oak in the open is.',
    trunk: 'Bare trunk below the first big limbs, in metres. Short in the open; long in a forest, where it grows up toward the light.',
    girth: 'How thick the trunk is: its radius just above the swollen foot, in metres. Every branch\'s thickness follows from it.',
    lean: 'How far the whole tree leans, in degrees.',
    limbs: 'How many big limbs the trunk divides into. They set off at different heights, turning round the trunk.',
    crooked: 'How much the branches zig-zag. Oaks are crooked; 0 grows them straight.',
    droop: 'How much long limbs sag with their length, their tips most.',
    leafiness: 'How full the crown is: more branches grown into it, and fuller clusters of leaves.',
    clumpSize: 'How big a cluster of leaves is: its radius, in metres.',
    squash: 'A cluster\'s height over its width: below 1 flat, above 1 tall.',
    rough: 'How lumpy the clusters of leaves are.',
    sway: 'How far a branch tip bobs in the wind, in metres for each m/s.',
  },
  broadleaf: {
    ...BRANCHING,
    trunk: 'How tall the bare trunk is, from the ground to where it splits into limbs, in metres.',
    leader: 'The chance that one limb carries on nearly upright, as a leader (with 3 limbs or more).',
    core: 'A clump over the split, tying the others into one crown: its radius in metres (0: none).',
  },
  fir: {
    height: 'How tall the fir is, to its tip, in metres.',
    bare: 'Bare trunk under the lowest tier of branches, in metres.',
    girth: BRANCHING.girth,
    lean: BRANCHING.lean,
    tiers: 'How many tiers of branches, from the bottom to the tip.',
    radius: 'How wide the lowest tier reaches, in metres (higher tiers are narrower).',
    points: 'How many branch tips go round each tier.',
    droop: 'How far the tips hang below the tier, in metres (the lowest most). Below 0 they turn up.',
    jag: 'How much shorter a tip can be than its neighbours, as a share: ragged tiers.',
    sway: 'How far a tier\'s rim bobs in the wind, in metres for each m/s.',
  },
  pine: {
    ...BRANCHING,
    height: 'How tall the trunk is, to its top, in metres.',
    crook: 'How far the trunk wanders off straight, in metres.',
    crown: 'Where the limbs start, as a share of the height: 0.7 is the top 30%.',
    stubs: 'Dead stubs on the bare trunk.',
  },
};

export function shapeTip(kind, key) {
  return SHAPE_TIPS[kind]?.[key] ?? `A setting of the workshop's tree generator ("${key}"), new since TreeLab's tips were written.`;
}

export function tip(key, kind = '') {
  const text = TIPS[key];
  return text ? text.replaceAll('{kind}', kind) : null;
}
