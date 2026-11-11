import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DROP, LOBE, MIST_GLSL, MIST_HEIGHT, PATTERN_GLSL, dropsPattern, mistLight, mistLit, onward, setMistLight, underMist } from '../src/mistLight.js';
import { skyShade, underSky } from '../src/skyShade.js';

// What the mist does with the sun's light (src/mistLight.js): the drops'
// pattern, the light turned aside more than once, and the light on things
// in the mist. (The drawing is checked in the browser.)

const cos = (degrees) => Math.cos(THREE.MathUtils.degToRad(degrees));

test('the drops\' pattern is the paper\'s, for drops 10 micrometres across: half in a sharp peak, the rest mostly forward', () => {
  assert.equal(DROP, 10);
  const p = dropsPattern();
  // (Jendersie and d'Eon's fit at 10 micrometres.)
  assert.ok(Math.abs(p.peak - 0.988) < 0.001 && Math.abs(p.lobe - 0.556) < 0.001 && Math.abs(p.fill - 22.0) < 0.05 && Math.abs(p.share - 0.482) < 0.001);
  assert.equal(LOBE, p.share);
  // All the light a drop catches goes somewhere: over every direction, 1.
  let sum = 0, forward = 0, within5 = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) {
    const c = -1 + (2 * (i + 0.5)) / N;
    const part = onward(c) * 2 * Math.PI * (2 / N);
    sum += part;
    forward += part * c;
    if (c > cos(5)) within5 += part;
  }
  assert.ok(Math.abs(sum - 1) < 0.002, `over every direction: ${sum}`);
  assert.ok(Math.abs(forward - 0.86) < 0.01, `on average ${forward.toFixed(3)} of the way forward`);
  assert.ok(within5 > 0.39 && within5 < 0.52, `${(within5 * 100).toFixed(0)}% within 5 degrees of straight on`);
  // Very bright toward the sun, faint from the side, a little back.
  assert.ok(onward(cos(5)) > 5 * onward(cos(20)) && onward(cos(20)) > 100 * onward(cos(90)));
  assert.ok(onward(cos(160)) > 3 * onward(cos(90)));
  // Bigger drops: a sharper peak.
  assert.ok(dropsPattern(20).peak > p.peak);
  // (The shader's copy carries the same numbers.)
  assert.match(PATTERN_GLSL, /float mistOnward\( float c \)/);
  assert.ok(PATTERN_GLSL.includes(p.peak.toFixed(5)) && PATTERN_GLSL.includes(p.lobe.toFixed(5)) && PATTERN_GLSL.includes(p.share.toFixed(5)));
});

test('no mist, or no sun: the beam undimmed, nothing turned aside', () => {
  for (const t of [mistLight({ density: 0, sunUp: 0.5 }), mistLight({ density: 0.02, sunUp: 0 }), mistLight({ density: 0.02, sunUp: -0.1 })]) {
    assert.ok(t.dims.every((v) => v === 1) && t.again.every((v) => v === 0) && t.down.every((v) => v === 0));
    assert.equal(t.heights[0], 0);
    assert.ok(t.heights.at(-1) >= 3 * MIST_HEIGHT);
  }
});

test('the beam loses the broad lobe\'s share of what the mist catches, more at a low sun and low in the mist', () => {
  const density = 0.04 * 0.85 ** 2, low = mistLight({ density, sunUp: Math.sin(THREE.MathUtils.degToRad(16)) }), high = mistLight({ density, sunUp: Math.sin(THREE.MathUtils.degToRad(60)) });
  // On the ground at 16 degrees: the way through the mist is 12 m / sin 16; the lobe's share of the mist dims it.
  const expected = Math.exp((-density * LOBE * MIST_HEIGHT) / Math.sin(THREE.MathUtils.degToRad(16)));
  assert.ok(Math.abs(low.dims[0] - expected) < 1e-9);
  assert.ok(low.dims[0] > 0.5 && low.dims[0] < 0.6, `${low.dims[0].toFixed(2)} of the beam reaches the ground in the misty wood`);
  assert.ok(high.dims[0] > low.dims[0]);
  for (let i = 1; i < low.dims.length; i++) assert.ok(low.dims[i] >= low.dims[i - 1], 'dimmer higher up');
  assert.ok(low.dims.at(-1) > 0.98);
});

test('light turned aside more than once: next to nothing in thin mist, growing faster than the mist does, never more than the sun gave', () => {
  const sunUp = 0.5;
  const thin = mistLight({ density: 0.0004, sunUp }), twice = mistLight({ density: 0.0008, sunUp }), thick = mistLight({ density: 0.04, sunUp }), fog = mistLight({ density: 0.4, sunUp });
  // Thin: what's turned twice goes as the mist's thickness (seen through
  // that much mist again: as its square).
  assert.ok(thin.again[0] > 0 && thin.again[0] < 0.002, `${thin.again[0]}`);
  const ratio = twice.again[0] / thin.again[0];
  assert.ok(ratio > 1.8 && ratio < 2.2, `twice the mist: ${ratio.toFixed(2)} times the light turned again`);
  assert.ok(thick.again[0] > 10 * thin.again[0]);
  // However thick: a bit of mist sends on no more than a white thing in
  // the same sun would (1 / pi a steradian).
  for (const t of [thin, thick, fog]) for (const v of t.again) assert.ok(v >= 0 && v < 1 / Math.PI, `${v}`);
  // And it reaches higher than the first metres: there's lit mist all round.
  assert.ok(thick.again[4] > 0.5 * thick.again[0]);
});

test('level ground in mist: the soft light from the mist makes up much of what the beam lost (the delta-Eddington answer)', () => {
  for (const [density, degrees] of [[0.04 * 0.85 ** 2, 16], [0.04, 62], [0.01, 36]]) {
    const sunUp = Math.sin(THREE.MathUtils.degToRad(degrees));
    const t = mistLight({ density, sunUp });
    const direct = sunUp * t.dims[0], open = sunUp, soft = t.down[0];
    assert.ok(soft > 0 && direct + soft < open, `${degrees} degrees: more light than with no mist`);
    assert.ok((direct + soft) / open > 0.8, `${degrees} degrees: ${(((direct + soft) / open) * 100).toFixed(0)}% of the open ground's light`);
    assert.ok(soft > 0.5 * (open - direct), `${degrees} degrees: the soft light makes up ${((soft / (open - direct)) * 100).toFixed(0)}% of what the beam lost`);
    // Less of it higher up, where there is less mist above.
    assert.ok(t.down.at(-1) < 0.2 * t.down[0]);
  }
});

test('the tables go to the shaders when the mist or the sun changes, and only then', () => {
  const version = () => mistLit.map.value.version;
  setMistLight({ density: 0.02, sunUp: 0.4 });
  const made = version();
  assert.equal(mistLit.thin.value, 0.02 * LOBE);
  assert.ok(Math.abs(mistLit.sunWay.value - MIST_HEIGHT / 0.4) < 1e-9);
  const data = mistLit.map.value.image.data;
  const expected = mistLight({ density: 0.02, sunUp: 0.4 });
  assert.ok(Math.abs(THREE.DataUtils.fromHalfFloat(data[0]) - expected.again[0]) < 1e-4 && Math.abs(THREE.DataUtils.fromHalfFloat(data[1]) - expected.down[0]) < 1e-3);
  setMistLight({ density: 0.02, sunUp: 0.4 });
  assert.equal(version(), made, 'worked out again for the same mist and sun');
  setMistLight({ density: 0.02, sunUp: 0.2 });
  assert.ok(version() > made);
  // (A sun on the horizon: its way through the mist is long, not endless.)
  setMistLight({ density: 0.02, sunUp: 0 });
  assert.equal(mistLit.sunWay.value, MIST_HEIGHT / 0.1);
});

test('a material takes the mist\'s light on top of the sky\'s: the sun dimmed last of all, the soft light with the sky\'s', () => {
  const material = new THREE.MeshStandardMaterial();
  material.customProgramCacheKey = () => 'sway';
  underSky(material);
  underMist(material);
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader, null);
  assert.equal(material.customProgramCacheKey(), 'sway|sky-shade|mist-light');
  assert.equal(shader.uniforms.mistLitMap, mistLit.map);
  assert.equal(shader.uniforms.mistSun, mistLit.sun);
  assert.equal(shader.uniforms.skyMap, skyShade.map);
  const f = shader.fragmentShader;
  assert.ok(f.includes(MIST_GLSL.trim().split('\n')[0].trim()));
  // The soft light: added to the light that isn't the sun's, after the sky's
  // share is taken, before three.js adds it up.
  const sky = f.indexOf('irradiance *= skyOpen'), soft = f.indexOf('irradiance += mistSun'), end = f.indexOf('#include <lights_fragment_end>');
  assert.ok(sky > 0 && sky < soft && soft < end);
  // The sun's dimming: after all of the sun's light is in, before it's put together.
  const dims = f.indexOf('reflectedLight.directDiffuse *= mistDims');
  assert.ok(dims > end && dims < f.indexOf('#include <aomap_fragment>'));
});
