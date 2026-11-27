import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import rigUrl from '../vendor/workshop/rig.glb?url';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { DEFAULT_SHAPES, KINDS, KIND_CHOICES, KIND_CROWNS, KIND_GROUPS, crownOf, evergreen, isOwn, kindName, leafTiming } from './kinds.js';
import { MixController, mixGroup, mixHead } from './mixTable.js';
import { LAYERS, layerOf } from './cover.js';
import { WOODS, plantWood, woodOf } from './woods.js';
import { createPlanter, recolor, treetops } from './tree.js';
import { DRAWINGS, ROWS, sectionsOf } from './sections.js';
import { foliageColor, groundColor, mottleOf } from './colors.js';
import { PRESETS, presetOf, presetShape } from './presets.js';
import { createSwayRig } from './swayRig.js';
import { limitsFor, sliderKind } from './limits.js';
import { CHOICES, MAX_TREES, RANGES, assign, defaultSettings, looksLikeSettings, normalize, toFile } from './settings.js';
import { fromOldLink, fromShortLink, toShortLink } from './link.js';
import { createTerrain, groundFor, PLAIN } from './terrain.js';
import { placeForest } from './forest.js';
import { gardenRecords } from './garden.js';
import { areaOf } from './patterns.js';
import { capture, shareImage } from './capture.js';
import { exportModel } from './exportModel.js';
import { DAY_EXPOSURE, brightness, hourAfter, lightAt } from './light.js';
import { leafLight } from './leafLight.js';
import { createSun, sunWidth, underSunDisc } from './sunShadow.js';
import { createLightShafts } from './lightShafts.js';
import { crownGaps } from './crownGaps.js';
import { canopyCover } from './canopy.js';
import { createSkyShade, skyShade, underSky } from './skyShade.js';
import { underMist } from './mistLight.js';
import { ADAPTS, createEye, eased, exposureFor, rangeAt } from './eye.js';
import { drawnIn, focusOf, heightIn, isClick, ringPoints, ringRadius, sameTree, turnRate } from './select.js';
import { mostFor, readWidths, widthAfter, writeWidths } from './panelWidth.js';
import { EYE, PIVOT, standingSpot, standingView, stepOnGround } from './stand.js';
import { createWalker, stepWalker, wanted } from './walker.js';
import { createFigure } from './figure.js';
import { trunksOf } from './tree.js';
import { createGamepad } from '@workshop/gamepad.js';
import { SCENES, sceneOf, sceneSettings } from './scenes.js';
import { SEASONS, leavesOf, seasonChanges, seasonOf } from './season.js';
import { siteOf, siteSays, standOf } from './site.js';
import { RangeController } from './rangeSlider.js';
import { OutlineController } from './outlineEditor.js';
import { agesOf, applyAge, hasAges, reAged } from './age.js';
import { closedShape, hemmedIn } from './woodGrown.js';
import { OUTLINE, outlineOf } from './oak/oak.js';
import { attachTooltips } from './tooltip.js';
import { shapeTip, tip } from './tips.js';
import { slopeSpot } from './slope.js';
import { ABOUT, opensOnAView, showsWelcome, turnWelcomeOff } from './welcome.js';
import { KOFI, KOFI_CUP, PLAIN_LINE, lineFor, askDue, asksMade, setAsksMade, supportDelay, supportIsOff, turnSupportOff } from './support.js';
import { versionLabel, versionSays } from './version.js';
import { NEWS, RELEASES, dayOf } from './changelog.js';

// TreeLab: the Tree tab grows one tree, or a grid of them to compare; the
// Forest tab plants them on hills. Both use the workshop's trees, wind and
// sway (vendor/workshop/), and one settings object (src/settings.js) that
// the panel shows, the address keeps, and a file saves.

// The workshop's look by day (src/main.js, and src/daytime.js TODAY).
const SKY = 0xbfd1e5; // (the page's colour while it loads)
const HEAVY = 4e6; // triangles: more and a forest may stutter on an ordinary laptop
const FLAT_GROUND = 0x7d8f55; // the workshop's ground (the hills are coloured by their vertices)
const FAR = 3000; // m: how far the ground runs, each way (past the far veil's end)
const STORE = 'treelab.settings'; // where the browser keeps the last settings
const TEXT_STORE = 'treelab.textSize'; // and this viewer's text size (never in settings or links)
const FOLD_STORE = 'treelab.folded';   // and which of the cards this viewer has folded away
const WIDTH_STORE = 'treelab.widths';  // and how wide they dragged them (src/panelWidth.js)

// The text size: 1.5 times TreeLab's first size to start (1.25 on a phone).
const ui = { textSize: innerWidth > 0 && innerWidth < 700 ? 1.25 : 1.5 };
try {
  const kept = Number(localStorage.getItem(TEXT_STORE));
  if ([1, 1.25, 1.5, 2].includes(kept)) ui.textSize = kept;
} catch {
  // (no storage)
}
const applyTextSize = () => document.documentElement.style.setProperty('--ui-scale', String(ui.textSize));
applyTextSize();

// --- The stage ---------------------------------------------------------------------

// (The screen itself needs no smoothing of edges: the scene is drawn into a
// picture of its own, below, which has it.)
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('app').append(renderer.domElement);

// The picture. The scene is drawn as light: into a picture that holds how
// much light each pixel gives off (not the screen's values, which aren't
// light), with its edges smoothed. The far haze, the mist and the sun's
// light in the air are all mixed there, as light; then the picture goes
// through the camera's exposure and the tone mapping (three.js's Neutral:
// a bright sky and deep shade both keep their detail, and TreeLab's own
// colours don't shift) to the screen, once (src/lightShafts.js does that
// last step, with the mist). The exposure follows the day (src/light.js)
// and the eye (src/eye.js).
const picture = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const _pictureSize = new THREE.Vector2();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(SKY, 20, 60);

// (A page opened in a hidden tab may have no size yet.)
const aspect = () => (innerWidth > 0 && innerHeight > 0 ? innerWidth / innerHeight : 1);
const camera = new THREE.PerspectiveCamera(45, aspect(), 0.1, 2500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
// Round the trees: never under the ground, never closer than a metre.
// (Standing among them, further on, it's set up otherwise.)
const ORBIT = { minDistance: 1, minPolarAngle: 0, maxPolarAngle: Math.PI * 0.495, rotateSpeed: 1, panSpeed: 1, screenSpacePanning: true, enablePan: true };
Object.assign(controls, ORBIT, { maxDistance: 60 });

// The sun's shadows in two cascades, sharp near the camera, fitted to the
// stage (src/sunShadow.js).
const sun = createSun(0xffffff, 2.5);
sun.castShadow = true;
sun.shadow.normalBias = 0.02;
crownGaps.shadow = sun.shadow; // (the gaps in the crowns' shadows are sized by its maps)
scene.add(sun);

// The sky: three.js's sky (scattered sunlight, a sun disc, a few clouds),
// and a copy of it lighting the shade (the scene's environment, worked out
// again when the hour changes).
//
// The sky is drawn as bright as the light it gives, no brighter. three.js's
// sky has its own measure of brightness, far above the sun's here (as it
// comes, the sky would give level ground some twenty times the light a
// real sky does, against the sun). So its light is measured each hour (what
// it would give level ground, and a bit of air), and all of it is scaled
// (`skyGives`) to give what a real clear sky gives against the sun
// (src/light.js). Things then take the sky's light as drawn, all of it; and
// from below, what the sunlit ground throws back (a ground under the copy
// of the sky, as bright as the ground is).
const skyGives = { value: 1 };
const scaled = (material) => {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.skyGives = skyGives;
    shader.fragmentShader = `uniform float skyGives;\n${shader.fragmentShader}`.replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb *= skyGives;\n\t\t\t#include <tonemapping_fragment>');
  };
  return material;
};
const sky = new Sky();
sky.scale.setScalar(2000);
scaled(sky.material);
scene.add(sky);
const skyForLight = new Sky();
skyForLight.scale.setScalar(100);
skyForLight.material.uniforms.showSunDisc.value = 0;
scaled(skyForLight.material);
const groundUnder = new THREE.Mesh(new THREE.CircleGeometry(95, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, toneMapped: false }));
groundUnder.position.y = -0.5;
const skyScene = new THREE.Scene().add(skyForLight, groundUnder);
const pmrem = new THREE.PMREMGenerator(renderer);
let environment = null;

// The sky's light as it comes, before it's scaled: what it gives level
// ground (each way's light by how squarely it falls: `ground`) and a bit of
// air (every way alike: `air`), as the mean light of the sky in each sense.
// Looked at in the five upward faces of a small cube. (null where this
// browser can't read the light back.)
const SKY_FACE = 16;
const skyCube = new THREE.WebGLCubeRenderTarget(SKY_FACE, { type: THREE.HalfFloatType });
const skyCubeCamera = new THREE.CubeCamera(0.1, 500, skyCube);
// (A cube face's pixel, as a way out from the middle: three.js's faces are +x, -x, +y, -y, +z, -z.)
const wayOf = (face, i, j) => {
  const a = (2 * (i + 0.5)) / SKY_FACE - 1, b = (2 * (j + 0.5)) / SKY_FACE - 1;
  return [[1, -b, -a], [-1, -b, a], [a, 1, b], [a, -1, -b], [a, -b, 1], [-a, -b, -1]][face];
};
function skyAsItComes() {
  if (!renderer.capabilities.textureTypeReadable(THREE.HalfFloatType)) return null;
  const before = renderer.getRenderTarget();
  groundUnder.visible = false;
  skyGives.value = 1;
  skyCubeCamera.update(renderer, skyScene);
  groundUnder.visible = true;
  const pixels = new Uint16Array(SKY_FACE * SKY_FACE * 4);
  const ground = [0, 0, 0], air = [0, 0, 0];
  let groundAll = 0, airAll = 0;
  for (const face of [0, 1, 2, 4, 5]) {
    renderer.readRenderTargetPixels(skyCube, 0, 0, SKY_FACE, SKY_FACE, pixels, face);
    for (let j = 0; j < SKY_FACE; j++) {
      for (let i = 0; i < SKY_FACE; i++) {
        const way = wayOf(face, i, j), length = Math.hypot(...way), up = way[1] / length;
        if (up <= 0) continue;
        const covers = 1 / length ** 3; // (how much of the sky the pixel covers)
        for (let c = 0; c < 3; c++) {
          const light = THREE.DataUtils.fromHalfFloat(pixels[(j * SKY_FACE + i) * 4 + c]);
          air[c] += light * covers;
          ground[c] += light * covers * up;
        }
        airAll += covers;
        groundAll += covers * up;
      }
    }
  }
  renderer.setRenderTarget(before);
  if (![...ground, ...air].every(Number.isFinite) || !(brightness({ r: ground[0], g: ground[1], b: ground[2] }) > 0)) return null;
  return { ground: new THREE.Color(...ground.map((v) => v / groundAll)), air: new THREE.Color(...air.map((v) => v / airAll)) };
}
// (Where it can't be read back: about what three.js's sky gives, by day.)
const SKY_AS_IT_COMES = { ground: new THREE.Color(1.1, 1.7, 2.9), air: new THREE.Color(1.4, 2.2, 3.4) };
const GROUND_THROWS_BACK = new THREE.Color(FLAT_GROUND); // the ground's colour: the share of the light on it that it throws back
const mistSky = new THREE.Color(); // the sky's light in a bit of mist under the open sky (what comes to it from every side, on average)

// The sky's colour a little over the horizon, 4 to 8° up, all the way round,
// in 5° steps of the compass (raw light, before the tone mapping): the far
// veil (three.js's fog: the stand-in for the haze over a distance) takes the colour the camera faces, so far hills fade into the sky behind
// them, not into a colour of their own. (Looked at in four quarters, each 90°
// wide; null where this browser can't read the colours back.)
const LOOK = { width: 57, height: 2, up: 6, tall: 4 };
const STEPS = 72;
// (A small picture for each quarter, so all four are drawn at once and read back while the page goes on.)
const horizonTargets = Array.from({ length: 4 }, () => new THREE.WebGLRenderTarget(LOOK.width, LOOK.height, { type: THREE.HalfFloatType, depthBuffer: false }));
const horizonCamera = new THREE.PerspectiveCamera(LOOK.tall, 1 / Math.tan(THREE.MathUtils.degToRad(LOOK.tall / 2)), 0.1, 1000);
const compass = (x, z) => Math.floor((((Math.atan2(x, z) / (2 * Math.PI)) % 1 + 1) % 1) * STEPS) % STEPS;
let horizonAsk = 0; // (which ask for the horizon's colours is the latest)
// The four quarters drawn now; their colours when they've been read back (a promise; null where they can't be).
function horizonColorsLater() {
  if (!renderer.capabilities.textureTypeReadable(THREE.HalfFloatType) || !renderer.readRenderTargetPixelsAsync) return Promise.resolve(null);
  const before = renderer.getRenderTarget();
  for (let quarter = 0; quarter < 4; quarter++) {
    horizonCamera.rotation.set(THREE.MathUtils.degToRad(LOOK.up), (quarter * Math.PI) / 2, 0, 'YXZ');
    horizonCamera.updateMatrixWorld();
    renderer.setRenderTarget(horizonTargets[quarter]);
    renderer.render(skyScene, horizonCamera);
  }
  renderer.setRenderTarget(before);
  return Promise.all(horizonTargets.map((target) => {
    const pixels = new Uint16Array(LOOK.width * LOOK.height * 4);
    return renderer.readRenderTargetPixelsAsync(target, 0, 0, LOOK.width, LOOK.height, pixels).then(() => pixels);
  })).then(horizonFrom);
}
// The horizon's colours from the four quarters' pixels.
function horizonFrom(quarters) {
  const sums = Array.from({ length: STEPS }, () => [0, 0, 0, 0]);
  const forward = new THREE.Vector3(), right = new THREE.Vector3();
  for (let quarter = 0; quarter < 4; quarter++) {
    const pixels = quarters[quarter];
    const yaw = (quarter * Math.PI) / 2;
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    for (let i = 0; i < LOOK.width; i++) {
      const across = (2 * (i + 0.5)) / LOOK.width - 1; // (the look is 90° wide: tan 45° = 1)
      const sum = sums[compass(forward.x + right.x * across, forward.z + right.z * across)];
      for (let row = 0; row < LOOK.height; row++) {
        const k = (row * LOOK.width + i) * 4;
        for (let c = 0; c < 3; c++) sum[c] += THREE.DataUtils.fromHalfFloat(pixels[k + c]);
        sum[3]++;
      }
    }
  }
  if (sums.some((s) => !s[3] || !s.every(Number.isFinite))) return null;
  return sums.map(([r, g, b, n]) => new THREE.Color().setRGB(r / n, g / n, b / n));
}
let horizon = null;    // (the sky's colours round the horizon, as above)
let fallbackVeil = null; // (light.js's, where there are none)

// The far veil's colour for where the camera faces: the horizon's colours
// across the view, as light (the band of haze over the horizon is mixed in
// the picture, as light).
const facing = new THREE.Vector3(), seen = new THREE.Color();
function fitVeilColor() {
  if (!horizon) {
    if (fallbackVeil) haze.material.uniforms.color.value.copy(scene.fog.color.copy(fallbackVeil));
    return;
  }
  camera.getWorldDirection(facing);
  const middle = compass(facing.x, facing.z);
  const reach = 6; // steps: 30° each way
  seen.setRGB(0, 0, 0);
  let weight = 0;
  for (let k = -reach; k <= reach; k++) {
    const w = reach + 1 - Math.abs(k);
    const c = horizon[(middle + k + STEPS) % STEPS];
    seen.r += c.r * w; seen.g += c.g * w; seen.b += c.b * w;
    weight += w;
  }
  seen.multiplyScalar(1 / weight);
  haze.material.uniforms.color.value.copy(scene.fog.color.copy(seen));
}

// A band of haze in the far veil's colour over the horizon, fading out a few
// degrees up: where the ground runs out, or past the veil, it meets the sky without a
// seam. Thinner toward the sun, whose glow shines through.
const haze = new THREE.Mesh(
  new THREE.SphereGeometry(1, 48, 24),
  new THREE.ShaderMaterial({
    name: 'Haze',
    uniforms: { color: { value: new THREE.Color() }, sun: { value: new THREE.Vector2(0, -1) } },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w; // (as far off as the sky)
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform vec2 sun; // (the sun's way, level)
      varying vec3 vDirection;
      void main() {
        vec3 d = normalize(vDirection);
        float toSun = pow(max(0.0, dot(normalize(d.xz + 1e-6), sun)), 6.0);
        float a = (1.0 - smoothstep(-0.01, 0.12, d.y)) * (1.0 - 0.8 * toSun * smoothstep(-0.01, 0.02, d.y));
        gl_FragColor = vec4(color, a);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false, // (its colour is the far veil's: light, as everything in the picture)
  }),
);
haze.scale.setScalar(100);
haze.frustumCulled = false;
haze.renderOrder = -1;
haze.onBeforeRender = (r, s, cam) => {
  haze.position.copy(cam.position);
  haze.updateMatrixWorld();
};
scene.add(haze);

// Shafts of sunlight through the trees, laid over each frame
// (src/lightShafts.js).
const shafts = createLightShafts({ renderer, scene, camera, sun, skip: [sky, haze] });

// The sky's light among the trees: how much of it gets down to each place
// (src/skyShade.js), worked out again a moment after the trees change (at
// once the first time, and after a pause in a run of changes).
const shade = createSkyShade({ renderer });
let shadeDue = null, shaded = -Infinity;
function shadeSoon() {
  const now = performance.now();
  shadeDue = now - shaded < 600 ? now + 150 : now;
}
function shadeIfDue() {
  if (shadeDue === null || performance.now() < shadeDue) return;
  shadeDue = null;
  shade.update(shown === 'tree' ? garden : woods);
  shaded = performance.now();
}

// The eye: the exposure follows what's in view (src/eye.js), round the
// hour's own (src/light.js).
const eye = createEye({ renderer });
let baseExposure = 0;  // the hour's
let eyeRange = rangeAt(1); // the stops the eye has at this hour, down and up
let lightNow = null;   // the hour's light (lightAt's)

let sunDirection =new THREE.Vector3(0.5, 0.8, 0.3).normalize();
let lastStage = null; // (fitStage's last arguments, to refit when the sun moves)

// The light of the hour (src/light.js) on everything.
// sky: whether the sky's own light is measured again (it takes a picture of
// the sky and reads it back: too much for every frame of a running day,
// where it's done a few times a second, the sun itself every frame).
function applyLight({ sky: measured = true } = {}) {
  const L = lightAt(settings.light);
  sunDirection = L.direction.clone();
  for (const s of [sky, skyForLight]) {
    const u = s.material.uniforms;
    u.sunPosition.value.copy(L.direction).multiplyScalar(450000);
    u.turbidity.value = L.sky.turbidity;
    u.rayleigh.value = L.sky.rayleigh;
    u.mieCoefficient.value = L.sky.mieCoefficient;
    u.mieDirectionalG.value = L.sky.mieDirectionalG;
  }
  sun.color.copy(L.sun.color);
  sun.intensity = L.sun.intensity;
  // (The eye stays as far open as it was, against the new hour's exposure.)
  const open = baseExposure > 0 && settings.light.eye > 0 ? renderer.toneMappingExposure / baseExposure : 1;
  baseExposure = L.exposure;
  eyeRange = rangeAt(baseExposure, DAY_EXPOSURE);
  lightNow = L;
  renderer.toneMappingExposure = baseExposure * open;
  // The sky, scaled to what it gives against the sun (see above); the
  // ground under it, as bright as level ground is in this light (the sun's
  // and the sky's on it, by its colour); and from both, the light on
  // everything that isn't the sun's own.
  if (measured) lightFromSky(L);
  haze.material.uniforms.sun.value.set(L.direction.x, L.direction.z).normalize();
  leafLight.sun.value.copy(L.direction);
  leafLight.leafGlow.value = settings.light.glow;
  applyShafts(L);
  crownGaps.share = settings.light.gaps;
  skyShade.amount.value = settings.light.shade;
  if (lastStage) fitStage(...lastStage);
}

// The sky's own light for this hour, measured: how bright the sky is drawn,
// the ground under it, the light on everything that isn't the sun's own,
// the mist's light, and the horizon's colour.
function lightFromSky(L) {
  const comes = skyAsItComes() ?? SKY_AS_IT_COMES;
  skyGives.value = L.skyGives / (Math.PI * brightness(comes.ground));
  const onGround = _sunLight.copy(L.sun.color).multiplyScalar(L.sun.intensity * Math.max(0, L.direction.y)).add(_skyLight.copy(comes.ground).multiplyScalar(Math.PI * skyGives.value));
  groundUnder.material.color.copy(onGround).multiply(GROUND_THROWS_BACK).multiplyScalar(1 / Math.PI);
  environment?.dispose();
  environment = pmrem.fromScene(skyScene, 0.04, 1, 500);
  scene.environment = environment.texture;
  scene.environmentIntensity = 1;
  // (A bit of mist under the open sky: lit from above by the sky, from
  // below by the ground, half and half.)
  mistSky.copy(comes.air).multiplyScalar(0.5 * skyGives.value).add(_skyLight.copy(groundUnder.material.color).multiplyScalar(0.5));
  // (Drawn now, read back while the page goes on: until they come, the far veil keeps the colours it had, or the
  // fallback below. A later ask's colours win over an earlier one's.)
  groundUnder.visible = false;
  const ask = ++horizonAsk;
  horizonColorsLater()
    .then((colors) => {
      if (ask !== horizonAsk) return;
      horizon = colors;
      fitVeilColor();
    })
    .catch(() => {}); // (a lost context: the next light asks again)
  groundUnder.visible = true;
  // (Where the horizon can't be read: its hue from src/light.js, about as
  // bright as the low sky is against the whole.)
  fallbackVeil = L.veil.clone().multiplyScalar((1.6 * L.skyGives) / (Math.PI * brightness(L.veil)));
  fitVeilColor();
}

// The day running ("time runs", in the light folder): the hour moves on,
// and the sun with it every frame; the sky's own light is measured again
// a few times a second (the sun moves little in between). The clock's
// pause (P) holds it. The hour is saved once a second, not every frame.
let skyDue = 0, saveDue = 0;
function runDay(dt) {
  if (!(settings.light.runs > 0) || rig.clock.paused || !(dt > 0)) return;
  settings.light.hour = hourAfter(settings.light.hour, settings.light.runs, Math.min(dt, 0.25), RANGES['light.hour']);
  skyDue -= dt;
  saveDue -= dt;
  applyLight({ sky: skyDue <= 0 });
  if (skyDue <= 0) skyDue = 0.2;
  hourRow.updateDisplay();
  if (hourRow.$input) hourRow.$input.value = settings.light.hour.toFixed(2); // (not every digit of a running hour)
  if (saveDue <= 0) {
    saveDue = 1;
    showScene();
    showSeason();
    remember();
  }
}

// The light shafts: the sun's light, and how much the air catches of it.
function applyShafts(L = lightNow) {
  shafts.set({ color: _sunLight.copy(L.sun.color).multiplyScalar(L.sun.intensity), strength: settings.light.shafts, haze: L.haze, mist: settings.light.mist, sky: mistSky });
}

// The eye a moment on: the exposure toward what the last look calls for.
function adapt(dt) {
  const goal = exposureFor({ base: baseExposure, was: eye.seen?.at, seen: eye.seen?.mean, follow: settings.light.eye, range: eyeRange });
  const next = eased(renderer.toneMappingExposure, goal, dt);
  renderer.toneMappingExposure = next;
}

// The eye settled on the view at once (the first frame; before a picture
// taken from a script): a few frames drawn, each measured and corrected.
function settleEye(times = 5) {
  for (let i = 0; i < times; i++) {
    render();
    const seen = eye.measure();
    if (!seen) return;
    renderer.toneMappingExposure = exposureFor({ base: baseExposure, was: seen.at, seen: seen.mean, follow: settings.light.eye, range: eyeRange });
  }
}
const _sunLight = new THREE.Color(), _skyLight = new THREE.Color();

// The sun, its shadows and the far veil fitted to what's shown: `radius` m round
// `center`, up to `top` m high.
let standing = false; // (the camera among the trees, at eye height: further on)
function fitStage(center, radius, top) {
  lastStage = [center, radius, top];
  // A low sun throws long shadows, away from it only. So the stage isn't
  // grown both ways to take them in: it's moved down-sun by half their
  // reach, and takes in what's shown and its shadows that far, and no more
  // of the up-sun side than what's shown. (The reach it follows is at most
  // what's shown and 10 m: a bigger stage spreads the same shadow map
  // thinner, and every shadow in it is blockier and grainier for it.)
  const reach = Math.min(top / Math.max(0.1, Math.tan(Math.asin(Math.max(0.1, sunDirection.y)))), radius + 10);
  const half = Math.max(9, radius + 2) + reach / 2;
  const flat = Math.hypot(sunDirection.x, sunDirection.z) || 1;
  sun.position.copy(sunDirection); // (it shines from there toward the origin)
  sun.shadow.stage.center.copy(center);
  sun.shadow.stage.center.x -= (sunDirection.x / flat) * (reach / 2);
  sun.shadow.stage.center.z -= (sunDirection.z / flat) * (reach / 2);
  sun.shadow.stage.center.y += top / 2;
  sun.shadow.stage.radius = Math.hypot(half, top / 2 + 2);
  shafts.setGround(hillsShown()); // (the mist lies on the hills; on level ground, on level ground)
  // (Each cascade's map: twice as fine for a big stage, where the GPU takes a
  // texture 8192 wide.)
  const size = half > 40 && renderer.capabilities.maxTextureSize >= 8192 ? 4096 : 2048;
  if (sun.shadow.mapSize.x !== size) {
    sun.shadow.mapSize.set(size, size);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  stageRadius = radius;
  if (!standing) controls.maxDistance = Math.max(60, radius * 3.5);
}

// The far veil starts a little past what's shown, wherever the camera is,
// and thickens into the sky's colour at the horizon well before the ground ends.
let stageRadius = 9;
function fitVeil() {
  const d = camera.position.distanceTo(controls.target);
  scene.fog.near = Math.max(30, d + stageRadius * 0.5);
  scene.fog.far = Math.min(FAR * 0.6, Math.max(250, d + stageRadius * 4 + 150));
}

// --- The Tree tab's stage: flat ground, a metre grid, labels -------------------------------

const flat = (() => {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(FAR, 128).rotateX(-Math.PI / 2), // (on to the horizon)
    new THREE.MeshStandardMaterial({ color: FLAT_GROUND, roughness: 1 }),
  );
  mesh.receiveShadow = true;
  return { heightAt: () => 0, normalAt: (x, z, out = new THREE.Vector3()) => out.set(0, 1, 0), slopeAt: () => 0, mesh };
})();
const garden = new THREE.Group();
garden.name = 'trees';
const labels = new THREE.Group();
let grid = null;
const treeStage = new THREE.Group();
treeStage.add(flat.mesh, garden, labels);
scene.add(treeStage);

function setGrid(size) {
  if (grid?.userData.size === size) return;
  if (grid) {
    treeStage.remove(grid);
    grid.geometry.dispose();
    grid.material.dispose();
  }
  grid = new THREE.GridHelper(size, size, 0x4d5a35, 0x5f6e42);
  grid.userData.size = size;
  grid.position.y = 0.005;
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  grid.visible = settings.view.grid;
  treeStage.add(grid);
}

function label(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = 'rgba(246, 248, 243, 0.9)';
  g.beginPath();
  g.roundRect(4, 8, 248, 48, 12);
  g.fill();
  g.fillStyle = '#1f2a1c';
  g.font = '600 28px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 33);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, fog: true }));
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}

function clearLabels() {
  for (const sprite of [...labels.children]) {
    labels.remove(sprite);
    sprite.material.map.dispose();
    sprite.material.dispose();
  }
}

// --- The Forest tab's stage: hills, the forest's edge --------------------------------------

const woods = new THREE.Group();
woods.name = 'trees';
const forestStage = new THREE.Group();
forestStage.add(woods);
forestStage.visible = false;
scene.add(forestStage);
let terrain = null;
let terrainStamp = '';
let edge = null;

// One tree on the hills (its ground: hills): it stands on the forest's own
// hills, at their middle, its roots lying on them, with the forest's trees
// and edge hidden. The grid always stands on level ground, so its trees
// compare fairly.
const onHills = () => settings.tree.ground === 'hills' && settings.tree.show !== 'grid';
// Where it stands on them: on a slope near their middle (src/slope.js), the same place for the same hills. On level
// ground, the middle.
let treeSpot = { x: 0, z: 0 };
const spotGround = () => (onHills() ? terrain.heightAt(treeSpot.x, treeSpot.z) : 0);
// The hills under what's shown, if it stands on them: the forest's, or one tree's on them. (Else level ground.)
const hillsShown = () => ((shown ?? settings.tab) === 'forest' || ((shown ?? settings.tab) === 'tree' && onHills()) ? terrain : null);
// The stages for what's shown: one tree's level ground and grid, or the hills (with the forest on them, or not).
function showStages() {
  const tab = shown ?? settings.tab;
  const hills = tab === 'tree' && onHills();
  treeStage.visible = tab === 'tree';
  forestStage.visible = tab === 'forest' || hills;
  woods.visible = tab === 'forest';
  if (edge) edge.visible = tab === 'forest' && settings.view.edge;
  flat.mesh.visible = !hills;
  if (grid) grid.visible = settings.view.grid && !hills;
}

function setTerrain() {
  // (Big enough for the forest: its hills whole under every tree.)
  const ground = groundFor(settings.forest.radius * (settings.forest.area === 'square' ? Math.SQRT2 : 1));
  const stamp = JSON.stringify({ ...settings.terrain, ...ground });
  if (stamp === terrainStamp) return false;
  if (terrain) {
    forestStage.remove(terrain.mesh);
    terrain.dispose();
  }
  terrain = createTerrain(settings.terrain, ground);
  terrainStamp = stamp;
  groundColor(settings.autumn, terrain.mesh.material.color);
  forestStage.add(terrain.mesh);
  setPlain(terrain.half);
  return true;
}

// Beyond the hills, plain ground on to the horizon (the hills flatten into it
// at their edge), so that far off everything melts into the far veil.
const plainMaterial = new THREE.MeshStandardMaterial({ roughness: 1 });
underSky(plainMaterial); // (the wood's shade reaches a little way out onto it)
underMist(plainMaterial); // (and the mist lies on it too)
underSunDisc(plainMaterial);
let plain = null;
function setPlain(half) {
  if (plain?.userData.half === half) return;
  if (plain) {
    forestStage.remove(plain);
    plain.geometry.dispose();
  }
  const square = (h) => [new THREE.Vector2(-h, -h), new THREE.Vector2(h, -h), new THREE.Vector2(h, h), new THREE.Vector2(-h, h)];
  const shape = new THREE.Shape(square(FAR));
  shape.holes.push(new THREE.Path(square(half)));
  plain = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), plainMaterial);
  plain.receiveShadow = true;
  plain.userData.half = half;
  groundColor(settings.autumn, plainMaterial.color).multiply(PLAIN);
  forestStage.add(plain);
}

// The forest's edge: a line on the ground round its area.
function setEdge() {
  if (edge) {
    forestStage.remove(edge);
    edge.geometry.dispose();
    edge.material.dispose();
  }
  const { area, radius: r } = settings.forest;
  const points = [];
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let x, z;
    if (area === 'circle') {
      x = Math.cos(t * Math.PI * 2) * r;
      z = Math.sin(t * Math.PI * 2) * r;
    } else {
      const side = Math.floor(t * 4) % 4, f = (t * 4) % 1;
      [x, z] = [[-r + 2 * r * f, -r], [r, -r + 2 * r * f], [r - 2 * r * f, r], [-r, r - 2 * r * f]][side];
    }
    points.push(new THREE.Vector3(x, terrain.heightAt(x, z) + 0.08, z));
  }
  edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xf6f8f3, transparent: true, opacity: 0.55 }));
  edge.visible = settings.view.edge;
  forestStage.add(edge);
}

// The figure standing by the trees for scale: the workshop's own character
// (vendor/workshop/rig.glb, built in Blender: orange on its left, blue on
// its right), its feet on the ground. In the forest it walks ("walk among
// the trees": src/walker.js moves it, src/figure.js moves its limbs).
const person = new THREE.Group();
person.name = 'person';
scene.add(person);
new GLTFLoader().load(rigUrl, (gltf) => {
  const figure = gltf.scene;
  const worn = new Set();
  figure.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false; // (a skinned mesh's bounds are its rest pose's)
    for (const material of [o.material].flat()) worn.add(material);
  });
  for (const material of worn) {
    underSky(material); // (under the trees it stands in their shade, as they do)
    underMist(material); // (and in the mist)
    underSunDisc(material);
  }
  person.add(figure);
  personHeight = heightOf(figure);
  body = createFigure(figure); // (while it's at rest: that's the pose it's moved from)
  for (const row of personRows) row.name(personName());
}, undefined, (error) => console.warn('TreeLab: the figure for scale could not be loaded.', error));

// How tall the figure stands (m), from its posed vertices, for its row's name.
let personHeight = null;
let body = null; // the figure's limbs moved (src/figure.js), once it has loaded
const personName = () => (personHeight ? `figure for scale (${personHeight.toFixed(2)} m)` : 'figure for scale');
function heightOf(object) {
  object.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let lo = Infinity, hi = -Infinity;
  object.traverse((o) => {
    if (!o.isMesh) return;
    const position = o.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      if (o.isSkinnedMesh) o.getVertexPosition(i, v);
      else v.fromBufferAttribute(position, i);
      v.applyMatrix4(o.matrixWorld);
      lo = Math.min(lo, v.y);
      hi = Math.max(hi, v.y);
    }
  });
  return hi - lo;
}

// --- The settings --------------------------------------------------------------------------

const settings = defaultSettings();
settings.view.edge = true; // (not saved: the forest's edge line)
const planters = { tree: createPlanter(), forest: createPlanter() };
const dirty = { tree: true, forest: true };
let stats = { tree: null, forest: null };

// Where the settings come from at the start: a share link, the browser's
// last settings, or the defaults.
function startingSettings() {
  const hash = location.hash.slice(1);
  if (hash.startsWith('v=')) return { ...fromShortLink(hash.slice(2)), from: 'the link' };
  if (hash.startsWith('s=')) return { ...fromOldLink(hash.slice(2)), from: 'the link' }; // (links made up to 0.3.1: longer, still read, as 0.3.1 read them)
  const old = new URLSearchParams(hash); // (TreeLab's first links: #kind=…&seed=…&variant=…)
  if (old.has('kind')) return { ...normalize({ tree: { kind: old.get('kind'), seed: Number(old.get('seed')), variant: Number(old.get('variant')) } }), from: 'the link' };
  try {
    const kept = localStorage.getItem(STORE);
    if (kept) return { ...normalize(JSON.parse(kept)), from: 'your last visit' };
  } catch {
    // (no storage, or something unreadable in it)
  }
  return null;
}

// The settings into the address (a share link of this view) and the
// browser's storage, a moment after the last change.
let saveTimer;
function remember() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const link = toShortLink(settings);
    const changed = link !== toShortLink(defaultSettings());
    history.replaceState(null, '', changed ? `#v=${link}` : location.pathname + location.search);
    showScene();
    showSeason();
    try {
      localStorage.setItem(STORE, toFile(settings));
    } catch {
      // (private browsing: nothing kept, which is fine)
    }
  }, 300);
}
const shareLink = () => `${location.origin}${location.pathname}${location.search}#v=${toShortLink(settings)}`;

// --- What the page shows -------------------------------------------------------------

const statsEl = document.getElementById('stats');
const noteEl = document.getElementById('note');
// Which TreeLab this is, beside its name (./version.js). On the dev server the code changes under a running
// server, so the page asks again each time it loads.
const versionEl = document.getElementById('version');
const showVersion = (build) => {
  versionEl.textContent = versionLabel(build);
  versionEl.title = `${versionSays(build)} Click for what each release brought.`;
};
showVersion(__TREELAB__);
if (__TREELAB__.dev) fetch('/__treelab-build').then((answer) => answer.json()).then(showVersion).catch(() => {});

// The feature log (./changelog.js), opened by the version: what each release brought, newest first, each with
// a link to its news post where it has one. (On the studio's own site its links go by their path alone, as
// the welcome card's does, so they stay on whichever copy of the site this is.)
{
  const onSite = (address) => (import.meta.env.MODE === 'site' ? (({ pathname, hash }) => pathname + hash)(new URL(address)) : address);
  const card = document.getElementById('log'), list = document.getElementById('log-list');
  const make = (tag, text, parent) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    parent?.append(element);
    return element;
  };
  for (const release of RELEASES) {
    const head = make('h3', `TreeLab ${release.version} `, list);
    make('span', dayOf(release.date), head);
    const about = make('p', `${release.name}. `, list);
    about.className = 'about';
    if (release.post) {
      const link = make('a', 'Read the post', about);
      link.href = onSite(release.post);
      link.target = '_blank';
      link.rel = 'noopener';
    }
    const lines = make('ul', '', list);
    for (const change of release.changes) make('li', change, lines);
  }
  document.getElementById('log-news').href = onSite(NEWS);
  document.getElementById('news-link').href = onSite(NEWS);
  document.getElementById('log-ok').addEventListener('click', () => card.close());
  versionEl.addEventListener('click', () => {
    card.showModal?.();
    card.scrollTop = 0;
    document.getElementById('log-ok').focus();
  });
}
if (import.meta.env.DEV) {
  const w = __WORKSHOP__;
  document.getElementById('source').textContent = w.live ? `Reading the workshop's own files: ${w.dir}` : `Workshop files synced ${w.synced}`;
}

function showStats() {
  const s = stats[settings.tab];
  if (!s) return;
  statsEl.replaceChildren(...s.flatMap(([k, v]) => {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = k;
    dd.textContent = v;
    return [dt, dd];
  }));
}

let noteTimer;
function note(text, ms = 5000) {
  noteEl.textContent = text;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => (noteEl.textContent = ''), ms);
}

const metres = (v) => `${v.toFixed(2)} m`;
const count = (v) => Math.round(v).toLocaleString('en');

// --- Growing ----------------------------------------------------------------------

let rig = null;
const colorOf = (t, out) => foliageColor(t, settings.colors, settings.autumn, out, settings.season);
const mottle = (kind) => mottleOf(kind, settings.autumn, settings.season);
// A kind's shape as it's grown at this time of year: with the share of its
// leaves it carries now (src/season.js), if that's less than all of them.
// (Only TreeLab's own kinds that lose their leaves: an evergreen keeps
// them, and the workshop's trees are grown by the workshop's code.)
function inSeason(kind, variant, shape) {
  if (!isOwn(kind) || evergreen(kind)) return shape;
  const leaves = leavesOf(leafTiming(kind), settings.season, settings.autumn, variant);
  return leaves >= 1 ? shape : { ...shape, leaves };
}

// The ground's autumn cast: the flat ground's colour, and the hills'
// (whose colours are their vertices', the material's a multiplier).
function tintGround() {
  groundColor(settings.autumn, flat.mesh.material.color).multiply(new THREE.Color(FLAT_GROUND));
  if (terrain) groundColor(settings.autumn, terrain.mesh.material.color);
  groundColor(settings.autumn, plainMaterial.color).multiply(PLAIN);
}

// New colours on the trees already planted, both tabs, and the ground.
function recolorAll() {
  for (const planter of Object.values(planters)) planter.mottle(mottle);
  recolor(garden, colorOf);
  recolor(woods, colorOf);
  tintGround();
}
const wireframe = (group) => Object.values(group.userData.materials ?? {}).forEach((m) => (m.wireframe = settings.view.wireframe));

// How long the trees took to grow, as the info card says it: none grown (each already was, and was only placed again, as when one tree is set on the hills) says so.
const grownIn = (numbers) => (numbers.grown ? `${numbers.ms.toFixed(1)} ms` : 'already grown');

// The Tree tab's trees.
let gardenSize = null;
const personByTree = new THREE.Vector3(-2, 0, 0.6); // where the figure stands by them
const growTree = safely(function growTree({ frame = false } = {}) {
  const planter = planters.tree;
  // (One shape for a tree, asked for the same way each time: grown once, by the grid that spaces them or by the planter.)
  const shapeOf = (kind, variant) => inSeason(kind, variant, settings.shapes[kind]);
  const layout = gardenRecords(settings.tree, settings.shapes, planter, shapeOf);
  // On the hills: the forest's hills (made if they aren't yet; if they changed, the forest is grown again when next
  // shown), each tree on the ground under it. The planter sets TreeLab's own kinds on their roots; the workshop's are
  // sunk 0.3 m, as in the forest.
  const hills = onHills();
  if (hills && setTerrain()) dirty.forest = true;
  treeSpot = hills ? slopeSpot((x, z) => terrain.heightAt(x, z)) : { x: 0, z: 0 };
  if (hills) {
    for (const r of layout.records) {
      r.x += treeSpot.x;
      r.z += treeSpot.z;
      r.y = terrain.heightAt(r.x, r.z) - 0.3;
    }
  }
  const numbers = planter.plant(garden, layout.records, settings.shapes, { colorOf, mottle, shapeOf, ground: hills ? terrain : null });
  keepSelection('tree', layout.records);
  wireframe(garden);
  clearLabels();
  if (settings.tree.show === 'grid' && settings.tree.labels) {
    for (const r of layout.records) {
      const sprite = label(r.label);
      const width = Math.min(layout.spacing * 0.95, Math.min(4, Math.max(1.6, layout.spacing * 0.4)) * ui.textSize);
      sprite.scale.set(width, width / 4, 1);
      sprite.position.set(r.x, width / 8 + 0.05, r.z + Math.min(layout.reach, layout.spacing / 2 - 0.2));
      labels.add(sprite);
    }
  }
  setGrid(Math.max(20, 2 * Math.ceil(layout.extent + 2)));
  gardenSize = layout;
  rig.bind({ trees: garden, terrain: hills ? terrain : flat, warmUp: Math.min(20, 2000 / layout.records.length) });
  shadeSoon();
  dirty.tree = false;
  showStages();

  const one = settings.tree.show !== 'grid';
  const first = planter.model(layout.records[0].kind, layout.records[0].seed, layout.records[0].variant, inSeason(layout.records[0].kind, layout.records[0].variant, settings.shapes[layout.records[0].kind])).tree;
  stats.tree = one
    ? [['height', metres(first.height)], ['reach', metres(first.reach)], ['crown', metres(first.crown)], ['triangles', count(numbers.triangles)], ['grown in', grownIn(numbers)]]
    : [['trees', count(numbers.trees)], ['tallest', metres(layout.tallest)], ['spacing', metres(layout.spacing)], ['triangles', count(numbers.triangles)], ['grown in', grownIn(numbers)]];
  // (On the tree's left: the panel covers the right of the view.)
  personByTree.set(one ? treeSpot.x - Math.max(2, first.reach + 1) : layout.records[0].x - layout.spacing / 2, 0, one ? treeSpot.z + 0.6 : layout.records[0].z);
  if (hills) personByTree.y = terrain.heightAt(personByTree.x, personByTree.z);
  if (settings.tab === 'tree') {
    trunks = hills ? trunksOf(garden) : []; // (what the figure walks round, on the hills)
    person.position.copy(personByTree);
    fitTreeStage();
    showStats();
  }
  showMarks();
  if (frame) frameView();
});

// The Forest tab's trees, on its hills.
const growForest = safely(function growForest({ frame = false } = {}) {
  const start = performance.now();
  const newGround = setTerrain();
  // A kind of several ages: each of its shapes is the Tree tab's tree at an
  // age of its own (src/age.js), and since its age sets its size, the
  // forest's own "size" varies it a third as much.
  const aged = new Map(KINDS.filter((kind) => hasAges(kind) && settings.forest.mix[kind].mixed).map((kind) => {
    const ages = agesOf(settings.forest.variants, settings.forest.mix[kind].ages, settings.forest.mix[kind].old);
    return [kind, { ages, shapes: ages.map((age) => reAged(kind, settings.shapes[kind], age)) }];
  }));
  // Grown in a wood (src/woodGrown.js): with "crowns close in a wood", the trees of TreeLab's own kinds are placed as
  // they would grow among others, their crowns narrow (so the rules let them stand closer, and a wood set by cover takes
  // more of them); then each is asked whether it is hemmed in. One that is keeps its forest-grown shape, as a variant of
  // its own past the kind's others (variant + "variants a kind"); one at the edge, in a clearing or above the rest grows
  // in the open after all. Each at its own age, if its kind is of several.
  const n = settings.forest.variants;
  const closes = settings.forest.closes;
  const woodShapes = new Map();
  const woodShape = (kind, variant) => {
    const key = `${kind}|${variant}`;
    if (!woodShapes.has(key)) {
      const closed = closedShape(kind, settings.shapes[kind]);
      woodShapes.set(key, aged.has(kind) ? reAged(kind, closed, aged.get(kind).ages[variant]) : closed);
    }
    return woodShapes.get(key);
  };
  // (The rules reckon with how tall and wide each tree stands: its own shape's, at its own age. src/site.js.)
  const stands = new Map();
  const standing = (kind, variant) => {
    const wood = closes && isOwn(kind);
    const key = `${kind}|${aged.has(kind) || wood ? variant : 0}|${wood}`;
    if (!stands.has(key)) stands.set(key, standOf(wood ? woodShape(kind, variant) : aged.get(kind)?.shapes[variant] ?? settings.shapes[kind]));
    return stands.get(key);
  };
  // (A kind of several ages is sized by its age: the forest's own "size" varies it a third as much.)
  const sized = { ...settings.forest, sizeOf: (kind, size) => (aged.has(kind) ? 1 + (size - 1) / 3 : size) };
  const { records, report } = placeForest(sized, terrain, standing);
  for (const r of records) r.seed = settings.tree.seed;
  let closedCount = 0;
  if (closes) {
    const trees = records.map((r) => { const s = standing(r.kind, r.variant); return { x: r.x, z: r.z, height: s.height * r.size, crown: s.crown * r.size }; });
    const hemmed = hemmedIn(trees);
    records.forEach((r, i) => { if (isOwn(r.kind) && hemmed.has(i)) { r.variant += n; closedCount++; } });
  }
  // (Each tree of TreeLab's own: its age and whether it grew in a wood, for the panel to say when it is selected.)
  for (const r of records) {
    if (!isOwn(r.kind)) continue;
    r.wood = r.variant >= n;
    r.age = aged.get(r.kind)?.ages[r.variant % n] ?? settings.shapes[r.kind].age;
  }
  const shapeOf = (kind, variant) => inSeason(kind, variant, variant >= n ? woodShape(kind, variant - n) : aged.get(kind)?.shapes[variant] ?? settings.shapes[kind]);
  // (On the hills: TreeLab's own kinds each set on the ground under it, with roots of its own over it. src/tree.js.)
  const numbers = planters.forest.plant(woods, records, settings.shapes, { colorOf, mottle, shapeOf, ground: terrain });
  keepSelection('forest', records);
  trunks = trunksOf(woods); // (what the figure walks round)
  wireframe(woods);
  setEdge();
  rig.bind({ trees: woods, terrain, canopy: woods.userData.trees, warmUp: Math.min(20, 4000 / Math.max(1, records.length)) });
  shadeSoon();
  dirty.forest = false;
  const ms = performance.now() - start;

  const hectares = areaOf({ shape: settings.forest.area, radius: settings.forest.radius }) / 10000;
  const kinds = KINDS.map((k) => [k, records.filter((r) => r.kind === k).length]).filter(([, n]) => n);
  for (const [kind, row] of mixRows) row.stands(records.filter((r) => r.kind === kind).length); // (the mix's table: how many of each stand)
  // (By cover: what stands of each layer's cover, and of each kind's share of its layer, beside what was asked.)
  const percent = (v) => `${Math.round(100 * v)}%`;
  for (const [name, told] of Object.entries(report.layers ?? {})) {
    const any = Object.keys(told.kinds).length > 0;
    layerRows.get(name).says(any ? percent(told.stands) : 'none', any
      ? `${percent(told.stands)} of the ground lies under a crown of the ${name} as planted (asked: ${percent(told.asked)}).${told.full ? ` As many seeds fell as a forest may hold (${count(MAX_TREES)}): the rules and the ground let no more of them stand.` : ''}`
      : `No kind of the ${name} is ticked.`);
    for (const [kind, got] of Object.entries(told.kinds)) {
      mixRows.get(kind).says(`${percent(got.stands)} · ${got.trees}`, `${kindName(kind)}: ${percent(got.stands)} of the ${name}'s crowns as planted (asked: ${percent(got.asked)}), ${got.trees} ${got.trees === 1 ? 'tree' : 'trees'}.`);
    }
  }
  if (report.layers) for (const [kind, row] of mixRows) if (!(kind in report.layers[layerOf(kind)].kinds)) row.says('');
  stats.forest = [
    ['trees', count(records.length)],
    ['per hectare', count(records.length / hectares)],
    // (By cover the layers have rows of their own, below: this is every layer together, measured on the trees as grown.)
    [report.layers ? 'under leaves' : 'canopy cover', `${Math.round(100 * canopyCover(woods, { shape: settings.forest.area, radius: settings.forest.radius }).cover)}%`],
    ...Object.entries(report.layers ?? {}).filter(([, told]) => Object.keys(told.kinds).length).map(([name, told]) => [`${name} crowns`, `${percent(told.stands)} of the ground (asked ${percent(told.asked)})`]),
    ...kinds.map(([k, n]) => [kindName(k), `${count(n)} (${Math.round((100 * n) / Math.max(1, records.length))}%)`]),
    ...kinds.filter(([k]) => aged.has(k)).map(([k]) => [`${kindName(k)} ages`, `${aged.get(k).ages.join(', ')} years`]),
    ...(settings.forest.closes ? [['grown in a wood', `${count(closedCount)} of ${count(records.length)}`]] : []),
    ...(report.clearings ? [['in clearings', `${count(report.clearings)} left out`]] : []),
    ...(report.steep ? [['too steep', `${count(report.steep)} left out`]] : []),
    ...(report.crowded ? [['no room', `${count(report.crowded)} crowded out`]] : []),
    ...(report.shaded ? [['too dark', `${count(report.shaded)} shaded out`]] : []),
    ...(report.thinnedTo ? [['thinned', `to ${count(report.thinnedTo)} a hectare (at most ${count(MAX_TREES)} trees)`]] : []),
    ...(report.capped ? [['over the cap', `${count(report.capped)} left out`]] : []),
    ['trees grown', `${numbers.models} shapes, ${numbers.grown} new`],
    ...(numbers.roots?.left ? [['roots', `drawn for the ${count(numbers.roots.trees)} trees nearest the middle; ${count(numbers.roots.left)} further out stand without them`]] : []),
    ['triangles', count(numbers.triangles)],
    ...(numbers.triangles > HEAVY ? [['heavy', 'fewer trees or simpler shapes will run smoother']] : []),
    ['planted in', `${ms.toFixed(0)} ms${newGround ? ' (new hills)' : ''}`],
  ];
  person.position.set(0, terrain.heightAt(0, 0), 0);
  forestReadout.trees = `${count(records.length)} trees`;
  if (settings.tab === 'forest') {
    fitForestStage();
    showStats();
  }
  showMarks();
  if (frame) frameView();
});

// The forest's stage: as wide as the forest, and as tall as its tallest tree
// stands above the ground at its middle (trees on a hill stand higher), so
// the sun's shadows and the mist take in the crowns' tops and the long
// shadows they throw.
// One tree's or the grid's stage, on the ground they stand on.
function fitTreeStage() {
  fitStage(new THREE.Vector3(treeSpot.x, spotGround(), treeSpot.z), gardenSize.extent, gardenSize.tallest);
}
function fitForestStage() {
  const base = terrain.heightAt(0, 0);
  const reach = settings.forest.radius * (settings.forest.area === 'square' ? Math.SQRT2 : 1);
  fitStage(new THREE.Vector3(0, base, 0), reach + 3, Math.max(12, treetops(woods, base)));
}

function regrow({ frame = false } = {}) {
  if (settings.tab === 'tree') growTree({ frame });
  else growForest({ frame });
}

// A shape the generator can't grow (it shouldn't happen inside the sliders,
// tests/limits.test.js): say so, and leave the last trees standing.
function safely(grow) {
  return (options) => {
    try {
      grow(options);
    } catch (error) {
      console.error(error);
      note(`These settings can't grow a tree (${error.message}). Try moving the last slider back a little.`, 8000);
    }
  };
}

// --- The camera ---------------------------------------------------------------------

const views = { tree: null, forest: null }; // each tab's camera, while away from it
const tilt = new THREE.Vector3(0.45, 0.18, 1).normalize();
function frameView() {
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  setStanding((settings.tab === 'forest' || onHills()) && settings.view.stand);
  if (settings.tab === 'tree' && standing) {
    // One tree on the hills, walked round: the figure where it stands beside the tree, facing it.
    const { x, z } = personByTree;
    Object.assign(walker, createWalker({ x, z, y: terrain.heightAt(x, z), heading: Math.atan2(treeSpot.x - x, treeSpot.z - z) }));
    viewFromWalker();
  } else if (settings.tab === 'tree') {
    const { extent, tallest } = gardenSize;
    const distance = Math.max((tallest * 0.62) / tanV, (extent * 1.15) / (tanV * camera.aspect), 6);
    controls.target.set(treeSpot.x, spotGround() + tallest * 0.45, treeSpot.z);
    camera.position.copy(controls.target).addScaledVector(tilt, distance + (settings.tree.show === 'grid' ? extent * 0.5 : 0));
  } else if (standing) {
    // Among the trees, facing the sun (src/stand.js): the figure there,
    // and the camera with it.
    const spot = standingSpot({ trees: woods.userData.trees ?? [], toSun: sunDirection, radius: settings.forest.radius });
    Object.assign(walker, createWalker({ x: spot.x, z: spot.z, y: terrain.heightAt(spot.x, spot.z), heading: Math.atan2(sunDirection.x, sunDirection.z) }));
    viewFromWalker(sunDirection);
  } else {
    const r = settings.forest.radius;
    controls.target.set(0, terrain.heightAt(0, 0) + 3, 0);
    camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(0.5, 0.42, 1).normalize(), (r * 1.25) / Math.min(tanV * camera.aspect, tanV) + 6);
  }
  controls.update();
  fitVeil(); // (at once: the first frame may be a while coming)
}

// Walking among the trees (the Forest tab's "walk among the trees":
// src/stand.js, src/walker.js, src/figure.js). The figure walks the forest
// and the camera goes with it: behind it, turning round it as it's dragged,
// nearer or further by the wheel; or through its eyes ("through its
// eyes"), at eye height, where a drag looks round (the view following the
// pointer, and up into the crowns).
//
// The keys: W A S D or the arrows walk, the way the camera looks; Shift
// runs; Space jumps. A game pad (the workshop's reader,
// vendor/workshop/gamepad.js): the left stick walks, the right stick looks
// round, the right trigger runs (as far as it's squeezed), A jumps.
// Through its eyes the wheel walks too, and a drag with the right button
// or two fingers pulls the ground along.
const STAND = { minDistance: PIVOT, maxDistance: PIVOT, minPolarAngle: Math.PI * 0.15, maxPolarAngle: Math.PI * 0.9, panSpeed: 40, screenSpacePanning: false, enablePan: true };
const FOLLOW = { minDistance: 1.5, maxDistance: 25, minPolarAngle: Math.PI * 0.08, maxPolarAngle: Math.PI * 0.6, rotateSpeed: 1, enablePan: false };
const CHEST = 1.35;  // m above its feet: what the camera behind it turns round
const BEHIND = 4.5;  // m: how far behind it the camera starts
const hintEl = document.getElementById('hint');
const HINT = { round: hintEl.textContent, among: 'W A S D or the arrows walk, Shift runs, Space jumps. Drag to look round. Click a tree to select it, double-click to see it alone. H hides the panels.' };
const HOW_TO_WALK = 'W A S D or the arrow keys walk, Shift runs, Space jumps; a game pad works too (left stick, right trigger to run, A to jump). Drag to look round.';
const walker = createWalker();  // the figure walking (src/walker.js)
const still = createWalker();   // and standing where it's put, when nobody walks it
const pad = createGamepad();
let trunks = [];                // the forest's trunks: [{ x, z, r }]
const walkGround = { heightAt: (x, z) => terrain.heightAt(x, z), get trunks() { return trunks; }, get half() { return terrain.half - 2; } };
let throughEyes = false;        // (which of the two the camera is set up for)
function setStanding(on) {
  if (Boolean(on) === standing && settings.view.eyes === throughEyes) return;
  standing = Boolean(on);
  throughEyes = settings.view.eyes;
  held.clear();
  // (Walking: the keys are the figure's. A row just clicked still has the keyboard, and would take them: the
  // arrows would change its list, Space untick its box.)
  if (standing) document.activeElement?.blur?.();
  rolling = 0;
  hintEl.textContent = standing ? HINT.among : HINT.round;
  if (!standing) Object.assign(controls, ORBIT, { maxDistance: Math.max(60, stageRadius * 3.5) });
  else if (throughEyes) Object.assign(controls, STAND, { rotateSpeed: -camera.fov / 360 }); // (a drag turns the view by as much as it's dragged)
  else Object.assign(controls, FOLLOW);
}

// The camera put where the walker is: at its eyes, or behind it and a
// little above, looking `toward` ({ x, z } on the map; the way it faces
// if not given).
function viewFromWalker(toward = null) {
  const fx = toward?.x ?? Math.sin(walker.heading), fz = toward?.z ?? Math.cos(walker.heading);
  const length = Math.hypot(fx, fz) || 1;
  if (settings.view.eyes) {
    const view = standingView({ spot: walker, toSun: { x: fx, z: fz }, ground: walker.y });
    camera.position.copy(view.position);
    controls.target.copy(view.target);
  } else {
    controls.target.set(walker.x, walker.y + CHEST, walker.z);
    camera.position.set(walker.x - (fx / length) * BEHIND, walker.y + CHEST + 1.1, walker.z - (fz / length) * BEHIND);
  }
}

// Walking: the keys held, a jump asked, and how far the wheel has still to
// roll (m).
const WALK = { KeyW: [1, 0], ArrowUp: [1, 0], KeyS: [-1, 0], ArrowDown: [-1, 0], KeyD: [0, 1], ArrowRight: [0, 1], KeyA: [0, -1], ArrowLeft: [0, -1] };
const held = new Set();
let rolling = 0, jumpAsked = false;
const _step = new THREE.Vector3(), _offset = new THREE.Vector3(), _round = new THREE.Spherical();
function walk(dt) {
  pad.poll();
  if (!standing) return;
  const eyes = settings.view.eyes;
  // (Through its eyes, a drag that pulled the ground along has moved the
  // camera: the figure goes with it.)
  if (eyes) {
    walker.x = camera.position.x;
    walker.z = camera.position.z;
  }
  // What's asked: the keys and the pad together, the way the camera looks.
  let ahead = pad.drive.forward, aside = -pad.drive.turn;
  for (const code of held) {
    ahead += WALK[code]?.[0] ?? 0;
    aside += WALK[code]?.[1] ?? 0;
  }
  const run = held.has('ShiftLeft') || held.has('ShiftRight') ? 1 : pad.drive.run;
  const jump = jumpAsked || pad.pressed('a');
  jumpAsked = false;
  const facing = { x: controls.target.x - camera.position.x, z: controls.target.z - camera.position.z };
  stepWalker(walker, wanted({ ahead: THREE.MathUtils.clamp(ahead, -1, 1), aside: THREE.MathUtils.clamp(aside, -1, 1), run, jump }, facing), dt, walkGround);
  // The wheel (through its eyes): so far ahead still to roll.
  const rolled = Math.abs(rolling) < 0.01 ? rolling : rolling * (1 - Math.exp(-dt * 6));
  rolling -= rolled;
  if (rolled) {
    stepOnGround(camera.position, controls.target, rolled, 0, _step);
    walker.x += _step.x;
    walker.z += _step.z;
    if (walker.grounded) walker.y = terrain.heightAt(walker.x, walker.z);
  }
  // The camera goes with it: its eye at the figure's, or what it turns
  // round at the figure's chest.
  if (eyes) _step.set(walker.x - camera.position.x, walker.y + EYE - camera.position.y, walker.z - camera.position.z);
  else _step.set(walker.x - controls.target.x, walker.y + CHEST - controls.target.y, walker.z - controls.target.z);
  camera.position.add(_step);
  controls.target.add(_step);
  // The pad's right stick looks round: through its eyes the view turns,
  // behind it the camera goes round the figure.
  if (pad.look.x || pad.look.y) {
    const turn = THREE.MathUtils.degToRad(pad.settings.cameraSpeed) * dt;
    if (eyes) {
      _round.setFromVector3(_offset.subVectors(controls.target, camera.position));
      _round.theta -= pad.look.x * turn;
      _round.phi = THREE.MathUtils.clamp(_round.phi - pad.look.y * turn, Math.PI * 0.1, Math.PI * 0.85);
      controls.target.copy(camera.position).add(_offset.setFromSpherical(_round));
    } else {
      _round.setFromVector3(_offset.subVectors(camera.position, controls.target));
      _round.theta -= pad.look.x * turn;
      _round.phi = THREE.MathUtils.clamp(_round.phi + pad.look.y * turn, controls.minPolarAngle, controls.maxPolarAngle);
      camera.position.copy(controls.target).add(_offset.setFromSpherical(_round));
    }
  }
}

// The figure where it walks, or standing where it was put; its limbs moved,
// and its feet on the ground under them. (Through its eyes it isn't drawn:
// the camera is in its head.)
function poseFigure(dt) {
  if (standing) {
    person.position.set(walker.x, walker.y, walker.z);
    person.rotation.y = walker.heading;
  } else Object.assign(still, { x: person.position.x, y: person.position.y, z: person.position.z, heading: person.rotation.y });
  person.visible = standing ? !settings.view.eyes : settings.view.person;
  body?.update(dt, standing ? walker : still, hillsShown());
}
renderer.domElement.addEventListener('wheel', (e) => {
  if (!standing || !settings.view.eyes) return; // (behind the figure, the wheel moves the camera nearer or further)
  // (A notch of the wheel: a metre and a half.)
  rolling = Math.min(12, Math.max(-12, rolling - (e.deltaMode === 1 ? e.deltaY / 3 : e.deltaY / 100) * 1.5));
}, { passive: true });
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());

// --- What's shown --------------------------------------------------------------------

// Three buttons at the top of the settings: one tree, a grid of them, or a
// forest. Underneath they are the settings they always were (the tab, "tree"
// or "forest", and the tree tab's "show", one tree or a grid), so links are
// as they were.
const modeButtons = [...document.querySelectorAll('#tabs button[data-mode]')];
const modeOf = () => ((shown ?? settings.tab) === 'forest' ? 'forest' : settings.tree.show === 'grid' ? 'grid' : 'one');
function showMode(mode) {
  const tab = mode === 'forest' ? 'forest' : 'tree';
  const show = mode === 'grid' ? 'grid' : 'one tree';
  const changed = tab === 'tree' && settings.tree.show !== show;
  if (changed) {
    settings.tree.show = show;
    if (shown === 'tree') select(null); // (the selected tree was one of the other trees)
    dirty.tree = true;
  }
  showTab(tab, { frame: changed });
}
let shown = null; // the tab on screen
function showTab(tab, { frame = false, keepView = true } = {}) {
  if (shown && shown !== tab && keepView) views[shown] = { position: camera.position.clone(), target: controls.target.clone(), standing };
  if (shown !== tab) select(null); // (a selected tree is one of the tab's it was picked on)
  shown = tab;
  settings.tab = tab;
  showStages();
  for (const f of folders.tree) f.show(tab === 'tree');
  for (const f of folders.forest) f.show(tab === 'forest');
  for (const c of treeOnlyRows) c.show(tab === 'tree');
  showGridRows();
  showGroundRows();
  edgeRow.show(tab === 'forest');
  const firstTime = !views[tab];
  if (dirty[tab]) regrow();
  else if (tab === 'tree') rig.bind({ trees: garden, terrain: onHills() ? terrain : flat, warmUp: Math.min(20, 2000 / Math.max(1, garden.userData.count)) });
  else rig.bind({ trees: woods, terrain, canopy: woods.userData.trees, warmUp: Math.min(20, 4000 / Math.max(1, woods.userData.count)) });
  shadeSoon();
  if (tab === 'tree') {
    fitTreeStage();
    person.position.copy(personByTree); // (back from the forest's middle)
    trunks = onHills() ? trunksOf(garden) : []; // (what the figure walks round: the one tree's trunk, on the hills)
  } else {
    fitForestStage();
    person.position.set(0, terrain.heightAt(0, 0), 0);
    trunks = trunksOf(woods);
  }
  if (frame || firstTime) frameView();
  else {
    setStanding(views[tab].standing);
    camera.position.copy(views[tab].position);
    controls.target.copy(views[tab].target);
    controls.update();
  }
  showStats();
  showKind(); // (the left panel: this tab's kind)
  remember();
}
for (const b of modeButtons) b.addEventListener('click', () => showMode(b.dataset.mode));

// --- The panel ----------------------------------------------------------------------

// The cards (what's shown and one kind's settings, on the left; the
// settings, on the right) fold away to their top row: each by its own
// button, all by H. Which are folded is this viewer's own, kept in the
// browser (never in settings or links).
const cards = { info: document.getElementById('info'), kind: document.getElementById('kind'), panel: document.getElementById('panel') };
const foldButtons = [...document.querySelectorAll('.fold[data-folds]')];
function fold(name, folded) {
  cards[name].classList.toggle('folded', folded);
  const button = foldButtons.find((b) => b.dataset.folds === name);
  button.setAttribute('aria-expanded', String(!folded));
  button.title = folded ? 'Show it again (H: all)' : 'Fold it away (H: all)';
  try {
    localStorage.setItem(FOLD_STORE, Object.keys(cards).filter((key) => cards[key].classList.contains('folded')).join(','));
  } catch {
    // (no storage)
  }
}
const folded = (name) => cards[name].classList.contains('folded');
for (const button of foldButtons) button.addEventListener('click', () => fold(button.dataset.folds, !folded(button.dataset.folds)));
// (H: all away, or, if all already are, all back.)
const foldBoth = () => {
  const away = !Object.keys(cards).every(folded);
  for (const name of Object.keys(cards)) fold(name, away);
};
{
  let kept = '';
  try {
    kept = localStorage.getItem(FOLD_STORE) ?? '';
  } catch {
    // (no storage)
  }
  for (const name of Object.keys(cards)) fold(name, kept.split(',').includes(name));
}

// A card's edge, dragged, makes it wider or narrower (src/panelWidth.js):
// the left of the screen by its right edge, the settings by their left
// edge. The arrow keys move a focused edge; a double-click puts the width
// back. How wide is this viewer's own too, kept in the browser.
{
  const wide = { left: document.getElementById('left'), panel: document.getElementById('panel') };
  const grows = { left: 1, panel: -1 };
  let widths = {};
  try {
    widths = readWidths(localStorage.getItem(WIDTH_STORE), Object.keys(wide));
  } catch {
    // (no storage)
  }
  const keep = () => {
    try {
      localStorage.setItem(WIDTH_STORE, writeWidths(widths));
    } catch {
      // (no storage)
    }
  };
  const setWidth = (name, width) => {
    if (width === null) {
      delete widths[name];
      wide[name].style.width = '';
    } else {
      widths[name] = widthAfter(width, 0, { most: mostFor(innerWidth) });
      wide[name].style.width = `${widths[name]}px`;
    }
  };
  for (const name of Object.keys(widths)) setWidth(name, widths[name]);
  for (const edge of document.querySelectorAll('.edge[data-widens]')) {
    const name = edge.dataset.widens;
    edge.title = 'Drag to make this wider or narrower. A double-click puts it back.';
    edge.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      const from = { x: e.clientX, width: wide[name].getBoundingClientRect().width };
      edge.setPointerCapture(e.pointerId);
      edge.classList.add('dragging');
      const move = (m) => setWidth(name, widthAfter(from.width, m.clientX - from.x, { grows: grows[name], most: mostFor(innerWidth) }));
      const up = () => {
        edge.removeEventListener('pointermove', move);
        edge.removeEventListener('pointerup', up);
        edge.removeEventListener('pointercancel', up);
        edge.classList.remove('dragging');
        keep();
      };
      edge.addEventListener('pointermove', move);
      edge.addEventListener('pointerup', up);
      edge.addEventListener('pointercancel', up);
    });
    edge.addEventListener('keydown', (e) => {
      const by = { ArrowLeft: -16, ArrowRight: 16 }[e.key];
      if (!by) return;
      e.preventDefault();
      setWidth(name, widthAfter(wide[name].getBoundingClientRect().width, by, { grows: grows[name], most: mostFor(innerWidth) }));
      keep();
    });
    edge.addEventListener('dblclick', () => {
      setWidth(name, null);
      keep();
    });
  }
}

// Each part of the panel in a washed-out colour of its own (index.html:
// [data-tint]), so one tells from the next: the panel's own folders, and
// the sections of a tree's shape (src/sections.js).
const TINTS = {
  scene: 'wood', pattern: 'wood', 'groves and clearings': 'wood', 'where trees grow': 'wood', mix: 'leaf', ground: 'earth',
  sky: 'sun', light: 'sun', 'season and colour': 'autumn', wind: 'air', 'the wind': 'air', you: 'slate', 'save and share': 'paper',
};
const SECTION_TINTS = { size: 'slate', trunk: 'bark', roots: 'earth', limbs: 'wood', crown: 'leaf', movement: 'air', other: 'paper' };
const tint = (folder, name) => {
  if (name) folder.domElement.dataset.tint = name;
  return folder;
};

// The kinds as the panel names them, each for its key.
const KIND_OPTIONS = Object.fromEntries(KINDS.map((kind) => [kindName(kind), kind]));

const gui = new GUI({ container: document.getElementById('gui'), title: 'settings' });
// One kind of tree's settings, on the left of the screen: the selected
// tree's kind (see "Selecting", below, and fillKindPanel).
const kindGui = new GUI({ container: document.getElementById('kind-gui'), title: 'kind' });
const rows = () => [...gui.controllersRecursive(), ...kindGui.controllersRecursive()];
const refreshPanel = () => rows().forEach((c) => c.updateDisplay());
// (On a phone there is no room beside the trees: the kind's rows sit under the settings', in the one sheet.)
{
  const phone = matchMedia('(max-width: 700px)');
  const place = () => document.getElementById(phone.matches ? 'gui' : 'kind-gui').append(kindGui.domElement);
  phone.addEventListener('change', place);
  place();
}
const folders = { tree: [], forest: [] };
const range = (path) => RANGES[path];

// Both tabs, first: a whole starting point (src/scenes.js); "custom" once
// anything is changed.
const scenePick = { scene: 'custom' };
const sceneRow = gui.add(scenePick, 'scene', [...Object.keys(SCENES), 'custom']).name('start from').onChange((name) => {
  if (name === 'custom') return showScene();
  if (sceneOf(settings) === 'custom' && !confirm(`Start from "${name}"? Your own settings will be replaced.`)) return showScene();
  applySettings(sceneSettings(name), SCENES[name].says);
});
function showScene() {
  scenePick.scene = sceneOf(settings);
  sceneRow.updateDisplay();
}

// A row's changes regrow the trees that depend on it. lil-gui keeps one
// onChange a row, so anything else the row does comes in as `also`.
//   tree:   the Tree tab's trees, as it moves;
//   forest: the forest, when it's let go (planting takes longer);
//   both:   the shown tab's trees (the forest when let go), the other
//           tab's when it's next shown.
function watch(c, what, { frame = false, also } = {}) {
  c.onChange(() => {
    also?.();
    if (what === 'tree') growTree({ frame });
    if (what === 'both') {
      dirty[settings.tab === 'tree' ? 'forest' : 'tree'] = true;
      if (settings.tab === 'tree') growTree({ frame });
    }
    remember();
  });
  if (what !== 'tree') {
    c.onFinishChange(() => {
      if (settings.tab === 'forest') growForest({ frame });
    });
  }
  return c;
}

// A [least, most] range as one row with two handles (src/rangeSlider.js).
function addRange(folder, object, key, name, [lo, hi, step], what) {
  return watch(new RangeController(folder, object, key, lo, hi, step).name(name), what);
}

// (The tree's kind, seed and variant are on the left, at the top of its kind's panel: see shapeKind.)

// The grid's scene: how many trees, and how they differ. (Its own section,
// shown only with the grid; "show: one tree or grid" is the buttons at the top.)
const showFolder = gui.addFolder('scene');
const gridRows = [];
gridRows.push(watch(showFolder.add(settings.tree, 'rows', ...range('tree.rows')), 'tree', { frame: true }));
gridRows.push(watch(showFolder.add(settings.tree, 'cols', ...range('tree.cols')).name('columns'), 'tree', { frame: true }));
gridRows.push(watch(showFolder.add(settings.tree, 'vary', CHOICES['tree.vary']).name('vary'), 'tree'));
gridRows.push(watch(showFolder.add(settings.tree, 'gap', ...range('tree.gap')).name('gap between crowns (m)'), 'tree', { frame: true }));
gridRows.push(watch(showFolder.add(settings.tree, 'labels').name('labels'), 'tree'));

// The figure for scale, on or off: a row in each tab's first folders (the
// same setting, so both say the same).
const personRows = [];
function addPersonRow(folder) {
  const row = folder.add(settings.view, 'person').name(personName()).onChange((on) => {
    person.visible = on;
    for (const other of personRows) if (other !== row) other.updateDisplay();
    remember();
  });
  personRows.push(row);
  return row;
}
// What the buttons at the top say, and the grid's section shown with the grid alone.
function showGridRows() {
  showFolder.show((shown ?? settings.tab) === 'tree' && settings.tree.show === 'grid');
  for (const b of modeButtons) b.setAttribute('aria-selected', String(b.dataset.mode === modeOf()));
  showGroundRows(); // (one tree's ground choice goes with one tree)
}

// Forest tab: where the trees stand.
const forestReadout = { trees: '' };
const forestFolder = gui.addFolder('scene');
folders.forest.push(forestFolder);
forestFolder.add(forestReadout, 'trees').name('holds').disable().listen();
watch(forestFolder.add(settings.forest, 'seed', ...range('forest.seed')).name('seed (where they stand)'), 'forest');
forestFolder.add({
  newLayout() {
    settings.forest.seed = 1 + Math.floor(Math.random() * 999);
    refreshPanel();
    growForest();
    remember();
  },
}, 'newLayout').name('new layout');
watch(forestFolder.add(settings.forest, 'area', CHOICES['forest.area']), 'forest', { also: () => nameRadius() });
const radiusRow = watch(forestFolder.add(settings.forest, 'radius', ...range('forest.radius')), 'forest', { frame: true });
const nameRadius = () => radiusRow.name(settings.forest.area === 'circle' ? 'radius R (m)' : 'half its side (m)');
const densityRow = watch(forestFolder.add(settings.forest, 'density', ...range('forest.density')).name('seeds per hectare'), 'forest');
watch(forestFolder.add(settings.forest, 'closes').name('crowns close in a wood'), 'forest');
// The forest from among its trees, or from above (src/stand.js).
const amongRow = forestFolder.add(settings.view, 'stand').name('walk among the trees').onChange((on) => {
  frameView();
  remember();
  const one = shown === 'tree';
  note(on ? `${one ? 'You stand beside the tree, facing it.' : 'You walk among the trees, facing the sun.'} ${HOW_TO_WALK}` : one ? 'Back to looking round the tree.' : 'Back above the forest.', on ? 10000 : 3000);
});
// Behind the figure, or through its eyes.
const eyesRow = forestFolder.add(settings.view, 'eyes').name('through its eyes').onChange(() => {
  if (standing) {
    // (Looking the way the camera did.)
    const toward = { x: controls.target.x - camera.position.x, z: controls.target.z - camera.position.z };
    setStanding(true);
    viewFromWalker(toward);
    controls.update();
  }
  remember();
});

const patternFolder = gui.addFolder('pattern');
folders.forest.push(patternFolder);
watch(patternFolder.add(settings.forest, 'pattern', CHOICES['forest.pattern']), 'forest', { also: () => showPatternRows() });
const patternRows = {
  'jittered grid': [watch(patternFolder.add(settings.forest, 'jitter', ...range('forest.jitter')).name('jitter (share of a cell)'), 'forest')],
  clumps: [
    watch(patternFolder.add(settings.forest, 'clumpTrees', ...range('forest.clumpTrees')).name('trees a clump'), 'forest'),
    watch(patternFolder.add(settings.forest, 'clumpSpread', ...range('forest.clumpSpread')).name('clump spread (m)'), 'forest'),
  ],
  rows: [watch(patternFolder.add(settings.forest, 'rowAngle', ...range('forest.rowAngle')).name('rows run at (°)'), 'forest')],
};
const showPatternRows = () => Object.entries(patternRows).forEach(([p, rows]) => rows.forEach((c) => c.show(settings.forest.pattern === p)));

// Forest tab: the rules for where each kind of tree grows (src/site.js).
const rulesFolder = gui.addFolder('where trees grow').close();
folders.forest.push(rulesFolder);
watch(rulesFolder.add(settings.forest.rules, 'ground', ...range('forest.rules.ground')).name('each kind to its ground'), 'forest');
watch(rulesFolder.add(settings.forest.rules, 'room', ...range('forest.rules.room')).name('room between trees'), 'forest');
watch(rulesFolder.add(settings.forest.rules, 'light', ...range('forest.rules.light')).name('light under the crowns'), 'forest');
const patchFolder = gui.addFolder('groves and clearings').close();
folders.forest.push(patchFolder);
watch(patchFolder.add(settings.forest, 'patches').name('groves and clearings'), 'forest', { also: () => showPatchRows() });
const patchRows = [
  watch(patchFolder.add(settings.forest, 'patchSize', ...range('forest.patchSize')).name('grove size (m)'), 'forest'),
  watch(patchFolder.add(settings.forest, 'cover', ...range('forest.cover')).name('groves cover (share)'), 'forest'),
];
const showPatchRows = () => patchRows.forEach((c) => c.show(settings.forest.patches));

// Forest tab: which kinds grow, as a table, a row a kind (src/mixTable.js):
// whether it grows, its share, and how many of it stand as planted. The
// kinds are in their groups (src/kinds.js: KIND_GROUPS). A click on a
// kind's name shows that kind in the panel on the left, where the rest of
// what is the kind's own is: its shape, its greens, its ages in the
// forest, where it grows.
//
// The mix is set one of two ways ("set the mix"): by count, a kind's share
// its share of the seeds, the kinds listed by their country; or by cover
// (src/cover.js), the kinds listed under their layer, the canopy
// and the underwood, each layer with a row of its own for how much of the
// ground it covers, and a kind's share its share of its layer's crowns.
// "A wood of" starts the mix from a ready-made wood (src/woods.js), by
// cover.
const mixFolder = gui.addFolder('mix');
folders.forest.push(mixFolder);
const woodPick = { wood: 'custom' };
const woodRow = mixFolder.add(woodPick, 'wood', [...Object.keys(WOODS), 'custom']).name('a wood of').onChange((name) => {
  if (name === 'custom') return showWood();
  plantWood(settings.forest, name);
  refreshPanel();
  layMix();
  if (settings.tab === 'forest') growForest();
  remember();
  note(`The mix is "${name}", set by cover. The kinds' shapes are as they were: for a closed wood, start a kind from "forest-grown".`, 9000);
});
function showWood() {
  woodPick.wood = woodOf(settings.forest);
  woodRow.updateDisplay();
}
watch(mixFolder.add(settings.forest, 'mixBy', CHOICES['forest.mixBy']).name('set the mix'), 'forest', { also: () => layMix() });
const mixRows = new Map(); // (each kind's row)
const mixTop = mixHead();
mixFolder.$children.append(mixTop);
const mixGroups = KIND_GROUPS.map(({ title, kinds }) => ({ heading: mixGroup(title), kinds }));
for (const { heading, kinds } of mixGroups) {
  mixFolder.$children.append(heading);
  for (const kind of kinds) {
    mixRows.set(kind, watch(new MixController(mixFolder, settings.forest.mix[kind], kindName(kind), RANGES['forest.mix.share'], { onName: () => pickKind(kind) }), 'forest', { also: () => showWood() }));
  }
}
// (Each layer's own row: how much of the ground its crowns cover.)
const layerRows = new Map(LAYERS.map((name) => [name, watch(new MixController(mixFolder, settings.forest.layers, `${name} covers`, RANGES[`forest.layers.${name}`], { property: name, layer: true }), 'forest', { also: () => showWood() })]));
const groupingRow = watch(mixFolder.add(settings.forest, 'grouping', CHOICES['forest.grouping']).name('kinds grow'), 'forest', { also: () => standRow.show(settings.forest.grouping === 'in stands') });
// The table laid out for how the mix is set: by count, the kinds under
// their countries; by cover, under their layers. (The same rows, moved.)
function layMix() {
  const cover = settings.forest.mixBy === 'by cover';
  const put = (element) => mixFolder.$children.insertBefore(element, groupingRow.domElement);
  mixFolder.domElement.classList.toggle('by-cover', cover);
  mixTop.says(cover ? 'share of its layer (%)' : 'share (%)');
  for (const { heading } of mixGroups) heading.style.display = cover ? 'none' : '';
  for (const [, row] of layerRows) row.show(cover);
  if (cover) {
    for (const [name, row] of layerRows) {
      put(row.domElement);
      for (const kind of KINDS) if (layerOf(kind) === name) put(mixRows.get(kind).domElement);
    }
  } else {
    for (const { heading, kinds } of mixGroups) {
      put(heading);
      for (const kind of kinds) put(mixRows.get(kind).domElement);
    }
  }
  // (By cover the seeds are worked out, not asked.)
  densityRow.enable(!cover);
  showWood();
}
const standRow = watch(mixFolder.add(settings.forest, 'standSize', ...range('forest.standSize')).name('stand size (m)'), 'forest');
watch(mixFolder.add(settings.forest, 'variants', ...range('forest.variants')).name('variants a kind'), 'forest');
addRange(mixFolder, settings.forest, 'size', 'size', range('forest.size'), 'forest');

// The ground: the hills in the forest; flat, with its metre grid, under one tree or a grid.
const groundFolder = gui.addFolder('ground').close();
// One tree's ground: level, or the forest's hills (the grid is always level).
const groundChoice = groundFolder.add(settings.tree, 'ground', CHOICES['tree.ground']).onChange(() => {
  select(null);
  showGroundRows();
  growTree({ frame: true });
  remember();
});
// The hills are the forest's, and one tree's when it stands on them: a change grows whichever is shown.
const growOnHills = () => {
  if (shown === 'tree') {
    dirty.forest = true;
    if (onHills()) growTree();
  } else growForest();
};
const hillsRow = (row) => {
  row.onChange(remember);
  row.onFinishChange(growOnHills);
  return row;
};
const terrainRows = [
  hillsRow(groundFolder.add(settings.terrain, 'seed', ...range('terrain.seed')).name('seed (which hills)')),
  groundFolder.add({
    newHills() {
      settings.terrain.seed = 1 + Math.floor(Math.random() * 999);
      refreshPanel();
      growOnHills();
      remember();
    },
  }, 'newHills').name('new hills'),
  hillsRow(groundFolder.add(settings.terrain, 'height', ...range('terrain.height')).name('hills rise (m, 0 flat)')),
  hillsRow(groundFolder.add(settings.terrain, 'size', ...range('terrain.size')).name('hill size (m)')),
  hillsRow(groundFolder.add(settings.terrain, 'roughness', ...range('terrain.roughness'))),
];
const slopeRow = watch(groundFolder.add(settings.forest, 'maxSlope', ...range('forest.maxSlope')).name('steepest slope trees grow on (°)'), 'forest');
// The ground's rows for what's shown: the hills' in the forest or under one tree on them, the choice with one tree,
// the metre grid on level ground, the steepest slope in the forest.
function showGroundRows() {
  const tab = shown ?? settings.tab;
  const hills = tab === 'forest' || (tab === 'tree' && onHills());
  for (const c of terrainRows) c.show(hills);
  slopeRow.show(tab === 'forest');
  groundChoice.show(tab === 'tree' && settings.tree.show !== 'grid');
  gridRow.show(tab === 'tree' && !onHills());
  // (The walk: in the forest, and round one tree on the hills.)
  amongRow.show(hills);
  eyesRow.show(hills);
}

// Both tabs, on the left of the screen: one kind's shape, in a panel of its
// own. Which kind:
//   - the selected tree's (a click on a tree selects it);
//   - with none selected, in the Tree tab, the kind that tab shows;
//   - in the Forest tab, the kind last selected or picked from the list at
//     the panel's top. That choice is the panel's own: it is not a setting,
//     and a link doesn't carry it.
// Its sliders change every tree of the kind, in both tabs. A range is one
// row with two handles, the kind's least and most; where one tree is looked
// at (the selected tree, or the Tree tab's one tree), a red mark on each
// range shows what that tree drew for itself (showMarks).
const shapeFolder = kindGui;
const kindPick = { kind: settings.tree.kind }; // (the Forest tab's)
const kindShown = () => (shown === 'forest' ? kindPick.kind : selected?.tab === 'tree' ? selected.record.kind : settings.tree.kind);
const shapeKind = shapeFolder.add(kindPick, 'kind', KIND_OPTIONS).name('kind');
// The panel put on a kind: from the list at its top, or from the forest's
// mix (a click on a kind's name there).
function pickKind(kind) {
  kindPick.kind = kind;
  // (Another kind than the selected tree's: the tree is let go, or the panel would turn back to it when the forest is next planted.)
  if (selected && selected.record.kind !== kind) select(null);
  else showKind();
}
// The list at the top: with one tree or a grid, the kind grown (the tree's
// kind, a setting); in the forest, which kind's settings this panel shows.
shapeKind.onChange(() => {
  if (shown === 'forest') return pickKind(kindPick.kind);
  settings.tree.kind = kindPick.kind;
  select(null);
  dirty.forest = true; // (the forest's own trees don't change, but "start from" may)
  growTree({ frame: true });
  showKind();
  remember();
});
// The tree's seed and variant, under its kind: the seed is the forest's too
// (its trees grow from it), the variant only one tree's or the grid's.
const seedRow = watch(shapeFolder.add(settings.tree, 'seed', ...range('tree.seed')), 'both');
const variantRow = watch(shapeFolder.add(settings.tree, 'variant', ...range('tree.variant')), 'tree');
const newSeedRow = shapeFolder.add({
  newSeed() {
    settings.tree.seed = 1 + Math.floor(Math.random() * 999);
    refreshPanel();
    dirty.forest = true;
    if (shown === 'forest') growForest();
    else growTree();
    remember();
  },
}, 'newSeed').name('new seed');
const keptRows = new Set([shapeKind, seedRow, variantRow, newSeedRow]); // (kept when the panel is filled for another kind)
const treeOnlyRows = [variantRow];
let tintRow = null; // (the one tree's or grid's tint, among the greens)
const kindNameEl = document.getElementById('kind-name');
const kindSays = document.getElementById('kind-says');
let filled = null; // (the kind whose rows the panel holds)
let forestRows = null; // (its rows that are only the forest's: shown in the Forest tab)
const marks = new Map(); // (its rows that can mark one tree's value: by their setting)
// The panel on the kind it should show: filled again if that changed, and
// its marks either way.
function showKind() {
  if (kindShown() !== filled) fillShapeFolder();
  else showMarks();
}
// The tree whose own values are marked: the selected one; or, in the Tree
// tab with one tree shown, that tree.
function markedTree() {
  if (selected?.tab === shown) return { record: selected.record, group: shown === 'tree' ? garden : woods, picked: true };
  const alone = shown === 'tree' && settings.tree.show !== 'grid' ? gardenSize?.records : null;
  return alone?.length === 1 ? { record: alone[0], group: garden, picked: false } : null;
}
function showMarks() {
  forestRows?.show(shown === 'forest');
  tintRow?.show(shown !== 'forest');
  for (const [kind, row] of mixRows) row.shown(kind === filled); // (the mix's table marks the kind shown here)
  const tree = markedTree();
  const drew = tree && tree.record.kind === filled ? drawnIn(tree.group.userData.species, tree.record) : null;
  for (const [key, row] of marks) row.mark(drew?.[key] ?? null);
  kindSays.classList.toggle('marked', Boolean(drew));
  // (A forest's tree differs from its kind's handles: it has an age of its own (of several), it may have grown in a wood,
  // and the forest's own "size" makes it a little bigger or smaller. Each is said, since a mark can then lie outside the
  // handles; and the handles are said to be the kind as the Tree tab grows it.)
  const record = tree?.record ?? {};
  const size = record.size ?? 1;
  const shape = settings.shapes[filled] ?? {};
  const otherAge = record.age !== undefined && shape.age !== undefined && record.age !== shape.age;
  const sized = Math.abs(size - 1) > 0.005;
  const who = [record.age !== undefined ? `${record.age} years old` : '', record.wood ? 'grown in a wood' : '', selected ? `${selected.height.toFixed(1)} m tall` : ''].filter(Boolean).join(', ');
  const why = otherAge || record.wood || sized
    ? ` The handles are the ${kindName(filled)} as one tree grows it${shape.age !== undefined ? ` (${shape.age} years)` : ''}, so its marks can fall outside them${sized ? `; the forest's "size" makes it ${size.toFixed(2)} times as big` : ''}.`
    : '';
  if (drew) kindSays.textContent = tree.picked ? `The selected tree: ${who}.${why} The sliders change every ${kindName(filled)}.` : 'This tree\'s own values.';
  else if (tree?.record.kind === filled) kindSays.textContent = 'Selected. This kind\'s trees keep no values of their own to mark.';
  else kindSays.textContent = shown === 'forest' || settings.tree.show === 'grid' ? 'Click a tree to see where it falls in its kind\'s ranges.' : '';
}
const pick = { startFrom: 'workshop' }; // (the "start from" row's value)
let presetRow = null;
const crownPick = { form: 'custom' }; // (the "crown form" row's value, for a kind whose crown has forms)
let crownRow = null;
const showPreset = () => {
  pick.startFrom = presetOf(filled, settings.shapes[filled]);
  presetRow?.updateDisplay();
  crownPick.form = crownOf(filled, settings.shapes[filled]) ?? 'custom';
  crownRow?.updateDisplay();
};
function fillShapeFolder() {
  const kind = kindShown();
  // (Which sections are folded shut, and which of their own panels are open
  // (those start shut), before they go: the new ones start as these were.)
  for (const section of shapeFolder.folders) {
    section._closed ? shut.add(section._title) : shut.delete(section._title);
    for (const panel of section.folders) panel._closed ? opened.delete(`${section._title}/${panel._title}`) : opened.add(`${section._title}/${panel._title}`);
  }
  for (const child of [...shapeFolder.children]) if (!keptRows.has(child)) child.destroy();
  outlineRow = null;
  crownRow = null;
  marks.clear();
  filled = kind;
  shapeFolder.title(kindName(kind));
  kindNameEl.textContent = kindName(kind);
  if (kindPick.kind !== kind) kindPick.kind = kind; // (the list at the top says the same)
  shapeKind.updateDisplay();
  const shape = settings.shapes[kind];
  // Start from a ready-made shape (src/presets.js); "custom" once a slider moves.
  pick.startFrom = presetOf(kind, shape);
  presetRow = shapeFolder.add(pick, 'startFrom', [...Object.keys(PRESETS[kind]), 'custom']).name('start from').onChange((name) => {
    if (name === 'custom') return;
    const fresh = presetShape(kind, name);
    for (const key of Object.keys(shape)) {
      if (!(key in fresh)) continue;
      if (Array.isArray(shape[key])) shape[key].splice(0, shape[key].length, ...fresh[key]);
      else shape[key] = fresh[key];
    }
    refreshPanel();
    dirty.tree = dirty.forest = true;
    regrow({ frame: settings.tab === 'tree' });
    remember();
    note(`The ${kindName(kind)} starts from "${name}".`);
  });
  // The sliders in sections, by the part of the tree they shape, under
  // plain names (src/sections.js). A section folded shut stays shut when
  // the kind changes. Some rows share a folded panel of their own within
  // their section (the oak's noise); a setting that is a choice (the
  // noise's type) is a list, not a slider.
  const skipped = [];
  for (const { title, rows } of sectionsOf(kind, shape)) {
    const sliders = rows.filter(({ key }) => sliderKind(shape[key]) || (skipped.push(key), false));
    if (!sliders.length) continue;
    const section = tint(shapeFolder.addFolder(title), SECTION_TINTS[title]);
    if (shut.has(title)) section.close();
    // A kind whose crown can take several forms (src/kinds.js) lists them first among its crown's rows. A form sets
    // a few of the rows below it together, in plain sight; "custom" once one of them is moved.
    if (title === 'crown' && KIND_CROWNS[kind]) {
      crownPick.form = crownOf(kind, shape);
      crownRow = section.add(crownPick, 'form', [...Object.keys(KIND_CROWNS[kind]), 'custom']).name('crown form').onChange((name) => {
        if (name === 'custom') return;
        Object.assign(shape, KIND_CROWNS[kind][name]);
        refreshPanel();
        showPreset();
        dirty.tree = dirty.forest = true;
        regrow({ frame: false });
        remember();
        note(`The ${kindName(kind)}'s crown: ${name}.`);
      });
    }
    const panels = new Map(); // (the section's own panels, by title)
    for (const { key, name, panel } of sliders) {
      if (panel && !panels.has(panel)) {
        panels.set(panel, section.addFolder(panel));
        if (!opened.has(`${title}/${panel}`)) panels.get(panel).close();
        // (The crown's outline opens with its drawing: drag its dots, or use the rows under it.)
        if (DRAWINGS[kind]?.[panel] === 'outline') {
          outlineRow = new OutlineController(panels.get(panel), shape, OUTLINE, outlineOf, limitsFor(OUTLINE[0], shape[OUTLINE[0]], kind)).labels(OUTLINE.map((one) => ROWS[kind].crown[one]));
          watch(outlineRow, 'both', { also: () => { showPreset(); refreshPanel(); } });
        }
      }
      const into = panel ? panels.get(panel) : section;
      const choices = KIND_CHOICES[kind]?.[key];
      const limits = limitsFor(key, DEFAULT_SHAPES[kind][key] ?? shape[key], kind);
      const row = choices ? into.add(shape, key, choices) : sliderKind(shape[key]) === 'range' ? new RangeController(into, shape, key, ...limits) : into.add(shape, key, ...limits);
      if (row instanceof RangeController) marks.set(key, row);
      // (The age moves the other rows, in plain sight: src/age.js.)
      const aged = key === 'age' && hasAges(kind);
      watch(row.name(name), 'both', { also: () => {
        if (aged) {
          applyAge(kind, shape, shape.age);
          refreshPanel();
        }
        showPreset();
        if (aged || OUTLINE.includes(key)) outlineRow?.updateDisplay();
      } });
    }
  }
  if (skipped.length) shapeFolder.add({ skipped: skipped.join(', ') }, 'skipped').name('no slider yet').disable();
  // The kind's two greens (src/colors.js), folded shut until they're wanted.
  const greens = tint(shapeFolder.addFolder('greens'), 'leaf');
  if (shut.has('greens')) greens.close();
  recolored(greens.addColor(settings.colors[kind], 'dark').name('darkest'));
  recolored(greens.addColor(settings.colors[kind], 'light').name('lightest'));
  // (How far one tree's or the grid's trees lean to the darker or lighter green: theirs, not the forest's.)
  tintRow = watch(greens.add(settings.tree, 'tint', ...range('tree.tint')).name('tint (one tree, grid)'), 'tree');
  tintRow.show(shown !== 'forest');
  // The kind in the forest (shown in the Forest tab): its trees all of the
  // Tree tab's age or of several (src/age.js), and where it grows
  // (src/site.js), which is the kind's own and has no slider.
  forestRows = tint(shapeFolder.addFolder('in the forest'), 'wood');
  if (shut.has('in the forest')) forestRows.close();
  if (hasAges(kind)) {
    const mix = settings.forest.mix[kind];
    const aged = [];
    const show = () => aged.forEach((row) => row.show(mix.mixed));
    watch(forestRows.add(mix, 'mixed').name('of several ages'), 'forest', { also: show });
    aged.push(addRange(forestRows, mix, 'ages', 'ages (years)', RANGES['forest.mix.ages'], 'forest'));
    aged.push(watch(forestRows.add(mix, 'old', ...RANGES['forest.mix.old']).name('young to old'), 'forest'));
    show();
  }
  const said = document.createElement('p');
  said.className = 'said';
  said.textContent = siteSays(siteOf(kind));
  forestRows.$children.append(said);
  showMarks();
}
let outlineRow = null; // (the drawing of the crown's outline, while the kind shown has one)
const shut = new Set(['greens']); // (the kind's sections folded shut: its greens to start with)
const opened = new Set(); // (and their own panels unfolded: "section/panel")

// Both tabs: the light. The time of day and where the noon sun stands
// (src/light.js): the sun's angle and colour, the sky, its light in the
// shade, the far veil's colour; how much sun comes through the leaves
// (src/leafLight.js), the light shafts, mist and fog (src/lightShafts.js), the
// gaps in the crowns' shade (src/crownGaps.js), how much of the sky's light
// the trees keep off what's under them (src/skyShade.js), and how far the
// eye adjusts to the view (src/eye.js).
const lightFolder = gui.addFolder('light');
const relight = (c) => c.onChange(() => {
  applyLight();
  remember();
});
const hourRow = relight(lightFolder.add(settings.light, 'hour', ...range('light.hour')).name('time of day (h)'));
lightFolder.add(settings.light, 'runs', ...range('light.runs')).name('time runs (h a minute)').onChange(remember);
relight(lightFolder.add(settings.light, 'from', ...range('light.from')).name('noon sun from (°)'));
lightFolder.add(settings.light, 'glow', ...range('light.glow')).name('sun through leaves').onChange((v) => {
  leafLight.leafGlow.value = v;
  remember();
});
lightFolder.add(settings.light, 'shafts', ...range('light.shafts')).name('light shafts').onChange(() => {
  applyShafts();
  remember();
});
lightFolder.add(settings.light, 'mist', ...range('light.mist')).name('mist and fog').onChange(() => {
  applyShafts();
  remember();
});
lightFolder.add(settings.light, 'gaps', ...range('light.gaps')).name('gaps in the crowns').onChange((v) => {
  crownGaps.share = v;
  shadeSoon(); // (the sky's light gets through the gaps too)
  remember();
});
lightFolder.add(settings.light, 'shade', ...range('light.shade')).name('shade under the trees').onChange((v) => {
  skyShade.amount.value = v;
  remember();
});
lightFolder.add(settings.light, 'eye', ...range('light.eye')).name('eye adjusts to the view').onChange(remember);

// Both tabs: the season and colour. The season is a place to start from
// (src/season.js): it sets how much of their leaves the trees carry (they
// are grown again that way), how new the leaves are, and how far they have
// turned. Then autumn's colours, and each kind's two greens: for those
// nothing regrows, the trees take their new colours where they stand.
const colourFolder = gui.addFolder('season and colour').close();
const seasonPick = { season: 'custom' };
const seasonRow = colourFolder.add(seasonPick, 'season', [...Object.keys(SEASONS), 'custom']).name('season').onChange((name) => {
  if (!SEASONS[name]) return showSeason();
  assign(settings, seasonChanges(name));
  refreshPanel();
  dirty.tree = dirty.forest = true;
  regrow();
  recolorAll();
  remember();
});
function showSeason() {
  seasonPick.season = seasonOf(settings);
  seasonRow.updateDisplay();
}
const recolored = (c) => c.onChange(() => {
  recolorAll();
  showSeason();
  remember();
});
watch(colourFolder.add(settings.season, 'leaves', ...range('season.leaves')).name('leaves on the trees'), 'both', { also: showSeason });
recolored(colourFolder.add(settings.season, 'fresh', ...range('season.fresh')).name('new leaves'));
// (Autumn also decides which kinds are ahead with their leaves, src/season.js: with fewer than all their leaves
// on, the trees are grown again when the row is let go.)
recolored(colourFolder.add(settings.autumn, 'amount', ...range('autumn.amount')).name('autumn')).onFinishChange(() => {
  if (settings.season.leaves >= 1) return;
  dirty.tree = dirty.forest = true;
  regrow();
});
recolored(colourFolder.add(settings.autumn, 'palette', CHOICES['autumn.palette']).name('autumn colours'));
recolored(colourFolder.add(settings.autumn, 'spread', ...range('autumn.spread')).name('trees turn unevenly'));
recolored(colourFolder.add(settings.autumn, 'evergreens').name('needles turn too'));
// (Each kind's two greens are in its own panel, on the left: fillShapeFolder.)

// Both tabs: the sway, and the wind (its rows are the workshop's own, put
// in by src/windView.js each time the rig binds).
const swayFolder = gui.addFolder('sway').close();
swayFolder.add(settings.sway, 'on').name('sway on').onChange(remember);
swayFolder.add(settings.sway, 'branch', ...range('sway.branch')).name('limbs bob (× tuned)').onChange(remember);
swayFolder.add(settings.sway, 'flutter', ...range('sway.flutter')).name('flutter (× tuned)').onChange(remember);
const windFolder = gui.addFolder('wind').close();
windFolder.onChange(remember);
rig = createSwayRig({ scene, folder: windFolder, wind: settings.wind, sway: settings.sway });
swayFolder.add(rig.clock, 'paused').name('pause (P)').listen();
swayFolder.add(settings.sway, 'timeScale', ...range('sway.timeScale')).name('time scale').onChange(remember);

const viewFolder = gui.addFolder('view').close();
const personRow = addPersonRow(viewFolder); // (moved to the top of "you" with the walk's rows: see the panel's order, below)
viewFolder.add(ui, 'textSize', { '1×': 1, '1.25×': 1.25, '1.5×': 1.5, '2×': 2 }).name('text size').onChange(() => {
  applyTextSize();
  try {
    localStorage.setItem(TEXT_STORE, String(ui.textSize));
  } catch {
    // (no storage)
  }
  if (settings.tab === 'tree' && settings.tree.show === 'grid') growTree();
});
viewFolder.add(settings.view, 'wireframe').onChange(() => {
  wireframe(garden);
  wireframe(woods);
  remember();
});
const gridRow = viewFolder.add(settings.view, 'grid').name('metre grid').onChange((on) => {
  if (grid) grid.visible = on;
  remember();
});
const edgeRow = viewFolder.add(settings.view, 'edge').name('forest edge').onChange((on) => edge && (edge.visible = on));
viewFolder.add(settings.view, 'spin').name('turn slowly').onChange((on) => {
  controls.autoRotate = on;
  remember();
});
viewFolder.add(settings.view, 'turnSpeed', ...range('view.turnSpeed')).name('turn speed (°/s)').onChange((v) => {
  controls.autoRotateSpeed = turnRate(v);
  remember();
});
viewFolder.add({ centre: () => centreView() }, 'centre').name('centre on the selected tree');
viewFolder.add({ frame: () => frameView() }, 'frame').name('frame the view');

// Both tabs: save, load, share, export.
const fileFolder = gui.addFolder('save and share');
const shot = { scale: 2, mark: true };
const model = { ground: true, instancing: true };
fileFolder.add({ save: () => saveSettings() }, 'save').name('save settings to a file');
fileFolder.add({ load: () => document.getElementById('load-file').click() }, 'load').name('load settings from a file');
fileFolder.add({ copy: () => copyLink() }, 'copy').name('copy a link to this view');
fileFolder.add(shot, 'scale', { '1× (as on screen)': 1, '2×': 2, '4×': 4 }).name('screenshot size');
fileFolder.add(shot, 'mark').name('"TreeLab" in the corner');
fileFolder.add({ take: () => takeScreenshot() }, 'take').name('take a screenshot');
fileFolder.add({ share: () => shareScreenshot() }, 'share').name('share a screenshot…');
fileFolder.add(model, 'ground').name('model: with the ground');
fileFolder.add(model, 'instancing', { 'instanced (smallest)': true, 'one node a tree (works everywhere)': false }).name('model: trees as');
fileFolder.add({ glb: () => downloadModel() }, 'glb').name('download the model (.glb)');
fileFolder.add({
  startOver() {
    if (!confirm('Put every setting back to TreeLab\'s defaults?')) return;
    applySettings(defaultSettings(), 'Everything is back to the defaults.');
  },
}, 'startOver').name('start over');

// Every row's tooltip (src/tips.js), worked out when it's shown.
const owners = new Map([
  [settings.tree, 'tree'], [settings.forest, 'forest'], [settings.terrain, 'terrain'], [settings.sway, 'sway'],
  [settings.wind, 'wind'], [settings.view, 'view'], [settings.season, 'season'], [settings.forest.rules, 'forest.rules'], [rig.clock, 'clock'], [shot, 'shot'], [model, 'model'],
  [ui, 'ui'], [forestReadout, 'readout'], [settings.autumn, 'autumn'], [settings.light, 'light'], [settings.forest.layers, 'forest.layers'],
  ...KINDS.map((kind) => [settings.colors[kind], `colors:${kind}`]),
  ...KINDS.map((kind) => [settings.forest.mix[kind], `mix:${kind}`]),
]);
function tipOf(row) {
  const c = rows().find((one) => one.domElement === row);
  if (!c) return null;
  if (c === shapeKind) return tip('shape.kind');
  if (c === outlineRow) return tip('shape.outline');
  if (c.object === rig.windView?.view) return tip('windView.show');
  const kind = KINDS.find((k) => settings.shapes[k] === c.object);
  if (kind) return shapeTip(kind, c.property);
  if (c.object === pick) return tip('preset.startFrom');
  if (c.object === crownPick) return tip('crown.form');
  if (c.object === scenePick) return tip('scene.startFrom');
  if (c.object === woodPick) return tip('wood.startFrom');
  if (c.object === seasonPick) return tip('season.time');
  const owner = owners.get(c.object);
  if (owner?.startsWith('mix:')) return tip(c.property === 'share' && settings.forest.mixBy === 'by cover' ? 'mix.cover' : `mix.${c.property}`, kindName(owner.slice(4)));
  if (owner?.startsWith('colors:')) return tip(`colors.${c.property}`, kindName(owner.slice(7)));
  return tip(owner ? `${owner}.${c.property}` : `action.${c.property}`, settings.tree.kind);
}
attachTooltips(document.getElementById('panel'), tipOf);
attachTooltips(document.getElementById('kind'), tipOf);

// P pauses the clock. Walking among the trees, the arrow keys and W A S D
// walk, Shift runs and Space jumps (walk()).
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest?.('dialog')) return; // (a card is open over the page: its keys are its own)
  if (e.code === 'KeyP' && !e.repeat) rig.clock.paused = !rig.clock.paused;
  if (e.code === 'KeyH' && !e.repeat) foldBoth();
  if (e.code === 'KeyC' && !e.repeat) centreView();
  if (e.code === 'Escape' && selected) {
    select(null);
    note('Nothing selected.');
  }
  if (standing && e.code === 'Space') {
    if (!e.repeat) jumpAsked = true;
    e.preventDefault(); // (it would scroll the panel, or press the button last clicked)
    return;
  }
  if (!standing || !(WALK[e.code] || e.code.startsWith('Shift'))) return;
  held.add(e.code);
  if (WALK[e.code]) e.preventDefault(); // (the arrows would scroll the panel)
});

// --- Saving and loading -------------------------------------------------------------

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function saveSettings() {
  download(new Blob([toFile(settings)], { type: 'application/json' }), `treelab-${settings.tab}-${stamp()}.json`);
  note('Settings saved. Load the file again with "load settings from a file".');
}

document.getElementById('load-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const read = JSON.parse(await file.text());
    if (!looksLikeSettings(read)) throw new Error('not settings');
    const { settings: loaded, notes } = normalize(read);
    applySettings(loaded, notes.length ? `Loaded ${file.name}, but ${notes.slice(0, 3).join('; ')}${notes.length > 3 ? ` (and ${notes.length - 3} more)` : ''}.` : `Loaded ${file.name}.`);
  } catch {
    note(`${file.name} isn't a TreeLab settings file.`);
  }
});

async function copyLink() {
  const link = shareLink();
  try {
    await navigator.clipboard.writeText(link);
    note('Link copied: it opens TreeLab on exactly this view.');
  } catch {
    prompt('Copy this link:', link);
  }
}

// New settings in place of the old (the panel stays bound to the same
// objects), everything regrown.
function applySettings(loaded, message) {
  assign(settings, loaded);
  kindPick.kind = settings.tree.kind;
  refreshPanel();
  fillShapeFolder();
  showGridRows();
  nameRadius();
  showPatternRows();
  showPatchRows();
  standRow.show(settings.forest.grouping === 'in stands');
  layMix();
  grid && (grid.visible = settings.view.grid);
  person.visible = settings.view.person;
  controls.autoRotate = settings.view.spin;
  controls.autoRotateSpeed = turnRate(settings.view.turnSpeed);
  dirty.tree = dirty.forest = true;
  views.tree = views.forest = null;
  tintGround();
  applyLight();
  showTab(settings.tab, { frame: true, keepView: false });
  showScene();
  showSeason();
  if (standing) document.activeElement?.blur?.(); // (the list a walking view was just picked from would take the arrow keys)
  if (message) note(standing ? `${message} You walk among the trees, facing the sun. ${HOW_TO_WALK}` : message, standing ? 12000 : 8000);
}

// --- Screenshots and models ---------------------------------------------------------

// A frame: the scene, as light, into the picture; then the mist and the
// light shafts over it, and the picture onto the screen.
const render = () => {
  shadeIfDue();
  // (How high the crowns are, for the sun's width in the shadows: about
  // seven tenths of the way up the trees.)
  sunWidth.crowns.value = skyShade.min.value.y + 0.7 * skyShade.span.value.y;
  // (The mist drifts with the wind, and changes with the clock.)
  rig.wind?.carried(rig.clock.time, shafts.settings.drift);
  shafts.settings.time = rig.clock.time;
  renderer.getDrawingBufferSize(_pictureSize);
  if (picture.width !== _pictureSize.x || picture.height !== _pictureSize.y) picture.setSize(Math.max(1, _pictureSize.x), Math.max(1, _pictureSize.y));
  const before = renderer.getRenderTarget();
  renderer.setRenderTarget(picture);
  renderer.render(scene, camera);
  renderer.setRenderTarget(before);
  shafts.render(picture.texture);
};

async function takeScreenshot() {
  const blob = await capture({ renderer, draw: render, frames: 12, scale: shot.scale, mark: shot.mark });
  download(blob, `treelab-${settings.tab}-${stamp()}.png`);
  note('Screenshot saved.');
}

async function shareScreenshot() {
  const blob = await capture({ renderer, draw: render, frames: 12, scale: Math.min(shot.scale, 2), mark: shot.mark });
  const result = await shareImage({ blob, name: `treelab-${settings.tab}-${stamp()}.png`, link: shareLink(), download });
  if (result === 'shared') note('Shared.');
}

async function downloadModel() {
  note('Making the model…');
  const trees = settings.tab === 'tree' ? garden : woods;
  // (The ground: the forest's hills cut to the forest, or the hills under one tree cut to it; level ground isn't drawn.)
  const ground = !model.ground ? null : settings.tab === 'tree' && !onHills() ? null : terrain.mesh;
  try {
    const groundHalf = settings.tab === 'tree' ? Math.max(15, gardenSize.extent + 5) : settings.forest.radius + 10;
    const groundAt = settings.tab === 'tree' ? treeSpot : { x: 0, z: 0 }; // (the ground cut round the tree it's under)
    const { blob, triangles } = await exportModel({ trees, ground, groundHalf, groundAt, instancing: model.instancing, settings, link: shareLink() });
    download(blob, `treelab-${settings.tab}-${stamp()}.glb`);
    note(`Model saved: ${count(trees.userData.count)} trees, ${count(triangles)} triangles${model.instancing ? ' (instanced)' : ''}. It's yours to use (CC0).`, 8000);
  } catch (error) {
    console.error(error);
    note(`Couldn't make the model: ${error.message}`);
  }
}

// --- Selecting: a click picks a tree; the left panel shows its kind; "centre" turns the view round it ---

// (src/select.js. The selection isn't a setting: it isn't saved, and a link
// doesn't carry it. Shift and a click selects too, as it first did.)
let selected = null; // { tab, record, height }
let ring = null;     // the ring on the ground round its foot
function dropRing() {
  if (!ring) return;
  ring.parent?.remove(ring);
  ring.geometry.dispose();
  ring.material.dispose();
  ring = null;
}
// kept: the same tree again after a planting (the left panel stays on the
// kind it shows); otherwise the panel turns to the tree's kind.
function select(record, tab = shown, { kept = false } = {}) {
  dropRing();
  selected = null;
  if (record) {
    const group = tab === 'tree' ? garden : woods;
    selected = { tab, record, height: heightIn(group.userData.species, record) };
    const heightAt = tab === 'forest' || onHills() ? (x, z) => terrain.heightAt(x, z) : () => 0;
    const points = ringPoints({ x: record.x, z: record.z, radius: ringRadius(record.crown), heightAt }).map((p) => new THREE.Vector3(...p));
    ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 }));
    (tab === 'tree' ? treeStage : forestStage).add(ring);
    if (!kept && tab === 'forest') kindPick.kind = record.kind;
  }
  if (tab === shown) showKind();
}
// (The trees planted again, a slider moved: the selection stays on the tree standing where it stood.)
function keepSelection(tab, records) {
  if (selected?.tab !== tab) return;
  select(sameTree(records, selected.record), tab, { kept: true });
}
const selectedSays = () => `the ${kindName(selected.record.kind)}, ${selected.height.toFixed(1)} m tall`;

let pressed = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  pressed = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
});
// (A click, not a drag: a drag turns the view. A click on no tree lets the selected one go.)
renderer.domElement.addEventListener('pointerup', (e) => {
  const was = pressed;
  pressed = null;
  if (!isClick(was, { x: e.clientX, y: e.clientY })) return;
  const record = treeAt(e);
  if (!record && !selected) return;
  select(record);
  if (selected) note(`Selected: ${selectedSays()}. Its kind's settings are on the left. C turns the view round it, Esc lets it go.`, 8000);
  else note('Nothing selected.', 2500);
});

// The view slid so that the selected tree is at the middle of the screen,
// from the same angle and as far away; with none selected, the middle of
// what's shown. The view turns round that point from then on.
const _slide = new THREE.Vector3();
function centreView() {
  if (standing) {
    note('Walking among the trees, the view stays with the figure. Turn "walk among the trees" off to centre it on a tree.', 7000);
    return;
  }
  const on = selected?.tab === shown ? selected : null;
  if (on) _slide.set(...focusOf({ x: on.record.x, y: on.record.y ?? 0, z: on.record.z, height: on.height }));
  else if (shown === 'tree') _slide.set(treeSpot.x, spotGround() + gardenSize.tallest * 0.45, treeSpot.z);
  else _slide.set(0, terrain.heightAt(0, 0) + 3, 0);
  _slide.sub(controls.target);
  controls.target.add(_slide);
  camera.position.add(_slide);
  controls.update();
  fitVeil();
  note(on ? `Centred on ${selectedSays()}. The view turns round it now.` : 'Centred on the middle. A click on a tree selects it; then this centres on that tree.', 7000);
}

// --- Picking: a double-click on a tree shows it alone ---------------------------------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
// The tree under the pointer (its record), or none.
function treeAt(e) {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const group = settings.tab === 'tree' ? garden : woods;
  const hit = raycaster.intersectObjects(group.children, false)[0];
  // (A tree's wood and leaves are each an instance; the forest's roots are one mesh, and the triangle hit says whose.)
  return hit?.object.userData.treeOf?.(hit.faceIndex) ?? hit?.object.userData.trees?.[hit.instanceId] ?? null;
}
renderer.domElement.addEventListener('dblclick', (e) => {
  if (e.shiftKey) return; // (with Shift held, two clicks select and no more)
  const record = treeAt(e);
  if (!record) return;
  const from = settings.tab;
  if (from === 'tree' && settings.tree.show !== 'grid') return;
  if (record.seed !== settings.tree.seed) dirty.forest = true; // (the forest grows from the Tree tab's seed)
  Object.assign(settings.tree, { kind: record.kind, seed: record.seed, variant: record.variant, show: 'one tree' });
  fillShapeFolder();
  refreshPanel();
  showGridRows();
  dirty.tree = true;
  if (settings.tab === 'tree') growTree({ frame: true });
  else showTab('tree', { frame: true });
  remember();
  note(from === 'tree' ? `The ${kindName(record.kind)}, seed ${record.seed}, variant ${record.variant}. "Grid", at the top, goes back to the grid.` : `The ${kindName(record.kind)}, seed ${record.seed}, variant ${record.variant}, from the forest.`, 8000);
});

// --- Go -----------------------------------------------------------------------------

// Another link pasted into the address of a page already open: only what follows the # changes, so the page
// doesn't load again. It opens the link.
addEventListener('hashchange', () => {
  const hash = location.hash.slice(1);
  if (!hash.startsWith('v=') && !hash.startsWith('s=')) return;
  const opened = startingSettings();
  if (opened) applySettings(opened.settings, opened.notes.length ? `Opened the link, but ${opened.notes.slice(0, 3).join('; ')}.` : 'Opened the link.');
});

addEventListener('resize', () => {
  camera.aspect = aspect();
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const start = startingSettings();
if (start) assign(settings, start.settings);
kindPick.kind = settings.tree.kind;
tintGround();
applyLight();
fillShapeFolder();
showGridRows();
nameRadius();
showPatternRows();
showPatchRows();
standRow.show(settings.forest.grouping === 'in stands');
layMix();
person.visible = settings.view.person;
controls.autoRotate = settings.view.spin;
controls.autoRotateSpeed = turnRate(settings.view.turnSpeed);
refreshPanel();
showScene();
showSeason();
setTerrain();
growTree();
showTab(settings.tab, { frame: true });
if (start?.notes.length) note(`From ${start.from}: ${start.notes.slice(0, 2).join('; ')}.`, 8000);
// The panel in its order: what's shown (the scene: the grid's, or the
// forest's with its pattern, rules, groves and mix inside), then the world
// round it (the ground, the sky, the wind), then you (the figure and the
// camera), then saving and sharing. The rows were made where they're worked
// out, above; here they are put where they're read.
const skyFolder = gui.addFolder('sky').close();
skyFolder.$children.append(lightFolder.domElement, colourFolder.domElement);
swayFolder.title('wind');
windFolder.title('the wind');
swayFolder.$children.append(windFolder.domElement);
viewFolder.title('you');
viewFolder.$children.prepend(personRow.domElement, amongRow.domElement, eyesRow.domElement);
forestFolder.$children.append(patternFolder.domElement, rulesFolder.domElement, patchFolder.domElement, mixFolder.domElement);
groundChoice.domElement.after(gridRow.domElement); // (the choice, then the metre grid, then the hills' rows)
for (const f of [showFolder, forestFolder, groundFolder, skyFolder, swayFolder, viewFolder, fileFolder]) gui.$children.append(f.domElement);
// (The panel's own folders, each in its colour.)
for (const folder of gui.folders) tint(folder, TINTS[folder._title]);
if (innerWidth > 0 && innerWidth < 700) {
  gui.close();
  kindGui.close();
}

// The welcome card, on a first visit (src/welcome.js): what TreeLab is and
// how to look round. Not for someone a link sent to a view, nor for a
// viewer who asked not to see it again. "OK" (it has the focus, so Enter
// too) or Escape closes it until the next visit.
{
  const card = document.getElementById('welcome');
  const ok = document.getElementById('welcome-ok');
  // (On the studio's own site, by its path alone, so the link stays on whichever copy of the site it's on: the live one, or one being tried out.)
  document.getElementById('welcome-about').href = import.meta.env.MODE === 'site' ? new URL(ABOUT).pathname : ABOUT;
  ok.addEventListener('click', () => card.close());
  document.getElementById('welcome-never').addEventListener('click', () => {
    turnWelcomeOff(); // (where the browser keeps nothing, it shows again next time)
    card.close();
  });
  if (showsWelcome({ hash: location.hash })) {
    card.showModal?.();
    ok.focus();
  }
}

// The support card (src/support.js), in the middle: the first ask as the
// page opens (once the welcome card is closed), with only "OK"; the second
// a few minutes later, with "OK" and "Never show this again"; then nothing
// more that visit. "OK" (or Escape) closes it; following the Ko-fi link
// counts as an answer too.
{
  const card = document.getElementById('support');
  const says = document.getElementById('support-says');
  const ok = document.getElementById('support-ok');
  const never = document.getElementById('support-never');
  document.getElementById('support-kofi').href = KOFI;
  document.getElementById('support-kofi-cup').src = KOFI_CUP;
  document.getElementById('support-plain').textContent = PLAIN_LINE;
  let made = asksMade(); // (kept here too, so a browser that keeps nothing still gets its second ask)
  let clock = null;
  let said = null; // (the line last shown, so the second ask says something else)
  const done = (n) => { made = n; setAsksMade(n); };
  const ask = (which) => {
    if (supportIsOff()) return; // (turned off meanwhile, in another tab)
    said = lineFor(which, said);
    says.textContent = said;
    never.hidden = which === 'first';
    done(which === 'first' ? 1 : 2);
    card.showModal?.();
    ok.focus();
  };
  // The second ask: after the page has been in view so long, with none of TreeLab's cards open.
  const second = () => {
    const delay = supportDelay(location.search);
    let inView = 0;
    clock = setInterval(() => {
      if (document.visibilityState !== 'visible' || document.querySelector('dialog[open]')) return;
      if (++inView < delay) return;
      clearInterval(clock);
      ask('second');
    }, 1000);
  };
  card.addEventListener('close', () => { if (made === 1 && !clock) second(); });
  ok.addEventListener('click', () => card.close());
  document.getElementById('support-kofi').addEventListener('click', () => {
    done(2);
    clearInterval(clock);
    card.close();
  });
  never.addEventListener('click', () => {
    turnSupportOff(); // (where the browser keeps nothing, it may ask again on a later visit)
    done(2);
    card.close();
  });
  const due = askDue();
  // (Someone sent a view by a link came to see that view, as the welcome card knows: no ask as it opens, only the later one.)
  if (due === 'first' && opensOnAView(location.hash)) {
    done(1);
    second();
  } else if (due === 'first') {
    const welcome = document.getElementById('welcome');
    const first = () => setTimeout(() => ask('first'), 800);
    if (welcome.open) welcome.addEventListener('close', first, { once: true });
    else first();
  } else if (due === 'second') second();
}

// The camera never under the ground: the orbit's tilt keeps it above the
// target's level, but on the hills the ground can rise higher than that.
// Walking among the trees the camera goes with the figure (walk()): at
// its eyes it needs no more; behind it, it's kept off the ground too.
function keepAboveGround() {
  const p = camera.position;
  const ground = hillsShown()?.heightAt(p.x, p.z) ?? 0;
  if (standing && settings.view.eyes) return;
  if (p.y < ground + (standing ? 0.3 : 0.5)) p.y = ground + (standing ? 0.3 : 0.5);
}

let last = null;
let firstLooks = 3, snappedTo = null; // (the eye's first looks, each setting the exposure at once)
const frame = (now) => {
  const dt = last === null ? 0 : (now - last) / 1000;
  last = now;
  rig.update(dt, controls.target);
  runDay(dt);
  walk(Math.min(dt, 0.1));
  poseFigure(Math.min(dt, 0.1));
  controls.update(Math.min(dt, 0.1)); // (by the clock: "turn slowly" turns so many degrees a second, whatever the screen's rate)
  keepAboveGround();
  fitVeil();
  // (The eye's first looks set the exposure at once, as settleEye does for a script's picture, but without stopping
  // the page to wait for each: a look is read back while the page goes on, src/eye.js. With no graphics card, the
  // five pictures settleEye draws and waits for took seconds, during which the page could answer nothing.)
  if (eye.seen && firstLooks > 0 && eye.seen !== snappedTo) {
    snappedTo = eye.seen;
    firstLooks--;
    renderer.toneMappingExposure = exposureFor({ base: baseExposure, was: eye.seen.at, seen: eye.seen.mean, follow: settings.light.eye, range: eyeRange });
  } else if (eye.seen) adapt(dt);
  fitVeilColor();
  render();
  eye.look();
};
renderer.setAnimationLoop(frame);

// For poking at from the browser's console.
window.treelab = { scene, camera, controls, renderer, render, frame, eyeAdapts: ADAPTS, get standing() { return standing; }, walker, pad, get body() { return body; }, shafts, shade, skyShade, eye, settleEye, settings, garden, woods, rig, regrow, showTab, applySettings, frameView, centreView, select, get selected() { return selected; }, get kindShown() { return filled; }, get terrain() { return terrain; }, get stats() { return stats; } };
