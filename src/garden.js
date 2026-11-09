import { TREE_KINDS } from '@workshop/treeShapes.js';

// The Tree tab's trees: one tree, or a grid of them to compare, evenly
// spaced on flat ground, all the same size, unturned and equally tinted.
//
//   variants      the kind and seed, variants counting up from the variant
//   seeds         the kind and variant, seeds counting up from the seed
//   kinds by row  a row per kind, variants counting up along each row
//
// Returns the records (src/tree.js), each with a label, and how far the
// garden reaches from the middle (m).
export function gardenRecords(tree, shapes, planter) {
  const cells = [];
  if (tree.show !== 'grid') {
    cells.push({ kind: tree.kind, seed: tree.seed, variant: tree.variant, row: 0, col: 0 });
  } else {
    const first = TREE_KINDS.indexOf(tree.kind);
    for (let row = 0; row < tree.rows; row++) {
      for (let col = 0; col < tree.cols; col++) {
        const i = row * tree.cols + col;
        if (tree.vary === 'seeds') cells.push({ kind: tree.kind, seed: tree.seed + i, variant: tree.variant, row, col });
        else if (tree.vary === 'kinds by row') {
          const kind = TREE_KINDS[(first + row) % TREE_KINDS.length];
          const round = Math.floor(row / TREE_KINDS.length);
          cells.push({ kind, seed: tree.seed, variant: tree.variant + round * tree.cols + col, row, col });
        } else cells.push({ kind: tree.kind, seed: tree.seed, variant: tree.variant + i, row, col });
      }
    }
  }
  // Grown first, to space them by the widest.
  const grown = cells.map((c) => planter.model(c.kind, c.seed, c.variant, shapes[c.kind]).tree);
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
    label: tree.vary === 'seeds' ? `seed ${c.seed}` : tree.vary === 'kinds by row' ? `${c.kind} ${c.variant}` : `variant ${c.variant}`,
  }));
  const extent = Math.hypot(((cols - 1) / 2) * spacing + reach, ((rows - 1) / 2) * spacing + reach);
  return { records, spacing, reach, extent, tallest: Math.max(...grown.map((t) => t.height)) };
}
