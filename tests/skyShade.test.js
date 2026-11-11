import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RAYS, createSkyShade, lookDown, skyBox, skyShade, underSky } from '../src/skyShade.js';
import { crownGaps, gapUniforms } from '../src/crownGaps.js';
import { createPlanter } from '../src/tree.js';
import { placeForest } from '../src/forest.js';
import { RANGES, defaultSettings, normalize } from '../src/settings.js';

// The sky's light among the trees (src/skyShade.js): where the sky is looked
// at from, the box of cells over the trees, and the drawing's bookkeeping.
// (The drawing itself is checked in the browser.)

const group = () => ({ children: [], userData: {}, add(...m) { this.children.push(...m); }, remove() {} });
const flat = { heightAt: () => 0, slopeAt: () => 0, normalAt: (x, z, out) => out?.set(0, 1, 0), half: 150 };

function wood(radius = 30, density = 400) {
  const s = defaultSettings();
  Object.assign(s.forest, { radius, density });
  const { records } = placeForest(s.forest, flat);
  for (const r of records) r.seed = 7;
  const g = group();
  createPlanter().plant(g, records, s.shapes);
  return { g, records };
}

test('the sky is looked at from 26 places, all above the horizon, weighing 1 together; the lowest ring weighs least', () => {
  assert.equal(RAYS.length, 26);
  let sum = 0;
  for (const r of RAYS) {
    assert.ok(r.y > 0, 'a place under the horizon');
    assert.ok(Math.abs(Math.hypot(r.x, r.y, r.z) - 1) < 1e-9);
    sum += r.weight;
  }
  assert.ok(Math.abs(sum - 1) < 1e-9);
  const ring = (lo, hi) => RAYS.filter((r) => r.y > lo && r.y <= hi).reduce((s, r) => s + r.weight, 0);
  // (Level ground takes most from the middle of the sky: sin 2e.)
  assert.ok(ring(0, 0.3) < ring(0.3, 0.7) && ring(0.95, 1) < ring(0.7, 0.95));
  // For the air (the mist), which takes light from every way alike: each
  // band by what it covers of the sky, so the lowest counts for most.
  let air = 0;
  for (const r of RAYS) air += r.air;
  assert.ok(Math.abs(air - 1) < 1e-9);
  const ringOfAir = (lo, hi) => RAYS.filter((r) => r.y > lo && r.y <= hi).reduce((s, r) => s + r.air, 0);
  assert.ok(ringOfAir(0, 0.3) > ringOfAir(0.3, 0.7) && ringOfAir(0.3, 0.7) > ringOfAir(0.7, 0.95) && ringOfAir(0.7, 0.95) > ringOfAir(0.95, 1));
  assert.ok(ringOfAir(0, 0.3) > 2 * ring(0, 0.3), 'the low sky counts for no more in the air than on the ground');
  // No two from the same side: the rings are turned against each other.
  const sides = new Set(RAYS.map((r) => Math.round(Math.atan2(r.x, r.z) * 100)));
  assert.ok(sides.size >= 20);
});

test('the box takes in every crown, a margin round them and a cell over them, in cells it can afford', () => {
  const { g, records } = wood();
  const box = skyBox(g);
  const { min, n, cell } = box;
  const top = Math.max(...Object.values(g.userData.species).flatMap((s) => s.variants.map((v) => v.height * Math.max(...v.trees.map((t) => t.size)))));
  for (const t of records) {
    assert.ok(t.x - t.crown > min[0] + 6 && t.x + t.crown < min[0] + n[0] * cell - 6, 'a crown near the box\'s side');
    assert.ok(t.z - t.crown > min[2] + 6 && t.z + t.crown < min[2] + n[2] * cell - 6);
  }
  assert.ok(min[1] <= 0 && min[1] + (n[1] - 1) * cell >= top, 'no clear layer over the tallest tree');
  assert.ok(n[0] * n[1] * n[2] <= 400000 && n[1] <= 40, `${n.join(' x ')} cells`);
  assert.ok(cell >= 0.75 && cell < 2);
  assert.ok(box.edge > 2 && box.edge < 20);
  // A big forest: coarser cells, no more of them.
  const big = skyBox(wood(120, 100).g);
  assert.ok(big.cell > cell && big.n[0] * big.n[1] * big.n[2] <= 400000, `${big.n.join(' x ')} cells of ${big.cell.toFixed(2)} m`);
  assert.equal(skyBox(group()), null);
});

test('each look down at the box has all of it in view', () => {
  const box = skyBox(wood().g);
  for (const ray of RAYS) {
    const camera = lookDown(box, new THREE.Vector3(ray.x, ray.y, ray.z));
    const back = new THREE.Vector3(0, 0, 1).transformDirection(camera.matrixWorld);
    assert.ok(back.distanceTo(new THREE.Vector3(ray.x, ray.y, ray.z)) < 1e-6, 'not looking down the ray');
    for (let c = 0; c < 8; c++) {
      const p = new THREE.Vector3(box.min[0] + (c & 1) * box.n[0] * box.cell, box.min[1] + ((c >> 1) & 1) * box.n[1] * box.cell, box.min[2] + ((c >> 2) & 1) * box.n[2] * box.cell).project(camera);
      assert.ok(Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && Math.abs(p.z) <= 1, `a corner out of view: ${p.toArray().map((v) => v.toFixed(2))}`);
    }
  }
});

// A renderer that notes what's asked of it.
function fakeRenderer() {
  const calls = [];
  const state = { target: null, layer: 0 };
  return {
    calls,
    autoClear: true,
    shadowMap: { autoUpdate: true },
    getRenderTarget: () => state.target,
    setRenderTarget: (t, layer = 0) => { state.target = t; state.layer = layer; },
    render: (scene) => calls.push({ scene, target: state.target, layer: state.layer }),
  };
}

test('the map is drawn: the trees from each place in the sky, as their shadows are, then every layer; all left as it was', () => {
  const renderer = fakeRenderer();
  const shade = createSkyShade({ renderer });
  const { g } = wood(12, 300);
  // (As the sway leaves them: a depth material on each mesh.)
  for (const mesh of g.children) mesh.customDepthMaterial = new THREE.MeshDepthMaterial();
  const own = g.children.map((m) => m.material);
  crownGaps.share = 0.35;
  const drawnAs = [], gaps = [];
  const render = renderer.render;
  renderer.render = (scene, camera) => {
    render(scene, camera);
    if (scene === g) { drawnAs.push(g.children[0].material); gaps.push(gapUniforms.gapOn.value); }
  };
  const before = new THREE.WebGLRenderTarget(4, 4);
  renderer.setRenderTarget(before);
  const box = shade.update(g);

  const ofTrees = renderer.calls.filter((c) => c.scene === g);
  assert.equal(ofTrees.length, 26);
  assert.ok(ofTrees.every((c) => c.target.depthTexture), 'the trees not drawn into a depth map');
  assert.ok(drawnAs.every((m) => m === g.children[0].customDepthMaterial && m.side === THREE.DoubleSide), 'not drawn as their shadows');
  assert.ok(gaps.every((v) => v > 0), 'drawn without the crowns\' gaps');
  const layers = renderer.calls.filter((c) => c.scene !== g);
  assert.equal(layers.length, 26 * box.n[1]);
  assert.deepEqual([...new Set(layers.map((c) => c.layer))].sort((a, b) => a - b), Array.from({ length: box.n[1] }, (_, j) => j));
  assert.deepEqual([shade.target.width, shade.target.height, shade.target.depth], [box.n[0], box.n[2], box.n[1]], 'the map\'s layers run up');

  assert.deepEqual(g.children.map((m) => m.material), own, 'a mesh left drawn as its shadow');
  assert.equal(gapUniforms.gapOn.value, 0, 'the gaps left on');
  assert.equal(renderer.getRenderTarget(), before);
  assert.equal(renderer.autoClear, true);
  assert.equal(renderer.shadowMap.autoUpdate, true);

  // What the materials read.
  assert.equal(skyShade.map.value, shade.target.texture);
  assert.deepEqual(skyShade.min.value.toArray(), box.min);
  assert.ok(Math.abs(skyShade.span.value.x - box.n[0] * box.cell) < 1e-6 && Math.abs(skyShade.span.value.y - box.n[1] * box.cell) < 1e-6);
  assert.equal(skyShade.cell.value, box.cell);

  // No trees: open sky everywhere, nothing drawn.
  const drawn = renderer.calls.length;
  assert.equal(shade.update(group()), null);
  assert.equal(renderer.calls.length, drawn);
  assert.notEqual(skyShade.map.value, shade.target.texture);
  assert.equal(skyShade.map.value.image.data[0], 255);
});

test('a material takes the sky\'s light from the map, on top of what patched it before', () => {
  const material = new THREE.MeshStandardMaterial();
  let earlier = 0;
  material.customProgramCacheKey = () => 'sway';
  material.onBeforeCompile = (shader) => { earlier++; shader.uniforms.swayed = { value: 1 }; };
  underSky(material);
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader, null);
  assert.equal(earlier, 1);
  assert.ok(shader.uniforms.swayed && shader.uniforms.skyMap === skyShade.map && shader.uniforms.skyAmount === skyShade.amount);
  assert.equal(material.customProgramCacheKey(), 'sway|sky-shade');
  assert.match(shader.vertexShader, /varying vec3 vSkyAt;[\s\S]*#include <project_vertex>[\s\S]*vSkyAt = /);
  // (Before three.js adds up the light that isn't the sun's.)
  const f = shader.fragmentShader;
  assert.ok(f.indexOf('irradiance *= skyOpen') > 0 && f.indexOf('irradiance *= skyOpen') < f.indexOf('#include <lights_fragment_end>'));
  assert.ok(f.indexOf('radiance *= skyOpen') < f.indexOf('#include <lights_fragment_end>'));
});

test('settings keep the shade in range, all of it to start', () => {
  assert.equal(normalize({}).settings.light.shade, 1);
  assert.equal(normalize({ light: { shade: 3 } }).settings.light.shade, RANGES['light.shade'][1]);
  assert.equal(normalize({ light: { shade: -1 } }).settings.light.shade, RANGES['light.shade'][0]);
});
