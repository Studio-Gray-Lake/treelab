import * as THREE from 'three';
import { createWind } from '@workshop/wind.js';
import { createWindView } from '@workshop/windView.js';
import { createTreeSway } from '@workshop/treeSway.js';
import { lightThrough } from './leafLight.js';
import { gapsIn } from './crownGaps.js';
import { underSky } from './skyShade.js';
import { underMist } from './mistLight.js';
import { underSunDisc } from './sunShadow.js';

// The workshop's wind (src/wind.js), its texture and debug view
// (src/windView.js) and its tree sway (src/treeSway.js), on whichever trees
// and ground TreeLab shows, with TreeLab's own clock in place of the walk's.
//
// The workshop's wind works out the ground's lee and the trees' canopy once
// and keeps them, so whenever the trees or the ground change, bind() makes
// a new wind, wind view and sway (the settings, the clock and "show wind"
// carry over). windView has no dispose, so the rig gives it its own group
// in the scene and its own rows in the panel, and takes back its V key.
//
//   wind: the wind's settings (DEFAULT_WIND's shape), shown in `folder`.
//   sway: { on, branch, flutter, timeScale }: the sway on or off, the limbs'
//   bob and the foliage's flutter as shares of the workshop's tuning, and
//   how fast TreeLab's clock runs.
export function createSwayRig({ scene, folder, wind: windSettings, sway: swaySettings }) {
  const clock = { time: 0, paused: false };
  let bound = null;

  // trees: the planted group (src/tree.js); terrain: { heightAt, normalAt,
  // mesh } (the mesh's material shows the wind's heat map); canopy: the
  // trees the wind should feel ([{ x, z, crown }], none for open wind).
  // warmUp: how far back the springs start, s (the workshop's 20 for a few
  // trees; shorter for a forest, so a replant doesn't step thousands of
  // springs through 20 s).
  function bind({ trees, terrain, canopy = [], warmUp = 20 }) {
    const show = bound?.windView.view.show ?? false;
    unbind();
    // Patched again by the new sway and wind view: thrown away so the
    // renderer compiles them afresh with the new uniforms.
    for (const material of Object.values(trees.userData.materials ?? {})) material.dispose();
    terrain.mesh.material.dispose();

    const holder = new THREE.Group();
    holder.name = 'wind view';
    scene.add(holder);
    const rows = [];
    const panel = { add: (...args) => { const c = folder.add(...args); rows.push(c); return c; } };
    const keys = [];
    const wind = createWind({ terrain, trees: canopy, settings: windSettings });
    const windView = listening(keys, () => createWindView({ scene: holder, wind, terrain, folder: panel }));
    windView.view.show = show;
    const sway = createTreeSway({ trees, wind, windView, walk: { sim: clock }, listen: false, warmUp });
    // (On top of the sway's patch: the sun through the leaves, src/leafLight.js.)
    const { leaves, needles } = trees.userData.materials ?? {};
    if (leaves) lightThrough(leaves, 1);
    if (needles) lightThrough(needles, 0.45);
    // (And on the shadows the sway gave the foliage: gaps, src/crownGaps.js.
    // Needles let half as much through.)
    for (const species of Object.values(trees.userData.species ?? {})) {
      for (const mesh of species.meshes) {
        if (mesh.material === leaves) gapsIn(mesh, 1);
        else if (mesh.material === needles) gapsIn(mesh, 0.5);
      }
    }
    // (And the sky's light on the trees and the ground under them, as much as
    // gets down to each place: src/skyShade.js.)
    // And the mist's: the sun on them dimmed as its beam is, and the light
    // the mist has scattered (src/mistLight.js).
    for (const material of [...Object.values(trees.userData.materials ?? {}), terrain.mesh.material]) {
      underSky(material);
      underMist(material);
      underSunDisc(material); // (and the sun's width in their shadows: src/sunShadow.js)
    }
    bound = { wind, windView, sway, holder, rows, keys };
    sync();
    return bound;
  }

  function unbind() {
    if (!bound) return;
    bound.sway.dispose();
    scene.remove(bound.holder);
    bound.holder.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    bound.windView.texture?.dispose(); // (the wind's own map: nothing else lets it go)
    for (const row of bound.rows) row.destroy();
    for (const [type, listener, options] of bound.keys) globalThis.window?.removeEventListener?.(type, listener, options);
    bound = null;
  }

  // The panel's sway settings into the sway (each frame: cheap).
  function sync() {
    const { sway } = bound;
    if (sway.settings.on !== swaySettings.on) sway.settings.on = swaySettings.on;
    sway.uniforms.treeBranch.value = swaySettings.branch;
    sway.uniforms.treeFlutter.value = swaySettings.flutter;
  }

  // Once a frame: the clock on (unless paused), the springs stepped, the
  // wind texture filled; the wind's arrows drawn round center ({ x, z }).
  function update(dt, center = { x: 0, z: 0 }) {
    if (!bound) return;
    sync();
    const step = clock.paused ? 0 : Math.min(dt, 0.1) * swaySettings.timeScale;
    if (step > 0) {
      clock.time += step;
      bound.sway.step(step, clock.time);
    }
    bound.windView.update(clock.time, center);
  }

  return {
    clock,
    bind,
    update,
    dispose: unbind,
    get wind() { return bound?.wind; },
    get windView() { return bound?.windView; },
    get sway() { return bound?.sway; },
  };
}

// make(), with the window listeners it adds noted in `keys` ([type,
// listener, options]) so they can be taken back.
function listening(keys, make) {
  const win = globalThis.window;
  if (!win) return make();
  const own = Object.hasOwn(win, 'addEventListener');
  const add = win.addEventListener;
  win.addEventListener = function (type, listener, options) {
    keys.push([type, listener, options]);
    return add.call(this, type, listener, options);
  };
  try {
    return make();
  } finally {
    if (own) win.addEventListener = add;
    else delete win.addEventListener;
  }
}
