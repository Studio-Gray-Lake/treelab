// What each row of the panel does, in a line or two: shown when a row is
// hovered, focused, or its name tapped (src/main.js). Keys are the
// setting's path; {kind} is filled in with the tree's kind.

export const TIPS = {
  // Both tabs: a whole starting point (src/scenes.js).
  'scene.startFrom': 'Start everything from a ready-made view: one oak, a mixed forest, or a misty oak wood early in the morning. "custom" once you change something.',

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
  'shape.outline': 'The crown from the side. Drag a dot in or out to set how far the branches reach at that height: they grow into the shape you draw.',
  'preset.startFrom': 'Start this kind from a ready-made shape. The oak: in the open, young, in a forest, or ancient. The workshop\'s trees: "workshop" is the game\'s own.',

  // The Forest tab.
  'readout.trees': 'How many trees the forest holds now.',
  'forest.seed': 'Picks where the trees stand. The same seed always plants the same forest.',
  'action.newLayout': 'A random layout: the same kinds and density, standing elsewhere.',
  'forest.area': 'The forest\'s outline: a circle, or a square.',
  'forest.radius': 'How big the forest is, in metres: the circle\'s radius, or half the square\'s side. Past about 50 m from the middle the wind blows steady, without gusts.',
  'forest.density': 'Trees per hectare (100 × 100 m). 10 is a tree every 30 m; 400 one every 5 m; 2,500 one every 2 m. A forest holds at most 4,000 trees.',
  'forest.pattern': 'How trees are spread: even spacing (the most natural), random, a jittered grid, clumps, or plantation rows.',
  'forest.jitter': 'How far each tree is nudged off its grid spot, as a share of a cell. 0 is a perfect grid.',
  'forest.clumpTrees': 'About how many trees grow in each clump.',
  'forest.clumpSpread': 'How far a clump\'s trees stray from its middle, in metres.',
  'forest.rowAngle': 'Which way the plantation rows run, in degrees.',
  'forest.patches': 'Split the area into groves and clearings: trees grow only in the groves.',
  'forest.patchSize': 'About how wide a grove or a clearing is, in metres.',
  'forest.cover': 'How much of the area is groves (1: all of it).',
  'mix.on': 'Whether {kind} trees grow in the forest.',
  'mix.mixed': 'Off: every {kind} is the age the Tree tab shows. On: each of its shapes has an age of its own, and is the Tree tab\'s tree at that age.',
  'mix.ages': 'The youngest and the oldest {kind}, in years. Its shapes\' ages are spread between them; an age sets a tree\'s size, so "size" varies it less.',
  'mix.old': 'How the ages are spread. 0.5: as many young as old. Toward 0: mostly young, a few old ones. Toward 1: mostly old.',
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

  // The light.
  'light.hour': 'The time of day, in hours: the sun rises at 5:30, stands highest at 13:00 and sets at 20:30. Low, it turns golden.',
  'light.runs': 'Lets the day run: how many hours of it pass in each minute you watch. 0 stands still. After 21:00 it starts again at 5:00 (no night). P pauses it.',
  'light.from': 'Which way the noon sun shines from, in degrees (90 from +x, as the wind). Morning sun comes from its left, evening sun from its right.',
  'light.glow': 'Sunlight through the leaves: looking toward the sun, the edges of the crowns glow. 1 as tuned, 0 none.',
  'light.shafts': 'Shafts of sunlight through the trees. Strongest looking toward the sun, against shade. 1 as in life, faint from the side. Above 1 is a boost, not as in life: up to 10 times as bright. 0 none.',
  'light.mist': 'Mist on the ground in banks and wisps, drifting with the wind. It veils what\'s behind and catches the sun, most of all toward it. 0 clear, 0.2 a thin mist, 1 fog you see 100 m through.',
  'light.gaps': 'Gaps in the crowns: sun gets through the foliage in spots, so the shade is dappled and shafts fall through. 0 solid shade, 1 thin crowns. Needles let half as much through.',
  'light.shade': 'The trees keep the sky\'s light, as well as the sun\'s, off what is under them: a closed wood\'s floor is dim, so the spots of sun stand out. 1 as worked out from the trees, 0 none.',
  'light.eye': 'The eye adjusts to what it looks at: under the trees it opens up, so the shade shows and the sun burns bright; in the open it closes down again. 1 as far as an eye goes, 0 the hour\'s exposure only.',

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
  'view.stand': 'Walk the forest: the figure starts among the trees, facing the sun, and the camera follows it. W A S D or the arrow keys walk, Shift runs, Space jumps; a game pad works too. Drag to look round.',
  'view.eyes': 'See the forest through the figure\'s eyes, at eye height, where the camera otherwise follows behind it. Here the wheel walks too, and a drag with two fingers.',
  'action.frame': 'Move the camera back to see everything (among the trees: back to where you first stood).',

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
    age: 'The oak\'s age, in years. Moving it sets the other sliders to an oak\'s of that age, grown in the open: 15 young, 150 grown, 500 ancient. Move any of them by hand afterwards.',
    height: 'How tall the oak grows, to the top of its crown, in metres. A mature oak in the open is 17–22 m.',
    spread: 'The crown\'s width over the tree\'s height. Above 1 the crown is wider than tall, as an oak in the open is.',
    trunk: 'Bare trunk below the first big limbs, in metres. Short in the open; long in a forest, where it grows up toward the light.',
    girth: 'How thick the trunk is: its radius just above the swollen foot, in metres. Every branch\'s thickness follows from it.',
    lean: 'How far the whole tree leans, in degrees.',
    bends: 'How much the trunk itself bends on its way up, carrying the crown with it. 0 is straight as a pole; past 1 is a very crooked trunk.',
    limbs: 'How many big limbs the trunk divides into. They set off at different heights, turning round the trunk.',
    crooked: 'How much the branches zig-zag. Oaks are crooked; 0 grows them straight.',
    droop: 'How much long limbs sag with their length, their tips most.',
    leafiness: 'How full the crown is: more branches grown into it, and leaves that live on less light, so more of them under the top. Low: a thin crown, bare inside.',
    crowded: 'How near its neighbours stand. Their crowns keep the low sky off its sides, so its lower leaves go: 0 alone in the open, leafy down its sides; 1 in a wood, leaves at the top.',
    reachTop: 'How far the branches reach at the crown\'s top, as a share of half its width. 0: it closes to a point. More: a flat top.',
    reachHigh: 'How far the branches reach three quarters of the way up the crown, as a share of half its width.',
    reachMid: 'How far the branches reach halfway up the crown, as a share of half its width.',
    reachLow: 'How far the branches reach a quarter of the way up the crown, as a share of half its width. Low for a forest oak, whose low branches are short.',
    reachBottom: 'How far the branches reach at the crown\'s bottom, as a share of half its width. 0: it closes to the trunk there. More: a flat underside.',
    clumpSize: 'How big a cluster of leaves is: its radius, in metres.',
    squash: 'A cluster\'s height over its width: below 1 flat, above 1 tall.',
    rough: 'How lumpy the clusters of leaves are.',
    sway: 'How far a branch tip bobs in the wind, in metres for each m/s.',
    gnarl: 'How lumpy and fluted the trunk, the big limbs and the roots are. 0 is smooth, 1 an ancient oak\'s; past 1 is more than any oak. A thin trunk shows less of it than a thick one, and it thins out with height.',
    burrs: 'Burrs: lumpy bulges on the trunk, most of them low down. 1 is about eight on a trunk 0.6 m thick; a thinner trunk has fewer, a thicker one more. 0 none.',
    hollows: 'Hollows in the trunk: deep dark dents with a raised rim (dents, not holes through it), most of them low down. 0 none, 1 three, 2 six.',
    marksHigh: 'How far up the gnarl, burrs and hollows go. 0: they gather at the foot and thin out quickly. 1: evenly all the way up the trunk and the limbs.',
    stubs: 'Dead stubs: what is left of branches that died, on the trunk and the big limbs, broken off short. 0 none.',
    flare: 'How far the trunk\'s foot spreads toward the ground, most where a root leaves it.',
    roots: 'How far the roots run out over the ground before they go under it. They rise and dip on the way, and a long one forks. 0 none.',
    masses: 'A test. 0: every cluster of leaves a ball of its own. 1: each limb\'s clusters merged into one mass, hollow underneath, so branches show from below.',
    merge: 'With merged masses: how many of the clusters close enough to run together do. 100: all, one mass a bough. 0: each cluster its own. Raising it only adds merges.',
    noise: 'With merged masses: how much 3D noise shapes them. 0: the round lumps as they are. 100: bent and billowing, open where they run thin. Past 100: more. The rows under it choose what the noise is like.',
    noiseType: 'What the noise is like. Smooth: soft swells and dips. Creased: puffs with thin sharp creases between. Ridged: thin sharp ridges with soft dips between. Cells: round clumps with seams between.',
    noiseSize: 'How big the noise\'s broad billows are, in metres across. Small: many small ones. Large: a few big ones. Billows smaller than the facets (coarseness) fade out: they can\'t be drawn.',
    noiseDetail: 'How many finer layers of noise lie on the broad one, each about two-fifths the size of the last and half as strong. 0: the broad billows alone. A layer finer than the facets (coarseness) fades out, so with small billows or coarse facets more detail changes nothing.',
    noiseBend: 'How far the noise pulls the shapes out of round, in metres at 100% noise. 0: it doesn\'t bend them, only thickens and thins.',
    noiseBillow: 'How strongly the noise thickens the leaves in one place and thins them in the next, so how readily gaps open. 0: it only bends the shapes. 1: as usual. Past 1: more gaps, and more twigs left bare.',
    coarse: 'How big the merged masses\' facets are, in metres: small is fine and smooth, large is chunky. Only with merged masses.',
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
