import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SHAPES, KIND_CROWNS, OWN_KINDS, crownOf, growKind } from '../src/kinds.js';
import { limitsFor } from '../src/limits.js';
import { LINK_VERSION, fromShortLink } from '../src/link.js';
import { PRESETS, presetShape } from '../src/presets.js';

// The forms a kind's crown can take (src/kinds.js: KIND_CROWNS): a few of
// its settings set together. The beech's, the holly's and the linden's.

const SIX = ['squash', 'clumpWide', 'rough', 'merge', 'across', 'leafReach', 'sideLeaves', 'hang'];

test('a kind with crown forms starts as its first, and every form sets the same settings inside their sliders', () => {
  assert.deepEqual(Object.keys(KIND_CROWNS), ['beech', 'holly', 'linden', 'ash', 'birch']);

  assert.deepEqual(Object.keys(KIND_CROWNS.ash), ['full dome', 'tufts', 'cushions']);
  assert.deepEqual(Object.keys(KIND_CROWNS.holly), ['tiers', 'cushions']);
  assert.deepEqual(Object.keys(KIND_CROWNS.linden), ['billows', 'cushions']);
  for (const [kind, forms] of Object.entries(KIND_CROWNS)) {
    assert.equal(crownOf(kind, DEFAULT_SHAPES[kind]), Object.keys(forms)[0], kind);
    // (What it was before it had forms is still one of them.)
    assert.ok(forms.cushions && forms.cushions.across === 0 && forms.cushions.clumpWide === 1 && forms.cushions.sideLeaves === 1 && forms.cushions.hang === 0, `${kind}: cushions`);
    for (const [name, form] of Object.entries(forms)) {
      assert.deepEqual(Object.keys(form), SIX, `${kind}, ${name}`);
      for (const [key, value] of Object.entries(form)) {
        const [lo, hi] = limitsFor(key, value, kind);
        assert.ok(value >= lo && value <= hi, `${kind}, ${name}: ${key}`);
      }
    }
  }
  for (const kind of OWN_KINDS) if (!KIND_CROWNS[kind]) assert.equal(crownOf(kind, DEFAULT_SHAPES[kind]), null, kind);
});

test('a kind\'s ready-made shapes keep its form; the holly under taller trees is open, as it was; the ash in a wood is tufts', () => {
  for (const kind of Object.keys(KIND_CROWNS)) {
    for (const name of Object.keys(PRESETS[kind])) {
      const shape = presetShape(kind, name);
      if (kind === 'ash' && name === 'forest-grown') assert.equal(crownOf(kind, shape), 'tufts');
      else if (kind === 'holly' && name === 'forest-grown') {
        assert.equal(crownOf(kind, shape), 'custom');
        assert.deepEqual([shape.squash, shape.clumpWide, shape.rough, shape.merge, shape.across, shape.leafReach], [0.9, 1, 0.45, 80, 0, 0.24], 'as it was');
      } else assert.equal(crownOf(kind, shape), Object.keys(KIND_CROWNS[kind])[0], `${kind}, ${name}`);
    }
  }
});

test('no crown closes into one block: a part is a limb\'s leaves, about one mass to a limb', () => {
  const pieces = (g) => {
    const p = g.attributes.position, parent = new Map();
    const find = (k) => { while (parent.get(k) !== k) k = parent.get(k); return k; };
    const key = (i) => `${Math.round(p.getX(i) * 1e3)},${Math.round(p.getY(i) * 1e3)},${Math.round(p.getZ(i) * 1e3)}`;
    for (let i = 0; i < p.count; i += 3) {
      const [a, b, c] = [key(i), key(i + 1), key(i + 2)];
      for (const k of [a, b, c]) if (!parent.has(k)) parent.set(k, k);
      parent.set(find(b), find(a));
      parent.set(find(c), find(a));
    }
    return new Set([...parent.keys()].map(find)).size;
  };
  const leaves = (tree) => tree.foliage.attributes.position.count / 3;
  for (const kind of ['holly', 'linden']) {
    for (const seed of [3, 7, 21]) {
      const now = growKind(kind, seed, 0), cushions = growKind(kind, seed, 0, { ...DEFAULT_SHAPES[kind], ...KIND_CROWNS[kind].cushions });
      const limbs = new Set(now.layout.clumps.map((clump) => `${clump.limb.phase}|${clump.limb.heading}`)).size;
      const parts = pieces(now.foliage);
      // (Limb by limb: never fewer masses than limbs in leaf, so never one block; and all of a limb's clusters that can run together do.)
      assert.equal(DEFAULT_SHAPES[kind].across, 0, kind);
      assert.ok(parts >= limbs && parts >= 4 && parts <= limbs + 5, `${kind} ${seed}: ${parts} masses on ${limbs} limbs`);
      // (A linden's billows are fewer than its cushions were. A holly's cushions were about one to a limb already: its tiers are flatter, not fewer.)
      if (kind === 'linden') assert.ok(parts < pieces(cushions.foliage), `${kind} ${seed}: ${parts} masses against ${pieces(cushions.foliage)} as cushions`);
      assert.ok(leaves(now) < leaves(cushions) * 1.4, `${kind} ${seed}: ${leaves(now)} triangles of leaves against ${leaves(cushions)}`);
    }
  }
  // (The beech's thin layers are the one form that runs across limbs. They touch, so by count they can be one mass; it is their
  // thinness that keeps sky and wood between them: far less leaf than a block of its outline would be.)
  assert.equal(DEFAULT_SHAPES.beech.across, 1);
  assert.ok(DEFAULT_SHAPES.beech.squash < 0.5, 'thin layers');
});

test('the ash\'s tufts (its crown in a wood): leaves at its branches\' ends only, in fewer clusters, with sky between them', () => {
  // (As its crown was grown in the open until 25 November 2026: a thinner crown, in bigger clusters.)
  const thin = { ...DEFAULT_SHAPES.ash, leafiness: 0.45, clumpSize: [1.5, 2.4], coarse: 0.9 };
  for (const seed of [3, 7, 21]) {
    const tufts = growKind('ash', seed, 0, { ...thin, ...KIND_CROWNS.ash.tufts }), cushions = growKind('ash', seed, 0, { ...thin, ...KIND_CROWNS.ash.cushions });
    assert.ok(tufts.layout.oak.kept.every((cluster) => cluster.end), `seed ${seed}: a cluster on a twig off a branch's side`);
    assert.ok(cushions.layout.oak.kept.some((cluster) => !cluster.end), `seed ${seed}: as cushions, some are`);
    assert.ok(tufts.layout.clumps.length < cushions.layout.clumps.length * 0.75 && tufts.layout.clumps.length >= 12, `seed ${seed}: ${tufts.layout.clumps.length} tufts against ${cushions.layout.clumps.length} cushions`);
    // (And no more leaf than it carried as cushions, by much: the same leaves, gathered at the ends.)
    const leaf = (tree) => tree.layout.clumps.reduce((sum, k) => sum + k.radius ** 3 * k.squash, 0);
    assert.ok(leaf(tufts) < leaf(cushions) * 1.15 && leaf(tufts) > leaf(cushions) * 0.6, `seed ${seed}: ${(leaf(tufts) / leaf(cushions)).toFixed(2)} times the leaf it had as cushions`);
  }
  // (Between none and all: a share of the side twigs keep theirs, and raising it only adds.)
  const count = (sideLeaves) => growKind('ash', 7, 0, { ...DEFAULT_SHAPES.ash, sideLeaves }).layout.oak.kept.filter((cluster) => !cluster.end).length;
  assert.ok(count(0) === 0 && count(0.5) > 0 && count(0.5) < count(1), `${count(0)}, ${count(0.5)}, ${count(1)} clusters on side twigs`);
});

test('the ash grown in the open: a full dome, more and smaller clusters than its tufts, filling its crown', () => {
  const leaf = (tree) => tree.layout.clumps.reduce((sum, k) => sum + k.radius ** 3 * k.squash, 0);
  for (const seed of [3, 7, 21]) {
    const dome = growKind('ash', seed, 0), tufts = growKind('ash', seed, 0, { ...DEFAULT_SHAPES.ash, leafiness: 0.45, clumpSize: [1.5, 2.4], coarse: 0.9, ...KIND_CROWNS.ash.tufts });
    assert.ok(dome.layout.clumps.length > tufts.layout.clumps.length * 1.5, `seed ${seed}: ${dome.layout.clumps.length} clusters against ${tufts.layout.clumps.length} tufts`);
    assert.ok(leaf(dome) > leaf(tufts), `seed ${seed}: ${(leaf(dome) / leaf(tufts)).toFixed(2)} times the tufts' leaf`);
    assert.ok(dome.layout.oak.kept.some((cluster) => !cluster.end), `seed ${seed}: leaves along its branches too`);
  }
});

test('the birch: an upright, light crown whose branch ends alone hang (a silver birch, not a willow)', () => {
  assert.deepEqual(Object.keys(KIND_CROWNS.birch), ['hanging ends', 'cushions']);
  for (const seed of [3, 7, 21]) {
    const birch = growKind('birch', seed, 0), cushions = growKind('birch', seed, 0, { ...DEFAULT_SHAPES.birch, ...KIND_CROWNS.birch.cushions });
    const kept = birch.layout.oak.kept, clumps = birch.layout.clumps;
    const ends = clumps.filter((_, i) => kept[i].end), sides = clumps.filter((_, i) => !kept[i].end);
    assert.ok(ends.length >= 10 && sides.length >= 5, `seed ${seed}: ${ends.length} at branch ends, ${sides.length} along branches`);
    const mean = (list, of) => list.reduce((sum, k) => sum + of(k), 0) / list.length;
    // (Along a branch: about as tall as wide, sitting on its twigs. At a branch's end: longer, and lower than it would sit.)
    assert.ok(mean(sides, (k) => k.squash) < 1.3 && mean(ends, (k) => k.squash) > mean(sides, (k) => k.squash) * 1.4, `seed ${seed}: ${mean(ends, (k) => k.squash).toFixed(2)} tall at the ends, ${mean(sides, (k) => k.squash).toFixed(2)} along`);
    assert.ok(mean(ends, (k) => k.squash) < 2.2, `seed ${seed}: no long strands (${mean(ends, (k) => k.squash).toFixed(2)})`);
    // (A light crown: less leaf than as cushions, but not half.)
    const leaf = (tree) => tree.layout.clumps.reduce((sum, k) => sum + k.radius ** 3 * k.squash, 0);
    assert.ok(leaf(birch) < leaf(cushions) * 0.85 && leaf(birch) > leaf(cushions) * 0.5, `seed ${seed}: ${(leaf(birch) / leaf(cushions)).toFixed(2)} times the leaf it had as cushions`);
    // (Its crown stands: its leaves' middle is above the middle of the tree, and no leaf near the ground.)
    const middle = mean(clumps, (k) => k.center[1]), was = mean(cushions.layout.clumps, (k) => k.center[1]);
    assert.ok(middle > birch.height * 0.45 && middle > was - 0.8, `seed ${seed}: its leaves' middle at ${middle.toFixed(1)} m of ${birch.height.toFixed(1)} (${was.toFixed(1)} m as cushions)`);
    const p = birch.foliage.attributes.position;
    let lowest = Infinity;
    for (let i = 0; i < p.count; i++) lowest = Math.min(lowest, p.getY(i));
    assert.ok(lowest > 1, `seed ${seed}: its lowest leaves at ${lowest.toFixed(2)} m`);
  }
  // (Its limbs' ends turn down a little: far less than they did, when the whole limb wept.)
  assert.ok(DEFAULT_SHAPES.birch.tipRise < 0 && DEFAULT_SHAPES.birch.tipRise >= -1.2, 'tips turn down a little');
  for (const name of ['young', 'forest-grown', 'old']) assert.ok(presetShape('birch', name).tipRise >= -1.7, name);
  // (An old birch's limbs weep lowest: what hangs stops above the ground.)
  for (const seed of [1, 3, 7, 8, 12, 21, 40, 55]) {
    const p = growKind('birch', seed, 0, presetShape('birch', 'old')).foliage.attributes.position;
    let lowest = Infinity;
    for (let i = 0; i < p.count; i++) lowest = Math.min(lowest, p.getY(i));
    assert.ok(lowest > 0.2, `an old birch, seed ${seed}: its lowest leaves at ${lowest.toFixed(2)} m`);
  }
  // ("ends hang" alone: the more, the lower and the longer the leaves at the ends; those along the branches stay.)
  const at = (hang) => { const tree = growKind('birch', 7, 0, { ...DEFAULT_SHAPES.birch, hang }); const kept = tree.layout.oak.kept; const of = (end, what) => { const list = tree.layout.clumps.filter((_, i) => kept[i].end === end); return list.reduce((sum, k) => sum + what(k), 0) / list.length; }; return { ends: of(true, (k) => k.center[1]), long: of(true, (k) => k.squash), sides: of(false, (k) => k.squash) }; };
  const none = at(0), some = at(0.45), much = at(0.9);
  assert.ok(none.ends > some.ends && some.ends > much.ends && none.long < some.long && some.long < much.long, 'the ends');
  assert.ok(Math.abs(none.sides - much.sides) < 0.05, 'along the branches');
});

test('a link made before a kind had forms opens it as cushions', () => {
  assert.ok(LINK_VERSION >= 10);
  for (const version of [6, 7, 8, 9]) {
    for (const link of [`${version}`, `${version}~shapes.birch_lean-1-2`]) {
      const made = fromShortLink(link);
      assert.deepEqual(made.notes, [], link);
      assert.equal(crownOf('birch', made.settings.shapes.birch), 'cushions', link);
    }
  }
  assert.equal(crownOf('ash', fromShortLink('9').settings.shapes.ash), 'tufts');
  for (const version of [6, 7, 8]) {
    for (const link of [`${version}`, `${version}~shapes.ash_lean-1-2`]) {
      const made = fromShortLink(link);
      assert.deepEqual(made.notes, [], link);
      assert.equal(crownOf('ash', made.settings.shapes.ash), 'cushions', link);
    }
  }
  // (Before any kind had them, and when only the beech did. A link that says nothing of the kind, and one that moves another of its settings.)
  for (const version of [6, 7]) {
    for (const kind of ['holly', 'linden']) {
      for (const link of [`${version}`, `${version}~shapes.${kind}_lean-1-2`]) {
        const made = fromShortLink(link);
        assert.deepEqual(made.notes, [], link);
        assert.equal(crownOf(kind, made.settings.shapes[kind]), 'cushions', link);
      }
    }
  }
  assert.equal(crownOf('beech', fromShortLink('6').settings.shapes.beech), 'cushions');
  assert.equal(crownOf('beech', fromShortLink('7').settings.shapes.beech), 'layered dome');
  // (And a kind that had its form already keeps it, with the setting newer than the link as it was then.)
  for (const [kind, form] of [['holly', 'tiers'], ['linden', 'billows'], ['beech', 'layered dome']]) assert.equal(crownOf(kind, fromShortLink('8').settings.shapes[kind]), form, kind);
  for (const kind of Object.keys(KIND_CROWNS)) assert.equal(crownOf(kind, fromShortLink(`${LINK_VERSION}`).settings.shapes[kind]), Object.keys(KIND_CROWNS[kind])[0], kind);
});
