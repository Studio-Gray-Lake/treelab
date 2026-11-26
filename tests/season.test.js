import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foliageColor, mottleOf } from '../src/colors.js';
import { DEFAULT_SHAPES, FRAMES, KINDS, OWN_KINDS, evergreen, growKind, leafTiming, leafy } from '../src/kinds.js';
import { SEASONS, leavesOf, seasonChanges, seasonOf } from '../src/season.js';
import { RANGES, assign, defaultSettings, normalize } from '../src/settings.js';
import { tip } from '../src/tips.js';
import { greenOf } from '../src/tree.js';

// The seasons (src/season.js): how much of their leaves the trees carry,
// how new the leaves are, how far they have turned.

const summer = { amount: 0 }, fallen = { amount: 1 };
const withLeaves = (kind, leaves, seed = 7) => growKind(kind, seed, 0, { ...DEFAULT_SHAPES[kind], leaves });
const triangles = (g) => g.attributes.position.count / 3;

test('a season sets three settings, and TreeLab starts in high summer, as it always has', () => {
  const settings = defaultSettings();
  assert.deepEqual(settings.season, { leaves: 1, fresh: 0 });
  assert.equal(seasonOf(settings), 'high summer');
  for (const name of Object.keys(SEASONS)) {
    const s = defaultSettings();
    assign(s, seasonChanges(name));
    assert.equal(seasonOf(s), name);
    assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))).settings, s, `${name} is settings like any other: saved and read`);
  }
  // (The two that were asked for by name: mid winter nearly bare with few leaves; early summer a full crown with shades of green.)
  assert.ok(SEASONS['mid winter'].leaves > 0 && SEASONS['mid winter'].leaves < 0.15);
  assert.deepEqual([SEASONS['early summer'].leaves, SEASONS['early summer'].fresh > 0, SEASONS['early summer'].autumn], [1, true, 0]);
  const moved = defaultSettings();
  moved.season.leaves = 0.37;
  assert.equal(seasonOf(moved), 'custom');
  assert.ok(RANGES['season.leaves'] && RANGES['season.fresh'] && tip('season.leaves') && tip('season.fresh') && tip('season.time'));
  // (Settings saved before there were seasons: in full leaf.)
  const old = defaultSettings();
  delete old.season;
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(old))).settings.season, { leaves: 1, fresh: 0 });
});

test('each kind keeps its own time: the hawthorn and the hazel are out first and the ash last; the ash is bare first, the oak and the beech last', () => {
  const coming = (kind) => leavesOf(leafTiming(kind), { leaves: 0.3 }, summer);
  const going = (kind) => leavesOf(leafTiming(kind), { leaves: 0.3 }, fallen);
  const early = ['hawthorn', 'hazel', 'birch', 'beech', 'oak', 'ash'];
  for (let i = 1; i < early.length; i++) assert.ok(coming(early[i - 1]) > coming(early[i]), `${early[i - 1]} (${coming(early[i - 1])}) is out before ${early[i]} (${coming(early[i])})`);
  const bare = ['ash', 'birch', 'hazel', 'hawthorn', 'beech', 'oak'];
  for (let i = 1; i < bare.length; i++) assert.ok(going(bare[i - 1]) < going(bare[i]), `${bare[i - 1]} (${going(bare[i - 1])}) is bare before ${bare[i]} (${going(bare[i])})`);
  // (All of its leaves, and none, are all and none for every kind; in between, between.)
  for (const kind of OWN_KINDS.filter((k) => leafTiming(k))) {
    assert.equal(leavesOf(leafTiming(kind), { leaves: 1 }, fallen), 1);
    assert.equal(leavesOf(leafTiming(kind), { leaves: 0 }, summer), 0);
    for (const leaves of [0.1, 0.5, 0.9]) for (const autumn of [summer, fallen]) {
      const share = leavesOf(leafTiming(kind), { leaves }, autumn);
      assert.ok(share > 0 && share < 1, `${kind}: ${share} of its leaves at ${leaves}`);
    }
    // (More asked for, more carried.)
    assert.ok(leavesOf(leafTiming(kind), { leaves: 0.7 }, summer) > leavesOf(leafTiming(kind), { leaves: 0.3 }, summer));
  }
  // (Mid winter: an oak still holds a share; an ash almost none.)
  const winter = { leaves: SEASONS['mid winter'].leaves };
  assert.ok(leavesOf(leafTiming('oak'), winter, fallen) > 0.12 && leavesOf(leafTiming('ash'), winter, fallen) < 0.04);
  // (Each of a kind's trees a little ahead of the others or behind: not all the same, never far apart.)
  const shares = Array.from({ length: 8 }, (_, variant) => leavesOf(leafTiming('oak'), { leaves: 0.5 }, fallen, variant));
  assert.ok(new Set(shares).size > 3 && Math.max(...shares) - Math.min(...shares) < 0.25, shares.join(', '));
  // (A kind with no timing of its own: the middle of the others.)
  assert.ok(leavesOf(null, { leaves: 0.5 }, summer) > coming('ash') && leavesOf(null, { leaves: 0.3 }, summer) < coming('hawthorn'));
});

test('a tree with fewer of its leaves: fewer, smaller clusters, the same wood, and its bare twigs drawn', () => {
  for (const kind of ['oak', 'birch', 'hazel']) {
    const full = growKind(kind, 7, 0), half = withLeaves(kind, 0.5), few = withLeaves(kind, 0.1), bare = withLeaves(kind, 0);
    assert.deepEqual(withLeaves(kind, 1).layout.clumps, full.layout.clumps, `${kind}: all of its leaves is the tree as it was`);
    const n = (tree) => tree.layout.clumps.length;
    assert.ok(n(half) < n(full) * 0.75 && n(half) > n(full) * 0.25 && n(few) < n(half) && n(few) < n(full) * 0.3, `${kind}: ${n(full)}, ${n(half)}, ${n(few)} clusters`);
    assert.equal(n(bare), 0);
    assert.equal(triangles(bare.foliage), 0, `${kind}: bare, no leaves are drawn`);
    assert.ok(triangles(few.foliage) < triangles(full.foliage) * 0.25);
    // (Those left are the same clusters, where they were, smaller.)
    for (const k of half.layout.clumps) {
      const was = full.layout.clumps.find((f) => f.seed === k.seed);
      assert.ok(was && was.center.every((v, i) => Math.abs(v - k.center[i]) < 1e-9) && k.radius < was.radius, `${kind}: a cluster moved, or grew`);
    }
    // (The same tree under them: as tall, as wide, its trunk as thick; and its wood all still there. A cluster
    // in leaf has its twig drawn on into it; a bare twig ends where it ends: so a little less wood, not more.)
    assert.deepEqual([bare.layout.oak.height, bare.layout.oak.width, bare.layout.wood.girth], [full.layout.oak.height, full.layout.oak.width, full.layout.wood.girth]);
    assert.ok(triangles(bare.wood) > triangles(full.wood) * 0.85 && triangles(bare.wood) <= triangles(full.wood), `${kind}: ${triangles(bare.wood)} triangles of wood bare, ${triangles(full.wood)} in leaf`);
  }
});

test('an evergreen keeps its leaves whatever is asked: the holly, and every kind with needles', () => {
  for (const kind of OWN_KINDS.filter(evergreen)) {
    const full = growKind(kind, 7, 0), asked = withLeaves(kind, 0);
    assert.equal(triangles(asked.foliage), triangles(full.foliage), kind);
  }
  assert.ok(evergreen('holly') && evergreen('fir') && FRAMES.oak.leaf && FRAMES.ash.leaf && !FRAMES.holly.leaf);
  // (The page asks for fewer leaves only of TreeLab's own kinds that lose them.)
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /function inSeason\(kind, variant, shape\) \{\s+if \(!isOwn\(kind\) \|\| evergreen\(kind\)\) return shape;/);
});

test('new leaves are a paler, yellower green, uneven from limb to limb; and the last leaves on a tree are brown', () => {
  const colors = defaultSettings().colors;
  const record = { kind: 'oak', x: 4, z: -7, tint: 0.5 };
  const green = greenOf(record);
  const fresh = foliageColor(record, colors, summer, undefined, { leaves: 1, fresh: 1 });
  assert.ok(fresh.r > green.r && fresh.g > green.g && fresh.r / fresh.g > green.r / green.g, `${green.getHexString()} to ${fresh.getHexString()}`);
  assert.equal(foliageColor(record, colors, summer, undefined, { leaves: 1, fresh: 0 }).getHexString(), green.getHexString(), 'high summer: its own greens');
  assert.equal(foliageColor(record, colors, summer).getHexString(), green.getHexString(), 'no season given: as it was');
  // (An evergreen's new shoots change it far less.)
  const holly = { kind: 'holly', x: 4, z: -7, tint: 0.5 };
  const move = (r) => Math.abs(foliageColor(r, colors, summer, undefined, { leaves: 1, fresh: 1 }).g - greenOf(r).g);
  assert.ok(move(holly) < move(record) * 0.5);
  // (Shades of green within a crown: only in new leaf, never on an evergreen.)
  assert.ok(mottleOf('oak', summer, { leaves: 1, fresh: 0.3 }) > 0 && mottleOf('oak', summer, { leaves: 1, fresh: 0 }) === 0 && mottleOf('oak', summer) === 0);
  assert.equal(mottleOf('holly', summer, { leaves: 1, fresh: 1 }), 0);
  // (In winter what is left is brown, whatever autumn's colours were.)
  for (const palette of ['maple', 'birch', 'mixed']) {
    const autumn = { amount: 1, palette, spread: 0, evergreens: false };
    const turned = foliageColor(record, colors, autumn, undefined, { leaves: 1, fresh: 0 });
    const last = foliageColor(record, colors, autumn, undefined, { leaves: 0.06, fresh: 0 });
    const bright = (c) => Math.max(c.r, c.g, c.b);
    assert.ok(bright(last) < bright(turned) && last.r > last.g && last.g > last.b, `${palette}: ${turned.getHexString()} to ${last.getHexString()}`);
  }
});

test('the seasons leave every kind growable, and the workshop\'s own kinds as they were', () => {
  for (const kind of KINDS) {
    const tree = growKind(kind, 3, 0, { ...DEFAULT_SHAPES[kind], leaves: 0.3 });
    assert.ok(tree.wood.attributes.position.array.every(Number.isFinite) && tree.foliage.attributes.position.array.every(Number.isFinite), kind);
    if (!leafy(kind)) assert.equal(triangles(tree.foliage), triangles(growKind(kind, 3, 0).foliage), `${kind}: needles`);
  }
});
