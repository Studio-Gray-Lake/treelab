import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MIST, createLightShafts, shifts } from '../src/lightShafts.js';
import { createSun } from '../src/sunShadow.js';

// The light shafts (src/lightShafts.js): drawn only when there's something
// to draw, and leaving the renderer as they found it. (The drawing itself is
// checked in the browser.)

// A renderer that notes what's asked of it.
function fakeRenderer() {
  const calls = [];
  const state = { target: null, autoClear: true };
  return {
    calls,
    shadowMap: { enabled: true, autoUpdate: true },
    toneMappingExposure: 1.5,
    get autoClear() { return state.autoClear; },
    set autoClear(v) { state.autoClear = v; },
    getDrawingBufferSize: (v) => v.set(800, 600),
    getRenderTarget: () => state.target,
    setRenderTarget: (t) => { state.target = t; calls.push(['target', t]); },
    clear: () => calls.push(['clear']),
    render: (scene) => calls.push(['render', scene]),
  };
}

function setUp() {
  const renderer = fakeRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 2500);
  const sun = createSun(0xffffff, 3);
  sun.castShadow = true;
  scene.add(sun, new THREE.Mesh(new THREE.BoxGeometry()));
  const shafts = createLightShafts({ renderer, scene, camera, sun });
  return { renderer, scene, camera, sun, shafts };
}

test('with the shafts off, the sun down, or no shadows yet, only the picture goes to the screen', () => {
  const { renderer, sun, shafts } = setUp();
  const picture = new THREE.Texture();
  const renders = () => renderer.calls.filter((c) => c[0] === 'render').length;
  shafts.set({ color: new THREE.Color(1, 1, 1), strength: 0, haze: 0.02 });
  shafts.render(picture);
  assert.equal(renders(), 1, 'more than the picture drawn while off');
  assert.equal(shafts.onto.airOn.value, 0);
  assert.equal(shafts.onto.picture.value, picture);
  assert.equal(shafts.onto.exposure.value, 1.5, 'not the camera\'s exposure');
  assert.equal(renderer.getRenderTarget(), null);
  shafts.set({ color: new THREE.Color(1, 1, 1), strength: 1, haze: 0.02 });
  shafts.render(picture);
  assert.equal(renders(), 2, 'shafts drawn before the sun has a shadow map');
  sun.shadow.map = { depthTexture: new THREE.DepthTexture(4, 4) };
  sun.intensity = 0;
  shafts.render(picture);
  assert.equal(renders(), 3, 'shafts drawn after sunset');
  assert.equal(shafts.onto.airOn.value, 0);
});

test('drawn: the depth, the air along each ray, its blend, then onto the picture and the screen, and the renderer left as it was', () => {
  const { renderer, scene, sun, shafts } = setUp();
  sun.shadow.map = { depthTexture: new THREE.DepthTexture(4, 4) };
  shafts.set({ color: new THREE.Color(1, 0.8, 0.6), strength: 1, haze: 0.02, mist: 0.3 });
  const line = new THREE.Line(new THREE.BufferGeometry());
  scene.add(line);
  const tree = scene.children.find((o) => o.isMesh);
  const own = tree.material;
  tree.customDepthMaterial = new THREE.MeshDepthMaterial();
  tree.customDepthMaterial.side = THREE.BackSide; // (as three.js leaves it, having drawn a shadow)
  let drawnAs = null, drawnSide = null;
  renderer.render = (s) => { renderer.calls.push(['render', s]); if (s === scene) { drawnAs = tree.material; drawnSide = tree.material.side; } };
  const picture = new THREE.Texture();
  shafts.render(picture);
  const renders = renderer.calls.filter((c) => c[0] === 'render');
  assert.equal(renders.length, 4);
  assert.equal(renders[0][1], scene, 'the depth first');
  // The last pass takes the picture (the scene as light), the mist's sky
  // light and the sun's, and puts it all on the screen at the camera's
  // exposure (the drawing is checked in the browser).
  assert.equal(shafts.onto.picture.value, picture);
  assert.equal(shafts.onto.airOn.value, 1);
  assert.equal(shafts.onto.exposure.value, 1.5);
  assert.deepEqual(shafts.onto.sunColor.value.toArray(), [1, 0.8, 0.6]);
  assert.equal(shafts.onto.strength.value, 1);
  assert.equal(drawnAs, tree.customDepthMaterial, 'the depth not drawn as the shadows are (the trees swaying)');
  assert.equal(drawnSide, own.side, 'the depth measured to the crowns\' far side');
  assert.equal(tree.material, own, 'a mesh left drawn as its shadow');
  assert.equal(renderer.getRenderTarget(), null, 'left drawing into a target');
  assert.equal(renderer.autoClear, true);
  assert.equal(renderer.shadowMap.autoUpdate, true, 'the shadows left switched off');
  assert.equal(scene.overrideMaterial, null);
  assert.equal(line.visible, true, 'a line left hidden');
  // Half the screen's size, the depth at its full size.
  assert.deepEqual([shafts.targets.air.width, shafts.targets.air.height], [400, 300]);
  assert.deepEqual([shafts.targets.depth.width, shafts.targets.depth.height], [800, 600]);
});

test('mist alone is drawn, even with the sun down; without the sun, no shafts', () => {
  const { renderer, sun, shafts } = setUp();
  sun.intensity = 0;
  shafts.set({ color: new THREE.Color(1, 1, 1), strength: 1, haze: 0.02, mist: 0.5 });
  shafts.render();
  const renders = renderer.calls.filter((c) => c[0] === 'render');
  assert.equal(renders.length, 4, 'the depth, the mist along each ray, its blend, and the mist over the picture');
  assert.ok(shafts.settings.mist > 0 && shafts.settings.mist < MIST, 'the setting is eased in');
  assert.equal(shafts.uniforms.sunOn.value, 0, 'the sun counted while down');
  assert.equal(shafts.uniforms.mist.value, shafts.settings.mist);
});

test('the mist is followed as far as the fog of the scene goes; the light in the haze only with the sun up', () => {
  const { scene, sun, shafts } = setUp();
  scene.fog = new THREE.Fog(0xffffff, 30, 420);
  sun.shadow.map = { depthTexture: new THREE.DepthTexture(4, 4) };
  shafts.set({ color: new THREE.Color(1, 1, 1), strength: 1, haze: 0.0005, mist: 0.5 });
  shafts.render();
  assert.equal(shafts.uniforms.reach.value, 420);
  // (How deep the shadow maps reach along the sun's way: for telling what
  // is far up it, the crowns, from what is near.)
  assert.ok(shafts.uniforms.sunDeep.value.x > 0 && shafts.uniforms.sunDeep.value.y > 0);
  assert.equal(shafts.uniforms.haze.value, 0.0005);
  assert.equal(shafts.uniforms.sunOn.value, 1);
  sun.intensity = 0;
  shafts.render();
  assert.equal(shafts.uniforms.haze.value, 0);
});

test('the mist lies on the ground it is given: the heights of the hills, or flat', () => {
  const { shafts } = setUp();
  const flat = shafts.uniforms.groundMap.value;
  assert.deepEqual([flat.image.width, flat.image.height, flat.image.data[0]], [1, 1, 0]);
  const hills = { half: 100, heightAt: (x, z) => 0.05 * x - 0.02 * z };
  shafts.setGround(hills);
  const map = shafts.uniforms.groundMap.value;
  const n = map.image.width;
  assert.ok(n >= 64 && map.image.height === n);
  assert.equal(shafts.uniforms.groundHalf.value, 100);
  // (A texel holds the height at its middle.)
  const at = (i, j) => THREE.DataUtils.fromHalfFloat(map.image.data[j * n + i]);
  const middle = (i) => -100 + ((i + 0.5) / n) * 200;
  for (const [i, j] of [[0, 0], [n - 1, 0], [5, n - 3], [n >> 1, n >> 1]]) {
    assert.ok(Math.abs(at(i, j) - hills.heightAt(middle(i), middle(j))) < 0.01, `the height at ${i}, ${j}`);
  }
  shafts.setGround(hills);
  assert.equal(shafts.uniforms.groundMap.value, map, 'the same ground worked out again');
  shafts.setGround(null);
  assert.equal(shafts.uniforms.groundMap.value.image.width, 1);
});

test('the mist drifts with the wind, the wisps faster than the banks, and is never quite still', () => {
  const still = shifts({ drift: new THREE.Vector3(), time: 0 });
  assert.deepEqual([still.bank.toArray(), still.wisp.toArray()], [[0, 0, 0], [0, 0, 0]]);
  // Carried 12 m along x: the noise is read 12 m back, as a share of its repeat.
  const a = shifts({ drift: new THREE.Vector3(12, 0, 0), time: 0 });
  const back = (v) => (v > 0.5 ? 1 - v : -v); // (shares of a repeat, read backward)
  assert.ok(back(a.bank.x) > 0 && a.bank.y === 0 && a.bank.z === 0);
  const bankRepeat = 12 / back(a.bank.x), wispRepeat = 18 / back(a.wisp.x);
  assert.ok(bankRepeat > 300 && bankRepeat < 1000, `the banks repeat every ${bankRepeat.toFixed(0)} m`);
  assert.ok(wispRepeat > 50 && wispRepeat < 200, `the wisps repeat every ${wispRepeat.toFixed(0)} m (carried half as far again)`);
  // Far downwind: still within the noise.
  const far = shifts({ drift: new THREE.Vector3(-7200, 0, 3100), time: 3600 });
  for (const v of [...far.bank.toArray(), ...far.wisp.toArray()]) assert.ok(v >= 0 && v < 1);
  // No wind: the banks stay; the wisps still move, and rise.
  const calm = shifts({ drift: new THREE.Vector3(), time: 60 });
  assert.deepEqual(calm.bank.toArray(), [0, 0, 0]);
  assert.ok(calm.wisp.x > 0 && calm.wisp.y > 0 && calm.wisp.z > 0);
});

test('in the depth, the ground stops rays from below too (a camera under a hill sees no endless shafts)', () => {
  const { renderer, scene, sun, shafts } = setUp();
  sun.shadow.map = { depthTexture: new THREE.DepthTexture(4, 4) };
  shafts.set({ color: new THREE.Color(1, 1, 1), strength: 1, haze: 0.02 });
  const ground = scene.children.find((o) => o.isMesh);
  let drawnAs = null;
  renderer.render = (s) => { renderer.calls.push(['render', s]); if (s === scene) drawnAs = ground.material; };
  shafts.render();
  assert.equal(drawnAs.side, THREE.DoubleSide);
  assert.equal(drawnAs.colorWrite, false);
});

test('the sunlit air is blended over frames: none of the old at first, most of it with the camera still or turning, little as it walks fast', () => {
  const { renderer, camera, sun, shafts } = setUp();
  sun.shadow.map = { depthTexture: new THREE.DepthTexture(4, 4) };
  shafts.set({ color: new THREE.Color(1, 1, 1), strength: 1, haze: 0.02 });
  camera.position.set(0, 2, 10);
  camera.updateMatrixWorld();
  shafts.render();
  assert.equal(shafts.settings.kept, 0, 'the first frame has nothing before it');
  shafts.render();
  assert.ok(shafts.settings.kept > 0.8, `kept ${shafts.settings.kept} with the camera still`);
  camera.position.x += 2;
  camera.updateMatrixWorld();
  shafts.render();
  assert.ok(shafts.settings.kept < 0.01, `kept ${shafts.settings.kept} with the camera 2 m on`);
  shafts.render();
  assert.ok(shafts.settings.kept > 0.8, 'still again');
  // Turning on the spot: each pixel finds its place in the frame before
  // (where the world lay on the picture then), so all of it is kept.
  const then = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
  camera.rotation.y += 0.3;
  camera.updateMatrixWorld();
  shafts.render();
  assert.ok(shafts.settings.kept > 0.8, `kept ${shafts.settings.kept} on turning`);
  // A walk: a little less.
  camera.position.x += 0.03;
  camera.updateMatrixWorld();
  const before = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
  shafts.render();
  assert.ok(shafts.settings.kept > 0.7 && shafts.settings.kept < 0.85, `kept ${shafts.settings.kept} at a walk`);
  assert.notDeepEqual(before.toArray(), then.toArray());
  // A new size (a screenshot): nothing kept from the old one.
  renderer.getDrawingBufferSize = (v) => v.set(1600, 1200);
  shafts.render();
  assert.equal(shafts.settings.kept, 0);
  assert.equal(renderer.getRenderTarget(), null);
});
