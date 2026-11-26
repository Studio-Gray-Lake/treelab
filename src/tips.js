// What each row of the panel does, in a line or two: shown when a row is
// hovered, focused, or its name tapped (src/main.js). Keys are the
// setting's path; {kind} is filled in with the tree's kind.

export const TIPS = {
  // Both tabs: a whole starting point (src/scenes.js).
  'scene.startFrom': 'Start everything from a ready-made view: one oak, a mixed forest, a wood of one kind (oaks in fog, autumn beeches, firs, pines), or oaks over an underwood. "custom" once you change something.',

  // The Tree tab.
  'tree.kind': 'Which kind of tree: one of TreeLab\'s own, at their real size (oak, beech, hawthorn, hazel, holly, ash, birch, linden), or the workshop\'s broadleaf, fir or pine.',
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
  'shape.kind': 'Which kind of tree this panel shows. A click on a tree in the forest shows its kind. The sliders change every tree of the kind, in both tabs.',
  'shape.outline': 'The crown from the side. Drag a dot in or out to set how far the branches reach at that height: they grow into the shape you draw.',
  'preset.startFrom': 'Start this kind from a ready-made shape. TreeLab\'s own trees: in the open, young, in a forest, or old. The workshop\'s trees: "workshop" is the game\'s own.',

  // The Forest tab.
  'readout.trees': 'How many trees the forest holds now.',
  'forest.seed': 'Picks where the trees stand. The same seed always plants the same forest.',
  'action.newLayout': 'A random layout: the same kinds and density, standing elsewhere.',
  'forest.area': 'The forest\'s outline: a circle, or a square.',
  'forest.radius': 'How big the forest is, in metres: the circle\'s radius, or half the square\'s side. Past about 50 m from the middle the wind blows steady, without gusts.',
  'forest.density': 'Seeds that fall, per hectare (100 × 100 m): 10 is one every 30 m; 400 one every 5 m. The rules below decide which grow into trees; "holds" says how many stand. At most 4,000.',
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
  'mix.share': 'Tick: {kind} trees grow in the forest. Bar: their share against the other kinds (scaled to add up to 100%). Last number: how many stand. Click the name for the kind\'s settings.',
  'forest.mixBy': 'By count: a share is a share of the seeds. By cover: each layer is asked for a share of the ground under its crowns, and the seeds are worked out.',
  'forest.layers.canopy': 'How much of the ground the crowns of the tall trees cover, in percent. "Stands" is what came of it after the rules. A crown counts as a circle.',
  'forest.layers.underwood': 'How much of the ground the crowns of the small trees cover, under and between the tall ones, in percent. "Stands" is what came of it.',
  'mix.cover': 'Tick: {kind} trees grow in the forest. Bar: their share of the crowns of their layer, by area. Last: what stands of it, and how many trees. Click the name for the kind.',
  'crown.form': 'The form of this kind\'s crown. A form sets a few of the rows below together: how flat and wide a cluster of leaves is, and whether different limbs\' leaves run together. "custom" once you move one.',
  'wood.startFrom': 'Start the mix from a ready-made wood, set by cover: which kinds grow, and how much ground each layer covers. It moves only the rows below. "custom" once you move one.',
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
  'forest.rules.ground': 'How far each kind keeps to the ground it likes: an ash to the lower slopes, a birch and a pine to the higher ground. 0: any kind anywhere. On flat ground it changes nothing.',
  'forest.rules.room': 'How much room trees of a height keep between them. 1: a little over half of their two crowns\' reach, as crowns in a wood touch and interlock. More: wider apart. 0: a tree wherever a seed fell.',
  'forest.rules.light': 'How much the light decides under a taller tree\'s crown. 1: a holly or a beech grows there, a hazel mostly, a birch, a pine or an ash hardly ever. 0: any kind in any shade.',

  // The light.
  'light.hour': 'The time of day, in hours: the sun rises at 5:30, stands highest at 13:00 and sets at 20:30. Low, it turns golden.',
  'light.runs': 'Lets the day run: how many hours of it pass in each minute you watch. 0 stands still. After 21:00 it starts again at 5:00 (no night). P pauses it.',
  'light.from': 'Which way the noon sun shines from, in degrees (90 from +x, as the wind). Morning sun comes from its left, evening sun from its right.',
  'light.glow': 'Sunlight through the leaves: looking toward the sun, the edges of the crowns glow. 1 as tuned, 0 none.',
  'light.shafts': 'Shafts of sunlight through the trees. Strongest looking toward the sun, against shade. 1 as in life, faint from the side. Above 1 is a boost, not as in life: up to 10 times as bright. 0 none.',
  'light.mist': 'Water drops on the ground, in banks and wisps, drifting with the wind. Mist while you see 1 km or more, fog under that: 0 clear, 0.2 thin mist (2.4 km), 0.31 the line, 1 thick fog (100 m).',
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
  'view.turnSpeed': 'How fast "turn slowly" turns the view, in degrees a second: 12 is a turn in half a minute. Below 0 it turns the other way.',
  'action.centre': 'Slide the view so the selected tree is at the middle of the screen; the view then turns round it. A click selects a tree. With none selected: the middle of what\'s shown. Key: C.',
  'forest.closes': 'A tree hemmed in by others grows as it would in a wood: taller, its crown narrow and high on a long bare trunk. At the edge, in a clearing or above the rest, it grows as in the open.',
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
  'model.instancing': 'Instanced is the smallest file (three.js, Babylon.js, Blender 3.6+, Unity with glTFast). Godot 4.6 can\'t open it. One node a tree opens in every 3D tool.',
  'action.glb': 'Download the trees shown as a .glb 3D model, standing still. Yours to use (CC0).',
  'action.startOver': 'Put every setting back to TreeLab\'s defaults.',

  // Colour.
  'colors.dark': 'The {kind} foliage\'s darkest green (tint 0).',
  'colors.light': 'The {kind} foliage\'s lightest green (tint 1).',
  'season.time': 'The time of year: a place to start from. It sets the three rows under it: how much of their leaves the trees carry, how new those leaves are, how far they have turned. "custom" once you move one.',
  'season.leaves': 'How much of their leaves the trees carry. 1: all. Less, and clusters of leaves go, leaving bare twigs: each kind at its own pace (the ash bare first, the oak last). Evergreens keep theirs.',
  'season.fresh': 'How new the leaves are. 1: just out, a pale yellow green, uneven from limb to limb. 0: summer\'s own greens.',
  'autumn.amount': 'How far into autumn: 0 is summer green, 1 every broadleaf turned.',
  'autumn.palette': 'Autumn\'s colours: maple reds and oranges, birch golds, oak russets, or all mixed.',
  'autumn.spread': 'How unevenly the trees turn: 0 all together, 1 some still green while others are red.',
  'autumn.evergreens': 'Let the firs and pines turn too (as larches do). Otherwise they stay green, a little duller. A holly never turns.',
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
    leader: 'How far up its crown the trunk carries on before it gives way to its limbs. An oak\'s: about a third. 1: to the very top, as a fir\'s does.',
    whorl: 'How many limbs leave the trunk together in a ring. 0: none, they leave one by one in a spiral, as an oak\'s do. Conifers grow a ring a year.',
    riseTop: 'How steeply the topmost limbs set off, in degrees above level. 90 is straight up.',
    riseBottom: 'How steeply the lowest limbs set off, in degrees above level. 0 is level; below 0 they hang.',
    crooked: 'How much the branches zig-zag. Oaks are crooked; 0 grows them straight.',
    droop: 'How much long limbs sag with their length, their tips most.',
    sideLeaves: 'How many of the twigs off a branch\'s side keep their leaves. 1: all that have the light for it. 0: none, so leaves sit only at the branches\' ends, as an ash\'s do, and the wood inside shows.',
    leafiness: 'How full the crown is: more branches grown into it, and leaves that live on less light, so more of them under the top. Low: a thin crown, bare inside.',
    crowded: 'How near its neighbours stand. Their crowns keep the low sky off its sides, so its lower leaves go: 0 alone in the open, leafy down its sides; 1 in a wood, leaves at the top.',
    reachTop: 'How far the branches reach at the crown\'s top, as a share of half its width. 0: it closes to a point. More: a flat top.',
    reachHigh: 'How far the branches reach three quarters of the way up the crown, as a share of half its width.',
    reachMid: 'How far the branches reach halfway up the crown, as a share of half its width.',
    reachLow: 'How far the branches reach a quarter of the way up the crown, as a share of half its width. Low for a forest oak, whose low branches are short.',
    reachBottom: 'How far the branches reach at the crown\'s bottom, as a share of half its width. 0: it closes to the trunk there. More: a flat underside.',
    clumpSize: 'How big a cluster of leaves is: its radius, in metres. A cluster can be no bigger than lets light through to its own underside: about 2.6 m for a round one, up to 6 or so for a very flat or very tall one. Past that, the slider changes nothing.',
    squash: 'A cluster\'s height over its width: below 1 flat, above 1 tall.',
    hang: 'How far the leaves at a branch\'s end hang below their twigs, and how much longer they are for it. 0: they sit on their twigs. A silver birch\'s ends hang; its crown stands. Leaves along a branch never hang.',
    clumpWide: 'How many times wider a cluster\'s leaves are drawn than the light allows it. 1: as allowed. More: the same leaves spread wider, as a flat layer\'s are. A factor on the drawing, not grown.',
    across: 'Whether the leaves of different limbs run together. Limb by limb: each limb carries masses of its own, with sky between. The whole crown: masses lie over several limbs.',
    rough: 'How lumpy the clusters of leaves are.',
    sway: 'How far a branch tip bobs in the wind, in metres for each m/s.',
    gnarl: 'How lumpy and fluted the trunk, the big limbs and the roots are. 0 is smooth, 1 an ancient oak\'s; past 1 is more than any oak. A thin trunk shows less of it than a thick one, and it thins out with height.',
    burrs: 'Burrs: lumpy bulges on the trunk, most of them low down. 1 is about eight on a trunk 0.6 m thick; a thinner trunk has fewer, a thicker one more. 0 none.',
    hollows: 'Hollows in the trunk: deep dark dents with a raised rim (dents, not holes through it), most of them low down. 0 none, 1 three, 2 six.',
    marksHigh: 'How far up the gnarl, burrs and hollows go. 0: they gather at the foot and thin out quickly. 1: evenly all the way up the trunk and the limbs.',
    stubs: 'Dead stubs: what is left of branches that died, on the trunk and the big limbs, broken off short. 0 none.',
    flare: 'How far the trunk\'s foot spreads toward the ground, most where a root leaves it.',
    roots: 'How far the roots run out over the ground before they go under it. They rise and dip on the way, and a long one forks. 0 none.',
    merge: 'How many of the clusters of leaves close enough to run together into one mass do. 100: all, a limb\'s leaves one mass, hollow underneath. 0: every cluster a mass of its own. Raising it only adds merges.',
    leafReach: 'How far a cluster\'s leaves reach toward its neighbours. More: clusters further apart run together, and every mass is fuller (a cluster about a quarter wider at 0.6). 0.2 joins across a gap of a quarter of a cluster\'s radius.',
    noise: 'How much 3D noise shapes the masses of leaves. 0: the round lumps as they are. 100: bent and billowing, open where they run thin. Past 100: more. The rows under it choose what the noise is like.',
    noiseType: 'What the noise is like. Smooth: soft swells and dips. Creased: puffs with thin sharp creases between. Ridged: thin sharp ridges with soft dips between. Cells: round clumps with seams between.',
    noiseSize: 'How big the noise\'s broad billows are, in metres across. Small: many small ones. Large: a few big ones. Billows smaller than the facets (coarseness) fade out: they can\'t be drawn.',
    noiseDetail: 'How many finer layers of noise lie on the broad one, each about two-fifths the size of the last and half as strong. 0: the broad billows alone. A layer finer than the facets (coarseness) fades out, so with small billows or coarse facets more detail changes nothing.',
    noiseBend: 'How far the noise pulls the shapes out of round, in metres at 100% noise. 0: it doesn\'t bend them, only thickens and thins.',
    noiseBillow: 'How strongly the noise thickens the leaves in one place and thins them in the next, so how readily gaps open. 0: it only bends the shapes. 1: as usual. Past 1: more gaps, and more twigs left bare.',
    coarse: 'How big the facets of the masses of leaves are, in metres: small is fine and smooth, large is chunky. A small tree\'s are smaller.',
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

// TreeLab's own beech, at its real size: the oak's rows, said of a beech
// where a beech differs.
SHAPE_TIPS.beech = {
  ...SHAPE_TIPS.oak,
  age: 'The beech\'s age, in years. Moving it sets the other sliders to a beech\'s of that age, grown in the open: 20 young, 120 grown, 300 old. Move any of them by hand afterwards.',
  height: 'How tall the beech grows, to the top of its crown, in metres. A grown beech in the open is 24–30 m; in a wood it reaches 35 and more.',
  spread: 'The crown\'s width over the tree\'s height. A beech in the open is nearly as wide as it is tall; in a wood, a third as wide.',
  trunk: 'Bare trunk below the first big limbs, in metres. Short in the open; in a wood a beech is a clean column for 15 to 20 m.',
  limbs: 'How many big limbs the trunk divides into. A beech has more than an oak, and they set off at different heights, turning round the trunk.',
  leader: 'How far up its crown the trunk carries on before it gives way to its limbs. A grown beech\'s: about two fifths. A young one\'s: most of the way.',
  whorl: 'How many limbs leave the trunk together in a ring. 0: none, they leave one by one in a spiral, as a beech\'s do. Conifers grow a ring a year.',
  riseBottom: 'How steeply the lowest limbs set off, in degrees above level. 0 is level; below 0 they hang. A beech\'s lowest limbs set off low and sweep down with their length.',
  crooked: 'How much the branches zig-zag. A beech\'s curve gently; 0 grows them straight.',
  droop: 'How much long limbs sag with their length, their tips most. A beech\'s low limbs sweep down nearly to the ground.',
  tipRise: 'How far a limb\'s tip turns up again after it sags: the end keeps growing toward the light. 0: none. Below 0: the tip droops further.',
  leafiness: 'How full the crown is: more branches grown into it, and leaves that live on less light, so more of them under the top. A beech\'s leaves live on very little. Low: a thin crown, bare inside.',
  reachLow: 'How far the branches reach a quarter of the way up the crown, as a share of half its width. Low for a forest beech, whose low branches are short.',
  squash: 'A cluster\'s height over its width: below 1 flat, above 1 tall. A beech\'s leaves lie in flat layers, each spray held level.',
  gnarl: 'How lumpy and fluted the trunk, the big limbs and the roots are. 0 is smooth, as a beech\'s bark is nearly all its life. A thin trunk shows less of it than a thick one, and it thins out with height.',
  stubs: 'Dead stubs: what is left of branches that died, on the trunk and the big limbs, broken off short. 0 none: a beech sheds a branch cleanly.',
};

// TreeLab's own hawthorn, at its real size: the oak's rows, said of a
// hawthorn where a hawthorn differs.
SHAPE_TIPS.hawthorn = {
  ...SHAPE_TIPS.oak,
  age: 'The hawthorn\'s age, in years. Moving it sets the other sliders to a hawthorn\'s of that age, grown in the open: 10 young, 60 grown, 250 old. Move any of them by hand afterwards.',
  height: 'How tall the hawthorn grows, to the top of its crown, in metres. A grown hawthorn is 6–9 m, seldom over 10.',
  spread: 'The crown\'s width over the tree\'s height. A hawthorn in the open is about as wide as it is tall; an old one wider; under taller trees, narrower.',
  trunk: 'Bare trunk below the first big limbs, in metres. Short: a hawthorn divides low. Longer under taller trees.',
  girth: 'How thick the trunk is: its radius just above the swollen foot, in metres. A grown hawthorn\'s is 11 to 16 cm, an old one\'s 25 to 30. Every branch\'s thickness follows from it.',
  lean: 'How far the whole tree leans, in degrees. A hawthorn seldom stands upright.',
  swept: 'How far a wind from one side has shaped the tree. Its crown lies to the lee (the way the tree leans), its branches stream that way, those facing the wind stay short, and its trunk bows over. 0: none.',
  leader: 'How far up its crown the trunk carries on before it gives way to its limbs. A hawthorn\'s: hardly at all. 1: to the very top, as a fir\'s does.',
  whorl: 'How many limbs leave the trunk together in a ring. 0: none, they leave one by one in a spiral, as a hawthorn\'s do. Conifers grow a ring a year.',
  crooked: 'How much the branches zig-zag. A hawthorn\'s turn at every bud: a tangle. 0 grows them straight.',
  leafiness: 'How full the crown is: more branches grown into it, and leaves that live on less light, so more of them under the top. A hawthorn in the open is dense to the inside. Low: a thin crown, bare inside.',
  reachLow: 'How far the branches reach a quarter of the way up the crown, as a share of half its width. Low for a hawthorn under taller trees, whose low branches are short.',
  gnarl: 'How lumpy and fluted the trunk, the big limbs and the roots are. 0 is smooth; 1 is an old hawthorn\'s, deeply grooved. A hawthorn shows it on a far thinner trunk than an oak does: fully at 25 cm. It thins out with height.',
  burrs: 'Burrs: lumpy bulges on the trunk, most of them low down. 1 is about eight on a trunk 25 cm thick; a thinner trunk has fewer, a thicker one more. 0 none.',
};

// TreeLab's own hazel, at its real size: a shrub of many stems from one
// stool. The oak's rows, said of a hazel where a hazel differs.
SHAPE_TIPS.hazel = {
  ...SHAPE_TIPS.oak,
  age: 'The hazel\'s age, in years since it was last cut or first grew. Moving it sets the other sliders to a hazel\'s of that age, left to grow: 5 young, 25 grown, 70 long uncut. Move any of them by hand afterwards.',
  height: 'How tall the hazel grows, to the top of its crown, in metres. A grown hazel is 4–6 m; long uncut, or drawn up under taller trees, 8 and more.',
  spread: 'The crown\'s width over the hazel\'s height. A hazel is about as wide as it is tall; a cut stool\'s sheaf of rods is far narrower.',
  girth: 'How thick its thickest stem is: its radius just above the stool, in metres. The other stems are thinner, the less they carry. A grown hazel\'s: 3.5 to 5 cm; a rod seven years after cutting: about 2.',
  stool: 'How wide the stool is: the woody foot its stems rise from, its radius in metres. It widens with every cutting and every year: 0.1 m young, 0.3 grown, half a metre and more on an old one.',
  lean: 'How far the whole hazel leans, in degrees.',
  limbs: 'How many stems rise from the stool. A grown hazel has seven to ten; a cut stool a dozen and more; a long uncut one, four to six thick ones.',
  riseTop: 'How steeply the steepest stems rise, those in the middle, in degrees above level. 90 is straight up.',
  riseBottom: 'How steeply the stems that lean out most rise, in degrees above level.',
  crooked: 'How much the stems and their branches zig-zag. A hazel\'s rods are nearly straight; 0 grows them straight.',
  droop: 'How much the stems arch over with their length, their tips most.',
  leafiness: 'How full the crown is: more branches grown into it, and leaves that live on less light, so more of them under the top. Low: a thin crown, bare inside, as under taller trees.',
  reachLow: 'How far the branches reach a quarter of the way up the crown, as a share of half its width. Low for a hazel: its stems are bare low down.',
  gnarl: 'How lumpy the stool and the feet of the stems are. 0 is smooth; an old stool is knobbly.',
  stubs: 'Dead stubs: what is left of stems and branches that died, on the stool and the stems, broken off short. 0 none; many on a hazel long uncut.',
  flare: 'How far the stool spreads toward the ground.',
};

// TreeLab's own holly, at its real size: the oak's rows, said of a holly
// where a holly differs.
SHAPE_TIPS.holly = {
  ...SHAPE_TIPS.oak,
  age: 'The holly\'s age, in years. Moving it sets the other sliders to a holly\'s of that age, grown in the open: 12 young, 60 grown, 250 old. Move any of them by hand afterwards.',
  height: 'How tall the holly grows, to the top of its crown, in metres. A grown holly is 8–12 m, seldom over 15.',
  spread: 'The crown\'s width over the tree\'s height. A holly is about half as wide as it is tall: a pyramid.',
  trunk: 'Bare trunk below the first big limbs, in metres. A holly in the open has branches nearly to the ground; an old one\'s trunk is clear for a couple of metres.',
  limbs: 'How many big limbs leave the trunk, at different heights, turning round it. A holly has many, all the way up.',
  leader: 'How far up its crown the trunk carries on before it gives way to its limbs. A holly\'s: nearly to the top. An oak\'s: about a third.',
  whorl: 'How many limbs leave the trunk together in a ring. 0: none, they leave one by one in a spiral, as a holly\'s do. Conifers grow a ring a year.',
  riseBottom: 'How steeply the lowest limbs set off, in degrees above level. 0 is level; below 0 they hang, as an old holly\'s do.',
  crooked: 'How much the branches zig-zag. A holly\'s do a little; 0 grows them straight.',
  droop: 'How much long limbs sag with their length, their tips most.',
  tipRise: 'How far a limb\'s tip turns up again after it sags: the end keeps growing toward the light. 0: none. Below 0: the tip droops further.',
  leafiness: 'How full the crown is: more branches grown into it, and leaves that live on less light, so more of them under the top. A holly\'s leaves live on very little: it is leafy to the inside. Low: a thin crown, bare inside.',
  reachLow: 'How far the branches reach a quarter of the way up the crown, as a share of half its width. A holly is widest low down.',
  gnarl: 'How lumpy and fluted the trunk, the big limbs and the roots are. 0 is smooth, as a holly\'s bark is most of its life. A thin trunk shows less of it than a thick one, and it thins out with height.',
  burrs: 'Burrs: lumpy bulges on the trunk, most of them low down: an old holly\'s warts. 1 is about eight on a trunk 0.6 m thick; a thinner trunk has fewer. 0 none.',
};

// TreeLab's own ash, at its real size: the oak's rows, said of an ash
// where an ash differs.
SHAPE_TIPS.ash = {
  ...SHAPE_TIPS.oak,
  age: 'The ash\'s age, in years. Moving it sets the other sliders to an ash\'s of that age, grown in the open: 15 young, 100 grown, 220 old. Move any of them by hand afterwards.',
  height: 'How tall the ash grows, to the top of its crown, in metres. A grown ash in the open is 22–28 m; in a wood it reaches 35.',
  spread: 'The crown\'s width over the tree\'s height. An ash in the open is about two thirds as wide as it is tall; in a wood, a third.',
  trunk: 'Bare trunk below the first big limbs, in metres. A few metres in the open; in a wood an ash is a clean pole for 12 to 18 m.',
  leader: 'How far up its crown the trunk carries on before it gives way to its limbs. An ash\'s: about two fifths. A young one\'s: nearly to the top.',
  riseTop: 'How steeply the topmost limbs set off, in degrees above level. 90 is straight up. An ash\'s limbs rise steeply.',
  riseBottom: 'How steeply the lowest limbs set off, in degrees above level. 0 is level; below 0 they hang.',
  crooked: 'How much the branches zig-zag. An ash\'s are stout and nearly straight; 0 grows them straight.',
  droop: 'How much long limbs sag with their length, their tips most. An ash\'s lower limbs sweep out.',
  tipRise: 'How far a limb\'s tip turns up again after it sags: the end keeps growing toward the light. An ash\'s turn up more than any other tree\'s. 0: none. Below 0: the tip droops further.',
  leafiness: 'How full the crown is: more branches grown into it, and leaves that live on less light, so more of them under the top. An ash\'s need plenty: its crown is open, and you see sky through it. Low: a thin crown, bare inside.',
  reachLow: 'How far the branches reach a quarter of the way up the crown, as a share of half its width. Low for a forest ash, whose low branches are short.',
  merge: 'How many of the clusters of leaves close enough to run together into one mass do. An ash\'s mostly stand apart, with sky between. 100: all, a limb\'s leaves one mass. 0: every cluster a mass of its own.',
  gnarl: 'How lumpy and fluted the trunk, the big limbs and the roots are. 0 is smooth, as a young ash\'s bark is. A thin trunk shows less of it than a thick one, and it thins out with height.',
};

// TreeLab's own birch, at its real size: the oak's rows, said of a birch
// where a birch differs.
SHAPE_TIPS.birch = {
  ...SHAPE_TIPS.oak,
  age: 'The birch\'s age, in years. Moving it sets the other sliders to a birch\'s of that age, grown in the open: 8 young, 40 grown, 90 old. Move any of them by hand afterwards.',
  height: 'How tall the birch grows, to the top of its crown, in metres. A grown birch is 15–21 m, seldom over 25.',
  spread: 'The crown\'s width over the tree\'s height. A birch is slim: a third to a half as wide as it is tall.',
  trunk: 'Bare trunk below the first big limbs, in metres. A few metres in the open; in a wood a birch is a thin pole for 8 to 13 m.',
  girth: 'How thick the trunk is: its radius just above the foot, in metres. A birch\'s is thin, and white where it is thicker than a few centimetres: thinner wood is dark, so a sapling is brown.',
  leader: 'How far up its crown the trunk carries on before it gives way to its limbs. A birch\'s: most of the way. An oak\'s: about a third.',
  whorl: 'How many limbs leave the trunk together in a ring. 0: none, they leave one by one in a spiral, as a birch\'s do. Conifers grow a ring a year.',
  riseTop: 'How steeply the topmost limbs set off, in degrees above level. 90 is straight up. A birch\'s limbs rise steeply.',
  crooked: 'How much the branches zig-zag. A birch\'s do a little; 0 grows them straight.',
  droop: 'How much long limbs arch over with their length, their tips most.',
  tipRise: 'What a limb\'s tip does after it arches over. Below 0 it hangs, as a birch\'s fine twigs do: the crown weeps. Above 0 it turns up again. 0: neither.',
  leafiness: 'How full the crown is: more branches grown into it, and leaves that live on less light, so more of them under the top. A birch\'s need plenty: its crown is light and open. Low: a thin crown, bare inside.',
  reachLow: 'How far the branches reach a quarter of the way up the crown, as a share of half its width. Low for a forest birch, whose low branches are short.',
  squash: 'A cluster\'s height over its width: below 1 flat, above 1 tall. A birch\'s are taller than wide: its leaves hang in tresses.',
  gnarl: 'How lumpy and fluted the trunk, the big limbs and the roots are. 0 is smooth, as a birch\'s white bark is; an old one\'s black foot is rugged. A thin trunk shows less of it, and it thins out with height.',
};

// TreeLab's own linden, at its real size: the oak's rows, said of a linden
// where a linden differs.
SHAPE_TIPS.linden = {
  ...SHAPE_TIPS.oak,
  age: 'The linden\'s age, in years. Moving it sets the other sliders to a linden\'s of that age, grown in the open: 20 young, 120 grown, 400 old. Move any of them by hand afterwards.',
  height: 'How tall the linden grows, to the top of its crown, in metres. A grown linden in the open is 22–28 m; in a wood it reaches 35 and more.',
  spread: 'The crown\'s width over the tree\'s height. A linden\'s crown is an egg: a little over half as wide as the tree is tall; in a wood, a third.',
  trunk: 'Bare trunk below the first big limbs, in metres. A few metres in the open; in a wood a linden\'s trunk is clear for 12 to 18 m.',
  leader: 'How far up its crown the trunk carries on before it gives way to its limbs. A linden\'s: more than halfway. A young one\'s: nearly to the top.',
  whorl: 'How many limbs leave the trunk together in a ring. 0: none, they leave one by one in a spiral, as a linden\'s do. Conifers grow a ring a year.',
  riseBottom: 'How steeply the lowest limbs set off, in degrees above level. 0 is level; below 0 they hang. A linden\'s lower limbs set off low, arch down and sweep up at their tips.',
  crooked: 'How much the branches zig-zag. A linden\'s curve; 0 grows them straight.',
  droop: 'How much long limbs sag with their length, their tips most. A linden\'s lower limbs arch out and down.',
  tipRise: 'How far a limb\'s tip turns up again after it sags: the end keeps growing toward the light. A linden\'s sweep up. 0: none. Below 0: the tip droops further.',
  leafiness: 'How full the crown is: more branches grown into it, and leaves that live on less light, so more of them under the top. A linden\'s crown is dense: little sky shows through. Low: a thin crown, bare inside.',
  reachLow: 'How far the branches reach a quarter of the way up the crown, as a share of half its width. A linden is widest low down; a forest linden\'s low branches are short.',
  burrs: 'Burrs: lumpy bulges on the trunk, most of them low down. An old linden\'s trunk is burry. 1 is about eight on a trunk 0.6 m thick; a thinner trunk has fewer, a thicker one more. 0 none.',
};

export function shapeTip(kind, key) {
  return SHAPE_TIPS[kind]?.[key] ?? `A setting of the workshop's tree generator ("${key}"), new since TreeLab's tips were written.`;
}

export function tip(key, kind = '') {
  const text = TIPS[key];
  return text ? text.replaceAll('{kind}', kind) : null;
}
