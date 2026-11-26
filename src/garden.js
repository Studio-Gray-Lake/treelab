import { KINDS, kindName } from './kinds.js';
import { RANGES } from './settings.js';

// A seed or a variant counted up past the end of its slider starts again at its beginning: a tree in the grid is
// always one the sliders can ask for (a double-click on it sets them).
const within = (value, [lo, hi]) => lo + ((((value - lo) % (hi - lo + 1)) + (hi - lo + 1)) % (hi - lo + 1));

// The Tree tab's trees: one tree, or a grid of them to compare, evenly
// spaced on flat ground, all the same size, unturned and equally tinted.
//
//   variants      the kind and seed, variants counting up from the variant
//   seeds         the kind and variant, seeds counting up from the seed
//   kinds by row  a row per kind, variants counting up along each row
//
// Returns the records (src/tree.js), each with a label, and how far the
// garden reaches from the middle (m). shapeOf(kind, variant): the shape a
// tree is grown from (the kind's own, unless said: the season's, say), the
// same one the planter is given, so each tree is grown once.
export function gardenRecords(tree, shapes, planter, shapeOf = (kind) => shapes[kind]) {
  const cells = [];
  if (tree.show !== 'grid') {
    cells.push({ kind: tree.kind, seed: tree.seed, variant: tree.variant, row: 0, col: 0 });
  } else {
    const first = KINDS.indexOf(tree.kind);
    for (let row = 0; row < tree.rows; row++) {
      for (let col = 0; col < tree.cols; col++) {
        const i = row * tree.cols + col;
        if (tree.vary === 'seeds') cells.push({ kind: tree.kind, seed: within(tree.seed + i, RANGES['tree.seed']), variant: tree.variant, row, col });
        else if (tree.vary === 'kinds by row') {
          const kind = KINDS[(first + row) % KINDS.length];
          const round = Math.floor(row / KINDS.length);
          cells.push({ kind, seed: tree.seed, variant: within(tree.variant + round * tree.cols + col, RANGES['tree.variant']), row, col });
        } else cells.push({ kind: tree.kind, seed: tree.seed, variant: within(tree.variant + i, RANGES['tree.variant']), row, col });
      }
    }
  }
  // Grown first, to space them by the widest.
  const grown = cells.map((c) => planter.model(c.kind, c.seed, c.variant, shapeOf(c.kind, c.variant)).tree);
  const reach = Math.max(...grown.map((t) => t.reach));
  const spacing = 2 * reach + tree.gap;
  const rows = tree.show === 'grid' ? tree.rows : 1, cols = tree.show === 'grid' ? tree.cols : 1;
  const records = cells.map((c) => ({
    x: (c.col - (cols - 1) / 2) * spacing,
    y: 0,
    z: (c.row - (rows - 1) / 2) * spacing,
    size: 1,
    turn: 0,
    tint: tree.tint,
    kind: c.kind,
    seed: c.seed,
    variant: c.variant,
    label: tree.vary === 'seeds' ? `seed ${c.seed}` : tree.vary === 'kinds by row' ? `${kindName(c.kind)} ${c.variant}` : `variant ${c.variant}`,
  }));
  const extent = Math.hypot(((cols - 1) / 2) * spacing + reach, ((rows - 1) / 2) * spacing + reach);
  return { records, spacing, reach, extent, tallest: Math.max(...grown.map((t) => t.height)) };
}
