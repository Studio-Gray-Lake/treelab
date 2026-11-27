import { DEFAULT_SHAPES, KINDS, isOwn } from './kinds.js';
import { DEFAULT_WIND } from '@workshop/wind.js';
import { hasAges } from './age.js';
import { limitsFor, sliderKind } from './limits.js';
import { GREENS } from './tree.js';

// Everything a visitor can set, in one object: what the panel shows, what a
// settings file saves, what a share link carries.
//
// A file or link may come from an older or newer TreeLab, or be edited by
// hand, so it's read through normalize(): settings it doesn't know are left
// out, missing ones take their defaults, and every value is checked against
// its slider or its choices. When the workshop reshapes a tree's settings,
// a saved shape keeps the settings that still mean the same and takes the
// new defaults for the rest.

export const SETTINGS_VERSION = 1;

// The most trees a forest may hold. A bigger, denser forest than this is
// planted thinner all over (src/forest.js), and says so.
export const MAX_TREES = 4000;

// The workshop's mix (src/trees.js TREE_MIX), in percent.
// TreeLab's own kinds (real size: an oak is 20 m wide)
// are in the mix but off to start.
const MIX = { fir: 45, pine: 20, broadleaf: 35, oak: 30, beech: 30, hawthorn: 30, hazel: 30, holly: 30, ash: 30, birch: 30, linden: 30};
// The ages a kind with ages has in a forest of several, to start with (years).
const MIX_AGES = { oak: [30, 300], beech: [25, 250], hawthorn: [10, 200], hazel: [10, 60], holly: [12, 200], ash: [20, 200], birch: [10, 80], linden: [20, 300]};

export function defaultSettings() {
  return {
    app: 'TreeLab',
    version: SETTINGS_VERSION,
    tab: 'tree',
    tree: { kind: 'oak', seed: 7, variant: 0, tint: 0.5, show: 'one tree', ground: 'flat', rows: 2, cols: 4, vary: 'variants', gap: 1, labels: true },
    shapes: structuredClone(DEFAULT_SHAPES),
    forest: {
      seed: 7,
      area: 'circle',
      radius: 30,
      density: 400,
      pattern: 'even spacing',
      jitter: 0.8,
      clumpTrees: 8,
      clumpSpread: 4,
      rowAngle: 0,
      patches: false,
      patchSize: 20,
      cover: 0.6,
      // (A kind with ages, TreeLab's own: mixed: its trees of several ages, from ages[0] to ages[1] years; old: 0 mostly young, 1 mostly old.
      // src/age.js. On to start with, since 25 November 2026: a wood holds trees of many ages. Before, every tree of a kind was the
      // Tree tab's one age, so a forest's birches were all 40 and its oaks all 150; links made then still open so, by their record.)
      mix: Object.fromEntries(KINDS.map((kind) => [kind, { on: !isOwn(kind), share: MIX[kind] ?? 30, ...(hasAges(kind) ? { mixed: true, ages: [...(MIX_AGES[kind] ?? [30, 300])], old: 0.5 } : {}) }])),
      // (How the mix is set: by count, a kind's share of the seeds; or by cover, a layer at a time: layers.canopy and
      // layers.underwood, the percent of the ground each layer's crowns cover, and a kind's share then of its layer's crowns. src/cover.js.)
      mixBy: 'by count',
      layers: { canopy: 70, underwood: 40 },
      grouping: 'mixed',
      standSize: 25,
      variants: 6,
      // (A tree hemmed in by others grows as in a wood: its kind's forest-grown shape. src/woodGrown.js.)
      closes: true,
      size: [0.75, 1.35],
      maxSlope: 30,
      // (The rules for where trees grow, each from 0, off, upward: src/site.js.)
      rules: { ground: 1, room: 1, light: 1 },
    },
    terrain: { seed: 3, height: 6, size: 35, roughness: 0.45 },
    // Each kind's foliage greens (a tree's tint picks between them), and autumn.
    colors: Object.fromEntries(KINDS.map((kind) => [kind, { dark: hex(GREENS[kind][0]), light: hex(GREENS[kind][1]) }])),
    // (The season: how much of their leaves the trees carry, and how new those leaves are. src/season.js.)
    season: { leaves: 1, fresh: 0 },
    autumn: { amount: 0, palette: 'mixed', spread: 0.5, evergreens: false },
    sway: { on: true, branch: 1, flutter: 0, timeScale: 1 },
    // The time of day (hours) and where the noon sun shines from (degrees).
    light: { hour: 19.25, runs: 0, from: 220, glow: 1, shafts: 1, mist: 0.2, gaps: 0.35, shade: 1, eye: 1 },
    wind: { ...DEFAULT_WIND },
    // (stand: the forest seen from among its trees, at eye height: src/stand.js.)
    view: { wireframe: false, grid: true, person: true, spin: false, turnSpeed: 12, stand: false, eyes: false },
  };
}

// The choices for each setting that is one of a list.
export const CHOICES = {
  tab: ['tree', 'forest'],
  'tree.kind': KINDS,
  'tree.show': ['one tree', 'grid'],
  'tree.ground': ['flat', 'hills'], // (one tree's: on level ground, or on the forest's hills. The grid is always flat.)
  'tree.vary': ['variants', 'seeds', 'kinds by row'],
  'forest.area': ['circle', 'square'],
  'forest.pattern': ['even spacing', 'random', 'jittered grid', 'clumps', 'rows'],
  'forest.mixBy': ['by count', 'by cover'],
  'forest.grouping': ['mixed', 'in stands'],
  'autumn.palette': ['mixed', 'maple', 'birch', 'oak', 'beech'],
};

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

// Each number's slider: [least, most, step]. The wind's are windView.js's.
export const RANGES = {
  'tree.seed': [1, 999, 1],
  'view.turnSpeed': [-60, 60, 1],
  'tree.variant': [0, 99, 1],
  'tree.tint': [0, 1, 0.01],
  'tree.rows': [1, 8, 1],
  'tree.cols': [1, 8, 1],
  'tree.gap': [0, 6, 0.1],
  'forest.seed': [1, 999, 1],
  'forest.radius': [5, 160, 1],
  'forest.density': [10, 3000, 10],
  'forest.jitter': [0, 1, 0.05],
  'forest.clumpTrees': [2, 30, 1],
  'forest.clumpSpread': [1, 15, 0.5],
  'forest.rowAngle': [0, 175, 5],
  'forest.patchSize': [5, 60, 1],
  'forest.cover': [0.1, 1, 0.05],
  'forest.mix.share': [0, 100, 1],
  'forest.mix.ages': [10, 800, 1],
  'forest.mix.old': [0, 1, 0.01],
  'forest.layers.canopy': [0, 100, 1],
  'forest.layers.underwood': [0, 100, 1],
  'forest.standSize': [8, 60, 1],
  'forest.variants': [1, 12, 1],
  'forest.size': [0.5, 1.6, 0.05],
  'forest.maxSlope': [5, 60, 1],
  'forest.rules.ground': [0, 1, 0.05],
  'forest.rules.room': [0, 2, 0.05],
  'forest.rules.light': [0, 1, 0.05],
  'terrain.seed': [1, 999, 1],
  'terrain.height': [0, 20, 0.5],
  'terrain.size': [10, 80, 1],
  'terrain.roughness': [0, 0.8, 0.05],
  'season.leaves': [0, 1, 0.01],
  'season.fresh': [0, 1, 0.01],
  'autumn.amount': [0, 1, 0.01],
  'autumn.spread': [0, 1, 0.01],
  'light.hour': [5, 21, 0.25],
  'light.runs': [0, 24, 0.5],
  'light.from': [0, 355, 5],
  'light.glow': [0, 2, 0.05],
  'light.shafts': [0, 10, 0.05],
  'light.mist': [0, 1, 0.01],
  'light.gaps': [0, 1, 0.01],
  'light.shade': [0, 1, 0.05],
  'light.eye': [0, 1, 0.05],
  'sway.branch': [0, 3, 0.05],
  'sway.flutter': [0, 3, 0.05],
  'sway.timeScale': [0, 3, 0.05],
  'wind.speed': [0, 10, 0.1],
  'wind.from': [0, 355, 5],
  'wind.gust': [0, 12, 0.5],
  'wind.gustEvery': [10, 60, 1],
  'wind.turbulence': [0, 0.5, 0.01],
  'wind.seed': [1, 99, 1],
};

// A number setting's [least, most, step], by its path.
export function rangeOf(path) {
  const shape = path.match(/^shapes\.(\w+)\.(\w+)$/);
  if (shape) return DEFAULT_SHAPES[shape[1]]?.[shape[2]] === undefined ? null : limitsFor(shape[2], DEFAULT_SHAPES[shape[1]][shape[2]], shape[1]);
  const mix = path.match(/^forest\.mix\.\w+\.(share|ages|old)$/);
  if (mix) return RANGES[`forest.mix.${mix[1]}`];
  return RANGES[path] ?? null;
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function fit(value, path) {
  const range = rangeOf(path);
  if (!range) return value;
  const [lo, hi, step] = range;
  let v = Math.min(hi, Math.max(lo, value));
  if (Number.isInteger(step)) v = Math.round(v);
  return v;
}

// Settings read from a file or a link: { settings, notes } (notes: what
// was off, in words).
export function normalize(raw) {
  const settings = defaultSettings();
  const notes = [];
  if (!isObject(raw)) {
    notes.push('not TreeLab settings: everything is at its default');
    return { settings, notes };
  }
  if (Number(raw.version) > SETTINGS_VERSION) notes.push('saved by a newer TreeLab: settings it added are left out');
  const given = older(raw, notes);
  merge(settings, given, '', notes);
  // (Settings kept from before a setting existed, a file, a last visit, one of the first links, say nothing of
  // it: it is put to what it was in effect then, BEFORE, not to today's default.)
  for (const [path, value] of Object.entries(BEFORE)) {
    const names = path.split('.');
    let there = given, node = settings;
    for (const name of names.slice(0, -1)) {
      there = isObject(there) && Object.hasOwn(there, name) ? there[name] : undefined;
      node = node?.[name];
    }
    // (A kind's shape that wasn't kept at all, from before the kind existed, is today's whole: there is nothing of it to keep as it was.)
    if (names[0] === 'shapes' && !isObject(there)) continue;
    if (isObject(node) && !(isObject(there) && Object.hasOwn(there, names.at(-1)))) node[names.at(-1)] = structuredClone(value);
  }
  return { settings, notes };
}

// Settings saved by an older TreeLab, put the way they're kept now (a copy:
// what was given is left as it is).
// - The oak's leaves were separate balls unless "merged masses" was on
//   (its "masses": 0 or 1, gone since). They are always masses now, and a
//   file that had them separate has every cluster a mass of its own:
//   merging 0.
export function older(raw, notes) {
  const oak = raw.shapes?.oak;
  if (!isObject(oak) || !('masses' in oak)) return raw;
  const { masses, ...rest } = oak;
  if (!(Number(masses) >= 0.5)) {
    rest.merge = 0;
    notes.push('shapes.oak: its leaves were separate clusters; each is now a mass of its own (merging 0)');
  } else if (!('merge' in rest)) {
    // (Merged, and nothing said of how many: all of them, as that build had it. A link holds only what was changed.)
    rest.merge = 100;
  }
  return { ...raw, shapes: { ...raw.shapes, oak: rest } };
}

function merge(target, source, path, notes) {
  for (const key of Object.keys(target)) {
    if (!(key in source) || key === 'app' || key === 'version') continue;
    const p = path ? `${path}.${key}` : key;
    const want = target[key];
    const got = source[key];
    if (isObject(want)) {
      if (isObject(got)) merge(want, got, p, notes);
      else notes.push(`${p} left at its default`);
    } else if (Array.isArray(want)) {
      // A [least, most] range.
      if (sliderKind(got) === 'range') {
        const pair = [fit(got[0], p), fit(got[1], p)].sort((a, b) => a - b);
        want.splice(0, want.length, ...pair);
      } else notes.push(`${p} left at its default`);
    } else if (typeof want === 'number') {
      if (typeof got === 'number' && Number.isFinite(got)) target[key] = fit(got, p);
      else notes.push(`${p} left at its default`);
    } else if (typeof want === 'boolean') {
      if (typeof got === 'boolean') target[key] = got;
      else notes.push(`${p} left at its default`);
    } else if (typeof want === 'string') {
      if (p.startsWith('colors.') ? isColor(got) : CHOICES[p] ? CHOICES[p].includes(got) : typeof got === 'string') target[key] = p.startsWith('colors.') ? got.toLowerCase() : got;
      else notes.push(`${p} left at its default`);
    }
  }
}

// What a setting was, in effect, before it was a setting: { path: value }.
// A link made before a setting existed says nothing of it, and must open as
// it was made: so where the record of the link's version (src/frozen) has
// no such setting, the setting is put to this, not to today's default. Only
// a setting whose default changes what was already there needs a line here
// (a new kind of tree, off in the forest to start with, does not). A line
// for a kind's shape ('shapes.<kind>.<setting>') holds only where that kind's
// shape was kept: a kind newer than what is read starts as it does today.
export const BEFORE = {
  // (The seasons, src/season.js: before them every tree was in full summer leaf.)
  'season.leaves': 1,
  'season.fresh': 0,
  // (One tree's ground: before it could stand on the hills, it stood on level ground.)
  'tree.ground': 'flat',
  // (The view's turn speed: before the slider, a turn in half a minute.)
  'view.turnSpeed': 12,
  // (The forest's rules, src/site.js: before there were any, a tree stood wherever a seed fell.)
  'forest.rules.ground': 0,
  'forest.rules.room': 0,
  'forest.rules.light': 0,
  // (The mix by cover, src/cover.js: before it, the mix was by count. The layers' cover had no say then, and has none by count.)
  'forest.mixBy': 'by count',
  'forest.layers.canopy': 70,
  'forest.layers.underwood': 40,
  // (The beech's layered dome, src/oak/broadleaves.js: before it, a cluster was drawn as wide as the light allowed it, and a limb's leaves kept to their limb.
  // Only a kind whose crown has a form that changes them needs a line: the other kinds start with both as they were. The holly and the
  // linden got theirs a version later, and theirs change the width only: a link in between says it itself, by its record.)
  'shapes.beech.clumpWide': 1,
  'shapes.beech.across': 0,
  'shapes.holly.clumpWide': 1,
  'shapes.linden.clumpWide': 1,
  // (The ash's tufts: before them its clusters were as wide as they grew, and every twig off a branch's side that had the light kept its leaves.
  // Every kind has that second setting, at 1: only the ash, which starts at 0, needs the line.)
  'shapes.ash.clumpWide': 1,
  'shapes.ash.sideLeaves': 1,
  // (The birch's hanging ends: before them its clusters were as wide as they grew and sat on their twigs. Every kind has "hang", at 0: only the birch needs the line.)
  'shapes.birch.clumpWide': 1,
  'shapes.birch.hang': 0,
  // (Crowns close in a wood, src/woodGrown.js: before, every forest tree grew as the Tree tab shows it, as if alone in the open.)
  'forest.closes': false,
};

// Whether something read from a file could be TreeLab's settings at all: it says so, or it has a group of them.
// (Any other JSON would otherwise load as "everything at its default".)
export const looksLikeSettings = (raw) => isObject(raw) && (raw.app === 'TreeLab' || ['tree', 'forest', 'shapes', 'light', 'view'].some((group) => Object.hasOwn(raw, group) && isObject(raw[group])));

// Only what differs from the defaults.
export function changes(settings, base = defaultSettings()) {
  const out = {};
  for (const [key, value] of Object.entries(settings)) {
    if (!(key in base)) continue;
    const b = base[key];
    if (isObject(value) && isObject(b)) {
      const inner = changes(value, b);
      if (Object.keys(inner).length) out[key] = inner;
    } else if (JSON.stringify(value) !== JSON.stringify(b)) {
      out[key] = value;
    }
  }
  return out;
}

// Settings as a file: everything, so it still means the same if the
// defaults change.
export function toFile(settings) {
  return `${JSON.stringify({ ...settings, app: 'TreeLab', version: SETTINGS_VERSION }, null, 2)}\n`;
}

// Settings in a link's #, as TreeLab wrote them up to 0.3.1 (#s=…): what
// differs from the defaults, as base64url JSON. Such links are still read
// (src/link.js: fromOldLink, against 0.3.1's own defaults); today's are
// shorter and written there too. (toLink is kept so the tests can make a
// link as it was.)
export function toLink(settings) {
  const json = JSON.stringify({ version: SETTINGS_VERSION, ...changes(settings) });
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// One settings object copied into another in place, keeping every nested
// object and array the same one, so the panel's sliders stay bound.
export function assign(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (!Object.hasOwn(target, key)) continue;
    if (isObject(value) && isObject(target[key])) assign(target[key], value);
    else if (Array.isArray(value) && Array.isArray(target[key])) target[key].splice(0, target[key].length, ...value);
    else target[key] = value;
  }
  return target;
}
