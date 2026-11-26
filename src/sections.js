// The shape sliders in sections, by the part of the tree they shape, each
// with a plain name.
//
// The same sections, in the same order, for every kind of tree: TreeLab's
// own (the oak) and the workshop's. A kind lists a section only if it has
// something in it, and a kind to come adds its own rows to these (roots, an
// age) rather than a layout of its own.
//
// A name here is only what the panel shows. The settings keep their own
// keys (in saved links and files, in the generators, in the tooltips:
// src/tips.js), so renaming a row breaks nothing saved. A setting no
// section lists (one new to the workshop's generator) goes under "other",
// by its own key.
//
// Some of a section's rows share a folded panel of their own within it
// (PANELS: the oak's outline and its noise, in its crown), so the section
// stays short until they're wanted. A panel can open with a drawing of its
// rows (DRAWINGS: the crown's outline, src/outlineEditor.js).

export const SECTIONS = ['size', 'trunk', 'roots', 'limbs', 'crown', 'movement'];
export const OTHER = 'other';

const CLUMPS = { clumps: 'clumps on a limb', clumpSize: 'clump size', squash: 'flat to tall', rough: 'lumpy' };

// (Rows put after one of a section's rows.)
const after = (rows, key, more) => Object.fromEntries(Object.entries(rows).flatMap(([k, v]) => (k === key ? [[k, v], ...Object.entries(more)] : [[k, v]])));

// TreeLab's own English oak (src/oak/oak.js).
const OAK = {
  size: { age: 'age (years)', height: 'height', spread: 'crown width', lean: 'lean' },
  trunk: { trunk: 'bare trunk', girth: 'thickness', bends: 'bends', gnarl: 'gnarl', burrs: 'burrs', hollows: 'hollows', marksHigh: 'marks reach up' },
  roots: { flare: 'flare', roots: 'surface roots' },
  limbs: { limbs: 'big limbs', leader: 'trunk carries on', whorl: 'limbs to a ring', riseTop: 'rise at the top (°)', riseBottom: 'rise at the bottom (°)', crooked: 'crooked', droop: 'sag', stubs: 'dead stubs' },
  crown: { leafiness: 'fullness', sideLeaves: 'leaves along branches', crowded: 'neighbours', reachTop: 'at the top', reachHigh: 'three quarters up', reachMid: 'halfway up', reachLow: 'a quarter up', reachBottom: 'at the bottom', clumpSize: 'cluster size', clumpWide: 'cluster width', squash: 'flat to tall', hang: 'ends hang', rough: 'lumpy', merge: 'merging (%)', across: 'runs together', leafReach: 'leaves reach', coarse: 'coarseness', noise: 'amount (%)', noiseType: 'type', noiseSize: 'size (m)', noiseDetail: 'detail', noiseBend: 'bend (m)', noiseBillow: 'billow' },
  movement: { sway: 'sway' },
};
// A beech's (src/oak/broadleaves.js): an oak's, and its limbs' tips.
const BEECH = { ...OAK, limbs: after(OAK.limbs, 'droop', { tipRise: 'tips turn up' }) };

// A hawthorn's: an oak's, and the wind that swept it.
const HAWTHORN = { ...OAK, size: after(OAK.size, 'lean', { swept: 'wind-swept' }) };
// A hazel's: a shrub of stems from a stool. No trunk's rows; its stems where an oak has its limbs.
const HAZEL = {
  size: OAK.size,
  trunk: { stool: 'stool width', gnarl: 'gnarl' },
  roots: OAK.roots,
  limbs: { limbs: 'stems', girth: 'stem thickness', riseTop: 'steepest stems (°)', riseBottom: 'outermost stems (°)', crooked: 'crooked', droop: 'arch over', stubs: 'dead stubs' },
  crown: OAK.crown,
  movement: OAK.movement,
};

export const ROWS = {
  oak: OAK,
  beech: BEECH,
  hawthorn: HAWTHORN,
  hazel: HAZEL,
  holly: BEECH, // (a beech's rows: an oak's, and its limbs' tips)
  ash: BEECH,
  birch: BEECH,
  linden: BEECH,
  // The workshop's three (vendor/workshop/treeShapes.js).
  broadleaf: {
    size: { lean: 'lean' },
    trunk: { trunk: 'bare trunk', girth: 'thickness' },
    limbs: { branches: 'limbs', length: 'length', tilt: 'lean out', curl: 'curl up', leader: 'leader' },
    crown: { ...CLUMPS, core: 'middle clump' },
    movement: { sway: 'sway' },
  },
  fir: {
    size: { height: 'height', lean: 'lean' },
    trunk: { bare: 'bare trunk', girth: 'thickness' },
    limbs: { tiers: 'tiers', radius: 'reach', points: 'tips on a tier', droop: 'droop', jag: 'ragged' },
    movement: { sway: 'sway' },
  },
  pine: {
    size: { height: 'height', lean: 'lean' },
    trunk: { girth: 'thickness', crook: 'crooked', stubs: 'dead stubs' },
    limbs: { crown: 'limbs start', branches: 'limbs', length: 'length', tilt: 'lean out', curl: 'curl up' },
    crown: CLUMPS,
    movement: { sway: 'sway' },
  },
};

// The rows that share a folded panel of their own within their section:
// { kind: { the panel's title: [settings] } }. (They're listed together in
// their section, above.)
const OUTLINE_ROWS = ['reachTop', 'reachHigh', 'reachMid', 'reachLow', 'reachBottom'];
const LEAF_PANELS = {
  outline: OUTLINE_ROWS,
  noise: ['noise', 'noiseType', 'noiseSize', 'noiseDetail', 'noiseBend', 'noiseBillow'],
};
export const PANELS = {
  oak: LEAF_PANELS,
  beech: LEAF_PANELS,
  hawthorn: LEAF_PANELS,
  hazel: LEAF_PANELS,
  holly: LEAF_PANELS,
  ash: LEAF_PANELS,
  birch: LEAF_PANELS,
  linden: LEAF_PANELS,
};

// The panels that open with a drawing of their rows: { kind: { the panel's
// title: what's drawn } }.
export const DRAWINGS = { oak: { outline: 'outline' }, beech: { outline: 'outline' }, hawthorn: { outline: 'outline' }, hazel: { outline: 'outline' }, holly: { outline: 'outline' }, ash: { outline: 'outline' }, birch: { outline: 'outline' }, linden: { outline: 'outline' }};

// A kind's settings laid out for the panel: [{ title, rows: [{ key, name }] }],
// the sections in their order (those with nothing in them left out), each
// row in the order its section lists it (with panel: its title, if it's in
// a folded panel within the section); settings no section lists last,
// under "other". shape: the kind's settings (their keys are what's there).
export function sectionsOf(kind, shape) {
  const there = new Set(Object.keys(shape));
  const panelOf = (key) => Object.keys(PANELS[kind] ?? {}).find((panel) => PANELS[kind][panel].includes(key));
  const out = [];
  for (const title of SECTIONS) {
    const rows = Object.entries(ROWS[kind]?.[title] ?? {}).filter(([key]) => there.has(key))
      .map(([key, name]) => (panelOf(key) ? { key, name, panel: panelOf(key) } : { key, name }));
    for (const { key } of rows) there.delete(key);
    if (rows.length) out.push({ title, rows });
  }
  if (there.size) out.push({ title: OTHER, rows: [...there].map((key) => ({ key, name: key })) });
  return out;
}
