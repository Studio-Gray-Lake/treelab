import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TREE_KINDS, TREE_SHAPES } from '@workshop/treeShapes.js';
import { DEFAULT_WIND } from '@workshop/wind.js';
import { createPlanter } from '../src/tree.js';
import { createSwayRig } from '../src/swayRig.js';
import { createTerrain } from '../src/terrain.js';
import { placeForest } from '../src/forest.js';
import { defaultSettings } from '../src/settings.js';

// These checks guard what TreeLab relies on from the workshop's wind
// (wind.js, windView.js) and tree sway (treeSway.js): if one of them
// changes how it's set up, these fail before the page breaks.

// windView listens for its V key on the window; the tests have none.
const listeners = new Set();
globalThis.window ??= {
  addEventListener(type, fn) { listeners.add(fn); },
  removeEventListener(type, fn) { listeners.delete(fn); },
};

// A lil-gui folder, as far as windView uses one; it counts its rows.
function folder() {
  const rows = new Set();
  return {
    rows,
    add() {
      const row = { name: () => row, listen: () => row, onChange: () => row, destroy: () => rows.delete(row) };
      rows.add(row);
      return row;
    },
  };
}

const flat = () => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial());
  return { heightAt: () => 0, normalAt: (x, z, out = new THREE.Vector3()) => out.set(0, 1, 0), mesh };
};

// A tree planted in a scene, with the rig on it, in a steady wind: no gusts
// and no swirl, blowing from +x (90°), so toward -x.
function stage(kind, wind = {}) {
  const scene = new THREE.Scene();
  const terrain = flat();
  const trees = new THREE.Group();
  scene.add(terrain.mesh, trees);
  const planter = createPlanter();
  const plant = (record) => planter.plant(trees, [{ x: 0, y: 0, z: 0, size: 1, turn: 0, tint: 0.5, seed: 7, variant: 0, ...record }], TREE_SHAPES);
  plant({ kind });
  const settings = { wind: { ...DEFAULT_WIND, gust: 0, turbulence: 0, from: 90, speed: 6, ...wind }, sway: { on: true, branch: 1, flutter: 0, timeScale: 1 } };
  const panel = folder();
  const rig = createSwayRig({ scene, folder: panel, ...settings });
  rig.bind({ trees, terrain });
  return { scene, trees, terrain, rig, settings, panel, plant };
}

// The bend at the tree's top the sway last wrote (x, z, m, in the tree's own
// frame: the same as the world's for a tree unturned and of size 1).
const bendOf = (trees) => {
  const sway = trees.children[0].geometry.attributes.sway;
  return [sway.getX(0), sway.getY(0)];
};

const run = (rig, seconds) => {
  for (let i = 0; i < seconds * 60; i++) rig.update(1 / 60);
};

test('every kind bends downwind in a steady wind', () => {
  for (const kind of TREE_KINDS) {
    const { trees, rig } = stage(kind);
    run(rig, 5);
    const [x, z] = bendOf(trees);
    assert.ok(x < -0.05, `${kind}: bent ${x.toFixed(3)} m along x, not downwind`);
    assert.ok(Math.abs(z) < Math.abs(x) * 0.1, `${kind}: bent ${z.toFixed(3)} m across the wind`);
  }
});

test('a stronger wind bends a tree further', () => {
  const soft = stage('broadleaf', { speed: 3 });
  const hard = stage('broadleaf', { speed: 7 });
  run(soft.rig, 5);
  run(hard.rig, 5);
  assert.ok(bendOf(hard.trees)[0] < bendOf(soft.trees)[0] * 2, `${bendOf(hard.trees)[0]} vs ${bendOf(soft.trees)[0]}`);
});

test('no wind, no bend', () => {
  const { trees, rig } = stage('fir', { on: false });
  run(rig, 3);
  assert.deepEqual(bendOf(trees), [0, 0]);
});

test('sway off stands the tree straight, and pausing stops the clock', () => {
  const { trees, rig, settings } = stage('pine');
  run(rig, 2);
  settings.sway.on = false;
  run(rig, 0.1);
  assert.deepEqual(bendOf(trees), [0, 0]);
  settings.sway.on = true;
  rig.clock.paused = true;
  const t = rig.clock.time;
  run(rig, 1);
  assert.equal(rig.clock.time, t);
});

test('a replanted tree takes the sway again: both meshes, its shadow too', () => {
  const { trees, terrain, rig, plant } = stage('broadleaf');
  run(rig, 1);
  plant({ kind: 'fir', seed: 8, variant: 1 });
  rig.bind({ trees, terrain });
  run(rig, 3);
  for (const mesh of trees.children) {
    assert.ok(mesh.geometry.attributes.sway, `${mesh.material.type}: no sway attribute`);
    assert.ok(mesh.geometry.attributes.branch, 'no branch attribute from treeShapes.js');
    assert.ok(mesh.customDepthMaterial, 'its shadow would not bend');
    assert.equal(typeof mesh.material.onBeforeCompile, 'function');
  }
  assert.ok(bendOf(trees)[0] < -0.05);
});

test('binding again leaves nothing of the last wind behind', () => {
  const { scene, trees, terrain, rig, panel } = stage('broadleaf');
  const rows = panel.rows.size;
  const children = scene.children.length;
  const keys = listeners.size;
  const before = rig.wind;
  let released = 0;
  rig.windView.texture.addEventListener('dispose', () => released++);
  for (let i = 0; i < 3; i++) rig.bind({ trees, terrain });
  assert.notEqual(rig.wind, before);
  assert.equal(released, 1, 'the map of the last wind was never let go');
  assert.equal(panel.rows.size, rows, 'the wind panel grew rows');
  assert.equal(scene.children.length, children, 'old wind views stayed in the scene');
  assert.equal(listeners.size, keys, 'old V-key listeners stayed');
});

test('"show wind" and the clock carry over a new binding', () => {
  const { trees, terrain, rig } = stage('broadleaf');
  run(rig, 1);
  rig.windView.view.show = true;
  const t = rig.clock.time;
  rig.bind({ trees, terrain });
  assert.equal(rig.windView.view.show, true);
  assert.equal(rig.clock.time, t);
});

test('the wind texture is filled while the tree shows', () => {
  const { rig } = stage('broadleaf');
  run(rig, 1);
  const { windMap, windTime } = rig.windView.uniforms;
  assert.ok(windMap.value.image.data.some((v) => v !== 0), 'the wind texture is empty');
  assert.equal(windTime.value, rig.clock.time);
});

test('a forest sways, quickly enough, and is calmer inside', () => {
  const settings = defaultSettings();
  settings.terrain.height = 0; // (flat: no lee from the hills)
  const terrain = createTerrain(settings.terrain);
  const scene = new THREE.Scene();
  const trees = new THREE.Group();
  scene.add(terrain.mesh, trees);
  const { records } = placeForest(settings.forest, terrain);
  createPlanter().plant(trees, records.map((r) => ({ ...r, seed: 7 })), TREE_SHAPES);
  const rig = createSwayRig({ scene, folder: folder(), wind: { ...DEFAULT_WIND, gust: 0, turbulence: 0, speed: 6 }, sway: settings.sway });
  const start = performance.now();
  rig.bind({ trees, terrain, canopy: trees.userData.trees, warmUp: Math.min(20, 4000 / records.length) });
  const bindMs = performance.now() - start;
  assert.ok(bindMs < 3000, `binding ${records.length} trees took ${bindMs.toFixed(0)} ms`);
  const t0 = performance.now();
  run(rig, 1);
  const frameMs = (performance.now() - t0) / 60;
  assert.ok(frameMs < 20, `a frame of ${records.length} springs took ${frameMs.toFixed(1)} ms`);
  // The mean wind 3 m up, under the crowns and out in the open round them.
  const mean = (inside) => {
    let sum = 0, n = 0;
    for (let x = -39; x <= 39; x += 2) {
      for (let z = -39; z <= 39; z += 2) {
        const r = Math.hypot(x, z);
        if (inside ? r > 25 : r < 33) continue;
        sum += Math.hypot(...rig.wind.windAbove(rig.clock.time, x, z, 3, [0, 0, 0]));
        n++;
      }
    }
    return sum / n;
  };
  assert.ok(mean(true) < mean(false) * 0.95, `under the crowns ${mean(true).toFixed(2)} m/s, in the open ${mean(false).toFixed(2)} m/s`);
});
