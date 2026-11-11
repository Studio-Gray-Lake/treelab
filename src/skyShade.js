import * as THREE from 'three';
import { gapsDrawn } from './crownGaps.js';

// The sky's light among the trees. The sun's light is stopped by the crowns
// (its shadows); so is the sky's, which lights the shade. Under a closed
// canopy little of the sky is in sight, so the floor, the trunks and the
// undersides of the crowns are dim, and the spots of sun stand out. In the
// open, or over the crowns, the whole sky lights everything as before.
//
// How: as the sun's shadows, from 26 places in the sky instead of one. The
// trees are drawn from each place into a depth map (their own shapes, wood
// and foliage, with the crowns' gaps: src/crownGaps.js); then, for each cell
// of a grid over the trees, whether that place in the sky is in sight. What
// is in sight, each place weighted by what it gives level ground under an
// even sky, is the share of the sky's light arriving there, kept in a 3D
// texture. Every lit material reads it a cell out from its surface (the
// light arriving at it, not inside it) and takes that share of the sky's
// light (the sky as the scene's environment, and the mist's soft light).
//
// Worked out when the trees change (26 drawings of them: a few frames'
// work), not as they sway.
//
// Not counted yet: the hills (the sky is taken as open down to the
// horizon), and light thrown back by sunlit leaves and ground, which in a
// real wood adds a little green to the shade. One number per place, for a
// surface facing up: a trunk's side sees less of the sky than that, a
// little.

// Where the light comes from: [elevation (degrees), how many round the
// compass]. Each ring stands for a band of sky 22.5° tall; its weight is
// what that band gives level ground under an even sky (sin 2e). The air
// (the mist, src/lightShafts.js) isn't ground: it takes light from every
// way alike, so for it a band weighs what it covers of the sky (`air`:
// cos e), and the low sky, seen between the trunks, counts for most.
const RINGS = [[78.75, 4], [56.25, 6], [33.75, 8], [11.25, 8]];
export const RAYS = (() => {
  const rays = RINGS.flatMap(([elevation, count], ring) => {
    const e = THREE.MathUtils.degToRad(elevation);
    return Array.from({ length: count }, (_, k) => {
      const a = ((k + ring * 0.37) / count) * Math.PI * 2;
      return { x: Math.cos(e) * Math.sin(a), y: Math.sin(e), z: Math.cos(e) * Math.cos(a), weight: Math.sin(2 * e) / count, air: Math.cos(e) / count };
    });
  });
  for (const key of ['weight', 'air']) {
    const sum = rays.reduce((s, r) => s + r[key], 0);
    for (const r of rays) r[key] /= sum;
  }
  return rays;
})();

const CELLS = 400000; // cells in the grid at most
const FINEST = 0.75;  // m: a cell's edge at least
const LAYERS = 40;    // layers of cells at most (each is drawn 26 times)

// What every patched material reads: the map, the corner and size of the box
// it covers (world, m), a cell's edge, how far in from the box's sides the
// shade fades in (m), and how much of the shading is applied (1: all).
export const skyShade = {
  map: { value: null },
  min: { value: new THREE.Vector3() },
  span: { value: new THREE.Vector3(1, 1, 1) },
  cell: { value: 1 },
  edge: { value: 1 },
  amount: { value: 1 },
};

// The box of cells over the planted trees (src/tree.js: group.userData.
// species): { min: [x, y, z], n: [nx, ny, nz], cell (m), edge (m) }, or
// null with no trees. It takes in every crown, a margin round them (as far
// as the tallest tree is tall, or so: the trees dim the sky's light further
// off than that, a little, and there the shade fades out over `edge`), and
// a cell over them.
export function skyBox(group) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const species of Object.values(group.userData.species ?? {})) {
    for (const variant of species.variants) {
      const { foliage, wood } = variant.model.tree;
      const box = new THREE.Box3();
      for (const geometry of [foliage, wood]) {
        if (!geometry?.attributes.position.count) continue;
        geometry.computeBoundingBox();
        box.union(geometry.boundingBox);
      }
      if (box.isEmpty()) continue;
      const reach = Math.hypot(Math.max(-box.min.x, box.max.x), Math.max(-box.min.z, box.max.z));
      for (const t of variant.trees) {
        x0 = Math.min(x0, t.x - reach * t.size); x1 = Math.max(x1, t.x + reach * t.size);
        z0 = Math.min(z0, t.z - reach * t.size); z1 = Math.max(z1, t.z + reach * t.size);
        y0 = Math.min(y0, t.y); y1 = Math.max(y1, t.y + box.max.y * t.size);
      }
    }
  }
  if (!(x1 > x0)) return null;
  const margin = Math.min(40, Math.max(6, 1.2 * (y1 - y0)));
  const wide = x1 - x0 + 2 * margin, deep = z1 - z0 + 2 * margin, tall = y1 - y0;
  // (Cells as fine as can be afforded: a little coarser until they are.)
  let cell = Math.max(FINEST, Math.cbrt((wide * deep * tall) / CELLS));
  const cells = () => [Math.ceil(wide / cell), Math.ceil(tall / cell) + 2, Math.ceil(deep / cell)];
  let n = cells();
  while (n[0] * n[1] * n[2] > CELLS || n[1] > LAYERS) {
    cell *= 1.05;
    n = cells();
  }
  return { min: [(x0 + x1) / 2 - (n[0] * cell) / 2, y0, (z0 + z1) / 2 - (n[2] * cell) / 2], n, cell, edge: margin * 0.4 };
}

// A camera looking down a ray from the sky at the whole box (so `ray`, a
// unit vector toward the sky, is the way back along its view).
export function lookDown(box, ray, camera = new THREE.OrthographicCamera()) {
  const { min, n, cell } = box;
  const half = [n[0] * cell / 2, n[1] * cell / 2, n[2] * cell / 2];
  const radius = Math.hypot(...half);
  camera.left = camera.bottom = -radius;
  camera.right = camera.top = radius;
  camera.near = 1;
  camera.far = 2 * radius + 3;
  const center = new THREE.Vector3(min[0] + half[0], min[1] + half[1], min[2] + half[2]);
  camera.position.copy(center).addScaledVector(ray, radius + 2);
  camera.up.set(0, 1, 0);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

// The map's maker. update(group): the map for those trees as they stand
// now (null or no trees: open sky everywhere), into what the materials
// read. Returns the box.
export function createSkyShade({ renderer }) {
  let target = null;
  let depthTarget = null;
  const camera = new THREE.OrthographicCamera();
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const shapeOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  const count = new THREE.ShaderMaterial({
    name: 'SkyInSight',
    uniforms: {
      depthMap: { value: null },
      toMap: { value: new THREE.Matrix4() },
      boxMin: { value: new THREE.Vector3() },
      cell: { value: 1 },
      layer: { value: 0 },
      weight: { value: 0 },
      air: { value: 0 },
      bias: { value: 0 },
    },
    vertexShader: QUAD,
    fragmentShader: COUNT,
    depthTest: false,
    depthWrite: false,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), count);
  quad.frustumCulled = false;
  const open = openSky();
  skyShade.map.value ??= open;

  function update(group) {
    const box = group ? skyBox(group) : null;
    if (!box) {
      skyShade.map.value = open;
      skyShade.min.value.set(0, 0, 0);
      skyShade.span.value.set(1, 1, 1);
      return null;
    }
    const { min, n, cell } = box;
    if (!target || target.width !== n[0] || target.height !== n[2] || target.depth !== n[1]) {
      target?.dispose();
      // (Across: x and z; its layers: up.)
      target = new THREE.WebGL3DRenderTarget(n[0], n[2], n[1], { type: THREE.HalfFloatType, depthBuffer: false });
      target.texture.minFilter = target.texture.magFilter = THREE.LinearFilter;
    }
    const radius = Math.hypot(n[0], n[1], n[2]) * cell / 2;
    const size = radius > 40 ? 2048 : 1024;
    if (!depthTarget || depthTarget.width !== size) {
      depthTarget?.dispose();
      depthTarget = new THREE.WebGLRenderTarget(size, size, { depthTexture: new THREE.DepthTexture(size, size, THREE.UnsignedIntType) });
    }

    // The trees drawn as their shadows are (the sway's depth materials,
    // which sway them and leave the crowns' gaps out), from both sides.
    const meshes = group.children.filter((o) => o.isMesh);
    const own = meshes.map((o) => o.material);
    for (const o of meshes) {
      if (o.customDepthMaterial) o.customDepthMaterial.side = THREE.DoubleSide;
      o.material = o.customDepthMaterial ?? shapeOnly;
    }
    const before = { target: renderer.getRenderTarget(), autoClear: renderer.autoClear, shadows: renderer.shadowMap.autoUpdate };
    renderer.shadowMap.autoUpdate = false;
    gapsDrawn((2 * radius) / size);
    const u = count.uniforms;
    u.depthMap.value = depthTarget.depthTexture;
    u.boxMin.value.fromArray(min);
    u.cell.value = cell;
    try {
      RAYS.forEach((ray, r) => {
        lookDown(box, ray, camera);
        renderer.autoClear = true;
        renderer.setRenderTarget(depthTarget);
        renderer.render(group, camera);
        u.toMap.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        u.weight.value = ray.weight;
        u.air.value = ray.air;
        u.bias.value = (0.35 * cell) / (camera.far - camera.near);
        // (The first place in the sky is written; the rest are added to it.)
        count.blending = r === 0 ? THREE.NoBlending : THREE.CustomBlending;
        renderer.autoClear = false;
        for (let j = 0; j < n[1]; j++) {
          u.layer.value = j;
          renderer.setRenderTarget(target, j);
          renderer.render(quad, quadCamera);
        }
      });
    } finally {
      gapsDrawn(null);
      meshes.forEach((o, i) => (o.material = own[i]));
      renderer.setRenderTarget(before.target);
      renderer.autoClear = before.autoClear;
      renderer.shadowMap.autoUpdate = before.shadows;
    }
    skyShade.map.value = target.texture;
    skyShade.min.value.fromArray(min);
    skyShade.span.value.set(n[0], n[1], n[2]).multiplyScalar(cell);
    skyShade.cell.value = cell;
    skyShade.edge.value = box.edge;
    return box;
  }

  function dispose() {
    for (const o of [target, depthTarget, shapeOnly, count, quad.geometry, open]) o?.dispose();
    if (skyShade.map.value === open || skyShade.map.value === target?.texture) skyShade.map.value = null;
  }

  return { update, dispose, get target() { return target; } };
}

// A map of open sky everywhere (until there are trees).
function openSky() {
  const map = new THREE.Data3DTexture(Uint8Array.of(255, 255, 255, 255), 1, 1, 1);
  map.minFilter = map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  return map;
}

const QUAD = /* glsl */ `
  void main() {
    gl_Position = vec4( position.xy, 0.0, 1.0 );
  }
`;

// One layer of cells, one place in the sky: the share of each cell (eight
// points in it) from which that place is in sight, times its weight (r: for
// a surface; g: for the air).
const COUNT = /* glsl */ `
  uniform sampler2D depthMap;
  uniform mat4 toMap;
  uniform vec3 boxMin;
  uniform float cell;
  uniform float layer;
  uniform float weight;
  uniform float air;
  uniform float bias;
  float inSight( vec3 p ) {
    vec4 at = toMap * vec4( p, 1.0 );
    vec3 c = at.xyz / at.w * 0.5 + 0.5;
    if ( c.x <= 0.0 || c.y <= 0.0 || c.x >= 1.0 || c.y >= 1.0 ) return 1.0;
    return step( c.z - bias, texture2D( depthMap, c.xy ).r );
  }
  void main() {
    // (Across the layer: x and z.)
    vec3 middle = boxMin + vec3( gl_FragCoord.x, layer + 0.5, gl_FragCoord.y ) * cell;
    float seen = 0.0;
    for ( int k = 0; k < 8; k ++ ) {
      vec3 corner = vec3( float( k & 1 ), float( ( k >> 1 ) & 1 ), float( ( k >> 2 ) & 1 ) ) - 0.5;
      seen += inSight( middle + corner * 0.5 * cell );
    }
    gl_FragColor = vec4( weight * seen / 8.0, air * seen / 8.0, 0.0, 1.0 );
  }
`;

// The sky's light on `material` taken from the map, on top of whatever
// patched its shader before.
export function underSky(material) {
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.customProgramCacheKey = () => `${key}|sky-shade`;
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer);
    Object.assign(shader.uniforms, skyUniforms());
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkyAt;')
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
      .replace('#include <lights_fragment_end>', `${FRAGMENT}\n#include <lights_fragment_end>`);
  };
  material.needsUpdate = true;
}

// (Where the point is in the world, as three.js places it: project_vertex.)
const VERTEX = /* glsl */ `
  vec4 skyAt = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    skyAt = batchingMatrix * skyAt;
  #endif
  #ifdef USE_INSTANCING
    skyAt = instanceMatrix * skyAt;
  #endif
  vSkyAt = ( modelMatrix * skyAt ).xyz;
`;

// The map's uniforms, and how it's read at a place in the world (m): for a
// material's shader, and for the mist's (src/lightShafts.js). (Its layers
// run up. Toward the box's sides the shade fades out; past them there's
// none.)
export const SKY_GLSL = /* glsl */ `
  uniform highp sampler3D skyMap;
  uniform vec3 skyMin;
  uniform vec3 skySpan;
  uniform float skyCell;
  uniform float skyEdge;
  uniform float skyAmount;
  // (r: the sky's light arriving on a surface there; g: in the air there.)
  vec2 skyOpenBoth( vec3 place ) {
    vec3 at = place - skyMin;
    float side = min( min( at.x, skySpan.x - at.x ), min( at.z, skySpan.z - at.z ) );
    return 1.0 - ( 1.0 - texture( skyMap, ( at / skySpan ).xzy ).rg ) * smoothstep( 0.0, skyEdge, side ) * skyAmount;
  }
  float skyOpenAt( vec3 place ) {
    return skyOpenBoth( place ).r;
  }
  float skyOpenInAirAt( vec3 place ) {
    return skyOpenBoth( place ).g;
  }
`;
export const skyUniforms = () => ({
  skyMap: skyShade.map, skyMin: skyShade.min, skySpan: skyShade.span, skyCell: skyShade.cell, skyEdge: skyShade.edge, skyAmount: skyShade.amount,
});

const FRAGMENT_PARS = /* glsl */ `
  ${SKY_GLSL}
  varying vec3 vSkyAt;
`;

// (Before three.js adds up the light that isn't the sun's: the hemisphere
// light, and the sky as the scene's environment. The map is read a cell out
// from the surface, on the side it's seen from.)
const FRAGMENT = /* glsl */ `
  {
    float skyOpen = skyOpenAt( vSkyAt + inverseTransformDirection( geometryNormal, viewMatrix ) * skyCell );
    #if defined( RE_IndirectDiffuse )
      irradiance *= skyOpen;
      iblIrradiance *= skyOpen;
    #endif
    #if defined( RE_IndirectSpecular )
      radiance *= skyOpen;
      clearcoatRadiance *= skyOpen;
    #endif
  }
`;
