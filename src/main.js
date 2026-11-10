import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import rigUrl from '../vendor/workshop/rig.glb?url';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { DEFAULT_SHAPES, KINDS } from './kinds.js';
import { createPlanter, recolor } from './tree.js';
import { foliageColor, groundColor, mottleOf } from './colors.js';
import { PRESETS, presetOf, presetShape } from './presets.js';
import { createSwayRig } from './swayRig.js';
import { limitsFor, sliderKind } from './limits.js';
import { CHOICES, RANGES, assign, defaultSettings, fromLink, normalize, toFile, toLink } from './settings.js';
import { createTerrain } from './terrain.js';
import { placeForest } from './forest.js';
import { gardenRecords } from './garden.js';
import { areaOf } from './patterns.js';
import { capture, shareImage } from './capture.js';
import { exportModel } from './exportModel.js';
import { RangeController } from './rangeSlider.js';
import { attachTooltips } from './tooltip.js';
import { shapeTip, tip } from './tips.js';

// TreeLab: the Tree tab grows one tree, or a grid of them to compare; the
// Forest tab plants them on hills. Both use the workshop's trees, wind and
// sway (vendor/workshop/), and one settings object (src/settings.js) that
// the panel shows, the address keeps, and a file saves.

// The workshop's look by day (src/main.js, and src/daytime.js TODAY).
const SKY = 0xbfd1e5;
const SUN = { color: 0xfff1dc, intensity: 2.5 };
const HEMI = { sky: 0xffffff, ground: 0x8d7c6a, intensity: 1.5 };
const SUN_FROM = new THREE.Vector3(9, 16, 7).normalize();
const HEAVY = 4e6; // triangles: more and a forest may stutter on an ordinary laptop
const FLAT_GROUND = 0x7d8f55; // the workshop's ground (the hills are coloured by their vertices)
const STORE = 'treelab.settings'; // where the browser keeps the last settings
const TEXT_STORE = 'treelab.textSize'; // and this viewer's text size (never in settings or links)

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

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('app').append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 20, 60);

// (A page opened in a hidden tab may have no size yet.)
const aspect = () => (innerWidth > 0 && innerHeight > 0 ? innerWidth / innerHeight : 1);
const camera = new THREE.PerspectiveCamera(45, aspect(), 0.1, 800);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495; // never under the ground
controls.minDistance = 1;
controls.maxDistance = 60;

scene.add(new THREE.HemisphereLight(HEMI.sky, HEMI.ground, HEMI.intensity));
const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity);
sun.castShadow = true;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// The sun, its shadows and the fog fitted to what's shown: `radius` m round
// `center`, up to `top` m high.
function fitStage(center, radius, top) {
  const half = Math.max(9, radius + 2);
  sun.target.position.copy(center);
  sun.position.copy(center).addScaledVector(SUN_FROM, half + top + 20);
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 2 * (half + top + 20) });
  sun.shadow.camera.updateProjectionMatrix();
  const size = half > 20 ? 4096 : 2048;
  if (sun.shadow.mapSize.x !== size) {
    sun.shadow.mapSize.set(size, size);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  stageRadius = radius;
  controls.maxDistance = Math.max(60, radius * 3.5);
}

// The fog starts a little past what's shown, wherever the camera is (the
// workshop's 20 to 60 m for one tree up close).
let stageRadius = 9;
function fitFog() {
  const d = camera.position.distanceTo(controls.target);
  scene.fog.near = Math.max(20, d + stageRadius * 0.3);
  scene.fog.far = Math.max(60, d + stageRadius * 2.5 + 40);
}

// --- The Tree tab's stage: flat ground, a metre grid, labels -------------------------------

const flat = (() => {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(150, 96).rotateX(-Math.PI / 2),
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

function setTerrain() {
  const stamp = JSON.stringify(settings.terrain);
  if (stamp === terrainStamp) return false;
  if (terrain) {
    forestStage.remove(terrain.mesh);
    terrain.dispose();
  }
  terrain = createTerrain(settings.terrain);
  terrainStamp = stamp;
  groundColor(settings.autumn, terrain.mesh.material.color);
  forestStage.add(terrain.mesh);
  return true;
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
// its right), standing at rest, its feet on the ground, facing the camera.
const person = new THREE.Group();
person.name = 'person';
scene.add(person);
new GLTFLoader().load(rigUrl, (gltf) => {
  const figure = gltf.scene;
  figure.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false; // (a skinned mesh's bounds are its rest pose's)
  });
  person.add(figure);
  personHeight = heightOf(figure);
  for (const row of personRows) row.name(personName());
}, undefined, (error) => console.warn('TreeLab: the figure for scale could not be loaded.', error));

// How tall the figure stands (m), from its posed vertices, for its row's name.
let personHeight = null;
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
  if (hash.startsWith('s=')) return { ...fromLink(hash.slice(2)), from: 'the link' };
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
    const link = toLink(settings);
    const changed = link !== toLink(defaultSettings());
    history.replaceState(null, '', changed ? `#s=${link}` : location.pathname + location.search);
    try {
      localStorage.setItem(STORE, toFile(settings));
    } catch {
      // (private browsing: nothing kept, which is fine)
    }
  }, 300);
}
const shareLink = () => `${location.origin}${location.pathname}${location.search}#s=${toLink(settings)}`;

// --- What the page shows -------------------------------------------------------------

const statsEl = document.getElementById('stats');
const noteEl = document.getElementById('note');
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
const colorOf = (t, out) => foliageColor(t, settings.colors, settings.autumn, out);
const mottle = (kind) => mottleOf(kind, settings.autumn);

// The ground's autumn cast: the flat ground's colour, and the hills'
// (whose colours are their vertices', the material's a multiplier).
function tintGround() {
  groundColor(settings.autumn, flat.mesh.material.color).multiply(new THREE.Color(FLAT_GROUND));
  if (terrain) groundColor(settings.autumn, terrain.mesh.material.color);
}

// New colours on the trees already planted, both tabs, and the ground.
function recolorAll() {
  for (const planter of Object.values(planters)) planter.mottle(mottle);
  recolor(garden, colorOf);
  recolor(woods, colorOf);
  tintGround();
}
const wireframe = (group) => Object.values(group.userData.materials ?? {}).forEach((m) => (m.wireframe = settings.view.wireframe));

// The Tree tab's trees.
let gardenSize = null;
const growTree = safely(function growTree({ frame = false } = {}) {
  const planter = planters.tree;
  const layout = gardenRecords(settings.tree, settings.shapes, planter);
  const numbers = planter.plant(garden, layout.records, settings.shapes, { colorOf, mottle });
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
  rig.bind({ trees: garden, terrain: flat, warmUp: Math.min(20, 2000 / layout.records.length) });
  dirty.tree = false;

  const one = settings.tree.show !== 'grid';
  const first = planter.model(layout.records[0].kind, layout.records[0].seed, layout.records[0].variant, settings.shapes[layout.records[0].kind]).tree;
  stats.tree = one
    ? [['height', metres(first.height)], ['reach', metres(first.reach)], ['crown', metres(first.crown)], ['triangles', count(numbers.triangles)], ['grown in', `${numbers.ms.toFixed(1)} ms`]]
    : [['trees', count(numbers.trees)], ['tallest', metres(layout.tallest)], ['spacing', metres(layout.spacing)], ['triangles', count(numbers.triangles)], ['grown in', `${numbers.ms.toFixed(1)} ms`]];
  // (On the tree's left: the panel covers the right of the view.)
  person.position.set(one ? -Math.max(2, first.reach + 1) : layout.records[0].x - layout.spacing / 2, 0, one ? 0.6 : layout.records[0].z);
  if (settings.tab === 'tree') {
    fitStage(new THREE.Vector3(), layout.extent, layout.tallest);
    showStats();
  }
  if (frame) frameView();
});

// The Forest tab's trees, on its hills.
const growForest = safely(function growForest({ frame = false } = {}) {
  const start = performance.now();
  const newGround = setTerrain();
  const { records, report } = placeForest(settings.forest, terrain);
  for (const r of records) r.seed = settings.tree.seed;
  const numbers = planters.forest.plant(woods, records, settings.shapes, { colorOf, mottle });
  wireframe(woods);
  setEdge();
  rig.bind({ trees: woods, terrain, canopy: woods.userData.trees, warmUp: Math.min(20, 4000 / Math.max(1, records.length)) });
  dirty.forest = false;
  const ms = performance.now() - start;

  const hectares = areaOf({ shape: settings.forest.area, radius: settings.forest.radius }) / 10000;
  const kinds = KINDS.map((k) => [k, records.filter((r) => r.kind === k).length]).filter(([, n]) => n);
  stats.forest = [
    ['trees', count(records.length)],
    ['per hectare', count(records.length / hectares)],
    ...kinds.map(([k, n]) => [k, `${count(n)} (${Math.round((100 * n) / Math.max(1, records.length))}%)`]),
    ...(report.clearings ? [['in clearings', `${count(report.clearings)} left out`]] : []),
    ...(report.steep ? [['too steep', `${count(report.steep)} left out`]] : []),
    ...(report.capped ? [['over the cap', `${count(report.capped)} left out`]] : []),
    ['trees grown', `${numbers.models} shapes, ${numbers.grown} new`],
    ['triangles', count(numbers.triangles)],
    ...(numbers.triangles > HEAVY ? [['heavy', 'fewer trees or simpler shapes will run smoother']] : []),
    ['planted in', `${ms.toFixed(0)} ms${newGround ? ' (new hills)' : ''}`],
  ];
  person.position.set(0, terrain.heightAt(0, 0), 0);
  forestReadout.trees = `${count(records.length)} trees`;
  if (settings.tab === 'forest') {
    const reach = settings.forest.radius * (settings.forest.area === 'square' ? Math.SQRT2 : 1);
    fitStage(new THREE.Vector3(0, terrain.heightAt(0, 0), 0), reach + 3, 12);
    showStats();
  }
  if (frame) frameView();
});

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
  if (settings.tab === 'tree') {
    const { extent, tallest } = gardenSize;
    const distance = Math.max((tallest * 0.62) / tanV, (extent * 1.15) / (tanV * camera.aspect), 6);
    controls.target.set(0, tallest * 0.45, 0);
    camera.position.copy(controls.target).addScaledVector(tilt, distance + (settings.tree.show === 'grid' ? extent * 0.5 : 0));
  } else {
    const r = settings.forest.radius;
    controls.target.set(0, terrain.heightAt(0, 0) + 3, 0);
    camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(0.5, 0.42, 1).normalize(), (r * 1.25) / Math.min(tanV * camera.aspect, tanV) + 6);
  }
  controls.update();
  fitFog(); // (at once: the first frame may be a while coming)
}

// --- The tabs ------------------------------------------------------------------------

const tabButtons = [...document.querySelectorAll('#tabs button')];
let shown = null; // the tab on screen
function showTab(tab, { frame = false, keepView = true } = {}) {
  if (shown && shown !== tab && keepView) views[shown] = { position: camera.position.clone(), target: controls.target.clone() };
  shown = tab;
  settings.tab = tab;
  for (const b of tabButtons) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  treeStage.visible = tab === 'tree';
  forestStage.visible = tab === 'forest';
  for (const f of folders.tree) f.show(tab === 'tree');
  for (const f of folders.forest) f.show(tab === 'forest');
  shapeKind.show(tab === 'forest');
  gridRow.show(tab === 'tree');
  edgeRow.show(tab === 'forest');
  const firstTime = !views[tab];
  if (dirty[tab]) regrow();
  else if (tab === 'tree') rig.bind({ trees: garden, terrain: flat, warmUp: Math.min(20, 2000 / Math.max(1, garden.userData.count)) });
  else rig.bind({ trees: woods, terrain, canopy: woods.userData.trees, warmUp: Math.min(20, 4000 / Math.max(1, woods.userData.count)) });
  if (tab === 'tree') {
    fitStage(new THREE.Vector3(), gardenSize.extent, gardenSize.tallest);
    person.position.y = 0;
  } else {
    const reach = settings.forest.radius * (settings.forest.area === 'square' ? Math.SQRT2 : 1);
    fitStage(new THREE.Vector3(0, terrain.heightAt(0, 0), 0), reach + 3, 12);
    person.position.set(0, terrain.heightAt(0, 0), 0);
  }
  if (frame || firstTime) frameView();
  else {
    camera.position.copy(views[tab].position);
    controls.target.copy(views[tab].target);
    controls.update();
  }
  showStats();
  remember();
}
for (const b of tabButtons) b.addEventListener('click', () => showTab(b.dataset.tab));

// --- The panel ----------------------------------------------------------------------

const gui = new GUI({ container: document.getElementById('gui'), title: 'settings' });
const refreshPanel = () => gui.controllersRecursive().forEach((c) => c.updateDisplay());
const folders = { tree: [], forest: [] };
const range = (path) => RANGES[path];

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

// Tree tab: the tree.
const treeFolder = gui.addFolder('tree');
folders.tree.push(treeFolder);
watch(treeFolder.add(settings.tree, 'kind', CHOICES['tree.kind']), 'both', { frame: true, also: () => fillShapeFolder() });
watch(treeFolder.add(settings.tree, 'seed', ...range('tree.seed')), 'both');
watch(treeFolder.add(settings.tree, 'variant', ...range('tree.variant')), 'tree');
treeFolder.add({
  newSeed() {
    settings.tree.seed = 1 + Math.floor(Math.random() * 999);
    refreshPanel();
    dirty.forest = true;
    growTree();
    remember();
  },
}, 'newSeed').name('new seed');
watch(treeFolder.add(settings.tree, 'tint', ...range('tree.tint')).name('tint (greens)'), 'tree');

// Tree tab: one tree or a grid.
const showFolder = gui.addFolder('show');
folders.tree.push(showFolder);
const gridRows = [];
watch(showFolder.add(settings.tree, 'show', CHOICES['tree.show']).name('show'), 'tree', { frame: true, also: () => showGridRows() });
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
addPersonRow(showFolder);
const showGridRows = () => gridRows.forEach((c) => c.show(settings.tree.show === 'grid'));

// Forest tab: where the trees stand.
const forestReadout = { trees: '' };
const forestFolder = gui.addFolder('forest');
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
watch(forestFolder.add(settings.forest, 'density', ...range('forest.density')).name('trees per hectare'), 'forest');
addPersonRow(forestFolder);

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

const patchFolder = gui.addFolder('groves and clearings').close();
folders.forest.push(patchFolder);
watch(patchFolder.add(settings.forest, 'patches').name('groves and clearings'), 'forest', { also: () => showPatchRows() });
const patchRows = [
  watch(patchFolder.add(settings.forest, 'patchSize', ...range('forest.patchSize')).name('grove size (m)'), 'forest'),
  watch(patchFolder.add(settings.forest, 'cover', ...range('forest.cover')).name('groves cover (share)'), 'forest'),
];
const showPatchRows = () => patchRows.forEach((c) => c.show(settings.forest.patches));

const mixFolder = gui.addFolder('mix');
folders.forest.push(mixFolder);
for (const kind of KINDS) {
  watch(mixFolder.add(settings.forest.mix[kind], 'on').name(kind), 'forest');
  watch(mixFolder.add(settings.forest.mix[kind], 'share', ...RANGES['forest.mix.share']).name(`${kind} share (%)`), 'forest');
}
watch(mixFolder.add(settings.forest, 'grouping', CHOICES['forest.grouping']).name('kinds grow'), 'forest', { also: () => standRow.show(settings.forest.grouping === 'in stands') });
const standRow = watch(mixFolder.add(settings.forest, 'standSize', ...range('forest.standSize')).name('stand size (m)'), 'forest');
watch(mixFolder.add(settings.forest, 'variants', ...range('forest.variants')).name('variants a kind'), 'forest');
addRange(mixFolder, settings.forest, 'size', 'size', range('forest.size'), 'forest');

const groundFolder = gui.addFolder('ground').close();
folders.forest.push(groundFolder);
watch(groundFolder.add(settings.terrain, 'seed', ...range('terrain.seed')).name('seed (which hills)'), 'forest');
groundFolder.add({
  newHills() {
    settings.terrain.seed = 1 + Math.floor(Math.random() * 999);
    refreshPanel();
    growForest();
    remember();
  },
}, 'newHills').name('new hills');
watch(groundFolder.add(settings.terrain, 'height', ...range('terrain.height')).name('hills rise (m, 0 flat)'), 'forest');
watch(groundFolder.add(settings.terrain, 'size', ...range('terrain.size')).name('hill size (m)'), 'forest');
watch(groundFolder.add(settings.terrain, 'roughness', ...range('terrain.roughness')), 'forest');
watch(groundFolder.add(settings.forest, 'maxSlope', ...range('forest.maxSlope')).name('steepest slope trees grow on (°)'), 'forest');

// Both tabs: one kind's shape at a time, refilled when the kind changes. A
// range is one row with two handles, least and most. (In the Forest tab,
// the kind to change is chosen at its top.)
const shapeFolder = gui.addFolder('shape').close();
const shapeKind = shapeFolder.add(settings.tree, 'kind', CHOICES['tree.kind']).name('kind to change');
shapeKind.onChange(() => {
  fillShapeFolder();
  refreshPanel();
  dirty.tree = true;
  remember();
});
const pick = { startFrom: 'workshop' }; // (the "start from" row's value)
let presetRow = null;
const showPreset = () => {
  pick.startFrom = presetOf(settings.tree.kind, settings.shapes[settings.tree.kind]);
  presetRow?.updateDisplay();
};
function fillShapeFolder() {
  const kind = settings.tree.kind;
  for (const child of [...shapeFolder.children]) if (child !== shapeKind) child.destroy();
  shapeFolder.title(`${kind} shape`);
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
    note(`The ${kind} starts from "${name}".`);
  });
  const skipped = [];
  for (const [key, value] of Object.entries(shape)) {
    const slider = sliderKind(value);
    if (!slider) {
      skipped.push(key);
      continue;
    }
    const limits = limitsFor(key, DEFAULT_SHAPES[kind][key] ?? value, kind);
    if (slider === 'range') watch(new RangeController(shapeFolder, shape, key, ...limits).name(key), 'both', { also: showPreset });
    else watch(shapeFolder.add(shape, key, ...limits), 'both', { also: showPreset });
  }
  if (skipped.length) shapeFolder.add({ skipped: skipped.join(', ') }, 'skipped').name('no slider yet').disable();
}

// Both tabs: colour. Autumn, and each kind's two greens. Nothing regrows:
// the trees take their new colours where they stand.
const colourFolder = gui.addFolder('colour').close();
const recolored = (c) => c.onChange(() => {
  recolorAll();
  remember();
});
recolored(colourFolder.add(settings.autumn, 'amount', ...range('autumn.amount')).name('autumn'));
recolored(colourFolder.add(settings.autumn, 'palette', CHOICES['autumn.palette']).name('autumn colours'));
recolored(colourFolder.add(settings.autumn, 'spread', ...range('autumn.spread')).name('trees turn unevenly'));
recolored(colourFolder.add(settings.autumn, 'evergreens').name('needles turn too'));
const greensFolder = colourFolder.addFolder('greens').close();
for (const kind of KINDS) {
  recolored(greensFolder.addColor(settings.colors[kind], 'dark').name(`${kind}: dark`));
  recolored(greensFolder.addColor(settings.colors[kind], 'light').name(`${kind}: light`));
}

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
  [settings.wind, 'wind'], [settings.view, 'view'], [rig.clock, 'clock'], [shot, 'shot'], [model, 'model'],
  [ui, 'ui'], [forestReadout, 'readout'], [settings.autumn, 'autumn'],
  ...KINDS.map((kind) => [settings.colors[kind], `colors:${kind}`]),
  ...KINDS.map((kind) => [settings.forest.mix[kind], `mix:${kind}`]),
]);
function tipOf(row) {
  const c = gui.controllersRecursive().find((one) => one.domElement === row);
  if (!c) return null;
  if (c === shapeKind) return tip('shape.kind');
  if (c.object === rig.windView?.view) return tip('windView.show');
  const kind = KINDS.find((k) => settings.shapes[k] === c.object);
  if (kind) return shapeTip(kind, c.property);
  if (c.object === pick) return tip('preset.startFrom');
  const owner = owners.get(c.object);
  if (owner?.startsWith('mix:')) return tip(`mix.${c.property}`, owner.slice(4));
  if (owner?.startsWith('colors:')) return tip(`colors.${c.property}`, owner.slice(7));
  return tip(owner ? `${owner}.${c.property}` : `action.${c.property}`, settings.tree.kind);
}
attachTooltips(document.getElementById('panel'), tipOf);

// P pauses the clock.
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'KeyP') rig.clock.paused = !rig.clock.paused;
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
    const { settings: loaded, notes } = normalize(JSON.parse(await file.text()));
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
  refreshPanel();
  fillShapeFolder();
  showGridRows();
  nameRadius();
  showPatternRows();
  showPatchRows();
  standRow.show(settings.forest.grouping === 'in stands');
  grid && (grid.visible = settings.view.grid);
  person.visible = settings.view.person;
  controls.autoRotate = settings.view.spin;
  dirty.tree = dirty.forest = true;
  views.tree = views.forest = null;
  tintGround();
  showTab(settings.tab, { frame: true, keepView: false });
  if (message) note(message, 8000);
}

// --- Screenshots and models ---------------------------------------------------------

const render = () => renderer.render(scene, camera);

async function takeScreenshot() {
  const blob = await capture({ renderer, scene, camera, scale: shot.scale, mark: shot.mark });
  download(blob, `treelab-${settings.tab}-${stamp()}.png`);
  note('Screenshot saved.');
}

async function shareScreenshot() {
  const blob = await capture({ renderer, scene, camera, scale: Math.min(shot.scale, 2), mark: shot.mark });
  const result = await shareImage({ blob, name: `treelab-${settings.tab}-${stamp()}.png`, link: shareLink(), download });
  if (result === 'shared') note('Shared.');
}

async function downloadModel() {
  note('Making the model…');
  const trees = settings.tab === 'tree' ? garden : woods;
  const ground = !model.ground ? null : settings.tab === 'tree' ? null : terrain.mesh;
  try {
    const groundHalf = settings.forest.radius + 10;
    const { blob, triangles } = await exportModel({ trees, ground, groundHalf, instancing: model.instancing, settings, link: shareLink() });
    download(blob, `treelab-${settings.tab}-${stamp()}.glb`);
    note(`Model saved: ${count(trees.userData.count)} trees, ${count(triangles)} triangles${model.instancing ? ' (instanced)' : ''}. It's yours to use (CC0).`, 8000);
  } catch (error) {
    console.error(error);
    note(`Couldn't make the model: ${error.message}`);
  }
}

// --- Picking: a double-click on a tree shows it alone ---------------------------------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
renderer.domElement.addEventListener('dblclick', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const group = settings.tab === 'tree' ? garden : woods;
  const hit = raycaster.intersectObjects(group.children, false)[0];
  const record = hit?.object.userData.trees?.[hit.instanceId];
  if (!record) return;
  const from = settings.tab;
  if (from === 'tree' && settings.tree.show !== 'grid') return;
  Object.assign(settings.tree, { kind: record.kind, seed: record.seed, variant: record.variant, show: 'one tree' });
  fillShapeFolder();
  refreshPanel();
  showGridRows();
  dirty.tree = true;
  if (settings.tab === 'tree') growTree({ frame: true });
  else showTab('tree', { frame: true });
  remember();
  note(from === 'tree' ? `The ${record.kind}, seed ${record.seed}, variant ${record.variant}. "show: grid" goes back to the grid.` : `The ${record.kind}, seed ${record.seed}, variant ${record.variant}, from the forest.`, 8000);
});

// --- Go -----------------------------------------------------------------------------

addEventListener('resize', () => {
  camera.aspect = aspect();
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const start = startingSettings();
if (start) assign(settings, start.settings);
tintGround();
fillShapeFolder();
showGridRows();
nameRadius();
showPatternRows();
showPatchRows();
standRow.show(settings.forest.grouping === 'in stands');
person.visible = settings.view.person;
controls.autoRotate = settings.view.spin;
refreshPanel();
setTerrain();
growTree();
showTab(settings.tab, { frame: true });
if (start?.notes.length) note(`From ${start.from}: ${start.notes.slice(0, 2).join('; ')}.`, 8000);
if (innerWidth > 0 && innerWidth < 700) gui.close();

let last = null;
renderer.setAnimationLoop((now) => {
  const dt = last === null ? 0 : (now - last) / 1000;
  last = now;
  rig.update(dt, controls.target);
  controls.update();
  fitFog();
  render();
});

// For poking at from the browser's console.
window.treelab = { scene, camera, controls, renderer, render, settings, garden, woods, rig, regrow, showTab, applySettings, frameView, get terrain() { return terrain; }, get stats() { return stats; } };
