import { FROZEN } from './frozen/index.js';
import { PRESETS, presetShape } from './presets.js';
import { SCENES, sceneSettings } from './scenes.js';
import { BEFORE, assign, changes, defaultSettings, normalize, older } from './settings.js';

// A share link: what the page's address carries after "#v=".
//
// A link names what the settings start from and lists only what differs
// from it, in plain text:
//
//   1-misty.wood~shapes.oak-ancient_height-14-18~light_hour-7.5_mist-.6
//
//   - Its parts are joined by "~". The first is the link's version
//     (LINK_VERSION), then, after a "-", the starting view the settings
//     start from (src/scenes.js; none: TreeLab's defaults). Each other part
//     is a group of settings by its path (light, forest.mix.oak,
//     shapes.oak). A kind's shape may name, after a "-", the ready-made
//     shape it starts from (src/presets.js).
//   - A setting follows its part as "_name-value": a number as it is (0.6
//     as .6), a [least, most] range as its two numbers joined by "-", a
//     switch as 1 or 0, a colour as its six digits, a choice by its name.
//     (The settings outside any group, the tab, follow the first part.)
//   - In a name, letters and digits are themselves; a space between two of
//     them is "."; anything else is ".." and its code, four digits in hex.
//
// So a link holds only letters, digits and - _ . ~ (nothing a chat, an
// email or markdown changes), and ends in a letter or a digit (a full stop
// or a tilde at the end of an address is often taken for punctuation).
//
// Of the defaults and every starting view, a link starts from whichever
// makes it shortest; a kind's shape likewise, of its ready-made ones.
//
// The older links (#s=…, base64 of JSON, made up to TreeLab 0.3.1) are
// still read, and always will be: fromOldLink.

// A link opens as it was made, always. It says only what differs from what
// it starts from (the defaults, a starting view, a ready-made shape), so
// what those were when it was made is kept: a record for each version of
// the links (src/frozen: scripts/freeze.mjs writes one, once, and it is
// never edited). A link of an older version is read against its version's
// record, not against today's defaults, views and shapes.
//
// Whenever anything a link can start from changes (a default, a view, a
// ready-made shape, one more of any of them), this number goes up and
// `npm run freeze` records the new one: tests/frozen.test.js fails until
// then. Version 0 stands for the older links (#s=…): the defaults of
// TreeLab 0.3.1, the last release to make them.
//
// What is kept is every setting. The code that grows a tree from its
// settings is not kept: where that changes, the same settings grow the
// tree as today's TreeLab grows it.
export const LINK_VERSION = 14;

// What this TreeLab's links start from: its defaults, each starting view
// (as what it changes of the defaults), each kind's ready-made shapes (as
// what each changes of the kind's own).
export function liveBases() {
  const defaults = defaultSettings();
  const scenes = Object.fromEntries(Object.keys(SCENES).map((name) => [name, changes(sceneSettings(name), defaults)]));
  const presets = Object.fromEntries(Object.keys(PRESETS).map((kind) => [kind, Object.fromEntries(Object.keys(PRESETS[kind]).map((name) => [name, changes(presetShape(kind, name), defaults.shapes[kind])]))]));
  return { defaults, scenes, presets };
}

// What a link of a version starts from: { defaults(), hasScene(name),
// scene(name), hasPreset(kind, name), preset(kind, name), record }. This
// version's: TreeLab as it is. An older one's: its record (`record`: its
// defaults as they were, or null for this version).
function basesOf(version, frozen, current) {
  const record = version === current ? null : frozen[version] ?? null;
  if (!record) {
    return {
      record: null,
      defaults: defaultSettings,
      hasScene: (name) => Object.hasOwn(SCENES, name),
      scene: sceneSettings,
      hasPreset: (kind, name) => Object.hasOwn(PRESETS, kind) && Object.hasOwn(PRESETS[kind], name),
      preset: presetShape,
    };
  }
  const defaults = () => structuredClone(record.defaults);
  return {
    record,
    defaults,
    hasScene: (name) => Object.hasOwn(record.scenes ?? {}, name),
    scene: (name) => merged(defaults(), record.scenes[name]),
    hasPreset: (kind, name) => Object.hasOwn(record.presets ?? {}, kind) && Object.hasOwn(record.presets[kind], name),
    preset: (kind, name) => ({ ...defaults().shapes[kind], ...structuredClone(record.presets[kind][name]) }),
  };
}
const merged = (target, source) => {
  assign(target, structuredClone(source));
  return target;
};
// What a link says laid over what it starts from, whether or not that had
// such a setting (normalize() then keeps what TreeLab knows).
// (A link is a stranger's text. Only what the target has of its own is gone
// into, and a name that would reach an object's own workings is left out:
// "__proto__" as a link's key would otherwise write onto every object.)
const REACHES_PAST = new Set(['__proto__', 'constructor', 'prototype']);
function laidOver(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (REACHES_PAST.has(key)) continue;
    if (isObject(value) && Object.hasOwn(target, key) && isObject(target[key])) laidOver(target[key], value);
    else target[key] = structuredClone(value);
  }
  return target;
}

// Settings read against an older record, brought to today's: what the
// record has no setting for is put to what it was in effect then (BEFORE),
// and normalize() does the rest (a setting TreeLab no longer has is left
// out; a kind of tree it has gained is added, off).
function fromRecord(raw, record, before) {
  for (const [path, value] of Object.entries(before)) {
    const names = path.split('.');
    let was = record.defaults;
    for (const name of names.slice(0, -1)) was = isObject(was) ? was[name] : undefined;
    // (A kind the record has no shape for didn't exist then: it starts as it does today.)
    if (names[0] === 'shapes' && !isObject(was)) continue;
    let node = raw;
    for (const name of names.slice(0, -1)) node = isObject(node[name]) ? node[name] : (node[name] = {});
    // (Unless the link itself says what it is: an older link made by a build that already had the setting.)
    if ((!isObject(was) || !Object.hasOwn(was, names.at(-1))) && !Object.hasOwn(node, names.at(-1))) node[names.at(-1)] = structuredClone(value);
  }
  return normalize(raw);
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const isPlain = (ch) => ch !== undefined && /[A-Za-z0-9]/.test(ch);

// --- Names ---------------------------------------------------------------------------------

const coded = (ch) => `..${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
// A name in a path: letters and digits only.
const pathName = (text) => text.replace(/[^A-Za-z0-9]/g, coded);
// A name as a value: a space (as ".") or a "-" between two letters or digits stays readable.
const valueName = (text) => text.replace(/[^A-Za-z0-9]/g, (ch, at) => (isPlain(text[at - 1]) && isPlain(text[at + 1]) && (ch === ' ' || ch === '-') ? (ch === ' ' ? '.' : '-') : coded(ch)));
const readName = (text) => text.replace(/\.\.([0-9a-f]{4})|\./g, (found, hex) => (hex ? String.fromCharCode(parseInt(hex, 16)) : ' '));
// A path's names ("forest.mix.oak").
const readPath = (text) => (text.match(/(?:[A-Za-z0-9]|\.\.[0-9a-f]{4})+/g) ?? []).map(readName);

// --- Values --------------------------------------------------------------------------------

// A number as JavaScript writes it (so it reads back the very same), without the 0 before its point.
const numberText = (n) => (Object.is(n, -0) ? '-0' : String(n)).replace(/^(-?)0\./, '$1.').replace('+', '');
const sameNumbers = (a, b) => Array.isArray(b) && a.length === b.length && a.every((n, i) => Object.is(n, b[i]));

// A value as a link writes it, or null if it's what it starts from (or nothing a link can say).
function valueText(value, from) {
  if (Array.isArray(value)) return !value.length || !value.every((n) => typeof n === 'number') || sameNumbers(value, from) ? null : value.map(numberText).join('-');
  if (typeof value === 'number') return Object.is(value, from) ? null : numberText(value);
  if (typeof value === 'boolean') return value === from ? null : value ? '1' : '0';
  if (typeof value === 'string') return value === from ? null : isColor(value) && isColor(from) ? value.slice(1) : valueName(value);
  return null;
}

// The numbers in "15-47" (or "-.5--.2", or "1e-7"), or null if it isn't numbers.
function readNumbers(text) {
  const number = /-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/y;
  const out = [];
  for (let at = 0; ;) {
    number.lastIndex = at;
    const found = number.exec(text);
    if (!found) return null;
    out.push(Number(found[0]));
    at = number.lastIndex;
    if (at === text.length) return out;
    if (text[at++] !== '-') return null;
  }
}

// What a link wrote, as the kind of value the setting holds (`was`). What
// can't be read that way is handed on as it is, for normalize() to leave at
// its default and say so.
function readValue(text, was) {
  const numbers = Array.isArray(was) || typeof was === 'number' ? readNumbers(text) : null;
  if (Array.isArray(was)) return numbers ?? text;
  if (typeof was === 'number') return numbers?.length === 1 ? numbers[0] : text;
  if (typeof was === 'boolean') return text === '1' ? true : text === '0' ? false : text;
  return isColor(was) && /^[0-9a-f]{6}$/i.test(text) ? `#${text}` : readName(text);
}

// --- Writing -------------------------------------------------------------------------------

// The parts of a link for one object of the settings against what it
// starts from: its own (`header`, then each setting in it that differs),
// then those of the objects inside it. Its own part is left out if nothing
// in it differs, unless `always`.
function parts(value, from, path, header, always = false) {
  const own = [];
  const inner = [];
  for (const [key, v] of Object.entries(value)) {
    if (!Object.hasOwn(from, key)) continue;
    const below = [...path, key];
    if (isObject(v) && isObject(from[key])) inner.push(...(path.length === 1 && path[0] === 'shapes' ? shapeParts(v, from[key], below) : parts(v, from[key], below, below.map(pathName).join('.'))));
    else {
      const text = valueText(v, from[key]);
      if (text !== null) own.push(`${pathName(key)}-${text}`);
    }
  }
  return [...(own.length || always ? [[header, ...own].join('_')] : []), ...inner];
}

// A kind's shape: against what it starts from, or against one of the kind's
// ready-made shapes, named: whichever is shortest.
function shapeParts(shape, from, path) {
  const header = path.map(pathName).join('.');
  let best = parts(shape, from, path, header);
  if (!best.length) return best;
  const length = (list) => list.join('~').length;
  for (const name of Object.keys(PRESETS[path[1]] ?? {})) {
    const named = parts(shape, presetShape(path[1], name), path, `${header}-${valueName(name)}`, true);
    if (length(named) < length(best)) best = named;
  }
  return best;
}

// What a link can start from: the defaults (no name), then every starting
// view. (Kept: they are the same each time.)
let starts = null;

// Settings as a link (what follows "#v=").
export function toShortLink(given) {
  const { settings } = normalize(given);
  starts ??= [[null, defaultSettings()], ...Object.keys(SCENES).map((name) => [name, sceneSettings(name)])];
  let best = null;
  for (const [view, from] of starts) {
    const link = parts(settings, from, [], view === null ? `${LINK_VERSION}` : `${LINK_VERSION}-${valueName(view)}`, true).join('~');
    if (best === null || link.length < best.length) best = link;
  }
  return best;
}

// --- Reading -------------------------------------------------------------------------------

// One "name-value" of a link put into the settings, if they have that
// setting (one they don't have is left out, as normalize() leaves it out).
function put(raw, path, entry) {
  const dash = entry.indexOf('-');
  if (dash < 1) throw new Error('not a setting');
  const names = [...path, ...readPath(entry.slice(0, dash))];
  let node = raw;
  for (const name of names.slice(0, -1)) {
    if (!isObject(node) || !Object.hasOwn(node, name)) return;
    node = node[name];
  }
  const last = names.at(-1);
  if (!isObject(node) || !Object.hasOwn(node, last) || isObject(node[last])) return;
  node[last] = readValue(entry.slice(dash + 1), node[last]);
}

// A link read: { settings, notes }, as normalize() gives them. It is read
// against what links of its version start from (basesOf): it opens as it
// was made. A link that can't be read, or that starts from a view its
// version didn't have, gives the defaults and says so.
// (frozen, current, before: the records, this version and what settings were before they were settings, for the tests to stand in for.)
export function fromShortLink(text, { frozen = FROZEN, current = LINK_VERSION, before = BEFORE } = {}) {
  try {
    const notes = [];
    const [head, ...groups] = String(text).split('~');
    const [first, ...rootEntries] = head.split('_');
    const [, version, view] = first.match(/^(\d+)(?:-(.+))?$/);
    if (Number(version) > current) notes.push('made by a newer TreeLab: it may not open as it was made');
    else if (Number(version) < current && !frozen[Number(version)]) notes.push('made by an older TreeLab whose record is missing: it may not open as it was made');
    const bases = basesOf(Number(version), frozen, current);
    if (view !== undefined && !bases.hasScene(readName(view))) {
      return { settings: defaultSettings(), notes: ['the link starts from a view this TreeLab doesn\'t have: everything is at its default'] };
    }
    const raw = view === undefined ? bases.defaults() : bases.scene(readName(view));
    for (const entry of rootEntries) put(raw, [], entry);
    for (const group of groups) {
      const [header, ...entries] = group.split('_');
      const dash = header.indexOf('-');
      const path = readPath(dash < 0 ? header : header.slice(0, dash));
      if (!path.length) throw new Error('not a group');
      if (dash >= 0) {
        // (Starting from a ready-made shape: only a kind's shape can.)
        const [shapes, kind] = path;
        const name = readName(header.slice(dash + 1));
        const known = path.length === 2 && shapes === 'shapes' && Object.hasOwn(raw.shapes, kind) && bases.hasPreset(kind, name);
        if (!known) {
          notes.push('a kind\'s shape starts from a ready-made shape this TreeLab doesn\'t have: left as it was');
          continue;
        }
        raw.shapes[kind] = bases.preset(kind, name);
      }
      for (const entry of entries) put(raw, path, entry);
    }
    const read = bases.record ? fromRecord(raw, bases.record, before) : normalize(raw);
    return { settings: read.settings, notes: [...notes, ...read.notes] };
  } catch {
    return { settings: defaultSettings(), notes: ['the link is damaged: everything is at its default'] };
  }
}

// An older link read (#s=…: base64 of JSON, only what differed from the
// defaults, made up to TreeLab 0.3.1): against the defaults as 0.3.1 had
// them (the record of version 0), so it opens as 0.3.1 opened it. (Builds
// between 0.3.1 and the short links made such links too, with settings
// 0.3.1 hadn't: what such a link says of them is kept; what it leaves
// unsaid of them is today's.)
export function fromOldLink(text, { frozen = FROZEN, before = BEFORE } = {}) {
  try {
    const given = JSON.parse(atob(String(text).replace(/-/g, '+').replace(/_/g, '/')));
    if (!isObject(given)) throw new Error('not settings');
    const record = frozen[0];
    if (!record) return normalize(given);
    const { app, version, ...rest } = given;
    // (What the link says, first put the way settings are kept now: what that makes of what it leaves unsaid
    // depends on the link alone, not on the record under it.)
    const notes = [];
    const read = fromRecord(laidOver(structuredClone(record.defaults), older(rest, notes)), record, before);
    return { settings: read.settings, notes: [...notes, ...read.notes] };
  } catch {
    return { settings: defaultSettings(), notes: ['the link is damaged: everything is at its default'] };
  }
}
