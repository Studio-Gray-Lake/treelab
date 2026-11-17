import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { versionLabel, versionSays } from '../src/version.js';

// Which TreeLab this is, beside its name (src/version.js).

test('the version beside the name: the website\'s by its day, a build of your own by its commit, the dev server said so', () => {
  assert.equal(versionLabel({ version: '0.3.0', date: '2026-11-11', dev: false }), '0.3.0 · 2026-11-11');
  assert.equal(versionLabel({ version: '0.3.0', date: '2026-11-17', dev: false, hash: '18d23c1', changed: false }), '0.3.0 · 18d23c1');
  assert.equal(versionLabel({ version: '0.3.0', date: '2026-11-17', dev: true, hash: '18d23c1', changed: true }), '0.3.0 · dev · 18d23c1+');
  // (A downloaded copy, on its dev server: no commit to name.)
  assert.equal(versionLabel({ version: '0.3.0', date: '2026-11-17', dev: true }), '0.3.0 · dev · 2026-11-17');
  // (Nothing known: nothing shown.)
  assert.equal(versionLabel(undefined), '');
  assert.equal(versionLabel({}), '');
  assert.match(versionSays({ version: '0.3.0', dev: true, hash: '18d23c1', changed: true }), /dev server, from commit 18d23c1 with changes not yet committed/);
  assert.match(versionSays({ version: '0.3.0', date: '2026-11-11', dev: false }), /^TreeLab 0\.3\.0: built 2026-11-11\.$/);
});

test('the page has a place for it in its title, and the build tells it what to say', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(page, /<h1>TreeLab <span id="version"><\/span><\/h1>/);
  const config = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(config, /__TREELAB__: JSON\.stringify\(buildOf\(mode, command === 'serve'\)\)/);
  // (A build for the website names no commit of the private repository.)
  assert.match(config, /mode === 'site' \? \{\} : commit\(\)/);
  assert.equal(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version.split('.').length, 3);
});
