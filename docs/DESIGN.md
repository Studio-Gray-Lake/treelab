# How TreeLab is built

The companion to [FOUNDATIONS.md](FOUNDATIONS.md): that page says what TreeLab holds to, this one says how the code keeps to it. The [README](../README.md) describes what a visitor can do and lists every file; this page explains how the parts fit, and the rules for changing them.

## The program in one picture

```
 settings ──► growing ──► planting ──► lighting ──► the picture
 (one object)  (a tree)    (a wood)     (sun, sky,    (and links,
                                         shade, mist)  files, models)
```

- **Settings** are one plain object (`src/settings.js`). Everything on screen follows from it. A link or a file is that object written down.
- **Growing** turns a kind, a seed and a shape into a tree's wood and leaves (`src/oak/`, `src/kinds.js`).
- **Planting** decides which trees stand where (`src/garden.js` for the Tree tab, `src/forest.js` and `src/site.js` for the forest) and draws each grown tree as many times as it stands (`src/tree.js`). What answers to the ground under one tree can't be part of a grown tree that many share: on the hills each tree's roots are drawn for it alone, over its own ground, and its trunk is sunk as its own slope asks.
- **Lighting** is the sun, its shadows, the sky's light among the trees, the shade inside crowns and the mist (`src/light.js` and the modules round it).
- **The page** (`src/main.js`) wires the panel to the settings and the settings to the rest.

Nothing later in that row reaches back. A tree does not know what forest it stands in; the light does not know what kind a tree is.

## Growing a tree

One generator grows every kind TreeLab calls its own: `layoutOak(seed, shape, frame)` in `src/oak/oak.js`, drawn by `meshOak` in `src/oak/oakMesh.js`. It works in numbered steps, which the file's own comments follow:

1. **The crown's space.** An outline (how far the branches reach at five heights) is filled with points to grow toward.
2. **Trunk and limbs.** The trunk rises to where the crown is widest; the big limbs leave it at their own heights and headings. A kind that grows as stems has a low stool in place of a trunk, and every limb is a stem rising from it.
3. **Growth.** Each branch tip grows a step toward the points near it, and points a branch has reached are used up, until the crown is filled. Branches compete, so they fork unevenly, as real ones do.
4. **Thickness.** From the tips down: a branch is as thick as what it carries. The trunk is scaled to the thickness asked for.
5. **Sag, and leaves.** Long limbs sag; their tips may turn up or hang. Twigs become clusters of leaves, but only where a twig is still growing and where the light reaches (`src/oak/crownLight.js`).
6. **The season.** With fewer than all its leaves, clusters go, each at its own turn, and their twigs stay, bare.
7. **Marks.** Where the trunk's burrs, hollows, stubs and roots are, each from its own chance.

Leaves are drawn as masses: each limb's clusters as one surface (`src/oak/leafMass.js`), optionally shaped by noise (`src/oak/leafNoise.js`). Conifers carry needles along their branches instead.

### What the generator promises

- **The same seed gives the same tree.** All chance comes from `src/oak/chance.js`: each part of a tree (a limb, a cluster, a burr) has random numbers of its own, made from the seed and the part's name. Nothing draws from a shared stream.
- **A slider changes what it names.** Every tree is first grown as its kind's usual tree, then fitted to its own height, width and trunk. So those three stretch the tree and regrow nothing. Later steps (sag, bends, wind, the season) move or thin what was grown; they do not grow it again.
- **It copes with every slider at either end.** Sliders reach far past what is usual on purpose.

### Shape and frame

A kind is two things:

- its **shape**: the settings a visitor can move (height, limbs, fullness, and so on). Ranges are `[least, most]`; each tree draws its own value.
- its **frame**: what a visitor cannot move, because it is what the kind *is*: the usual tree it is grown as, its bark, whether its leaves are needles, whether it grows as stems, whether it is evergreen, when in the year it has leaves (`leaf`), and where it grows (`site`).

The frame's options are described once, above `OAK_FRAME` in `src/oak/oak.js`.

### Adding a kind of tree

Today a kind is registered by hand in several files. This is the list; a missing entry usually fails a test, but not always.

| What | Where |
|---|---|
| Shape, frame, stages, places, sliders' limits | `src/oak/broadleaves.js` |
| The kind itself, its default shape, limits, choices, and its group in the forest's mix | `src/kinds.js` |
| Its ready-made shapes | `src/presets.js` |
| The stages its age slider goes between | `src/age.js` |
| Its panel rows, folded panels and drawings | `src/sections.js` |
| Its share of a forest, and the ages of a mixed stand | `src/settings.js` (`MIX`, `MIX_AGES`) |
| Its two greens | `src/tree.js` (`GREENS`) |
| Its tooltips, where they differ from the oak's | `src/tips.js` |
| Its tests | `tests/<kind>.test.js` |
| The links' version | `src/link.js`, then `npm run freeze` (see below) |

Then: pictures of every ready-made shape beside a figure for scale; its weight in triangles; and what was left out, said plainly in the kind's own comment and in the README.

A kind's key (`hawthorn`, `linden`) never changes once it has been in a link. Only the name the panel shows may change.

## The panels

- **The settings are on the right; one kind of tree's shape is on the left**, in a panel of its own. The left panel shows the selected tree's kind (a click on a tree selects it). With none selected it shows the Tree tab's kind, or, in the Forest tab, the kind last picked.
- **What is selected, and which kind the left panel shows in the forest, are not settings.** A link does not carry them, and neither does a saved file. The same holds for which cards are folded and how wide they were dragged: those are the viewer's own, kept in the browser.
- **A row is a name, a bar and a small box for the number.** The name has a set share of the row and wraps onto more lines; the bar gets what is left. A long name makes a taller row, never a shorter bar.
- **What is a kind's own is in the kind's panel**: its shape, its greens, its ages in a forest, and where it grows. The forest's mix is a table with a row a kind (whether it grows, its share, how many stand), and a click on a kind's name there shows the kind on the left.
- **A slider changes the kind; a red mark shows one tree.** On a [least, most] row the two handles are the kind's. Where one tree is looked at, a red mark shows what that tree drew for itself between them. The generator keeps those values as it draws them (`drew`, in `src/oak/oak.js`): only what a tree draws once, so a range drawn for each cluster has no mark. A forest's trees are each scaled by the forest's own "size", so a mark can lie outside its kind's handles, and the panel says so.

## Settings, files and links

- **One object.** `defaultSettings()` in `src/settings.js` is the whole of it, with each number's slider (`RANGES`) and each choice's list (`CHOICES`).
- **Nothing read from outside is trusted.** A file, a link and the browser's kept settings all pass through `normalize`: unknown settings are left out, numbers are brought inside their sliders, anything of the wrong kind is left at its default with a note. A link is a stranger's text and is read as one.
- **A link says only what differs** from what it starts from: the defaults, a starting view, or a ready-made shape, by name. That keeps it short and readable (`src/link.js`).

### A link opens as it was made, always

Because a link leaves out what was a default, its meaning depends on what the defaults were. So they are kept:

- Each link carries its **version**. What links of that version start from (every default, every starting view, every ready-made shape) is recorded once in `src/frozen/v<N>.js` and never edited.
- A link is read against **its own version's record**, then brought to today's settings.
- A setting that did not exist when a link was made is put to **what it was in effect then** (`BEFORE` in `src/settings.js`), not to today's default. The same holds for a saved file and for the browser's kept settings.
- Version 0 stands for the older links (`#s=`), read against the defaults of the last release that made them.

The rule for anyone changing TreeLab: **if a default, a starting view, a ready-made shape, a kind or a setting changes, `tests/frozen.test.js` fails.** Do not edit a record. Raise `LINK_VERSION` in `src/link.js`, run `npm run freeze`, and if a new setting changes what was already there, give it a line in `BEFORE`.

What is kept is the settings. The code that grows a tree from them is not kept: where it changes, the same settings grow the tree as today's code does.

## The forest

`placeForest` in `src/forest.js` works down a list:

1. the pattern's points in the area, at so many seeds a hectare;
2. groves and clearings, if on;
3. no tree on ground too steep;
4. each tree's kind, by the mix, or in stands;
5. the rules (`src/site.js`): each kind keeps to the ground it likes; a tree with no room beside trees of its height is crowded out; a tree under a taller crown lives only if its kind bears the shade.

With every rule at 0 the forest is planted exactly as it was before there were rules.

The mix is set one of two ways (`forest.mixBy`). By count, a kind's share is its share of the seeds, and the forest is planted as the list above says. By cover (`src/cover.js`), the kinds stand in two layers, the canopy and the underwood; each layer is asked for a share of the ground under its crowns, and a kind's share is its share of its layer's crowns. The seeds are then worked out, the canopy first and the underwood under it, so that what stands after the rules meets what was asked, and the report says both. A crown counts as a circle there: a shortcut, said in the file. The ready-made woods (`src/woods.js`) are mixes by cover.

The season (`src/season.js`) is three ordinary settings: how much of their leaves the trees carry, how new the leaves are, how far they have turned. Each kind has its own timing, in its frame.

## Light

In the order a material is lit:

| Part | Where | What it does |
|---|---|---|
| The day | `src/light.js` | Where the sun is at an hour, its colour and strength, how much light the sky gives |
| The sun's shadows | `src/sunShadow.js` | Two shadow maps, a sharp one near the camera and a broad one beyond, with a soft edge from the sun's real width |
| Gaps in the crowns | `src/crownGaps.js` | The foliage drawn into the shadow maps with patches left out, so shade is dappled |
| Shade inside a crown | `src/crownShade.js` | How much sky each leaf sees through the rest of its crown, kept in the tree's colours |
| The sky among the trees | `src/skyShade.js` | The trees drawn from 26 places in the sky, and how much of the sky each place on the ground sees |
| Sun through leaves | `src/leafLight.js` | The glow of a leaf lit from behind |
| Mist, fog and light shafts | `src/mistLight.js`, `src/lightShafts.js` | Along each pixel's ray: how thick the mist or fog is and whether the sun reaches it |
| The eye | `src/eye.js` | The finished picture's brightness measured, and the exposure moved toward a middle |

Several of these add their code to three.js's own materials. The order matters (leaf light, then the sky, then the mist), and it is set where the materials are bound, in `src/swayRig.js`.

### Fog, mist and haze: the words

Each of these words has one meaning in TreeLab: in the panel, the README, these pages and the code's comments. They are the weather services' meanings.

| Word | What it is made of | How far you see | Where it lies |
|---|---|---|---|
| **Haze** | Dry grains (dust, smoke, salt): no water drops | Many km | Everywhere, evenly: no banks, and no top you can see |
| **Mist** | Water drops hanging in the air | 1 km or more | On the ground, in banks and wisps |
| **Fog** | The same drops, more of them | Less than 1 km | The same places |

- **Fog and mist are one thing at two strengths.** TreeLab has one model for both (`src/lightShafts.js`, `src/mistLight.js`) and one slider, *mist and fog*. At a setting s you see 98 m ÷ s² on the ground, on average (`sight` in `src/lightShafts.js`): 2.4 km at 0.2, 1 km at 0.31, 98 m at 1. So up to 0.31 it is mist, and above that fog. In the code that model's names say `mist` at any strength.
- **Haze is another thing.** TreeLab's is the air of a clear day: you see 20 km at noon, down to 5 km with the sun low (`src/light.js`). Its grains throw light less sharply forward than water drops do.
- **Light shafts are not a kind of air.** They are what any of the three shows where sunlit air stands beside shaded air.
- **The far veil** is TreeLab's stand-in for the haze over a distance: far things fade into the horizon's colour. three.js calls its tool for that `fog`; TreeLab's own words say *the far veil*, and `fog` is written only where it is three.js's own name. It is not a model of the air (see the debts below).

## Movement

The wind, the trees' sway and the figure's joints come from another project of the studio's, as exact copies in `vendor/workshop/`. **Those files are never edited here.** A change is made in their own project and copied over with `npm run sync`; a test fails if a copy has been touched. `src/swayRig.js` binds them to whichever trees and ground are shown.

The figure's walk is TreeLab's own: `src/walker.js` (where it goes) and `src/figure.js` (how its limbs move).

## Tests and checks

- `npm test` runs every `tests/*.test.js` with Node's own test runner. They run side by side, so a test that checks work is done "in good time" counts processor time, not the clock (`tests/clock.js`).
- `npm run check:browser` opens every starting view in a real browser, checks that trees were drawn and the picture is neither black nor flat, and fails on any shader warning. It is the only check that compiles the shaders.
- `npm run build` must pass.
- A change to the look is checked by looking: a picture of the tree beside a figure, before and after.

A test's name is a sentence about the tree or the page ("a hazel has no trunk: a low stool, and every stem leaves it"), and its failure message gives the measured number.

## House rules for the code

- **Comments are plain English and say why.** They are written for someone who knows trees and not this code. A long comment that explains a rule of growth is wanted; one that repeats the line under it is not.
- **Every shortcut is named where it is taken**, with the words "said plainly" or "left out", and again in the README.
- **Names a visitor sees are plain** and are kept apart from the settings' keys (`src/sections.js`), so a row can be renamed without breaking a link. A name that can be misread is changed.
- **A tooltip is under 200 characters.** If it needs a list, the list belongs somewhere else.
- **Sliders reach past the usual.** Do not cap a slider at what is realistic.
- **Every piece of work says what it costs** (triangles, time) and lists its weak points.

## Releasing

A release is the project's files at one moment, published as a single commit, and the site is built with `npm run build:site`. The steps, and who does which, are kept outside this repository.

## Known debts

Found by an audit in November 2026; the order is roughly the order to pay them in.

1. **A kind is spread over eight files.** One record per kind, with the tables above derived from it, would make a new tree one file and close the gaps where an omission hides behind a default.
2. **Shading a crown costs more than growing the tree.** It is most of the wait when a slider moves.
3. **Leaf masses have no floor and no cap.** A cluster smaller than a facet is not drawn; an extreme setting can make over a million triangles.
4. **No shader is compiled where the tests run automatically.** Only `check:browser` does it, and it is run by hand.
5. **`src/main.js` is one module of 2,000 lines.** The order to take it apart: one function that makes the panel show what the settings say; then storing and links; selecting; the sky's light; walking; the panel's rows from a table; growing last.
6. **Each link version's record is a whole copy.** Later ones should be stored as what changed.
7. **The haze is drawn three ways**: the far veil, the band over the horizon, and the sunlit haze of the light shafts. Only the last is a model of the air, and it hands over to the far veil with distance.
8. **A tree's shape does not answer to its neighbours.** Its wood-grown shape is chosen by hand, and the forest's rules do not reach into the generator.
