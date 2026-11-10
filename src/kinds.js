import { TREE_KINDS, TREE_SHAPES, buildTree, variantSeed } from '@workshop/treeShapes.js';
import { OAK_LIMITS, OAK_SHAPE, buildOak } from './oak/oak.js';

// Every kind of tree TreeLab grows: its own (grown by its own code, at their
// real size: the English oak) and the workshop's three (its copied
// generator, unchanged: vendor/workshop/treeShapes.js).

export const OWN_KINDS = ['oak'];
export const WORKSHOP_KINDS = TREE_KINDS;
export const KINDS = [...OWN_KINDS, ...WORKSHOP_KINDS];

// Each kind's shape as it starts.
export const DEFAULT_SHAPES = { oak: OAK_SHAPE, ...TREE_SHAPES };

// The sliders of TreeLab's own kinds (the workshop's are in src/limits.js).
export const KIND_LIMITS = { oak: OAK_LIMITS };

export const isOwn = (kind) => OWN_KINDS.includes(kind);

// Leaves (turning in autumn, fluttering), not needles.
export const leafy = (kind) => kind === 'oak' || kind === 'broadleaf';

// The kind the workshop's sway tunes a tree by (it knows only its own three;
// an oak sways as a broadleaf).
export const swayKind = (kind) => (kind === 'oak' ? 'broadleaf' : kind);

// A tree grown: { wood, foliage, height, reach, crown, clumps, layout }.
// seed and variant as the workshop draws them (variantSeed), so the
// workshop's trees are the same as in the workshop.
export function growKind(kind, seed, variant, shape = DEFAULT_SHAPES[kind]) {
  const s = variantSeed(seed, kind, variant);
  return kind === 'oak' ? buildOak(s, shape) : buildTree(kind, s, shape);
}
