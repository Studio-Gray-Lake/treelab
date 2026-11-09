import * as THREE from 'three';
import { profile } from './wind.js';

// The wind (src/wind.js) in the page: its picture for the GPU, a debug view
// to see it, and its panel.
//
// The wind texture: windAt sampled once a frame on a 48 × 48 grid over the
// 80 m ground. Anything drawn on the GPU that moves with the wind (the
// trees' flutter, the fog's drift, the motes) reads this instead of a GLSL
// copy of windAt that could drift out of step. Each texel holds:
//   r, g: the wind's x and z at crown height (6 m up), m/s;
//   b:    the gusts there, m/s;
//   a:    the wind's speed at 1 m, m/s.
// It is filled (wind.fillGrid) only in a frame something will draw with it:
// the debug view, or a reader that says so. A reader is added with
// addReader(wants), wants() answering, once a frame before the fill, whether
// it will be drawn with the texture this frame (tree sway: while it's on and
// its trees are shown); it returns a function that removes the reader.
// Unread, the texture keeps its last fill, and the next fill catches up.
//
// The debug view (V, or "show" in the Wind panel):
//   - the ground tinted by the wind at 1 m: blue calm, through green and
//     yellow, to orange at gale-ish (2.5 times the open wind);
//   - the gust patches as orange outlines on the ground, brighter the
//     stronger they are now;
//   - arrows on a 2 m grid round the character, at ankle height (0.3 m)
//     and crown height (6 m), as long as the wind is strong (0.25 m per m/s)
//     and coloured the same way.

const SIZE = 48;
const HALF = 40;          // m: the ground, each way from the middle
const CROWN = 6;          // m above the ground: the texture's high wind
const ARROW_GRID = 11;    // arrows each way, 2 m apart
const ARROW_SPACING = 2;
const ARROW_HEIGHTS = [0.3, 6];
const ARROW_SCALE = 0.25; // m of arrow per m/s
const ELLIPSE_SEGMENTS = 24;
const MAX_CELLS = 200;

export function createWindView({ scene, wind, terrain, folder }) {
  const settings = wind.settings;
  const view = { show: false };

  // --- The texture --------------------------------------------------------------

  const data = new Uint16Array(SIZE * SIZE * 4);
  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  const values = new Float32Array(SIZE * SIZE * 4); // (toHalf rounds to a float first anyway)
  const w = [0, 0, 0];
  const toHalf = THREE.DataUtils.toHalfFloat;

  // Already filled for this time and these settings (paused, say)?
  const last = { t: NaN };
  function filled(t) {
    let same = last.t === t;
    for (const key in settings) {
      if (last[key] !== settings[key]) same = false;
      last[key] = settings[key];
    }
    // (An extra wind from outside counts as a setting: which one, and its version.)
    const extra = wind.extra;
    if (last.extra !== extra || last.version !== extra?.version) same = false;
    last.extra = extra;
    last.version = extra?.version;
    last.t = t;
    return same;
  }

  // The readers (see the top): each one's wants().
  const readers = new Set();
  function addReader(wants) {
    readers.add(wants);
    return () => readers.delete(wants);
  }
  function read() {
    for (const wants of readers) if (wants()) return true;
    return false;
  }

  // The grid in one pass (wind.fillGrid: exactly windColumn at each texel),
  // then into half floats.
  function fillTexture(t) {
    wind.fillGrid(t, SIZE, HALF, CROWN, 1, values);
    for (let k = 0; k < data.length; k++) data[k] = toHalf(values[k]);
    texture.needsUpdate = true;
  }

  // The uniforms a shader needs to read it: the texture, and how to turn a
  // world x, z into a texture coordinate (uv = (xz + half) / (2 half)).
  const uniforms = {
    windMap: { value: texture },
    windHalf: { value: HALF },
    windShow: { value: 0 },
    windOpen: { value: 1 }, // the open wind's speed at 1 m, m/s: the heat map's scale
    windTime: { value: 0 }, // the simulated time, s (for the trees' flutter)
  };

  // --- The heat map, drawn by the ground's own material -----------------------------

  const ground = terrain.mesh.material;
  ground.customProgramCacheKey = () => 'wind-heat';
  ground.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWindUv;\nuniform float windHalf;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vWindUv = ((modelMatrix * vec4(transformed, 1.0)).xz + windHalf) / (2.0 * windHalf);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vWindUv;
        uniform sampler2D windMap;
        uniform float windShow;
        uniform float windOpen;
        ${HEAT_GLSL}`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        if (windShow > 0.5) {
          float strength = texture2D(windMap, vWindUv).a / max(windOpen * 2.5, 0.01);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, windHeat(strength), 0.45);
        }`);
  };
  ground.needsUpdate = true;

  // --- Arrows and gust outlines -----------------------------------------------------

  const arrowCount = ARROW_GRID * ARROW_GRID * ARROW_HEIGHTS.length;
  const arrows = lines(arrowCount * 6);
  const cells = lines(MAX_CELLS * ELLIPSE_SEGMENTS * 2);
  scene.add(arrows, cells);
  const color = new THREE.Color();

  function drawArrows(t, center) {
    const pos = arrows.geometry.attributes.position;
    const col = arrows.geometry.attributes.color;
    let n = 0;
    const put = (x, y, z) => { pos.setXYZ(n, x, y, z); col.setXYZ(n, color.r, color.g, color.b); n++; };
    const cx = Math.round(center.x / ARROW_SPACING) * ARROW_SPACING;
    const cz = Math.round(center.z / ARROW_SPACING) * ARROW_SPACING;
    const half = (ARROW_GRID - 1) / 2;
    const open = openSpeed();
    for (const h of ARROW_HEIGHTS) {
      for (let j = -half; j <= half; j++) {
        for (let i = -half; i <= half; i++) {
          const x = cx + i * ARROW_SPACING, z = cz + j * ARROW_SPACING;
          const y = terrain.heightAt(x, z) + h;
          wind.windAbove(t, x, z, h, w);
          const speed = Math.hypot(w[0], w[1], w[2]);
          heatColor(speed / (open * 2.5), color);
          const len = Math.min(speed * ARROW_SCALE, ARROW_SPACING * 0.95);
          const k = speed > 1e-6 ? len / speed : 0;
          const ex = x + w[0] * k, ey = y + w[1] * k, ez = z + w[2] * k;
          // the head: two short lines back from the tip, either side across the wind
          const back = len * 0.3;
          const fx = w[0] * k / Math.max(len, 1e-6), fz = w[2] * k / Math.max(len, 1e-6);
          put(x, y, z); put(ex, ey, ez);
          put(ex, ey, ez); put(ex - back * (fx - fz * 0.5), ey, ez - back * (fz + fx * 0.5));
          put(ex, ey, ez); put(ex - back * (fx + fz * 0.5), ey, ez - back * (fz - fx * 0.5));
        }
      }
    }
    arrows.geometry.setDrawRange(0, n);
    pos.needsUpdate = col.needsUpdate = true;
  }

  function drawCells(t) {
    const pos = cells.geometry.attributes.position;
    const col = cells.geometry.attributes.color;
    const { dx, dz, nx, nz } = wind.axes();
    let n = 0;
    for (const cell of wind.cellsAt(t)) {
      if (cell.strength < 0.3 || n >= pos.count) continue;
      const reach = cell.length / 2;
      if (Math.abs(cell.x) > HALF + reach || Math.abs(cell.z) > HALF + reach) continue; // (off the ground)
      const k = Math.min(1, cell.strength / Math.max(settings.gust, 0.1));
      color.setRGB(1, 0.55, 0.2).multiplyScalar(0.35 + 0.65 * k);
      let px = 0, pz = 0;
      for (let s = 0; s <= ELLIPSE_SEGMENTS; s++) {
        const a = (s / ELLIPSE_SEGMENTS) * Math.PI * 2;
        const along = Math.cos(a) * cell.length / 2, across = Math.sin(a) * cell.width / 2;
        const x = cell.x + dx * along + nx * across, z = cell.z + dz * along + nz * across;
        if (s > 0) {
          pos.setXYZ(n, px, terrain.heightAt(px, pz) + 0.06, pz); col.setXYZ(n, color.r, color.g, color.b); n++;
          pos.setXYZ(n, x, terrain.heightAt(x, z) + 0.06, z); col.setXYZ(n, color.r, color.g, color.b); n++;
        }
        px = x; pz = z;
      }
    }
    cells.geometry.setDrawRange(0, n);
    pos.needsUpdate = col.needsUpdate = true;
  }

  // The open wind's speed at 1 m (no lee, no canopy, no gust), for the
  // colours' scale.
  function openSpeed() {
    return Math.max(profile(1) * settings.speed, 0.5);
  }

  // --- Panel and key --------------------------------------------------------------

  folder.add(settings, 'on').name('wind on');
  folder.add(settings, 'speed', 0, 10, 0.1).name('mean wind at 2 m (m/s)');
  folder.add(settings, 'from', 0, 355, 5).name('blows from (°, 90 = +x)');
  folder.add(settings, 'gust', 0, 12, 0.5).name('gusts add up to (m/s)');
  folder.add(settings, 'gustEvery', 10, 60, 1).name('a gust every (s)');
  folder.add(settings, 'turbulence', 0, 0.5, 0.01).name('swirl (share)');
  folder.add(settings, 'seed', 1, 99, 1).name('seed');
  folder.add(view, 'show').name('show wind (V)').listen();

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyV') view.show = !view.show;
  });

  // Once a frame, at simulated time t, round the character at center.
  function update(t, center) {
    const show = view.show && settings.on;
    arrows.visible = cells.visible = show;
    uniforms.windShow.value = show ? 1 : 0;
    uniforms.windOpen.value = openSpeed();
    uniforms.windTime.value = t;
    if ((show || read()) && !filled(t)) fillTexture(t);
    if (!show) return;
    drawArrows(t, center);
    drawCells(t);
  }

  return { update, texture, uniforms, view, addReader };
}

// Whether an object will be drawn: it and everything it hangs from are
// visible, up to a scene. (For a reader's wants().)
export function shown(object) {
  for (let o = object; o; o = o.parent) {
    if (!o.visible) return false;
    if (o.isScene) return true;
  }
  return false;
}

function lines(vertices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0, 0);
  const mesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true }));
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}

// Calm to strong (0..1 of 2.5 times the open wind): blue, green, yellow, orange.
const HEAT = [[0, [0.15, 0.35, 0.95]], [0.35, [0.2, 0.8, 0.45]], [0.65, [1, 0.85, 0.2]], [1, [1, 0.4, 0.1]]];
function heatColor(v, out) {
  const s = Math.min(1, Math.max(0, v));
  let k = 0;
  while (k < HEAT.length - 2 && s > HEAT[k + 1][0]) k++;
  const [a, ca] = HEAT[k], [b, cb] = HEAT[k + 1];
  const f = (s - a) / (b - a);
  return out.setRGB(ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f);
}
const HEAT_GLSL = `
  vec3 windHeat(float v) {
    float s = clamp(v, 0.0, 1.0);
    vec3 c0 = vec3(0.15, 0.35, 0.95), c1 = vec3(0.2, 0.8, 0.45), c2 = vec3(1.0, 0.85, 0.2), c3 = vec3(1.0, 0.4, 0.1);
    if (s < 0.35) return mix(c0, c1, s / 0.35);
    if (s < 0.65) return mix(c1, c2, (s - 0.35) / 0.3);
    return mix(c2, c3, (s - 0.65) / 0.35);
  }`;
