import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Where TreeLab's trees, wind and sway come from, and two small parts of
// its figure's walk (the legs' solver and the game pad's reader).
//
// TreeLab runs on copies of eight files from the 3D Procedural Animation
// Workshop, kept in vendor/workshop/. The workshop is their only home: the
// copies are never edited here. `npm run sync` copies them again from the
// workshop, and tests/vendor.test.js says when they've fallen behind.
//
// `npm run dev:live` reads the workshop's own files instead of the copies,
// to try a change in the workshop before syncing it.

const here = path.dirname(fileURLToPath(import.meta.url));

// The copies.
export const VENDOR_DIR = path.join(here, 'vendor', 'workshop');

// The code copied (from the workshop's src folder).
// (ik.js: a leg bent to put its ankle where it's asked; gamepad.js: a game
// controller read through the browser. For the figure that walks the
// forest: src/figure.js, src/main.js.)
export const WORKSHOP_FILES = ['treeShapes.js', 'treeSway.js', 'spring.js', 'wind.js', 'windView.js', 'ik.js', 'gamepad.js'];

// And other files, by where they are from its src folder: the figure that
// stands by the trees for scale (the workshop's character, built in Blender).
export const WORKSHOP_ASSETS = { 'rig.glb': '../public/models/rig.glb' };

// Every copy, and where each one's original is.
export const ALL_COPIES = [...WORKSHOP_FILES, ...Object.keys(WORKSHOP_ASSETS)];
export const originalOf = (name) => path.join(LIVE_DIR, WORKSHOP_ASSETS[name] ?? name);

// The workshop's src folder on this computer: WORKSHOP_SRC, or the first
// line of a .workshop file beside this one (kept out of git, relative to
// TreeLab's folder or absolute). Neither on a public clone: then there's
// nothing to sync from, and the drift check is skipped.
function findWorkshop() {
  if (process.env.WORKSHOP_SRC) return path.resolve(process.env.WORKSHOP_SRC);
  try {
    const line = readFileSync(path.join(here, '.workshop'), 'utf8').split('\n')[0].trim();
    if (line) return path.resolve(here, line);
  } catch {
    // (no .workshop file)
  }
  return null;
}
export const LIVE_DIR = findWorkshop();
export const hasLiveWorkshop = () => LIVE_DIR !== null && existsSync(path.join(LIVE_DIR, 'treeShapes.js'));

// The folder `@workshop/...` reads: the copies, or the workshop's own files.
export function workshopDir(live = false) {
  if (!live) return VENDOR_DIR;
  if (!hasLiveWorkshop()) {
    throw new Error(`TreeLab can't find the workshop${LIVE_DIR ? ` at ${LIVE_DIR}` : ''}. Set WORKSHOP_SRC, or put the path of the workshop's src folder in a .workshop file in TreeLab's folder.`);
  }
  return LIVE_DIR;
}
