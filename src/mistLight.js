import * as THREE from 'three';

// What the mist does with the sun's light, beyond showing it once.
//
// A drop of mist (water, about 10 micrometres across) throws the light it
// catches in two ways: about half in a sharp peak, within a degree or two
// of straight on, and the rest in a broad lobe, still mostly forward
// (Jendersie and d'Eon, 2023, "An approximate Mie scattering function for
// fog and cloud rendering": a fit to the exact theory). The sharp peak
// leaves the light in the sun's beam, to all purposes; the broad lobe is
// what turns it aside. So, of what the mist catches:
//
// - the beam loses the broad lobe's share only (LOBE of it), on its way
//   down through the mist: dimmer at a low sun, when the way is long;
// - light turned aside once is seen as shafts and glow (src/lightShafts.js
//   adds it up along each ray, with the drops' pattern: brightest by far
//   looking toward the sun);
// - and light turned aside again and again fills the mist from every side,
//   which is why sunlit mist seen from the side or with the sun behind is
//   white, not dark. That part is worked out here, by height above the
//   ground, as Hillaire (2020, "A scalable and production ready sky and
//   atmosphere rendering technique") does for the sky: the light that has
//   been turned aside twice, in every direction alike, and then all the
//   further turns as a share of it (each turn passes on the share of light
//   that doesn't leave the mist). In thin mist it comes to almost nothing,
//   as it should (little is caught once, far less twice).
//
// The mist is taken as it lies on average (thinning with height, no banks),
// the ground as dark, and the sun as unshaded. Under the trees the light
// from all sides is cut as the sky's is (src/skyShade.js): it comes from the
// mist round about and over the crowns, as the sky's light does.
//
// And on the things in the mist: the sun on them is dimmed as the beam is,
// and the light the mist has scattered falls on them from above, in its
// place. Level ground in a thick morning mist keeps most of its light, but
// soft: the sun's patches are dimmer, the shade lighter.

export const DROP = 10;        // micrometres: a drop of mist, across
export const MIST_HEIGHT = 12; // m: each this much higher above the ground, the mist is a third as thick
const TOP = 4 * MIST_HEIGHT;   // m: the tables reach this high (little mist above)
const HEIGHTS = 16;            // the tables' entries, from the ground up
const WAYS = 24, ALONG = 24;   // the ways looked from a place, and the steps along each

// The drops' pattern (Jendersie and d'Eon's fit, for drops 5 to 50
// micrometres across): { peak, lobe: Henyey-Greenstein's g of the sharp peak
// and of the broad lobe; fill: how far the lobe is filled out fore and aft;
// share: the lobe's share of the light }.
export function dropsPattern(d = DROP) {
  return {
    peak: Math.exp(-0.0990567 / (d - 1.67154)),
    lobe: Math.exp(-2.20679 / (d + 3.91029) - 0.428934),
    fill: Math.exp(3.62489 - 8.29288 / (d + 5.52825)),
    share: Math.exp(-0.599085 / (d - 0.641583) - 0.665888),
  };
}
const PATTERN = dropsPattern();
export const LOBE = PATTERN.share; // the share of what a drop catches that it turns aside (the rest stays in the beam)

// How much of the light a drop catches goes on at an angle whose cosine is
// c (per steradian; over every direction it comes to 1).
const hg = (g, c) => (1 - g * g) / Math.pow(1 + g * g - 2 * g * c, 1.5) / (4 * Math.PI);
export function onward(c, pattern = PATTERN) {
  const { peak, lobe, fill, share } = pattern;
  return (1 - share) * hg(peak, c) + share * hg(lobe, c) * (1 + fill * c * c) / (1 + fill * (1 + 2 * lobe * lobe) / 3);
}

// The same in GLSL, as `float mistOnward( float c )` (needs onward( g, c ):
// Henyey-Greenstein's, src/lightShafts.js).
export const PATTERN_GLSL = /* glsl */ `
  float mistOnward( float c ) {
    float lobe = onward( ${PATTERN.lobe.toFixed(5)}, c ) * ( 1.0 + ${PATTERN.fill.toFixed(4)} * c * c ) / ${(1 + PATTERN.fill * (1 + 2 * PATTERN.lobe * PATTERN.lobe) / 3).toFixed(4)};
    return ${(1 - PATTERN.share).toFixed(5)} * onward( ${PATTERN.peak.toFixed(5)}, c ) + ${PATTERN.share.toFixed(5)} * lobe;
  }
`;

// The light in the mist by height above the ground, for each unit of the
// sun's light (as it falls on a surface facing it):
//   density: what the mist catches, per m, on the ground, on average;
//   sunUp: the sine of the sun's height (0 or less: no sun).
// Gives { heights (m), dims: the sun's beam there (1: undimmed); again:
// the light turned aside more than once, as it leaves each bit of mist in
// every direction (per steradian); down: the light falling on level ground
// there that the mist has turned aside, once or more }.
export function mistLight({ density, sunUp, height = MIST_HEIGHT, lobe = LOBE }) {
  const heights = Array.from({ length: HEIGHTS }, (_, i) => (TOP * i) / (HEIGHTS - 1));
  const zero = { heights, dims: heights.map(() => 1), again: heights.map(() => 0), down: heights.map(() => 0) };
  if (!(density > 0) || !(sunUp > 0)) return zero;
  const thin = density * lobe; // (what turns light aside, per m, on the ground)
  const at = (h) => thin * Math.exp(-Math.max(0, h) / height);
  const beam = (h) => Math.exp((-at(h) * height) / Math.max(0.1, sunUp));

  // Along a way from height h (up: its rise per m), by how much mist has
  // been passed (tau): the height reached. The mist thins evenly with
  // height, so the mist passed between two heights is their difference in
  // thickness, times the height's scale, over the rise.
  const reached = (h, up, tau) => {
    if (Math.abs(up) < 1e-3) return h;
    const there = at(h) - (up * tau) / height;
    return there > 0 ? -height * Math.log(there / thin) : Infinity;
  };
  // (All the mist on that way, to the ground or out of the top.)
  const whole = (h, up) => {
    if (Math.abs(up) < 1e-3) return 8;
    return up > 0 ? (height * (at(h) - at(TOP))) / up : (height * (at(0) - at(h))) / -up;
  };
  // What comes back along a way: `source(height)` from each bit of mist,
  // seen through the mist before it.
  const seen = (h, up, source) => {
    const all = Math.min(8, whole(h, up));
    let sum = 0;
    for (let j = 0; j < ALONG; j++) {
      const tau = ((j + 0.5) / ALONG) * all;
      const there = reached(h, up, tau);
      if (Number.isFinite(there)) sum += Math.exp(-tau) * source(Math.min(TOP, Math.max(0, there)));
    }
    return (sum * all) / ALONG;
  };

  // Turned aside twice (the light turned once, arriving from every side
  // and turned again), and the share of light that is turned again rather
  // than leaving the mist.
  const once = (h) => beam(h) / (4 * Math.PI);
  const again = heights.map((h) => {
    let twice = 0, stays = 0;
    for (let k = 0; k < WAYS; k++) {
      const up = -1 + (2 * (k + 0.5)) / WAYS; // (every direction alike: evenly by rise)
      twice += seen(h, up, once);
      stays += 1 - Math.exp(-Math.min(8, whole(h, up)));
    }
    return twice / WAYS / (1 - Math.min(0.98, stays / WAYS));
  });
  const between = (table) => (h) => {
    const x = (Math.min(TOP, Math.max(0, h)) / TOP) * (HEIGHTS - 1), i = Math.min(HEIGHTS - 2, Math.floor(x));
    return table[i] + (table[i + 1] - table[i]) * (x - i);
  };
  // On level ground at each height: what comes down from the mist above,
  // turned aside once or more.
  const lit = between(again);
  const down = heights.map((h) => {
    let sum = 0;
    for (let k = 0; k < WAYS / 2; k++) {
      const up = (k + 0.5) / (WAYS / 2);
      sum += seen(h, up, (y) => once(y) + lit(y)) * up;
    }
    return (2 * Math.PI * sum) / (WAYS / 2);
  });
  // How much comes down to the ground in all: the working above takes
  // light as turned aside in every direction alike, but the drops throw
  // it mostly on, so more of it carries on down than that (twice as much
  // with the sun high). The delta-Eddington answer for a layer that
  // absorbs nothing over dark ground (Joseph, Wiscombe and Weinman, 1976)
  // sets the amount; the working above, how it falls off with height.
  const sun = Math.max(0.1, sunUp), deep = thin * height; // (deep: all the mist over the ground, straight up)
  const through = ((2 / 3 + sun) + (2 / 3 - sun) * Math.exp(-deep / sun)) / (4 / 3 + (1 - LOBE_ON) * deep);
  const onGround = sun * Math.max(0, through - beam(0));
  const more = down[0] > 0 ? Math.min(3, Math.max(0.5, onGround / down[0])) : 1;
  return { heights, dims: heights.map(beam), again, down: down.map((d) => d * more) };
}
// (How far forward the broad lobe throws its light, on average: its mean cosine.)
const LOBE_ON = (PATTERN.lobe * (1 + (PATTERN.fill * (3 + 2 * PATTERN.lobe ** 2)) / 5)) / (1 + (PATTERN.fill * (1 + 2 * PATTERN.lobe ** 2)) / 3);

// What every patched material and the shafts read: the tables (r: again,
// g: down; across: the height, to `top`), what turns the light aside on
// the ground (per m), the sun's way through the mist for each m of its
// height's scale, the sun's light, and the ground's heights (the mist
// lies on it).
const table = new THREE.DataTexture(new Uint16Array(HEIGHTS * 2), HEIGHTS, 1, THREE.RGFormat, THREE.HalfFloatType);
table.minFilter = table.magFilter = THREE.LinearFilter;
table.needsUpdate = true;
export const mistLit = {
  map: { value: table },
  top: { value: TOP },
  thin: { value: 0 },
  sunWay: { value: 0 },
  sun: { value: new THREE.Color(0, 0, 0) },
  ground: { value: null },
  groundHalf: { value: 1 },
};
export const mistUniforms = () => ({
  mistLitMap: mistLit.map, mistTop: mistLit.top, mistThin: mistLit.thin, mistSunWay: mistLit.sunWay, mistSun: mistLit.sun,
  mistGround: mistLit.ground, mistGroundHalf: mistLit.groundHalf,
});

// The tables for this mist and sun, worked out again only when they change.
let made = '';
export function setMistLight({ density, sunUp }) {
  const key = `${density.toPrecision(4)}|${sunUp.toFixed(3)}`;
  mistLit.thin.value = density * LOBE;
  mistLit.sunWay.value = MIST_HEIGHT / Math.max(0.1, sunUp);
  if (key === made) return;
  made = key;
  const { again, down } = mistLight({ density, sunUp });
  const data = table.image.data;
  for (let i = 0; i < HEIGHTS; i++) {
    data[2 * i] = THREE.DataUtils.toHalfFloat(again[i]);
    data[2 * i + 1] = THREE.DataUtils.toHalfFloat(down[i]);
  }
  table.needsUpdate = true;
}

// In GLSL: how high a place is above the ground the mist lies on, the
// sun's beam there (1: undimmed), and the tables there.
export const MIST_GLSL = /* glsl */ `
  uniform sampler2D mistLitMap;
  uniform float mistTop;
  uniform float mistThin;
  uniform float mistSunWay;
  uniform vec3 mistSun;
  uniform sampler2D mistGround;
  uniform float mistGroundHalf;
  float mistUp( vec3 place ) {
    return max( 0.0, place.y - texture2D( mistGround, ( place.xz + mistGroundHalf ) / ( 2.0 * mistGroundHalf ) ).r );
  }
  float mistBeam( float up ) {
    return exp( - mistThin * exp( - up / ${MIST_HEIGHT.toFixed(1)} ) * mistSunWay );
  }
  vec2 mistTurned( float up ) {
    return texture2D( mistLitMap, vec2( ( 0.5 + clamp( up / mistTop, 0.0, 1.0 ) * ${(HEIGHTS - 1).toFixed(1)} ) / ${HEIGHTS.toFixed(1)}, 0.5 ) ).rg;
  }
`;

// The mist's light on `material` (after src/skyShade.js's underSky, whose
// place in the world and sky it reads): the sun on it dimmed as the beam
// is, and the light the mist has scattered falling on it, as much as the
// sky's light gets to it. On top of whatever patched its shader before.
export function underMist(material) {
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.customProgramCacheKey = () => `${key}|mist-light`;
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer);
    Object.assign(shader.uniforms, mistUniforms());
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${MIST_GLSL}`)
      .replace('#include <lights_fragment_end>', `${SCATTERED}\n#include <lights_fragment_end>`)
      .replace('#include <aomap_fragment>', `${DIMMED}\n#include <aomap_fragment>`);
  };
  material.needsUpdate = true;
}

// (Before three.js adds up the light that isn't the sun's.)
const SCATTERED = /* glsl */ `
  #if defined( RE_IndirectDiffuse )
    irradiance += mistSun * mistTurned( mistUp( vSkyAt ) ).g * skyOpenAt( vSkyAt + inverseTransformDirection( geometryNormal, viewMatrix ) * skyCell );
  #endif
`;
// (After all of the sun's own light is in, the light through the leaves too.)
const DIMMED = /* glsl */ `
  {
    float mistDims = mistBeam( mistUp( vSkyAt ) );
    reflectedLight.directDiffuse *= mistDims;
    reflectedLight.directSpecular *= mistDims;
  }
`;
