import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TREE_SHAPES } from '@workshop/treeShapes.js';
import { createPlanter } from '../src/tree.js';
import { createTerrain } from '../src/terrain.js';
import { placeForest } from '../src/forest.js';
import { defaultSettings } from '../src/settings.js';
import { exportModel } from '../src/exportModel.js';

// three.js's exporter assembles a .glb with the browser's FileReader; Node
// has Blob but no FileReader.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

// A .glb's JSON chunk.
function gltf(buffer) {
  const view = new DataView(buffer);
  assert.equal(view.getUint32(0, true), 0x46546c67, 'not a .glb');
  const length = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length)));
}

function forest() {
  const settings = defaultSettings();
  settings.forest.radius = 15;
  const terrain = createTerrain(settings.terrain);
  const trees = new THREE.Group();
  const { records } = placeForest(settings.forest, terrain);
  createPlanter().plant(trees, records.map((r) => ({ ...r, seed: 7 })), TREE_SHAPES);
  return { settings, terrain, trees, records };
}

test('instanced: each grown tree drawn once a tree, the settings and licence inside', async () => {
  const { settings, trees, records } = forest();
  const { buffer, triangles } = await exportModel({ trees, instancing: true, settings, link: 'https://example.test/#s=x' });
  const json = gltf(buffer);
  assert.deepEqual(json.extensionsUsed, ['EXT_mesh_gpu_instancing']);
  const counts = json.nodes.filter((n) => n.extensions?.EXT_mesh_gpu_instancing).map((n) => json.accessors[n.extensions.EXT_mesh_gpu_instancing.attributes.TRANSLATION].count);
  // Each tree once in a wood mesh, once in a foliage mesh.
  assert.equal(counts.reduce((a, b) => a + b, 0), records.length * 2);
  assert.match(json.asset.copyright, /CC0/);
  const extras = json.nodes.find((n) => n.extras?.treelab)?.extras.treelab ?? json.scenes[0].extras?.treelab;
  assert.equal(extras.link, 'https://example.test/#s=x');
  assert.equal(extras.settings.forest.radius, 15);
  assert.ok(triangles > records.length * 300);
});

test('a node a tree: no extension needed, the grown trees\' meshes shared', async () => {
  const { trees, records } = forest();
  const json = gltf((await exportModel({ trees, instancing: false })).buffer);
  assert.equal(json.extensionsUsed, undefined);
  const treeNodes = json.nodes.filter((n) => n.children?.length === 2);
  assert.equal(treeNodes.length, records.length);
  const species = Object.values(trees.userData.species);
  const grown = species.reduce((n, s) => n + s.variants.length, 0);
  assert.ok(json.meshes.length <= grown * 5, `${json.meshes.length} meshes for ${grown} grown trees`);
});

test('flat-shaded, coloured, and nothing of the sway in the file', async () => {
  const { trees } = forest();
  const json = gltf((await exportModel({ trees })).buffer);
  for (const mesh of json.meshes) {
    const attributes = Object.keys(mesh.primitives[0].attributes).sort();
    assert.deepEqual(attributes, ['COLOR_0', 'NORMAL', 'POSITION'], mesh.name);
    assert.equal(mesh.primitives[0].indices, undefined, 'shared corners would smooth the facets');
  }
  const foliage = json.materials.filter((m) => m.name === 'leaves' || m.name === 'needles');
  assert.ok(foliage.length > 0);
});

test('the ground comes cut to the forest', async () => {
  const { trees, terrain } = forest();
  const whole = gltf((await exportModel({ trees, ground: terrain.mesh })).buffer);
  const cut = gltf((await exportModel({ trees, ground: terrain.mesh, groundHalf: 25 })).buffer);
  // (The exporter names nodes, not meshes.)
  const position = (json) => json.accessors[json.meshes[json.nodes.find((n) => n.name === 'ground').mesh].primitives[0].attributes.POSITION];
  assert.ok(position(cut).count < position(whole).count / 10, `${position(cut).count} of ${position(whole).count}`);
  const { min, max } = position(cut);
  assert.ok(max[0] <= 27 && min[0] >= -27);
});

test('each tree\'s colour goes into the file, at most 8 a grown tree', async () => {
  const { gather } = await import('../src/exportModel.js');
  const colors = Array.from({ length: 50 }, (_, i) => new THREE.Color().setHSL(i / 50, 0.6, 0.5));
  const { centres, of } = gather(colors, 8);
  assert.equal(centres.length, 8);
  assert.equal(of.length, 50);
  assert.ok(of.every((k) => k >= 0 && k < 8));
  const few = gather([new THREE.Color(1, 0, 0), new THREE.Color(1, 0, 0), new THREE.Color(0, 1, 0)], 8);
  assert.equal(few.centres.length, 2);
  assert.deepEqual(few.of, [0, 0, 1]);
});
