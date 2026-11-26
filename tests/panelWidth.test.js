import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEAST, mostFor, readWidths, widthAfter, writeWidths } from '../src/panelWidth.js';

// A card dragged wider or narrower by its edge (src/panelWidth.js), and
// the rows inside it: a name that wraps, a bar that keeps its length.

test('a card widens the way its edge is dragged, between its least and most', () => {
  assert.equal(widthAfter(400, 60, { grows: 1 }), 460, 'the left card, its right edge dragged right');
  assert.equal(widthAfter(400, 60, { grows: -1 }), 340, 'the settings, their left edge dragged right');
  assert.equal(widthAfter(400, -60, { grows: -1 }), 460);
  assert.equal(widthAfter(400, -900, { grows: 1 }), LEAST, 'never narrower than its rows read');
  assert.equal(widthAfter(400, 5000, { grows: 1, most: mostFor(1600) }), 960, 'never more than three fifths of the window');
  assert.equal(mostFor(200), LEAST, 'in a window narrower than that, the least');
});

test('the widths are kept as text, and anything else in that text is left out', () => {
  assert.equal(writeWidths({ panel: 480.4, left: 420 }), 'panel:480,left:420');
  assert.deepEqual(readWidths('panel:480,left:420', ['left', 'panel']), { panel: 480, left: 420 });
  assert.deepEqual(readWidths('panel:480,nonsense:300,left:abc,left:9,__proto__:500', ['left', 'panel']), { panel: 480 });
  assert.deepEqual(readWidths(null, ['left', 'panel']), {});
  assert.deepEqual(readWidths(writeWidths({}), ['left', 'panel']), {});
});

test('a row\'s name wraps and never takes more than its share: a long name cannot shorten the bar', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const name = page.match(/:is\(#gui, #kind-gui\) \.lil-gui \.controller > \.name \{([^}]*)\}/)?.[1] ?? '';
  assert.match(name, /width: var\(--name-width\)/, 'a set width');
  assert.match(name, /white-space: normal/, 'on as many lines as it needs');
  const share = Number(page.match(/--name-width: (\d+)%/)?.[1]);
  assert.ok(share > 0 && share <= 30, `the name's share of a row: ${share}%`);
  // (Both panels are styled by the same rules: no rule is left for the settings alone.)
  assert.equal(page.match(/#gui \./g), null);
});
