import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Where TreeLab's trees, wind and sway come from.
//
// TreeLab runs on copies of five files from the 3D Procedural Animation
// Workshop, kept in vendor/workshop/. The workshop is their only home: the
// copies are never edited here. `npm run sync` copies them again from the
// workshop, and tests/vendor.test.js says when they've fallen behind.
//
// `npm run dev:live` reads the workshop's own files instead of the copies,
// to try a change in the workshop before syncing it.

const here = path.dirname(fileURLToPath(import.meta.url));

// The copies.
export const VENDOR_DIR = path.join(here, 'vendor', 'workshop');

// The files copied.
export const WORKSHOP_FILES = ['treeShapes.js', 'treeSway.js', 'spring.js', 'wind.js', 'windView.js'];

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
