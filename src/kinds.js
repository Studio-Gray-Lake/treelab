import { TREE_KINDS, TREE_SHAPES, buildTree, variantSeed } from '@workshop/treeShapes.js';
import { OAK_CHOICES, OAK_FRAME, OAK_LIMITS, OAK_SHAPE, buildOak } from './oak/oak.js';

// Every kind of tree TreeLab grows: its own (grown by its own code, at its
// real size: the English oak) and the
// workshop's three (its copied generator, unchanged:
// vendor/workshop/treeShapes.js).

// TreeLab's own kinds, each with the frame it grows in (src/oak/oak.js: the
// tree it's grown as before it's fitted to its size, its bark, whether its
// leaves are needles, and which of the workshop's kinds it sways as).
export const FRAMES = { oak: OAK_FRAME };
export const OWN_KINDS = Object.keys(FRAMES);
export const WORKSHOP_KINDS = TREE_KINDS;
export const KINDS = [...OWN_KINDS, ...WORKSHOP_KINDS];

// Each kind's shape as it starts.
export const DEFAULT_SHAPES = { oak: OAK_SHAPE, ...TREE_SHAPES };

// The sliders of TreeLab's own kinds (the workshop's are in src/limits.js).
export const KIND_LIMITS = { oak: OAK_LIMITS };

// Their settings that are a choice from a list, not a slider: { kind: {
// setting: { name: value } } }.
export const KIND_CHOICES = { oak: OAK_CHOICES };

export const isOwn = (kind) => OWN_KINDS.includes(kind);

// The name the panel shows for a kind (its key, in settings, links and
// files, never changes). None is named otherwise than by its key yet.
export const LEGACY_KINDS = [];
const NAMES = {};
export const kindName = (kind) => NAMES[kind] ?? (LEGACY_KINDS.includes(kind) ? `${kind} (legacy)` : kind);

// Leaves (turning in autumn, fluttering), not needles.
export const leafy = (kind) => (isOwn(kind) ? !FRAMES[kind].needles : kind === 'broadleaf');

// The kind the workshop's sway tunes a tree by (it knows only its own
// three: an oak sways as a broadleaf).
export const swayKind = (kind) => FRAMES[kind]?.kind ?? kind;

// A tree grown: { wood, foliage, height, reach, crown, clumps, layout }.
// seed and variant as the workshop draws them (variantSeed), so the
// workshop's trees are the same as in the workshop.
export function growKind(kind, seed, variant, shape = DEFAULT_SHAPES[kind]) {
  const s = variantSeed(seed, kind, variant);
  return isOwn(kind) ? buildOak(s, shape, FRAMES[kind]) : buildTree(kind, s, shape);
}
