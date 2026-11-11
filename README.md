# TreeLab

Grow low-poly trees in your browser, compare their variations, and see how they look in a forest on hills, swaying in the wind. Save your settings, share a link or a screenshot, and download the trees as a model. TreeLab is a free tech demo from Studio Gray Lake. Its trees, wind and sway come from the studio's 3D Procedural Animation Workshop.

**Play it: https://studiograylake.com/treelab/**

No accounts, no cookies, and TreeLab itself sends nothing anywhere: your settings stay in your browser, and the address holds a link to what you see. The copy on studiograylake.com also loads the site's visit counter (Cloudflare Web Analytics, no cookies); a copy you build or run yourself has none.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5180.

```bash
npm test
```

The tests must show `ℹ fail 0`. They grow trees and read the shaders as text; none of them draws a picture. This does:

```bash
npm run check:browser
```

It serves TreeLab, opens it in a browser with no window (Chrome or Edge, whichever the computer has; `CHROME_PATH` names another), checks that the welcome card opens on a first visit and that OK closes it, then shows each starting view in turn and checks that nothing went wrong (no error, no shader that won't compile, no complaint from the graphics card), that there is a picture (not one flat colour, black or burnt out) and that the trees are there. A picture of each is left in `.scratch/browser-check/`. Whether a view looks right is still for eyes.

TreeLab has no motion clips of its own: the figure moves by hand-keyed cycles. It can be fitted with clips from [Mixamo](https://www.mixamo.com/) on your own computer. Download them there as .fbx, without skin (the walk and the run with *in place* ticked), into a `.mixamo/` folder in TreeLab's folder, named `Walking.fbx`, `Running.fbx`, `Jump.fbx` and `Idle.fbx`, then:

```bash
npm run bake:clips
```

It writes `.mixamo/figureClips.js`: each clip's motion fitted to the workshop's figure (its legs by where the ankles are, every other bone by how it's turned from rest), cut to start as the left foot lands, with its speed over the ground read from its feet. A clip that isn't there is left out, and the figure keeps its hand-keyed cycle for it. When that file is there, `npm run dev` and `npm run build` use it in place of the empty `src/figureClips.js`; a build made for the site (`npm run build:site`) never does. Neither Mixamo's own files nor the clips fitted from them are part of TreeLab: `.mixamo/` and every `.fbx` are kept out of git.

```bash
npm run build
```

builds the site into `dist/`. To serve it from a sub-folder of a website, set `TREELAB_BASE` (say `/treelab/`) when building; by default the paths are relative, so `dist/` works from any folder. `npm run build:site` builds the copy for studiograylake.com: the same, plus the site's visit counter (`/assets/analytics.js`).

## Where the trees come from

TreeLab runs on copies of eight files from the 3D Procedural Animation Workshop, in `vendor/workshop/`:

| File | What it does |
|---|---|
| `treeShapes.js` | The tree generator: each kind's settings, the skeleton, the wood and foliage |
| `treeSway.js` | Each tree a spring bent by the wind, and the shader that bends it |
| `spring.js` | The damped spring `treeSway.js` uses |
| `wind.js` | The wind: mean wind, gusts, swirl, lee behind hills, calm under crowns |
| `windView.js` | The wind as a texture for the shaders, and its debug view |
| `ik.js` | A leg bent to put its ankle where it's asked (hip, knee, ankle): for the figure's walk |
| `gamepad.js` | A game controller read through the browser: sticks, triggers, buttons |
| `rig.glb` | The workshop's character, built in Blender: the figure that stands by the trees for scale, and walks the forest |

The workshop is their only home: **never edit the copies here**. Change them in the workshop, then copy them again:

```bash
npm run sync
```

`vendor/workshop/SOURCE.json` records when they were copied, and each file's hash. `tests/vendor.test.js` fails if a copy was edited in TreeLab, if one starts importing something TreeLab doesn't copy, or (where the workshop is checked out) if the workshop has changed since the last sync.

To try a workshop change before syncing it, run TreeLab on the workshop's own files:

```bash
npm run dev:live
```

To tell TreeLab where the workshop is, put the path of its `src` folder in a `.workshop` file in TreeLab's folder (git ignores it), or set `WORKSHOP_SRC`. The workshop itself isn't public, so on a public clone there's nothing to sync from: the copies are all you need. The page says which files it's reading, under the stats, while developing.

## Using it

Two tabs, one set of settings.

- **start from** (the panel's first row): a whole starting point, every setting at once. *one oak* is TreeLab as it opens, *mixed forest* the same on the Forest tab, and *misty wood* a wood of tall oaks early in the morning, mist on the ground, seen from among the trees: the sun is low and ahead, so its light falls in shafts between the trunks, with the *light shafts* setting at 1, as in life. A starting point is only settings: change anything and the row says *custom*.

- **The English oak** is TreeLab's own tree, grown at its real size (a mature oak in the open is about 20 m tall and wider than that). Its branches grow into the space of an oak's crown and compete for it, so they branch unevenly and from all along their parents; every branch is as thick as the branches it carries, and a side branch starts thinner than the one it leaves. Its leaves grow only where there's light for them. The clusters of leaves are taken from the top down, and each keeps its leaves if enough of the sky's light reaches its underside through its own leaves and those above it (an oak's leaves live on about 8% of full light and stop light as measured in real oaks): so the crown is a layer of leaves at its top and outside, with fewer under it, fewer still further in and down, and bare limbs inside; sky shows through from underneath (6 to 8% of it; real crowns show 7 to 24%), and the shade is dappled by real gaps. Among neighbours (*neighbours*) the low sky is hidden, and the leaves are at the top only. Only twigs still growing carry leaves: a twig off the side of a branch that has since run on many times as far as the twig ever grew stopped long ago, shaded out as the crown closed over it, and is bare, so few clusters sit low down and deep inside. Every cluster sits on its twig, drawn from the wood into its middle: none floats. A slider changes what it names and nothing else: each part of the tree has random numbers of its own, and every oak is grown as the usual oak of its seed and then fitted to its own height, crown width and bare trunk, so those three stretch the tree and regrow nothing, one more limb leaves the others where they were, and a fuller crown keeps its limbs and its lean (where the crown itself changes, its finer branching rearranges with it). A crown bigger than the usual settings grow gets more of everything (branches, wood, clusters), up to three times as much for a 35 m oak, where it used to be the 20 m oak's skeleton stretched. It is drawn by its own mesher. Its wood is round (three sides for a twig, up to 24 for an ancient trunk); a branch is thicker where it leaves its parent, and wood thins gradually toward and past a fork; thick limbs are curves through their steps. Its foot spreads toward the ground, most where a root leaves it, and the roots run out over the ground: a third of each in it, rising and dipping on the way (here riding high, there under and out again), a long one forking, each going under for good over its last third. They're gnarled where they're thick, as the trunk is. (They lie on level ground: on a slope they don't follow it yet.) Its trunk bends a little on its way up (*bends*: none at the ground, where it's rooted, and the crown goes with it). It can be gnarled (lumps and flutes), carry burrs (bulges) and hollows (deep dents, dark inside, with a raised rim: dents, not holes through to a cavity), and it and the big limbs carry dead stubs, pale where they broke, where twigs died long ago. Those marks come with age and gather low down, as an oak's do: a trunk's thickness is its age, so a thin trunk shows few and a thick one many (as many as its sliders say at 0.6 m), and they're thickest at the foot and thin out with height (*marks reach up*: 0 at the foot only, 1 evenly all the way). So a tall thin forest oak has a clean bole, and a short thick one in the open is marked all over. Thick wood is drawn with an uneven mesh (no rows of diamonds), and a limb with sides about as wide as its trunk's. Where each mark is comes from the tree's own chance, so none moves when another slider does, and none of them changes the branches or the leaves. A test, off as it starts (*merged masses*, in the crown's section): each limb's clusters of leaves merged into one billowing mass, where every cluster is a ball of its own; lumps of many sizes run together, the mass is hollow underneath, so the branches show from below; *merging* (0 to 100%) is how many of the clusters near enough to run together do: at 100 a bough is one mass, lower down some clusters stay masses of their own, which overlap the others and move by themselves as the bough bobs, and at 0 every cluster is its own (raising it only adds merges: the ones made stay); *noise* (0 to 200%) shapes the masses with 3D noise, from the round lumps as they are (0) to bent, billowing ones that open where they run thin (100), never putting leaves where there is no twig; what the noise is like is chosen in a folded panel of its own (*noise*, in the crown's section): its *type* (smooth swells; creased: puffs with sharp creases between; ridged: sharp ridges; cells: round clumps), the *size* of its broad billows, how many finer layers lie on them (*detail*), how far it pulls the shapes out of round (*bend*) and how strongly it thickens and thins the leaves (*billow*); a layer of noise finer than the facets fades out, since it can't be drawn; and *coarseness* sets the facets' size. Its crown's outline can be drawn (*crown → outline*): a picture of the crown from the side with five dots, at its bottom, each quarter of the way up and its top; drag a dot in or out (or use the row under the drawing) to set how far the branches reach there. The branches follow, since they grow into that space, and the trunk carries on up toward where the crown is widest, so the limbs of a crown that's widest high up leave it all the way up and not in a bunch. The ready-made oaks each have their own: the open-grown oak's broad dome (which is what every oak had before), a young one's narrow egg, a forest oak's crown wide only near the top, an ancient one's low flat spread. Its *age* (years, the first slider) moves the others in plain sight: to an oak's of that age, grown in the open, between a young one at 15, a grown one at 150 and an ancient one at 500 (the ready-made oaks), and on past them from 10 to 800. Its thickness and its marks go by the years (wood is laid on year by year, and burrs and hollows come late); its height, its crown's width and outline, its bare trunk and its limbs by the age's logarithm (a tree does most of its growing up and out early), so an oak of 50 is about 13 m tall on a trunk 44 cm across, and one of 800 is lower than in its prime and 3.6 m across. Any slider can be moved by hand afterwards; the age itself grows nothing. (What neighbours do to a tree, the forest-grown oak, isn't an age: the slider doesn't know it yet.) In a forest the oaks are all of the age the Tree tab shows, until *mix → oak of several ages* is ticked: then each of the forest's oak shapes (*variants a kind*: six to start with, up to twelve) has an age of its own between the youngest and the oldest asked for (*oak ages*), spread evenly by the age's logarithm since a tree changes most while it's young (*young to old* leans them either way), and is the Tree tab's oak at that age, with whatever was changed by hand there carried along (a crown made half as wide again is half as wide again at every age). The info card lists the ages. An oak's age sets its size, so the forest's *size* varies such oaks a third as much. Its sliders reach well past any real oak (50 m tall, a trunk 3 m thick, limbs sagging to the ground, sixteen burrs), so the outlying ones can be looked at. They are an oak's, in sections by the part of the tree: size (age, height, crown width, lean), trunk (bare trunk, thickness, bends, gnarl, burrs, hollows, marks reach up), roots (flare, surface roots), limbs (big limbs, crooked, sag, dead stubs), crown (fullness, neighbours, the outline's own panel, cluster size, flat to tall, lumpy, merged masses, merging, coarseness, and the noise's own panel: amount, type, size, detail, bend, billow) and movement (sway). *start from* gives an oak grown in the open, a young one, one grown in a forest, and an ancient one. The workshop's broadleaf, fir and pine are there too, as the workshop grows them.
- **Tree**: one tree, or a grid of them to compare (rows × columns, each a different variant or seed, or a row per kind), evenly spaced on flat ground with a metre grid and labels. Double-click a tree in the grid to see it alone.
- **shape** (both tabs): every setting of the kind's generator, in the same sections for every kind (size, trunk, roots, limbs, crown, movement: those a kind has something in) under plain names; for the workshop's trees, every setting the workshop's generator has, reaching well past the workshop's own sliders (an old oak's girth, a 25 m spruce, limbs hanging past level). A [least, most] setting is one row with two handles; click its values to type them. *start from* gives each kind ready-made shapes: oak, birch, shrub, poplar, baobab; young fir, tall spruce, alpine fir; old pine, stone pine, young pine.
- **colour** (both tabs): *autumn* turns the broadleaves from green through gold to red, each tree at its own pace and limb by limb, in maple, birch, oak or mixed colours; firs and pines stay green unless *needles turn too*. Each kind's two greens are colour pickers.
- **Forest**: the trees planted on generated hills.
  - **forest**: where they stand (a seed, and *new layout*), the area (a circle of radius R, or a square), and trees per hectare (10 to 3,000), up to 160 m from the middle. The hills grow with the forest. A forest holds at most 4,000 trees: a bigger, denser one is planted thinner all over, and says so. The numbers under the title include its *canopy cover*, the share of the ground under a crown: a closed wood is about 85 to 95% covered, and the sun reaches the floor through the rest. The workshop's wind covers the middle 80 m with its gusts; further out the trees feel a steady wind.
  - **pattern**: *even spacing* (no two closer than about ¾ of the average spacing; the default), *random*, *jittered grid* (the workshop's own), *clumps*, or *rows* (a plantation, at an angle).
  - **groves and clearings**: noise splits the area, and trees grow only in the groves.
  - **mix**: which kinds grow and each one's share, *mixed* or *in stands* (each kind in its own patches), how many variants a kind, and the sizes.
  - **ground**: which hills, how high and wide, how rough, and the steepest slope a tree grows on.
  - *walk among the trees* puts the figure in the forest, a little back from its middle, where the trunks leave room, facing the sun, and the camera behind it. **W A S D** or the arrow keys walk it, the way the camera looks; **Shift** runs; **Space** jumps. A game pad works too: the left stick walks, the right stick looks round, the right trigger runs (as far as it's squeezed) and A jumps. Drag to turn the camera round the figure; the wheel brings it nearer or further. It walks at 1.4 m a second and runs at 4.2, and takes a moment to get there and to stop; slopes slow it as they slow a walker (Tobler's hiking function: fastest a little downhill, slower the steeper it is either way); a jump lifts it 45 cm and is left to gravity; trunks stop it and it slides round them. Its limbs are moved by cycles keyed by hand (standing, a walk, a run and a jump), or by clips of your own fitted to the figure, if you make some (see below), played as fast as it goes over the ground so that its feet don't slide, and each foot is put on the ground where it is: higher on the uphill side, tilted with the slope, the hips sinking as far as the lower foot needs. What isn't as in life: the feet aren't held where they landed (between a walk and a run they slide a little), nothing knows about balance, and the camera goes through leaves and trunks. *through its eyes* sees the forest from the figure's own eyes instead (1.7 m up; the figure isn't drawn): there a drag looks round, up into the crowns too, and the wheel and a drag with two fingers or the right button walk as well. Untick *walk among the trees* to go back above the forest; a link or a settings file keeps all of it.
  - The forest is grown from the Tree tab's seed and shapes: change a kind's shape and the forest's trees change too. Double-click a forest tree to see it alone in the Tree tab.
- **light** (both tabs): the time of day, from 5:00 to 21:00, and which way the noon sun shines from. *time runs* lets the day run, so many hours of it for each minute you watch (after 21:00 it is 5:00 again: there is no night; P pauses it): the sun moves every frame, and the sky's own light is measured again five times a second. The sun crosses a real sky, turns golden and dims as it sinks; the haze over the horizon takes the sky's colour in whichever direction you look. The sky is drawn as bright as the light it gives, no brighter: a clear sky gives level ground about an eighth as much as the sun gives a surface facing it (a quarter at sunset), so against sunlit ground it is a mid blue, as in a photograph exposed for the ground. Everything takes its light from the sky as drawn, and from below what the sunlit ground throws back: the shade is deeper than a pale sky would make it, and bluer. The camera's exposure puts a white thing in the noon sun just short of white. Shadows are sharpest near the camera and fitted to what's shown, so the trees close by cast crisp shadows even in a 160 m forest. Leaves deep in a crown are darker than those outside it, and looking toward the sun, the crowns' edges glow: *sun through leaves* sets how much (0 to 2). The air among the trees catches the sun where nothing shades it, so the light falls in shafts between the trunks; as in life, they show best looking toward the sun, against shade (*light shafts*: 1 as in life, where from the side they're faint; above 1 is a boost, named as one: the air shows the sun it catches up to 10 times as brightly). The sun is a disc, not a point, so a beam is sharp just under the gap that lets it through and softer the further it falls (9 mm for each metre): small gaps high in the crowns give a glow far below, not lines. The same on the ground: the spots of sun on the floor of a wood are round and soft, a trunk's shadow at its foot crisp. *mist* lays a mist on the ground, from clear air through a thin mist (0.2: you see a couple of kilometres) to fog (1: about 100 m): thick in banks and thin between, with wisps, lying over the hills, drifting with the wind and changing as it goes. It dims what's behind it, catches the sun where no tree shades it, and under the trees takes only the sky's light that gets down to it. Its drops throw light as real ones do (10 micrometres across: about half almost straight on, the rest mostly forward), so mist is brightest by far looking toward the sun; light turned aside again and again fills sunlit mist from every side, so from the side it is white, not dark. The sun on the ground and the trees in the mist is dimmer for it, and the mist's soft light falls on them in its place. *gaps in the crowns* lets the sun through the foliage in spots, so the shade is dappled, the leaves inside catch the sun, and shafts fall through (0 solid shade, 1 thin crowns). The trees keep the sky's light off what's under them as well as the sun's: under a closed canopy the floor, the trunks and the crowns' undersides are dim, and the spots of sun stand out (*shade under the trees*, 1 as worked out from the trees, 0 none). And the eye adjusts to what it looks at: among the trees it opens up, so the shade shows and the sun and the shafts burn bright; back in the open it closes down again. It makes up for a little darkness wholly and for a lot only partly, and opens furthest where the shade is deepest against the open: about three stops in a wood on a misty morning, a little over two in the same wood at noon (*eye adjusts to the view*, 1 as far as an eye goes, 0 the hour's exposure only). TreeLab opens at 19:15, the sun low and to one side.
- **sway** and **wind**: the workshop's sway and wind. The hills shelter what's behind them, and the wind is calmer under the crowns. *show wind (V)* draws it. P pauses.
- **save and share**:
  - *save settings to a file* and *load settings from a file*: a `.json` file with every setting. The browser also keeps your last settings, and the address always holds a link to what you see.
  - *copy a link to this view*: the link opens TreeLab on exactly these trees.
  - *take a screenshot*: a PNG at 1×, 2× or 4× the screen, with or without "TreeLab · Studio Gray Lake" in the corner. *share a screenshot…* opens the system's share sheet where the browser has one; otherwise it downloads the picture and offers the link for X, Bluesky, Reddit or Facebook.
  - *download the model (.glb)*: the trees shown, standing still, flat-shaded as on screen, with the forest's ground cut to the forest if you like. *Instanced* is smallest and uses glTF's `EXT_mesh_gpu_instancing` (three.js, Babylon.js, Godot, Blender 3.6 and later); *one node a tree* works in every glTF tool. The file carries its settings and link.

A first visit opens with a welcome card: what TreeLab is, how to look round, a link to the studio's news post about it, and on a phone a line saying it works best on a computer. *OK* (or Enter, or Escape) closes it until the next visit; *Don't show this again* is kept in your browser only, so where the browser keeps nothing the card shows again. A share link opens straight on its view, without the card.

Each part of the panel has a washed-out colour of its own (trunk, roots, limbs, crown; light, wind, view), so one tells from the next. Both cards fold away to their top row: each by the button in its corner, both by **H** (and H again brings them back); which are folded is kept in your browser only. Every row has a tooltip: hover it, focus it, or tap its name on a phone. *view → text size* sets the text from 1× to 2× (1.5× to start); it's kept in your browser only.

Settings files and links from older or newer TreeLabs still load: settings TreeLab doesn't know are left out, missing ones take their defaults, and every value is kept within its slider.

## What's in it

| File | What it does |
|---|---|
| `src/main.js` | The stage (the picture drawn as light, the sky scaled to the light it gives, the sun and its shadows, the far haze, the camera: round the trees, or standing among them), the tabs, the panel, saving and loading |
| `src/settings.js` | Every setting in one object: defaults, sliders, choices; reading files and links safely (`normalize`); share links (only what differs from the defaults) |
| `src/tree.js` | Grows trees with the workshop's `buildTree` and `variantSeed`, and plants them as the workshop's `src/trees.js` does: instanced meshes, the same materials and greens, the same `userData`, so the workshop's sway and wind can use them. Trees sharing a kind, seed and variant share one grown tree |
| `src/garden.js` | The Tree tab's grid |
| `src/terrain.js`, `src/noise.js` | The Forest tab's hills: seeded noise, flat-shaded facets (uneven: each corner a little off the grid, each patch cut the way the ground creases, so no rows of diamonds), a `heightAt` that is exactly the drawn surface |
| `src/patterns.js` | Where trees stand: the five patterns |
| `src/forest.js` | The forest: pattern, groves and clearings, slopes, mix, sizes |
| `src/light.js` | The day's light: where the sun is at each hour, its colour and strength, the sky's haze, how much light the sky gives against the sun, the exposure |
| `src/crownShade.js` | Crowns darker inside: how much sky each leaf sees through the rest of the crown, into the grown tree's colours |
| `src/leafLight.js` | Sunlight through the leaves, added to the foliage's shader on top of the sway |
| `src/canopy.js` | Canopy cover: the share of the forest's ground under a crown, looking straight down (shown with the forest's numbers) |
| `src/crownGaps.js` | Gaps in the crowns: the foliage drawn into the sun's shadow maps with patches left out (a repeating noise, fixed to each tree), so the shade is dappled |
| `src/skyShade.js` | The sky's light among the trees: the trees drawn from 26 places in the sky, as the sun's shadows are, and how much of the sky each place sees kept in a 3D texture that every lit material reads |
| `src/eye.js` | The eye: the finished picture's brightness measured every few frames, and the exposure moved toward what brings it to a middle: all the way for a view a little dim, part of the way for deep shade, and never past a fixed opening, so dusk stays dusk |
| `src/sunShadow.js` | The sun's shadows in two cascades (three.js's `SunLight`), fitted to the stage: a sharp map near the camera, a broader one beyond |
| `src/mistLight.js` | What the mist does with the sun's light: its drops' pattern (Jendersie and d'Eon's fit), the light turned aside more than once by height above the ground (as Hillaire does for the sky), the sun's dimming on things in the mist and the soft light that falls on them instead |
| `src/lightShafts.js` | Shafts of sunlight and mist: along each pixel's ray, how thick the mist is (uneven, on the ground's own heights, drifting), whether the sun reaches it (its shadow maps) and how much of the sky does; what's behind is dimmed by what gets through. The scene is drawn as light (a picture of its own, src/main.js), the mist and the sun's light in the air are mixed into it as light, and the picture goes to the screen once, through the exposure and the tone mapping. Sampled afresh each frame and blended over a few, each pixel taking the earlier frames from where its place was in them, so the shafts stay smooth as you turn and walk |
| `src/swayRig.js` | The workshop's wind, wind texture and tree sway, bound to whichever trees and ground are shown, with TreeLab's own clock |
| `src/capture.js` | Screenshots and sharing them |
| `src/exportModel.js` | `.glb` export |
| `src/limits.js` | Each shape setting's slider: the workshop's own table, and TreeLab's wider one |
| `src/oak/oak.js` | TreeLab's own English oak, laid out: its crown's space, its branches grown into it, their thickness, its leaves, and where its trunk's marks are |
| `src/oak/oakMesh.js` | The oak's own mesher: round wood in an uneven mesh, joints that swell, the foot and its roots, gnarl, burrs, hollows and stubs (and how they thin out with height and a thinner trunk); the leaves as clusters. It gives what the workshop's mesher gave, so the workshop's sway takes it |
| `src/oak/leafMass.js` | The oak's leaves as masses (a test): each limb's clusters as one field of lumps, hollowed from below, and its surface found on a grid of cells |
| `src/oak/leafNoise.js` | The noise that shapes those masses: its types (smooth, creased, ridged, cells), its layers, its bends, and how it fades where it's finer than the facets |
| `src/oak/chance.js` | The oak's chance: random numbers for each part of a tree, and patterns over space (a smooth one, and one of cells), all from the seed alone |
| `src/oak/crownLight.js` | Leaves where there's light: how much of the sky's light reaches a place through the clusters of leaves, and which clusters keep theirs |
| `src/kinds.js` | Every kind TreeLab grows, TreeLab's own and the workshop's, and how each is grown |
| `src/sections.js` | The shape sliders in sections, by the part of the tree, each with a plain name (the settings keep their own keys) |
| `src/presets.js` | The ready-made shapes to start from |
| `src/scenes.js` | The whole starting points (*start from*): TreeLab's defaults with a few settings changed, and telling which one the settings are |
| `src/stand.js` | Among the trees: where to start, which way to look, a step on the ground |
| `src/walker.js` | The figure's walk through the forest, as numbers: its speeds, slopes (Tobler), its jump, the trunks, which way it faces |
| `src/figure.js` | The figure's limbs moved: its clips mixed by its speed, each leg bent to reach its ankle, its feet put on the ground |
| `src/figureClips.js` | The figure's fitted clips: none (clips fitted on your own computer, in `.mixamo/`, stand in for it there) |
| `src/figureKeys.js` | Standing, a walk and a run keyed by hand: what the figure moves by where no clip is fitted |
| `src/colors.js` | The foliage's greens and autumn |
| `src/age.js` | The age slider: the settings an oak's age moves, and what each is at an age, between the ready-made stages; and a forest's oaks of several ages |
| `src/outlineEditor.js` | The crown's outline as a drawing in the panel: five dots to drag |
| `src/rangeSlider.js` | The two-handled row for a [least, most] setting |
| `src/tips.js`, `src/tooltip.js` | Every row's tooltip, and showing it |
| `src/welcome.js` | The welcome card: whether a visit opens with it, remembering "don't show this again", and the address its link goes to |
| `workshop.config.js`, `scripts/` | The copied workshop files, and `npm run sync`; `scripts/check-browser.mjs`: the starting views drawn in a real browser and checked (`npm run check:browser`); `scripts/bake-clips.mjs`: Mixamo's clips fitted to the figure (`npm run bake:clips`); `scripts/rig.js`: the figure as bare bones, for scripts and tests |
| `tests/` | `node --test` checks: what TreeLab relies on from the workshop's files, the copies, and each of TreeLab's parts |

## Licence

TreeLab's code, the copied workshop files included, is under the [PolyForm Noncommercial License 1.0.0](LICENSE): use it, change it and share it for anything noncommercial, but don't sell it or use it commercially.

**What you make with TreeLab is yours.** The models, images and settings files you export are dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/): use them for anything, commercial or not, no credit needed.

three.js and lil-gui are under the MIT licence: see [public/THIRD-PARTY-NOTICES.txt](public/THIRD-PARTY-NOTICES.txt).
