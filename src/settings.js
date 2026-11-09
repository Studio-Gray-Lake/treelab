import { TREE_KINDS, TREE_SHAPES } from '@workshop/treeShapes.js';
import { DEFAULT_WIND } from '@workshop/wind.js';
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

// The most trees a forest may hold (the sliders can't reach it: 3,000 a
// hectare on an 80 m square is 1,920).
export const MAX_TREES = 4000;

// The workshop's mix (src/trees.js TREE_MIX), in percent.
const MIX = { fir: 45, pine: 20, broadleaf: 35 };

export function defaultSettings() {
  return {
    app: 'TreeLab',
    version: SETTINGS_VERSION,
    tab: 'tree',
    tree: { kind: 'broadleaf', seed: 7, variant: 0, tint: 0.5, show: 'one tree', rows: 2, cols: 4, vary: 'variants', gap: 1, labels: true },
    shapes: structuredClone(TREE_SHAPES),
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
      mix: Object.fromEntries(TREE_KINDS.map((kind) => [kind, { on: true, share: MIX[kind] ?? 30 }])),
      grouping: 'mixed',
      standSize: 25,
      variants: 6,
      size: [0.75, 1.35],
      maxSlope: 30,
    },
    terrain: { seed: 3, height: 6, size: 35, roughness: 0.45 },
    // Each kind's foliage greens (a tree's tint picks between them), and autumn.
    colors: Object.fromEntries(TREE_KINDS.map((kind) => [kind, { dark: hex(GREENS[kind][0]), light: hex(GREENS[kind][1]) }])),
    autumn: { amount: 0, palette: 'mixed', spread: 0.5, evergreens: false },
    sway: { on: true, branch: 1, flutter: 0, timeScale: 1 },
    wind: { ...DEFAULT_WIND },
    view: { wireframe: false, grid: true, person: true, spin: false },
  };
}

// The choices for each setting that is one of a list.
export const CHOICES = {
  tab: ['tree', 'forest'],
  'tree.kind': TREE_KINDS,
  'tree.show': ['one tree', 'grid'],
  'tree.vary': ['variants', 'seeds', 'kinds by row'],
  'forest.area': ['circle', 'square'],
  'forest.pattern': ['even spacing', 'random', 'jittered grid', 'clumps', 'rows'],
  'forest.grouping': ['mixed', 'in stands'],
  'autumn.palette': ['mixed', 'maple', 'birch', 'oak'],
};

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

// Each number's slider: [least, most, step]. The wind's are windView.js's.
export const RANGES = {
  'tree.seed': [1, 999, 1],
  'tree.variant': [0, 99, 1],
  'tree.tint': [0, 1, 0.01],
  'tree.rows': [1, 8, 1],
  'tree.cols': [1, 8, 1],
  'tree.gap': [0, 6, 0.1],
  'forest.seed': [1, 999, 1],
  'forest.radius': [5, 40, 1],
  'forest.density': [50, 3000, 10],
  'forest.jitter': [0, 1, 0.05],
  'forest.clumpTrees': [2, 30, 1],
  'forest.clumpSpread': [1, 15, 0.5],
  'forest.rowAngle': [0, 175, 5],
  'forest.patchSize': [5, 60, 1],
  'forest.cover': [0.1, 1, 0.05],
  'forest.mix.share': [0, 100, 1],
  'forest.standSize': [8, 60, 1],
  'forest.variants': [1, 12, 1],
  'forest.size': [0.5, 1.6, 0.05],
  'forest.maxSlope': [5, 60, 1],
  'terrain.seed': [1, 999, 1],
  'terrain.height': [0, 20, 0.5],
  'terrain.size': [10, 80, 1],
  'terrain.roughness': [0, 0.8, 0.05],
  'autumn.amount': [0, 1, 0.01],
  'autumn.spread': [0, 1, 0.01],
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
  if (shape) return TREE_SHAPES[shape[1]]?.[shape[2]] === undefined ? null : limitsFor(shape[2], TREE_SHAPES[shape[1]][shape[2]]);
  if (/^forest\.mix\.\w+\.share$/.test(path)) return RANGES['forest.mix.share'];
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
  merge(settings, raw, '', notes);
  return { settings, notes };
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

// Only what differs from the defaults (for short share links).
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

// Settings in a link's #: what differs from the defaults, as base64url JSON.
export function toLink(settings) {
  const json = JSON.stringify({ version: SETTINGS_VERSION, ...changes(settings) });
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromLink(text) {
  try {
    const json = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return normalize(JSON.parse(json));
  } catch {
    return { settings: defaultSettings(), notes: ['the link is damaged: everything is at its default'] };
  }
}

// One settings object copied into another in place, keeping every nested
// object and array the same one, so the panel's sliders stay bound.
export function assign(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (!(key in target)) continue;
    if (isObject(value) && isObject(target[key])) assign(target[key], value);
    else if (Array.isArray(value) && Array.isArray(target[key])) target[key].splice(0, target[key].length, ...value);
    else target[key] = value;
  }
  return target;
}
