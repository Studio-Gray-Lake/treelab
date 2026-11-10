import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ALL_COPIES, VENDOR_DIR, WORKSHOP_FILES, hasLiveWorkshop, originalOf } from '../workshop.config.js';
import { fileHash, foreignImports } from '../scripts/copies.js';

// The copies of the workshop's files in vendor/workshop/ stay exact copies:
// they're changed in the workshop and synced (npm run sync), never here.

const names = ALL_COPIES;
const source = JSON.parse(readFileSync(path.join(VENDOR_DIR, 'SOURCE.json'), 'utf8'));
const sha256 = fileHash;

test('the copies are as synced: nobody has edited them in TreeLab', () => {
  assert.deepEqual(Object.keys(source.files).sort(), [...names].sort(), 'SOURCE.json lists other files: run npm run sync');
  for (const name of names) {
    assert.equal(sha256(path.join(VENDOR_DIR, name)), source.files[name], `vendor/workshop/${name} was edited here. Change it in the workshop, then npm run sync`);
  }
});

test('the copies need nothing but three.js and each other', () => {
  for (const name of WORKSHOP_FILES) {
    assert.deepEqual(foreignImports(readFileSync(path.join(VENDOR_DIR, name), 'utf8'), WORKSHOP_FILES), [], name);
  }
});

test('an import outside the copies is caught', () => {
  const code = "import * as THREE from 'three';\nimport { Spring } from './spring.js';\nimport { x } from './terrain.js';\nexport { y } from '../z.js';\n";
  assert.deepEqual(foreignImports(code, names), ['./terrain.js', '../z.js']);
});

// Only where the workshop is checked out (not on a public clone).
test('the copies are in step with the workshop', { skip: !hasLiveWorkshop() && 'no workshop on this computer' }, () => {
  const behind = names.filter((name) => sha256(originalOf(name)) !== sha256(path.join(VENDOR_DIR, name)));
  assert.deepEqual(behind, [], `the workshop has changed these since ${source.synced}: run npm run sync, then npm test`);
});
