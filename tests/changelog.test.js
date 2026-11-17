import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NEWS, RELEASES, dayOf, newer } from '../src/changelog.js';

// TreeLab's feature log (src/changelog.js): what each release brought.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the feature log has an entry for the version being built, at its top', () => {
  const version = JSON.parse(read('package.json')).version;
  // (0.3.0 in package.json is the release the log calls 0.3.)
  const same = (a, b) => !newer(a, b) && !newer(b, a);
  assert.ok(same(RELEASES[0].version, version), `package.json says ${version}; the log's newest entry is ${RELEASES[0].version}: add this release's entry`);
});

test('the log runs newest first, each release with its day, what it was about and what it brought', () => {
  assert.ok(RELEASES.length >= 4);
  RELEASES.forEach((release, i) => {
    assert.match(release.version, /^\d+\.\d+(\.\d+)?$/);
    assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!Number.isNaN(Date.parse(release.date)), `${release.version}: ${release.date} is no day`);
    assert.ok(release.name.length > 3 && !/[.!]$/.test(release.name), `${release.version}: its name`);
    assert.ok(release.changes.length >= 2 && release.changes.length <= 12, `${release.version}: ${release.changes.length} lines`);
    for (const change of release.changes) assert.ok(change.length > 10 && change.length <= 170 && !/\.$/.test(change), `${release.version}: "${change}"`);
    // (Its news post, if it has one: on the studio's own website.)
    assert.ok(release.post === null || release.post.startsWith('https://studiograylake.com/'), `${release.version}: ${release.post}`);
    if (i) {
      assert.ok(newer(RELEASES[i - 1].version, release.version), `${release.version} is listed after ${RELEASES[i - 1].version}`);
      assert.ok(RELEASES[i - 1].date >= release.date, `${release.version}'s day is after the release above it`);
    }
  });
  assert.equal(new Set(RELEASES.map((release) => release.version)).size, RELEASES.length);
  assert.ok(NEWS.startsWith('https://studiograylake.com/'));
});

test('a release\'s day as people write it, and which of two versions is newer', () => {
  assert.equal(dayOf('2026-11-17'), '17 November 2026');
  assert.equal(dayOf('2026-01-05'), '5 January 2026');
  assert.equal(dayOf('soon'), 'soon');
  assert.ok(newer('0.3.1', '0.3') && newer('0.10', '0.9') && newer('1.0', '0.9.9'));
  assert.ok(!newer('0.3', '0.3.0') && !newer('0.3.0', '0.3') && !newer('0.2', '0.3'));
});

test('the page opens the log from the version beside the name, and links to the studio\'s news', () => {
  const page = read('index.html');
  assert.match(page, /<button id="version" type="button" aria-haspopup="dialog">/);
  assert.match(page, /<dialog id="log" aria-labelledby="log-title">/);
  assert.match(page, /<div id="log-list"><\/div>/);
  assert.match(page, /<a id="news-link" href="https:\/\/studiograylake\.com\/news\.html"/);
  const main = read('src/main.js');
  assert.match(main, /for \(const release of RELEASES\)/);
  assert.match(main, /versionEl\.addEventListener\('click'/);
  // (Its text is set as text, never as markup.)
  assert.ok(!/log-list[^\n]*innerHTML/.test(main));
});
