import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { KINDS, growKind } from '../src/kinds.js';
import { shadeCrown } from '../src/crownShade.js';
import { leafLight, lightThrough } from '../src/leafLight.js';
import { RANGES, normalize } from '../src/settings.js';

// Crowns darker inside (src/crownShade.js) and the sun through the leaves
// (src/leafLight.js).

// Each vertex's colour after shading over its colour before.
function shaded(kind, seed = 7, variant = 0) {
  const tree = growKind(kind, seed, variant);
  const before = { foliage: tree.foliage.attributes.color.array.slice(), wood: tree.wood.attributes.color.array.slice() };
  shadeCrown(tree);
  const ratios = (g, was) => {
    const now = g.attributes.color.array, out = [];
    for (let i = 0; i < now.length; i += 3) out.push(now[i] / was[i]);
    return out;
  };
  return { tree, leaves: ratios(tree.foliage, before.foliage), wood: ratios(tree.wood, before.wood) };
}

test('every kind\'s crown is darker inside, and its most open leaves keep their colour', () => {
  for (const kind of KINDS) {
    const { leaves, wood } = shaded(kind);
    const open = leaves.filter((r) => r > 0.999).length / leaves.length;
    assert.ok(open >= 0.09, `${kind}: only ${(open * 100).toFixed(0)}% of the leaves left as they were`);
    assert.ok(leaves.every((r) => Number.isFinite(r) && r >= 0.42 - 1e-6 && r <= 1 + 1e-6), `${kind}: a leaf out of range`);
    assert.ok(Math.min(...leaves) < 0.7, `${kind}: no leaf much darker`);
    assert.ok(wood.every((r) => Number.isFinite(r) && r >= 0.65 - 1e-6 && r <= 1 + 1e-6), `${kind}: wood out of range`);
  }
});

test('an oak\'s leaves deep in its crown are darker than those on its outside', () => {
  const { tree, leaves } = shaded('oak');
  const pos = tree.foliage.attributes.position;
  const box = new THREE.Box3().setFromBufferAttribute(pos);
  const middle = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const inner = [], outer = [];
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).sub(middle).divide(size).multiplyScalar(2);
    const d = p.length(); // 0 in the middle, about 1 at the edge
    if (d < 0.45) inner.push(leaves[i]);
    else if (d > 0.85) outer.push(leaves[i]);
  }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(inner.length > 50 && outer.length > 50);
  // (Less so than when the crown was full of leaves to its middle: the
  // twigs deep inside are bare now, and let more light in.)
  assert.ok(mean(inner) < mean(outer) - 0.08, `inside ${mean(inner).toFixed(2)}, outside ${mean(outer).toFixed(2)}`);
});

test('the shading leaves the tree\'s shape alone and is the same every time', () => {
  const a = growKind('broadleaf', 7, 1), b = growKind('broadleaf', 7, 1);
  const shape = Array.from(a.foliage.attributes.position.array);
  shadeCrown(a);
  shadeCrown(b);
  assert.deepEqual(Array.from(a.foliage.attributes.position.array), shape);
  assert.deepEqual(Array.from(a.foliage.attributes.color.array), Array.from(b.foliage.attributes.color.array));
});

// A shader as three.js hands it over, with the parts the patches look for.
const fakeShader = () => ({
  uniforms: {},
  vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n#include <worldpos_vertex>\n}',
  fragmentShader: '#include <common>\n#include <shadowmap_pars_fragment>\nvoid main() {\n#include <lights_fragment_end>\n}',
});

test('the light through the leaves goes on top of the sway\'s patch, not in place of it', () => {
  const material = new THREE.MeshStandardMaterial();
  material.customProgramCacheKey = () => 'tree-leaves';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n// swayed');
  };
  lightThrough(material, 1);
  const shader = fakeShader();
  material.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /\/\/ swayed/, 'the sway\'s patch is gone');
  assert.match(shader.fragmentShader, /float leafOpen\(/, 'no look-up in the sun\'s shadow maps');
  assert.match(shader.fragmentShader, /reflectedLight\.directDiffuse \+=/);
  assert.ok(shader.fragmentShader.indexOf('float leafOpen(') > shader.fragmentShader.indexOf('<shadowmap_pars_fragment>'), 'looked up before three.js\'s shadow code is there');
  assert.equal(shader.uniforms.leafSun, leafLight.sun, 'the sun\'s direction isn\'t shared');
  assert.equal(shader.uniforms.leafGlow, leafLight.leafGlow);
  assert.notEqual(material.customProgramCacheKey(), 'tree-leaves', 'compiled as the sway alone');
  assert.match(material.customProgramCacheKey(), /^tree-leaves/);
});

test('needles pass on less light than leaves', () => {
  const strength = (s) => {
    const m = new THREE.MeshStandardMaterial();
    lightThrough(m, s);
    const shader = fakeShader();
    m.onBeforeCompile(shader);
    return Number(/leafGlow \* ([\d.]+)/.exec(shader.fragmentShader)[1]);
  };
  assert.ok(strength(0.45) < strength(1));
});

test('settings keep the light through the leaves in range', () => {
  assert.equal(normalize({ light: { glow: 9 } }).settings.light.glow, RANGES['light.glow'][1]);
  assert.equal(normalize({ light: { glow: -1 } }).settings.light.glow, RANGES['light.glow'][0]);
  assert.equal(normalize({}).settings.light.glow, 1);
});

test('the light through the leaves is looked up the same way for every pixel: no dots', () => {
  // (three.js's own soft look-up turns its five looks a different way for
  // each pixel. Over the wide radius the glow uses, that showed as dots all
  // over the glowing leaves.)
  const material = new THREE.MeshStandardMaterial();
  lightThrough(material, 1);
  const shader = fakeShader();
  material.onBeforeCompile(shader);
  const from = shader.fragmentShader.indexOf('float leafOpen(');
  const lookUp = shader.fragmentShader.slice(from, shader.fragmentShader.indexOf('#endif', from));
  assert.ok(!/getShadow\(|interleavedGradientNoise|gl_FragCoord/.test(lookUp), 'the look-up differs from pixel to pixel');
  assert.equal(lookUp.split('texture( sunShadowMap[ 0 ]').length - 1, 9, 'nine looks at the shadow map');
  assert.match(lookUp, /return 1\.0;/, 'off the shadow map counts as open');
});
