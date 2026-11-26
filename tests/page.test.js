import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// What the page says of itself to a search engine or a shared link: its
// title, its description, its address, and the same as a block of data
// (schema.org's SoftwareApplication). Said in several places, so held together here.
const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const meta = (pattern) => page.match(pattern)?.[1];

test('the page has a title that says what TreeLab is', () => {
  const title = meta(/<title>([^<]*)<\/title>/);
  assert.match(title, /^TreeLab: \S/, 'the name first, then what it is');
  assert.ok(title.length <= 60, `a search result shows about 60 characters: this has ${title.length}`);
});

test('the block of data for search engines is data, and says what the page says', () => {
  const blocks = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1);
  const told = JSON.parse(blocks[0][1]);
  assert.equal(told['@type'], 'SoftwareApplication');
  assert.equal(told.name, 'TreeLab');
  assert.equal(told.description, meta(/<meta name="description" content="([^"]*)"/));
  assert.equal(told.url, meta(/<link rel="canonical" href="([^"]*)"/));
  assert.equal(told.image, meta(/<meta property="og:image" content="([^"]*)"/));
  assert.equal(told.offers.price, '0', 'the TreeLab on the web is free');
  assert.equal(told.publisher.name, meta(/<meta property="og:site_name" content="([^"]*)"/));
});

test('the page runs no script written into it: one module of its own, and data', () => {
  const scripts = [...page.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);
  for (const attributes of scripts) assert.ok(/\bsrc=/.test(attributes) || /type="application\/ld\+json"/.test(attributes), `<script${attributes}> is written into the page`);
  assert.doesNotMatch(page, /\son[a-z]+\s*=\s*["']/, 'no handler written into a tag');
});
