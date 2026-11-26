import { TREE_KINDS, TREE_SHAPES, buildTree, variantSeed } from '@workshop/treeShapes.js';
import { OAK_CHOICES, OAK_FRAME, OAK_LIMITS, OAK_SHAPE, buildOak } from './oak/oak.js';
import { BEECH_CHOICES, BEECH_CROWNS, BEECH_FRAME, BEECH_LIMITS, BEECH_SHAPE, HAWTHORN_CHOICES, HAWTHORN_FRAME, HAWTHORN_LIMITS, HAWTHORN_SHAPE, HAZEL_CHOICES, HAZEL_FRAME, HAZEL_LIMITS, HAZEL_SHAPE, HOLLY_CHOICES, HOLLY_CROWNS, HOLLY_FRAME, HOLLY_LIMITS, HOLLY_SHAPE, ASH_CHOICES, ASH_CROWNS, ASH_FRAME, ASH_LIMITS, ASH_SHAPE, BIRCH_CHOICES, BIRCH_CROWNS, BIRCH_FRAME, BIRCH_LIMITS, BIRCH_SHAPE, LINDEN_CHOICES, LINDEN_CROWNS, LINDEN_FRAME, LINDEN_LIMITS, LINDEN_SHAPE } from './oak/broadleaves.js';

// Every kind of tree TreeLab grows: its own (grown by its own code, at their
// real size: the English oak, the beech, the hawthorn, the hazel, the
// holly, the ash, the birch, the linden) and the
// workshop's three (its copied generator, unchanged:
// vendor/workshop/treeShapes.js).

// TreeLab's own kinds, each with the frame it grows in (src/oak/oak.js: the
// tree it's grown as before it's fitted to its size, its bark, whether its
// leaves are needles, and which of the workshop's kinds it sways as).
export const FRAMES = { oak: OAK_FRAME, beech: BEECH_FRAME, hawthorn: HAWTHORN_FRAME, hazel: HAZEL_FRAME, holly: HOLLY_FRAME, ash: ASH_FRAME, birch: BIRCH_FRAME, linden: LINDEN_FRAME};
export const OWN_KINDS = Object.keys(FRAMES);
export const WORKSHOP_KINDS = TREE_KINDS;
export const KINDS = [...OWN_KINDS, ...WORKSHOP_KINDS];

// The kinds in the groups the forest's mix lists them in: the trees that
// grow together in one country, and the workshop's own three. Every kind
// is in one group, and a new kind is put in its group here.
export const KIND_GROUPS = [
  { title: 'an English wood', kinds: ['oak', 'beech', 'hawthorn', 'hazel', 'holly', 'ash', 'birch', 'linden'] },
  { title: 'the workshop\'s first trees', kinds: [...WORKSHOP_KINDS] },
];

// Each kind's shape as it starts.
export const DEFAULT_SHAPES = { oak: OAK_SHAPE, beech: BEECH_SHAPE, hawthorn: HAWTHORN_SHAPE, hazel: HAZEL_SHAPE, holly: HOLLY_SHAPE, ash: ASH_SHAPE, birch: BIRCH_SHAPE, linden: LINDEN_SHAPE, ...TREE_SHAPES };

// The sliders of TreeLab's own kinds (the workshop's are in src/limits.js).
export const KIND_LIMITS = { oak: OAK_LIMITS, beech: BEECH_LIMITS, hawthorn: HAWTHORN_LIMITS, hazel: HAZEL_LIMITS, holly: HOLLY_LIMITS, ash: ASH_LIMITS, birch: BIRCH_LIMITS, linden: LINDEN_LIMITS};

// Their settings that are a choice from a list, not a slider: { kind: {
// setting: { name: value } } }.
export const KIND_CHOICES = { oak: OAK_CHOICES, beech: BEECH_CHOICES, hawthorn: HAWTHORN_CHOICES, hazel: HAZEL_CHOICES, holly: HOLLY_CHOICES, ash: ASH_CHOICES, birch: BIRCH_CHOICES, linden: LINDEN_CHOICES };

// The forms a kind's crown can take: { kind: { form: { setting: value } } }. A form is a few of the kind's
// settings set together (flat or round clusters, limb by limb or across the crown, ...): the panel lists them in
// its "crown form" row. A kind with one form only has no such row.
// A form is the shape of a crown's parts and how they lie: no crown closes into one block (one was tried, a
// cone and a dome each in a single mass, and read as a lump: nothing of the tree left to see in it). The parts
// are a limb's leaves each. The beech's layers alone run across limbs: they touch, but they are thin, and sky and
// wood show between them. The ash's are small clusters all through a full dome, run together with small gaps
// (in a wood, a thin crown: its branches' ends, each a tuft). The birch's are
// its clusters themselves, small ones, those at its branches' ends hanging.
export const KIND_CROWNS = { beech: BEECH_CROWNS, holly: HOLLY_CROWNS, linden: LINDEN_CROWNS, ash: ASH_CROWNS, birch: BIRCH_CROWNS };

// Which of its kind's forms a shape's crown has ('custom' if none; null for a kind without forms).
export function crownOf(kind, shape) {
  const forms = KIND_CROWNS[kind];
  if (!forms) return null;
  return Object.keys(forms).find((name) => Object.entries(forms[name]).every(([key, value]) => shape[key] === value)) ?? 'custom';
}

export const isOwn = (kind) => OWN_KINDS.includes(kind);

// The name the panel shows for a kind (its key, in settings, links and
// files, never changes). None is named otherwise than by its key yet.
export const LEGACY_KINDS = [];
const NAMES = {};
export const kindName = (kind) => NAMES[kind] ?? (LEGACY_KINDS.includes(kind) ? `${kind} (legacy)` : kind);

// Leaves, not needles.
export const leafy = (kind) => (isOwn(kind) ? !FRAMES[kind].needles : kind === 'broadleaf');

// When in the year a kind has its leaves, beside the others (src/season.js).
export const leafTiming = (kind) => FRAMES[kind]?.leaf ?? null;

// Keeps its foliage the year round: every kind with needles, and a kind
// with leaves whose frame says so (the holly).
export const evergreen = (kind) => !leafy(kind) || Boolean(FRAMES[kind]?.evergreen);

// The kind the workshop's sway tunes a tree by (it knows only its own
// three: an oak, a beech, a hawthorn, a hazel, a holly, an ash, a birch and a linden sway as a broadleaf).
export const swayKind = (kind) => FRAMES[kind]?.kind ?? kind;

// A tree grown: { wood, foliage, height, reach, crown, clumps, layout }.
// seed and variant as the workshop draws them (variantSeed), so the
// workshop's trees are the same as in the workshop.
export function growKind(kind, seed, variant, shape = DEFAULT_SHAPES[kind]) {
  const s = variantSeed(seed, kind, variant);
  return isOwn(kind) ? buildOak(s, shape, FRAMES[kind]) : buildTree(kind, s, shape);
}
