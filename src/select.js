// Selecting a tree and centring the view on it, and how fast the view
// turns by itself: what src/main.js needs worked out (no three.js here).
//
// A click picks a tree (a click, not a drag: the press and its release in
// one place; a double-click still shows a tree alone). The picked tree gets
// a ring on the ground round its foot, the panel on the left shows its
// kind, and each of that kind's ranges marks where this one tree fell. "centre on it" slides the view so
// the tree is at the middle of the screen, from the same angle and
// distance, and the view then turns round it: by a drag, or by itself
// ("turn slowly").

// "turn slowly" in degrees a second, as the orbit controls count it (their
// 1 is a turn a minute: 6° a second). Below 0 it turns the other way.
export const turnRate = (degreesASecond) => degreesASecond / 6;

// Whether a press and its release are a click, not a drag: within `slack`
// pixels of each other.
export const isClick = (down, up, slack = 5) => Boolean(down && up) && Math.hypot(up.x - down.x, up.y - down.y) <= slack;

// How tall a planted tree stands (m): its grown tree's height, by its own
// size. species: a planting's (src/tree.js: plant), { kind: { variants:
// [{ trees, height }] } }. 0 if the tree isn't among them.
export function heightIn(species, record) {
  for (const entry of Object.values(species ?? {})) {
    for (const variant of entry.variants) if (variant.trees.includes(record)) return variant.height * (record.size ?? 1);
  }
  return 0;
}

// What a planted tree drew for itself from its kind's ranges (src/oak/oak.js:
// drew), as it stands: { setting: value }, its lengths by its own size (a
// forest's trees are each a little bigger or smaller than they were grown).
// null for a tree that keeps none: the workshop's, grown by its own code.
const LENGTHS = ['height', 'trunk', 'girth'];
export function drawnIn(species, record) {
  for (const entry of Object.values(species ?? {})) {
    for (const variant of entry.variants) {
      if (!variant.trees.includes(record)) continue;
      const drew = variant.model?.tree?.layout?.oak?.drew;
      if (!drew) return null;
      const size = record.size ?? 1;
      return Object.fromEntries(Object.entries(drew).map(([key, v]) => [key, LENGTHS.includes(key) ? v * size : v]));
    }
  }
  return null;
}

// The point the view turns round for a tree: on its trunk, a little under
// halfway up it (as the Tree tab looks at its trees).
export const focusOf = ({ x, y = 0, z, height }) => [x, y + height * 0.45, z];

// The ring round a tree's foot: points on the ground, a little above it so
// it shows, `radius` m from the trunk. heightAt(x, z): the ground's height.
export function ringPoints({ x, z, radius, heightAt = () => 0, steps = 48, lift = 0.1 }) {
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    const px = x + Math.cos(a) * radius, pz = z + Math.sin(a) * radius;
    return [px, heightAt(px, pz) + lift, pz];
  });
}

// How wide that ring is (its radius, m): round the foot, not the crown;
// wider under a wider tree.
export const ringRadius = (crown) => Math.min(3.5, Math.max(0.8, (crown ?? 0) * 0.3));

// The same tree after the trees were planted again (a slider moved): the
// one of its kind standing where it stood. None if it's gone.
export function sameTree(records, was, within = 0.05) {
  if (!was) return null;
  return records.find((r) => r.kind === was.kind && Math.hypot(r.x - was.x, r.z - was.z) <= within) ?? null;
}
