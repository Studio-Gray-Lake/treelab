import * as THREE from 'three';
import { NOISE_CELLS, evenNoise } from './crownGaps.js';
import { SKY_GLSL, skyUniforms } from './skyShade.js';
import { LOBE, MIST_HEIGHT, PATTERN_GLSL, mistLit, setMistLight } from './mistLight.js';
import { FAR_UP, SUN_WIDE } from './sunShadow.js';

// Shafts of sunlight, and mist. The air between the camera and what it sees
// catches the sun where nothing shades it: that lit air glows, and the air
// in the trees' shadows doesn't, so the light falls in shafts between the
// trunks and through gaps in the crowns.
//
// Two kinds of air:
// - haze, everywhere, a little more as the sun sinks (src/light.js): the
//   air of a clear day, in which you see 5 to 20 km. It throws light mostly
//   onward, so its shafts show looking toward the sun, against shade. What
//   it veils and the sky's light in it are the scene's own fog; here only
//   the sun's light in it is counted, within the stage, where the shadows
//   are known.
// - mist, as much as the mist setting asks, lying on the ground: thick in
//   banks and thin between them, with wisps, drifting with the wind and
//   changing as it goes. It dims what's behind it, and shows the light it
//   catches: the sun's, where no tree shades it (and less deep in the mist,
//   where the mist above has taken some), and the sky's, as much as gets
//   down through the trees (src/skyShade.js).
//
// Drawn after the scene, over it:
// 1. the scene's depth (each mesh's shape only, the trees as they sway);
// 2. at half the screen's size, along each pixel's ray to what it meets, 40
//    steps: at each, how thick the mist is, whether the sun reaches it (its
//    shadow maps, src/sunShadow.js) and how much of the sky does. Added up
//    from the camera outward, each step seen through the mist before it:
//    the sun's light caught, the sky's light caught, and how much of what's
//    behind gets through;
// 2a. blended with the last few frames: each frame's steps fall in new
//    places, so the air is sampled many times over, and thin beams resolve.
//    As the camera turns or walks, each pixel takes the frames before from
//    where its place was in them, so the samples aren't thrown away;
// 3. onto the picture, and the picture onto the screen. The scene is drawn
//    as light (src/main.js: into a picture of its own, not the screen's
//    values); here that light is dimmed by what gets through the mist, the
//    sky's light in the mist is added (what the sky gives a bit of mist
//    from every side: half the sky's light, and half what the ground under
//    it throws back) and the sun's; then the sum is put through the
//    exposure and the tone mapping, once, to the screen. Each pixel takes
//    the half-size pixels round it that are about as far away (so a near
//    trunk doesn't take the mist of the sky beside it). With no mist and
//    no shafts, the picture goes to the screen as it is.
//
// (It's all light until that last step. Blended onto the screen's own
// values, which aren't light (a value half as high is about a fifth of the
// light), a faint beam over a dark trunk showed five to seven times too
// dim, and what stood behind the mist too dark.)
//
// The sun's light on its way down through the mist: a drop of mist throws
// about half of the light it catches almost straight on (within a degree
// or two), and that half is still in the beam. So the beam is dimmed by
// the other half of what the mist over a place catches (src/mistLight.js:
// LOBE), and by the mist as it lies on average at that height, not by the
// bank or wisp the place happens to be in (a wisp is a few metres across;
// the sun's way through the mist, at a low sun, tens).
//
// The light the air shows: the sun's, turned aside once by the mist's
// drops in their own pattern (very bright within a few degrees of the sun,
// bright within 40, faint from the side: src/mistLight.js), and the light
// turned aside again and again, which fills sunlit mist from every side
// (worked out there by height; under the trees it's cut as the sky's light
// is). So mist in the sun seen from the side is white, as in life.
//
// The sun isn't a point: it's a disc half a degree wide, so the edge of a
// shadow is soft, by 9 mm for every metre between what casts it and where
// it falls. Each step looks toward one point of the disc, a new one every
// step and frame; blended, a beam through a gap in the crowns is sharp
// just under the gap and soft far below it (a gap 0.45 m wide gives no
// clean beam past 50 m: there the beams run together into a glow), while a
// trunk near by still cuts a clean edge. How far up the sun's way the
// thing that shades a place is isn't known exactly (the shadow map holds
// only the first thing the sun meets): something at least FAR_UP m up is
// taken to be the crowns, as far up the sun's way as the crowns are; less
// than that, near.
//
// Not counted: the mist's banks and wisps in the light turned aside more
// than once (it's worked out for the mist as it lies on average), and the
// trees' shade on it (taken as the sky's light is, not as the sun falls).
//
// One thing not as in life, and named as such where it's set: the light
// shafts setting above 1 (up to 10) shows the sun's light in the air that
// many times as bright as it is. At 1 the shafts are as faint as real ones
// (from the side, about a fiftieth as bright as sunlit ground).

const STEPS = 40;
const FIRST = 6;         // of them, the steps before a ray enters the stage (evenly; the rest from there on)
const NEAR = 10;         // m: the steps from there start about a metre long and grow with the distance (plus this)
export const MIST = 0.04; // per m: what the mist catches on the ground with the setting at 1, on average: fog (you see about 100 m: 3.9 over this, to a contrast of 2%)
const BANK = [30, 10, 30]; // m: a bank of mist is about this wide, tall and deep (one cell of the noise)
const WISP = [6, 4, 6];    // m: and a wisp
const KEEP = 0.88;       // the share of the frames before kept in the blend, the camera still (about 8 frames' worth)
const MOVED = 0.3;       // m a frame: the camera walking this fast, a third of that is kept (the air in front of a thing slides past it; turning costs nothing)
const GROUND_CELLS = 128; // the ground's heights for the mist: this many each way

// renderer, scene (its fog gives the mist the sky's colour, and how far the
// mist is followed), camera, sun (createSun's); skip: objects left out of
// the depth (the sky, the haze: they're the background).
export function createLightShafts({ renderer, scene, camera, sun, skip = [] }) {
  const depthTarget = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType) });
  // (r: the sun's light in the air; g: how far away, m; b: the sky's light
  // in the mist; a: how much of what's behind gets through.)
  const half = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
  const airTarget = new THREE.WebGLRenderTarget(1, 1, half);
  // (Blended over the last frames: this frame's into one, from the other,
  // turn about.)
  const smooth = { ...half, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }; // (read between its pixels, where a pixel's place was)
  const blended = [new THREE.WebGLRenderTarget(1, 1, smooth), new THREE.WebGLRenderTarget(1, 1, smooth)];
  // (Both sides: from below, the ground still stops the rays.)
  const shapeOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  let groundMap = mistLit.ground.value = heights(null);
  let groundOf = null; // (the ground those heights are of)

  const shadow = sun.shadow;
  const march = new THREE.ShaderMaterial({
    uniforms: {
      depthMap: { value: depthTarget.depthTexture },
      projectionInverse: { value: new THREE.Matrix4() },
      cameraWorld: { value: new THREE.Matrix4() },
      haze: { value: 0 },    // per m
      mist: { value: 0 },    // per m, on the ground, on average
      reach: { value: 1e4 }, // m: how far the mist is followed
      sunOn: { value: 0 },   // 1: the sun is up and its shadows drawn
      sunMap: { value: null },
      sunMatrix: { value: [shadow.getMatrix(0), shadow.getMatrix(1)] },
      nearEnd: { value: 0 }, // the view depth where the near cascade ends
      sunDeep: { value: new THREE.Vector2(1, 1) }, // m: how deep each cascade's map reaches along the sun's way
      stageCenter: { value: shadow.stage.center },
      stageRadius: { value: 1 },
      cameraAhead: { value: new THREE.Vector3() },
      toSun: { value: new THREE.Vector3(0, 1, 0) },
      frame: { value: 0 },
      groundMap: { value: groundMap },
      groundHalf: { value: 1 },
      noiseMap: { value: null },
      mistLitMap: mistLit.map, // (the light turned aside more than once, by height: src/mistLight.js)
      mistTop: mistLit.top,
      bankShift: { value: new THREE.Vector3() },
      wispShift: { value: new THREE.Vector3() },
      ...skyUniforms(),
    },
    vertexShader: QUAD,
    fragmentShader: MARCH,
    depthTest: false,
    depthWrite: false,
  });
  const blend = new THREE.ShaderMaterial({
    uniforms: {
      now: { value: airTarget.texture },
      before: { value: null },
      keep: { value: 0 }, // the share of the frames before that's kept
      projectionInverse: march.uniforms.projectionInverse,
      cameraWorld: march.uniforms.cameraWorld,
      beforeMatrix: { value: new THREE.Matrix4() }, // the world onto the picture, a frame ago
    },
    vertexShader: QUAD,
    fragmentShader: BLEND,
    depthTest: false,
    depthWrite: false,
  });
  const taken = {
    air: { value: null },
    airSize: { value: new THREE.Vector2(1, 1) },
    depthMap: { value: depthTarget.depthTexture },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 1000 },
  };
  const compose = new THREE.ShaderMaterial({
    uniforms: {
      ...taken,
      picture: { value: null },   // the scene, as light
      airOn: { value: 0 },        // 1: there's mist or sunlit air to add
      exposure: { value: 1 },
      skyLight: { value: new THREE.Color() }, // the sky's light in a bit of mist under the open sky
      sunColor: { value: new THREE.Color() },
      strength: { value: 0 },
    },
    vertexShader: QUAD,
    fragmentShader: TAKE + COMPOSE,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), march);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const draw = (material, target) => {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCamera);
  };

  const size = new THREE.Vector2();
  // drift: how far the wind has carried the air (m); time: the clock (s).
  const settings = { strength: 0, haze: 0, mist: 0, kept: 0, drift: new THREE.Vector3(), time: 0 };
  // Where the camera was a frame ago; which blend holds the last frames
  // (none yet, or none of this size: `fresh`).
  const last = { position: new THREE.Vector3() };
  let turn = 0, fresh = true, frame = 0;

  // After the scene is drawn, as light, into `picture` (its texture): the
  // mist and the shafts over it, and all of it onto the screen (or whatever
  // the renderer was drawing into).
  function render(picture) {
    const map = shadow.map?.depthTexture;
    const sunUp = sun.castShadow && sun.intensity > 0 && !!map && renderer.shadowMap.enabled;
    const shafts = settings.strength > 0 && settings.haze + settings.mist > 0 && sunUp;
    const mist = settings.mist > 0;
    // (What the mist does to the light on the things in it, and the light
    // turned aside more than once: src/mistLight.js.)
    setMistLight({ density: settings.mist, sunUp: sun.intensity > 0 ? _eye.copy(sun.position).normalize().y : 0 });
    const air = shafts || mist;
    renderer.getDrawingBufferSize(size);
    const w = Math.max(1, Math.floor(size.x / 2)), h = Math.max(1, Math.floor(size.y / 2));
    if (air && (airTarget.width !== w || airTarget.height !== h)) {
      depthTarget.setSize(Math.max(1, size.x), Math.max(1, size.y));
      airTarget.setSize(w, h);
      for (const target of blended) target.setSize(w, h);
      fresh = true;
    }

    const before = { target: renderer.getRenderTarget(), autoClear: renderer.autoClear, shadows: renderer.shadowMap.autoUpdate };
    const hidden = [], swapped = [];
    try {
      if (air) {
      // 1. The depth (the sun's shadows as the scene just drew them). Each
      // mesh drawn with its shadow's material (the trees as they sway), or
      // plain; from the side the mesh shows (three.js draws a shadow from its
      // far side, and leaves the material so), and whole (the gaps in the
      // crowns' shadows, src/crownGaps.js, are on only in the shadow maps).
      renderer.shadowMap.autoUpdate = false;
      for (const o of skip) if (o.visible) hidden.push(o);
      scene.traverseVisible((o) => {
        if ((o.isLine || o.isPoints || o.isSprite) && !hidden.includes(o)) hidden.push(o);
        else if (o.isMesh && !hidden.includes(o)) {
          const depth = o.customDepthMaterial;
          if (depth && o.material.side !== undefined) depth.side = o.material.side;
          swapped.push([o, o.material]);
          o.material = depth ?? shapeOnly;
        }
      });
      for (const o of hidden) o.visible = false;
      renderer.setRenderTarget(depthTarget);
      renderer.autoClear = true;
      renderer.clear();
      renderer.render(scene, camera);
      for (const o of hidden) o.visible = true;
      for (const [o, material] of swapped) o.material = material;
      hidden.length = swapped.length = 0;

      // 2. Along each ray: the mist, the sun's light and the sky's.
      const u = march.uniforms;
      u.projectionInverse.value.copy(camera.projectionMatrixInverse);
      u.cameraWorld.value.copy(camera.matrixWorld);
      u.haze.value = shafts ? settings.haze : 0;
      u.mist.value = settings.mist;
      u.reach.value = scene.fog?.far ?? 1e4;
      camera.getWorldDirection(u.cameraAhead.value);
      u.toSun.value.copy(sun.position).normalize();
      u.sunOn.value = shafts ? 1 : 0;
      u.sunMap.value = map ?? null;
      u.nearEnd.value = shadow._cascadeData?.[0].y ?? 0;
      const deep = (i) => (shadow._cameras?.[i] ? shadow._cameras[i].far - shadow._cameras[i].near : 1e4);
      u.sunDeep.value.set(deep(0), deep(1));
      u.stageRadius.value = shadow.stage.radius;
      u.frame.value = frame = (frame + 1) % 64;
      u.noiseMap.value ??= evenNoise();
      shifts(settings, u.bankShift.value, u.wispShift.value);
      draw(march, airTarget);

      // 2a. Blended with the frames before: each frame's steps fall in new
      // places, so over a few frames the air is sampled many times over.
      // Each pixel takes the old from where its place was a frame ago, so
      // turning keeps it all; a little less is kept the faster the camera
      // walks (the air in front of a thing slides past it), and none where
      // what a pixel sees has changed.
      _eye.setFromMatrixPosition(camera.matrixWorld);
      const moved = _eye.distanceTo(last.position) / MOVED;
      last.position.copy(_eye);
      settings.kept = blend.uniforms.keep.value = fresh ? 0 : KEEP * Math.exp(-moved);
      blend.uniforms.before.value = blended[turn].texture;
      turn = 1 - turn;
      fresh = false;
      draw(blend, blended[turn]);
      blend.uniforms.beforeMatrix.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

      taken.air.value = blended[turn].texture;
      taken.airSize.value.set(w, h);
      taken.cameraNear.value = camera.near;
      taken.cameraFar.value = camera.far;
      }
      // 3. Onto the picture (what's there dimmed by what the mist lets
      // through, plus the sky's light in the mist and the sun's), and the
      // picture onto the screen, through the exposure and the tone mapping.
      renderer.autoClear = false;
      compose.uniforms.picture.value = picture;
      compose.uniforms.airOn.value = air ? 1 : 0;
      compose.uniforms.exposure.value = renderer.toneMappingExposure ?? 1;
      draw(compose, before.target);
    } finally {
      for (const o of hidden) o.visible = true;
      for (const [o, material] of swapped) o.material = material;
      renderer.shadowMap.autoUpdate = before.shadows;
      renderer.autoClear = before.autoClear;
      renderer.setRenderTarget(before.target);
    }
  }

  // color: the sun's light (colour × intensity); strength: how brightly the
  // air shows it (the light shafts setting: 1 as in life, more a boost; 0:
  // no shafts); haze: the hour's haze (per m); mist: the mist setting (0 to
  // 1); sky: the sky's light in a bit of mist under the open sky (what
  // comes to it from every side, on average).
  function set({ color, strength, haze, mist = 0, sky = _white }) {
    compose.uniforms.sunColor.value.copy(color);
    compose.uniforms.strength.value = strength;
    compose.uniforms.skyLight.value.copy(sky);
    mistLit.sun.value.copy(color);
    Object.assign(settings, { strength, haze, mist: MIST * mist * mist });
  }

  // The ground the mist lies on: { heightAt(x, z), half (m: it reaches this
  // far each way from the middle; flat beyond, at its edge's height) }, or
  // none: flat, at 0.
  function setGround(ground) {
    if (ground === groundOf) return;
    groundOf = ground;
    groundMap.dispose();
    groundMap = heights(ground?.half ? ground : null);
    march.uniforms.groundMap.value = mistLit.ground.value = groundMap;
    march.uniforms.groundHalf.value = mistLit.groundHalf.value = ground?.half || 1;
  }

  function dispose() {
    for (const o of [depthTarget, airTarget, ...blended, shapeOnly, march, blend, compose, quad.geometry, groundMap]) o?.dispose();
  }

  return { render, set, setGround, dispose, settings, targets: { depth: depthTarget, air: airTarget, blended }, uniforms: march.uniforms, onto: compose.uniforms };
}

const _eye = new THREE.Vector3(), _white = new THREE.Color(1, 1, 1);

// A ground's heights as a texture (one texel for flat ground at 0).
function heights(ground) {
  const n = ground ? GROUND_CELLS : 1;
  const data = new Uint16Array(n * n);
  if (ground) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -ground.half + ((i + 0.5) / n) * 2 * ground.half, z = -ground.half + ((j + 0.5) / n) * 2 * ground.half;
        data[j * n + i] = THREE.DataUtils.toHalfFloat(ground.heightAt(x, z));
      }
    }
  }
  const map = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.HalfFloatType);
  map.minFilter = map.magFilter = THREE.LinearFilter;
  map.unpackAlignment = 1;
  map.needsUpdate = true;
  return map;
}

// Where the noise is read for the banks and the wisps, as the air has
// drifted (in the noise's own lengths, kept between 0 and 1: it repeats).
// The banks go with the wind; the wisps half as fast again, with a slow
// drift of their own and a slow rise, so the mist changes shape as it goes,
// and is never quite still.
export function shifts({ drift, time }, bank = new THREE.Vector3(), wisp = new THREE.Vector3()) {
  const part = (v) => v - Math.floor(v);
  const of = (cell, x, y, z) => [part(-x / (cell[0] * NOISE_CELLS)), part(-y / (cell[1] * NOISE_CELLS)), part(-z / (cell[2] * NOISE_CELLS))];
  bank.fromArray(of(BANK, drift.x, 0, drift.z));
  wisp.fromArray(of(WISP, 1.5 * drift.x + 0.06 * time, 0.03 * time, 1.5 * drift.z + 0.04 * time));
  return { bank, wisp };
}

const QUAD = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4( position.xy, 0.0, 1.0 );
  }
`;

const per = (cell) => `vec3( ${cell.map((c) => (1 / (c * NOISE_CELLS)).toFixed(6)).join(', ')} )`;

// Along each pixel's ray, from the camera to what it meets: the sun's light
// the air catches, the sky's light the mist catches, and how much of what's
// behind gets through the mist; and how far away the pixel is.
const MARCH = /* glsl */ `
  precision highp sampler2DShadow;
  precision highp sampler3D;
  uniform sampler2D depthMap;
  uniform mat4 projectionInverse;
  uniform mat4 cameraWorld;
  uniform float haze;
  uniform float mist;
  uniform float reach;
  uniform float sunOn;
  uniform sampler2DShadow sunMap;
  uniform mat4 sunMatrix[ 2 ];
  uniform float nearEnd;
  uniform vec2 sunDeep;
  uniform vec3 stageCenter;
  uniform float stageRadius;
  uniform vec3 cameraAhead;
  uniform vec3 toSun;
  uniform float frame;
  uniform sampler2D groundMap;
  uniform float groundHalf;
  uniform sampler3D noiseMap;
  uniform sampler2D mistLitMap;
  uniform float mistTop;
  uniform vec3 bankShift;
  uniform vec3 wispShift;
  varying vec2 vUv;
  ${SKY_GLSL}

  // The camera, the way of the pixel's ray, how far to what it meets (far,
  // for the sky), and the view depth there.
  void ray( out vec3 eye, out vec3 dir, out float dist, out float depth ) {
    float d = texture2D( depthMap, vUv ).x;
    vec4 view = projectionInverse * vec4( vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
    view /= view.w;
    eye = ( cameraWorld * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
    vec3 hit = ( cameraWorld * vec4( view.xyz, 1.0 ) ).xyz;
    dir = normalize( hit - eye );
    dist = d < 1.0 ? length( hit - eye ) : 1e4;
    depth = - view.z;
  }

  // One look at the sun's shadow map: lit (1) or shaded (0) at p, from the
  // near cascade where p falls on its half of the map, else the far one;
  // off both, lit. nearer (m): asks instead whether p would be shaded were
  // it that much nearer the sun, that is, by something at least that far
  // up the sun's way.
  float look( vec3 p, float depth, float nearer ) {
    vec4 at = sunMatrix[ 0 ] * vec4( p, 1.0 );
    at.xyz /= at.w;
    float deep = sunDeep.x;
    if ( depth >= nearEnd || at.x > 0.5 || at.x < 0.0 ) {
      at = sunMatrix[ 1 ] * vec4( p, 1.0 );
      at.xyz /= at.w;
      deep = sunDeep.y;
      if ( at.x < 0.5 || at.x > 1.0 ) return 1.0;
    }
    if ( at.y < 0.0 || at.y > 1.0 || at.z > 1.0 ) return 1.0;
    return texture( sunMap, vec3( at.xy, at.z - nearer / deep ) );
  }

  // How much of the sun shows at p, looking toward one point of its disc
  // (disc: where on it, within a circle of radius 1). The crowns hide
  // that point if they stand where the way to it passes them: to the side
  // by the sun's width for each metre up the way. Something near (a trunk)
  // hides it almost as it would a point of light. The map holds only the
  // first thing the sun meets, so where the crowns are in the way of the
  // straight look, what is near can't be told there: then something near
  // seen through the crowns' gap, where the way to this point passes
  // them, is taken to hide it.
  float lit( vec3 p, float depth, vec2 disc ) {
    vec3 side = normalize( cross( toSun, vec3( 0.0, 1.0, 0.0 ) ) );
    vec3 off = ( side * disc.x + cross( side, toSun ) * disc.y ) * ${SUN_WIDE};
    float crowns = skyMin.y + 0.7 * skySpan.y;
    float way = clamp( ( crowns - p.y ) / max( 0.1, toSun.y ), ${FAR_UP.toFixed(1)}, 150.0 );
    vec3 through = p + off * way;
    float past = look( through, depth, ${FAR_UP.toFixed(1)} );
    if ( past <= 0.0 ) return 0.0;
    vec3 by = p + off * ${(FAR_UP / 2).toFixed(1)};
    float clear = look( by, depth, ${FAR_UP.toFixed(1)} );           // no crowns in the way of the straight look
    float near = ( 1.0 - look( by, depth, 0.0 ) ) * clear;          // something near, seen there
    float behind = ( 1.0 - look( through, depth, 0.0 ) ) * ( 1.0 - clear ); // or seen through the gap, where it can't be
    return past * ( 1.0 - min( 1.0, near + behind ) );
  }

  // Henyey-Greenstein: how much light, at cos c from the sun's way, goes on
  // toward the camera (per unit of light caught, in every direction 1).
  float onward( float g, float c ) {
    return ( 1.0 - g * g ) / pow( 1.0 + g * g - 2.0 * g * c, 1.5 ) / 12.566;
  }

  // (The mist's drops' own pattern: mistOnward( c ).)
  ${PATTERN_GLSL}

  // The mist at p, per m: thinner the higher above the ground under it;
  // thick in banks and thin between (most of it in a third of the space),
  // with wisps. On average, at the ground, the setting's. (even: as it
  // lies on average at that height; up: the height above the ground, m.)
  float mistAt( vec3 p, out float even, out float up ) {
    up = max( 0.0, p.y - texture2D( groundMap, ( p.xz + groundHalf ) / ( 2.0 * groundHalf ) ).r );
    float thick = even = mist * exp( - up / ${MIST_HEIGHT.toFixed(1)} );
    if ( thick < 2e-5 ) return 0.0;
    float bank = texture( noiseMap, p * ${per(BANK)} + bankShift ).r;
    float wisp = texture( noiseMap, p * ${per(WISP)} + wispShift ).r;
    return thick * ( 0.1 + 2.7 * bank * bank ) * ( 0.5 + wisp );
  }

  void main() {
    vec3 eye, dir;
    float dist, depth;
    ray( eye, dir, dist, depth );
    float ahead = max( 1e-3, dot( dir, cameraAhead ) );
    // The stage along the ray: from a to c (where the sun's shadows are
    // known, and the haze's light is counted).
    vec3 oc = eye - stageCenter;
    float b = dot( oc, dir );
    float inside = b * b - dot( oc, oc ) + stageRadius * stageRadius;
    float a = 1e9, c = -1.0;
    if ( inside > 0.0 ) {
      a = max( 0.0, - b - sqrt( inside ) );
      c = - b + sqrt( inside );
    }
    // The steps: the mist is followed to what the ray meets (or as far as
    // the scene's fog goes); with no mist, only the stage. Up to where the
    // ray enters the stage, a few even steps; from there on (or from the
    // camera, if it never does), steps that start about a metre long and
    // grow with the distance, so the shafts near by are finely sampled.
    // Each pixel starts at its own place in each step, a new one every
    // frame: blended over the frames, the steps don't show as bands.
    float end = mist > 0.0 ? min( dist, reach ) : min( dist, c );
    float start = a < end ? a : 0.0;
    int first = mist > 0.0 && start > 0.0 ? ${FIRST} : 0;
    float rest = float( ${STEPS} - first );
    float grow = log( 1.0 + max( 0.0, end - start ) / ${NEAR.toFixed(1)} );
    float jitter = fract( 52.9829189 * fract( dot( gl_FragCoord.xy + 5.588238 * frame, vec2( 0.06711056, 0.00583715 ) ) ) );

    // The haze throws light mostly onward; the mist's drops far more so
    // (their own pattern).
    float cosSun = dot( dir, toSun );
    float hazeOnward = 0.85 * onward( 0.65, cosSun ) + 0.15 / 12.566;
    float mistOnce = mistOnward( cosSun );
    // (How far the sun's light comes through the mist to a place in it, as
    // if the mist were as thick as it is on average at each height; the
    // light thrown straight on is still in the beam.)
    float sunWay = ${(MIST_HEIGHT * LOBE).toFixed(3)} / max( 0.1, toSun.y );

    float sun = 0.0, sky = 0.0, through = 1.0;
    if ( end > 0.0 ) {
      for ( int i = 0; i < ${STEPS}; i ++ ) {
        float t, dt;
        if ( i < first ) {
          dt = start / float( first );
          t = ( float( i ) + jitter ) * dt;
        } else {
          float t0 = start + ${NEAR.toFixed(1)} * ( exp( float( i - first ) / rest * grow ) - 1.0 );
          float t1 = start + ${NEAR.toFixed(1)} * ( exp( float( i - first + 1 ) / rest * grow ) - 1.0 );
          dt = t1 - t0;
          t = mix( t0, t1, jitter );
        }
        vec3 p = eye + dir * t;
        bool staged = t >= a && t <= c;
        float even = 0.0, up = 0.0;
        float m = mist > 0.0 ? mistAt( p, even, up ) : 0.0;
        float sunHere = 0.0;
        if ( sunOn > 0.0 ) {
          // (A point of the sun's disc for this step: evenly over it, as
          // the steps and the frames go.)
          vec2 seed = gl_FragCoord.xy + vec2( 31.416, 17.13 ) * frame + vec2( 7.77, 3.31 ) * float( i );
          float round = 6.2832 * fract( 52.9829189 * fract( dot( seed, vec2( 0.06711056, 0.00583715 ) ) ) );
          float out_ = sqrt( fract( 52.9829189 * fract( dot( seed.yx + 11.7, vec2( 0.06711056, 0.00583715 ) ) ) ) );
          vec2 disc = out_ * vec2( cos( round ), sin( round ) );
          sunHere = ( staged ? lit( p, t * ahead, disc ) : 1.0 ) * exp( - even * sunWay );
        }
        // (What this step's mist takes of the view, seen through the mist
        // before it.)
        float kept = exp( - m * dt );
        float caught = through * ( 1.0 - kept );
        if ( m > 0.0 ) {
          float open = skyOpenInAirAt( p );
          // (Turned aside once, toward the camera; and again and again,
          // from every side: the broad lobe's share of what's caught
          // shows it.)
          float again = sunOn * ${LOBE.toFixed(5)} * texture2D( mistLitMap, vec2( ( 0.5 + clamp( up / mistTop, 0.0, 1.0 ) * 15.0 ) / 16.0, 0.5 ) ).r;
          sun += caught * ( mistOnce * sunHere + again * open );
          sky += caught * open;
        }
        if ( staged ) sun += through * haze * dt * hazeOnward * sunHere;
        through *= kept;
      }
    }
    gl_FragColor = vec4( sun, depth, sky, through );
  }
`;

// This frame's air with the frames' before: `keep` of the old, taken from
// where the pixel's place (what it sees, g: how far off) was in the picture
// a frame ago, where that still shows about as far off as the place was.
// (The old isn't held to what this frame's pixels round about show, as is
// often done against trails: a thin beam is caught by a step only now and
// then, and would be clipped away.)
const BLEND = /* glsl */ `
  uniform sampler2D now;
  uniform sampler2D before;
  uniform float keep;
  uniform mat4 projectionInverse;
  uniform mat4 cameraWorld;
  uniform mat4 beforeMatrix;
  varying vec2 vUv;
  void main() {
    vec4 a = texture2D( now, vUv );
    vec4 far = projectionInverse * vec4( vUv * 2.0 - 1.0, 1.0, 1.0 );
    vec3 ray = far.xyz / far.w;
    vec3 place = ( cameraWorld * vec4( ray * ( a.y / max( 1e-4, - ray.z ) ), 1.0 ) ).xyz;
    vec4 was = beforeMatrix * vec4( place, 1.0 );
    vec2 at = was.xy / was.w * 0.5 + 0.5;
    vec4 b = a;
    float k = 0.0;
    if ( was.w > 0.0 && at.x > 0.0 && at.y > 0.0 && at.x < 1.0 && at.y < 1.0 ) {
      b = texture2D( before, at );
      float apart = abs( was.w - b.y ) / ( 0.1 * was.w + 0.2 );
      k = keep * exp( - apart * apart );
    }
    gl_FragColor = vec4( mix( a.x, b.x, k ), a.y, mix( a.zw, b.zw, k ) );
  }
`;

// The air for a pixel of the picture: (the sun's light, the sky's light,
// what gets through). Each pixel takes it from the half-size pixels round
// it, the nearer the more, and only from those about as far away as itself;
// that also smooths the steps' grain. With none as far away (a twig against
// the sky), the one nearest in depth, taken as far along its ray as the
// pixel is.
const TAKE = /* glsl */ `
  uniform sampler2D air;
  uniform vec2 airSize;
  uniform sampler2D depthMap;
  uniform float cameraNear;
  uniform float cameraFar;
  varying vec2 vUv;

  float metres( float d ) {
    float z = d * 2.0 - 1.0;
    return 2.0 * cameraNear * cameraFar / ( cameraFar + cameraNear - z * ( cameraFar - cameraNear ) );
  }

  vec3 airHere() {
    float here = metres( texture2D( depthMap, vUv ).x );
    vec2 p = vUv * airSize - 0.5;
    vec2 base = floor( p );
    vec3 sum = vec3( 0.0 );
    float weights = 0.0, nearest = 1e9;
    vec4 fallback = vec4( 0.0, 1.0, 0.0, 1.0 );
    for ( int j = -1; j <= 2; j ++ ) {
      for ( int i = -1; i <= 2; i ++ ) {
        vec2 cell = base + vec2( float( i ), float( j ) );
        vec4 s = texture2D( air, ( cell + 0.5 ) / airSize );
        vec2 off = cell - p;
        float apart = abs( s.y - here ) / ( 0.04 * here + 0.05 );
        float w = exp( - dot( off, off ) * 0.6 ) * exp( - apart * apart );
        sum += s.xzw * w;
        weights += w;
        if ( abs( s.y - here ) < nearest ) { nearest = abs( s.y - here ); fallback = s; }
      }
    }
    if ( weights > 1e-4 ) return sum / weights;
    float share = clamp( here / max( fallback.y, 1e-3 ), 0.0, 2.0 );
    float through = pow( fallback.w, share );
    if ( fallback.w < 0.999 ) share = ( 1.0 - through ) / ( 1.0 - fallback.w );
    return vec3( fallback.x * share, fallback.z * share, through );
  }
`;

// The mist and the sun's light onto the picture, and the picture onto the
// screen. picture: the scene, as light; airOn: whether there's mist or sunlit
// air to add; skyLight: the sky's light in a bit of mist under the open sky;
// sunColor: the sun's light; strength: how brightly the air shows it (the
// light shafts setting); exposure: the camera's.
//
// tone() is three.js's Neutral tone mapping, on light already at the
// exposure.
const COMPOSE = /* glsl */ `
  uniform sampler2D picture;
  uniform float airOn;
  uniform float exposure;
  uniform vec3 skyLight;
  uniform vec3 sunColor;
  uniform float strength;

  const float START = 0.76, ROOM = 0.24, GREYS = 0.15;

  vec3 tone( vec3 c ) {
    float low = min( c.r, min( c.g, c.b ) );
    c -= low < 0.08 ? low - 6.25 * low * low : 0.04;
    float peak = max( c.r, max( c.g, c.b ) );
    if ( peak < START ) return c;
    float top = 1.0 - ROOM * ROOM / ( peak + ROOM - START );
    c *= top / peak;
    float g = 1.0 - 1.0 / ( GREYS * ( peak - top ) + 1.0 );
    return mix( c, vec3( top ), g );
  }

  // Light to the screen's values (sRGB).
  vec3 screen( vec3 l ) {
    return mix( l * 12.92, 1.055 * pow( l, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, l ) );
  }

  void main() {
    vec3 sum = min( texture2D( picture, vUv ).rgb, vec3( 1e4 ) );
    if ( airOn > 0.0 ) {
      // What's behind, by the share the mist lets through; the sky's light
      // in the mist, by the share of it the mist has caught; and the sun's
      // light in the air.
      vec3 a = airHere();
      sum = sum * a.z + skyLight * a.y + sunColor * ( a.x * strength );
    }
    sum = tone( max( sum, 0.0 ) * exposure );
    // (A grain finer than the screen's steps, so smooth mist and sky don't band.)
    float grain = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) - 0.5;
    gl_FragColor = vec4( screen( clamp( sum, 0.0, 1.0 ) ) + grain / 255.0, 1.0 );
  }
`;
