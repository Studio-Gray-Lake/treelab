# TreeLab

Grow low-poly trees in your browser, compare their variations, and see how they look in a forest on hills, swaying in the wind. Save your settings, share a link or a screenshot, and download the trees as a model. TreeLab is a free tech demo from Studio Gray Lake. Its trees, wind and sway come from the studio's 3D Procedural Animation Workshop.

**Play it: https://studiograylake.com/treelab/**

Nothing you do in TreeLab leaves your computer: no accounts, no tracking. Your browser keeps your last settings, and the address holds a link to what you see.

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

The tests must show `ℹ fail 0`.

```bash
npm run build
```

builds the site into `dist/`. To serve it from a sub-folder of a website, set `TREELAB_BASE` (say `/treelab/`) when building; by default the paths are relative, so `dist/` works from any folder.

## Where the trees come from

TreeLab runs on copies of five files from the 3D Procedural Animation Workshop, in `vendor/workshop/`:

| File | What it does |
|---|---|
| `treeShapes.js` | The tree generator: each kind's settings, the skeleton, the wood and foliage |
| `treeSway.js` | Each tree a spring bent by the wind, and the shader that bends it |
| `spring.js` | The damped spring `treeSway.js` uses |
| `wind.js` | The wind: mean wind, gusts, swirl, lee behind hills, calm under crowns |
| `windView.js` | The wind as a texture for the shaders, and its debug view |

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

- **Tree**: one tree, or a grid of them to compare (rows × columns, each a different variant or seed, or a row per kind), evenly spaced on flat ground with a metre grid and labels. Double-click a tree in the grid to see it alone.
- **shape** (both tabs): every setting the workshop's generator has, reaching well past the workshop's own sliders (an old oak's girth, a 25 m spruce, limbs hanging past level). A [least, most] setting is one row with two handles; click its values to type them. *start from* gives each kind ready-made shapes: oak, birch, shrub, poplar, baobab; young fir, tall spruce, alpine fir; old pine, stone pine, young pine.
- **colour** (both tabs): *autumn* turns the broadleaves from green through gold to red, each tree at its own pace and limb by limb, in maple, birch, oak or mixed colours; firs and pines stay green unless *needles turn too*. Each kind's two greens are colour pickers.
- **Forest**: the trees planted on generated hills.
  - **forest**: where they stand (a seed, and *new layout*), the area (a circle of radius R, or a square), and trees per hectare. The workshop's wind covers 80 m, so the forest stays within 40 m of the middle.
  - **pattern**: *even spacing* (no two closer than about ¾ of the average spacing; the default), *random*, *jittered grid* (the workshop's own), *clumps*, or *rows* (a plantation, at an angle).
  - **groves and clearings**: noise splits the area, and trees grow only in the groves.
  - **mix**: which kinds grow and each one's share, *mixed* or *in stands* (each kind in its own patches), how many variants a kind, and the sizes.
  - **ground**: which hills, how high and wide, how rough, and the steepest slope a tree grows on.
  - The forest is grown from the Tree tab's seed and shapes: change a kind's shape and the forest's trees change too. Double-click a forest tree to see it alone in the Tree tab.
- **sway** and **wind**: the workshop's sway and wind. The hills shelter what's behind them, and the wind is calmer under the crowns. *show wind (V)* draws it. P pauses.
- **save and share**:
  - *save settings to a file* and *load settings from a file*: a `.json` file with every setting. The browser also keeps your last settings, and the address always holds a link to what you see.
  - *copy a link to this view*: the link opens TreeLab on exactly these trees.
  - *take a screenshot*: a PNG at 1×, 2× or 4× the screen, with or without "TreeLab · Studio Gray Lake" in the corner. *share a screenshot…* opens the system's share sheet where the browser has one; otherwise it downloads the picture and offers the link for X, Bluesky, Reddit or Facebook.
  - *download the model (.glb)*: the trees shown, standing still, flat-shaded as on screen, with the forest's ground cut to the forest if you like. *Instanced* is smallest and uses glTF's `EXT_mesh_gpu_instancing` (three.js, Babylon.js, Godot, Blender 3.6 and later); *one node a tree* works in every glTF tool. The file carries its settings and link.

Every row has a tooltip: hover it, focus it, or tap its name on a phone. *view → text size* sets the text from 1× to 2× (1.5× to start); it's kept in your browser only.

Settings files and links from older or newer TreeLabs still load: settings TreeLab doesn't know are left out, missing ones take their defaults, and every value is kept within its slider.

## What's in it

| File | What it does |
|---|---|
| `src/main.js` | The stage (the workshop's daylight, the orbit camera), the tabs, the panel, saving and loading |
| `src/settings.js` | Every setting in one object: defaults, sliders, choices; reading files and links safely (`normalize`); share links (only what differs from the defaults) |
| `src/tree.js` | Grows trees with the workshop's `buildTree` and `variantSeed`, and plants them as the workshop's `src/trees.js` does: instanced meshes, the same materials and greens, the same `userData`, so the workshop's sway and wind can use them. Trees sharing a kind, seed and variant share one grown tree |
| `src/garden.js` | The Tree tab's grid |
| `src/terrain.js`, `src/noise.js` | The Forest tab's hills: seeded noise, flat-shaded facets, a `heightAt` that is exactly the drawn surface |
| `src/patterns.js` | Where trees stand: the five patterns |
| `src/forest.js` | The forest: pattern, groves and clearings, slopes, mix, sizes |
| `src/swayRig.js` | The workshop's wind, wind texture and tree sway, bound to whichever trees and ground are shown, with TreeLab's own clock |
| `src/capture.js` | Screenshots and sharing them |
| `src/exportModel.js` | `.glb` export |
| `src/limits.js` | Each shape setting's slider: the workshop's own table, and TreeLab's wider one |
| `src/presets.js` | The ready-made shapes to start from |
| `src/colors.js` | The foliage's greens and autumn |
| `src/rangeSlider.js` | The two-handled row for a [least, most] setting |
| `src/tips.js`, `src/tooltip.js` | Every row's tooltip, and showing it |
| `workshop.config.js`, `scripts/` | The copied workshop files, and `npm run sync` |
| `tests/` | `node --test` checks: what TreeLab relies on from the workshop's files, the copies, and each of TreeLab's parts |

## Licence

TreeLab's code, the copied workshop files included, is under the [PolyForm Noncommercial License 1.0.0](LICENSE): use it, change it and share it for anything noncommercial, but don't sell it or use it commercially.

**What you make with TreeLab is yours.** The models, images and settings files you export are dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/): use them for anything, commercial or not, no credit needed.

three.js and lil-gui are under the MIT licence: see [public/THIRD-PARTY-NOTICES.txt](public/THIRD-PARTY-NOTICES.txt).
