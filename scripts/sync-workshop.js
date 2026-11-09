// Copies the workshop's tree, wind and sway files into vendor/workshop/,
// exactly as they are, and notes when, and each file's hash, in
// SOURCE.json (the workshop's branch and commit are only printed here).
//
//   npm run sync           copy them
//   npm run sync -- --check  only say whether the copies match the workshop
//
// The workshop is the files' only home: change them there, then sync.

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LIVE_DIR, VENDOR_DIR, WORKSHOP_FILES, hasLiveWorkshop } from '../workshop.config.js';
import { fileHash, foreignImports } from './copies.js';

const check = process.argv.includes('--check');

if (!hasLiveWorkshop()) {
  console.error(`No workshop${LIVE_DIR ? ` at ${LIVE_DIR}` : ' set'}. Set WORKSHOP_SRC, or put the path of the workshop's src folder in a .workshop file in TreeLab's folder.`);
  process.exit(1);
}

const git = (...args) => {
  try {
    return execFileSync('git', ['-C', LIVE_DIR, ...args], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

const names = WORKSHOP_FILES;
const behind = names.filter((name) => {
  try {
    return fileHash(path.join(LIVE_DIR, name)) !== fileHash(path.join(VENDOR_DIR, name));
  } catch {
    return true;
  }
});

if (check) {
  if (behind.length) {
    console.log(`Behind the workshop: ${behind.join(', ')}. Run npm run sync.`);
    process.exit(1);
  }
  console.log('The copies match the workshop.');
  process.exit(0);
}

// A copied file may import only three.js and the other copied files: a new
// import means the workshop's file now needs something TreeLab doesn't have.
const strays = names.flatMap((name) => foreignImports(readFileSync(path.join(LIVE_DIR, name), 'utf8'), names).map((i) => `${name} imports ${i}`));
if (strays.length) {
  console.error(`Not synced. These need a file TreeLab doesn't copy:\n  ${strays.join('\n  ')}\nAdd it to WORKSHOP_FILES in workshop.config.js, or change the workshop's file.`);
  process.exit(1);
}

mkdirSync(VENDOR_DIR, { recursive: true });
for (const name of names) copyFileSync(path.join(LIVE_DIR, name), path.join(VENDOR_DIR, name));

const source = {
  from: '3D Procedural Animation Workshop',
  synced: new Date().toISOString().slice(0, 10),
  files: Object.fromEntries(names.map((name) => [name, fileHash(path.join(VENDOR_DIR, name))])),
};
writeFileSync(path.join(VENDOR_DIR, 'SOURCE.json'), `${JSON.stringify(source, null, 2)}\n`);

// Where they came from, for the commit message (not kept in the repo).
const at = `${git('rev-parse', '--abbrev-ref', 'HEAD')} @ ${git('rev-parse', '--short', 'HEAD')}`;
const uncommitted = (git('status', '--porcelain', '--', ...names) || '').split('\n').filter(Boolean).map((l) => l.slice(3));
console.log(behind.length ? `Synced from ${at}: ${behind.join(', ')} changed.` : `Already in step with ${at}.`);
if (uncommitted.length) console.log(`Note: not committed in the workshop: ${uncommitted.join(', ')}.`);
