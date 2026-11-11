import { KINDS } from './kinds.js';
import { presetShape } from './presets.js';
import { assign, changes, defaultSettings, normalize } from './settings.js';

// Whole starting points (the panel's first row, "start from"): every
// setting at once, as TreeLab's defaults with a few changed. A starting
// point is only settings: nothing in it that the sliders can't reach.
//
//   says:    what the note says when it's chosen;
//   changes: the settings it changes (as src/settings.js lays them out);
//   shapes:  the ready-made shape a kind starts from (src/presets.js).

const only = (kind) => Object.fromEntries(KINDS.map((k) => [k, { on: k === kind }]));

export const SCENES = {
  'one oak': {
    says: 'One oak in the evening sun, as TreeLab opens.',
    changes: {},
  },
  'mixed forest': {
    says: 'A mixed forest on its hills, in the evening sun.',
    changes: { tab: 'forest' },
  },
  // Tall oaks grown close (three quarters of the ground under a crown),
  // each carrying its leaves at the top and bare below, as trees grown
  // among others are (src/oak/crownLight.js), so the sun gets through
  // between the clusters of leaves; the sun 16° up an hour and a quarter
  // after sunrise; a mist you see some 100 m through. The light shafts are
  // as in life (1): they show because the view is toward a low sun,
  // against the wood's shade.
  'misty wood': {
    says: 'A wood of tall oaks early in the morning, mist on the ground.',
    changes: {
      tab: 'forest',
      forest: { radius: 60, density: 80, mix: only('oak') },
      terrain: { height: 2 },
      light: { hour: 6.75, mist: 0.85 },
      view: { stand: true, eyes: true },
    },
    shapes: { oak: 'forest-grown' },
  },
};

// A starting point's settings, whole.
export function sceneSettings(name) {
  const scene = SCENES[name];
  const raw = defaultSettings();
  if (!scene) return raw;
  assign(raw, scene.changes);
  for (const [kind, preset] of Object.entries(scene.shapes ?? {})) raw.shapes[kind] = presetShape(kind, preset);
  return normalize(raw).settings;
}

// Which starting point these settings are, if any ('custom' otherwise).
// How it's looked at doesn't count: the same trees in the same light, seen
// from above or from among them, on either tab. (Of two that differ only
// in the tab they open on, the one for the tab shown.)
const told = (settings) => {
  const { view, tab, ...rest } = changes(settings);
  return JSON.stringify(rest);
};
let known = null;
export function sceneOf(settings) {
  known ??= Object.keys(SCENES).map((name) => ({ name, tab: sceneSettings(name).tab, text: told(sceneSettings(name)) }));
  const text = told(settings);
  const same = known.filter((scene) => scene.text === text);
  return (same.find((scene) => scene.tab === settings.tab) ?? same[0])?.name ?? 'custom';
}
