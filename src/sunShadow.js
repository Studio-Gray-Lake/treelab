import * as THREE from 'three';
import { SunLight } from 'three/addons/lights/SunLight.js';
import { SunLightShadow } from 'three/addons/lights/SunLightShadow.js';

// The sun, with its shadows in two cascades: a sharp shadow map for what's
// near the camera and a broader one for what's beyond, side by side in one
// texture (three.js's SunLight, which the renderer draws so).
//
// three.js fits its cascades to the whole view, out to a set distance. Here
// they're fitted to the part of the view the stage fills (the trees shown
// and as far as their shadows reach), and split nearer the camera, so the
// trees close by have sharp shadows however big the forest is, and a forest
// seen from afar uses both maps on itself rather than on the empty air in
// front of it. (Fitted as three.js's SunLightShadow fits them, MIT.)
//
// A cascade then covers the stage rather than all the view, so a point off
// the stage can fall outside its map, onto the other cascade's half of the
// texture, and pick up shadows that aren't there. three.js's look-up (its
// shadow shader code, shared by every material) is changed once, here, to
// take a cascade only where the point falls on that cascade's own half;
// elsewhere the point is lit (nothing on the stage shades it).
//
// And the sun isn't a point: it's a disc half a degree wide, so a shadow's
// edge is soft by 9 mm for each metre between what casts it and where it
// falls. The look-up looks toward five points of the disc (turned about
// from pixel to pixel), and toward twelve more where those don't agree
// (a shadow's soft edge, where it matters). The shadow map holds only the first thing the sun
// meets, so how far up the sun's way that is can't be read exactly:
// something FAR_UP m up or more is taken for the crowns, as far up the
// sun's way as the crowns are, and its shadow is soft by that; anything
// nearer (a trunk beside you, a clump's own leaves) keeps three.js's own
// look-up, nearly sharp. So the spots of sun on the floor of a wood are
// round and soft, as they are, and a trunk's shadow at its foot is crisp.
// (The same in the air: src/lightShafts.js.)

const CASCADES = 2;   // (three.js's shader draws two)
const FADE = 0.1;     // the share of a cascade's depth over which it blends into the next

export const SUN_WIDE = 0.00465; // the sun's disc: its radius, as m to the side for each m away (half of 0.53 degrees)
export const FAR_UP = 12;        // m: something this far up the sun's way or more is taken for the crowns
const FIRST = 5;                 // points of the sun's disc looked toward at first: if they agree (all lit, all shaded), that's the answer
const DISC = 12;                 // and this many more where they don't (a shadow's soft edge)

// What the look-up reads (materials take them with underSunDisc; without,
// they're 0 and the look-up is three.js's own): how deep each cascade's map
// reaches along the sun's way (m), how high the crowns are (m), and the way
// to the sun.
export const sunWidth = {
  deep: { value: new THREE.Vector2(0, 0) },
  crowns: { value: 0 },
  toSun: { value: new THREE.Vector3(0, 1, 0) },
};
export function underSunDisc(material) {
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.customProgramCacheKey = () => `${key}|sun-disc`;
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer);
    shader.uniforms.sunDiscDeep = sunWidth.deep;
    shader.uniforms.sunDiscCrowns = sunWidth.crowns;
    shader.uniforms.sunDiscToSun = sunWidth.toSun;
  };
  material.needsUpdate = true;
}

const SUN_DISC = /* glsl */ `
		uniform vec2 sunDiscDeep;
		uniform float sunDiscCrowns;
		uniform vec3 sunDiscToSun;

		#if defined( SHADOWMAP_TYPE_PCF )

			// One look at cascade i's map for a place: lit (1) or shaded (0);
			// nearer (m): by something at least that far up the sun's way.
			float sunLook( sampler2DShadow shadowMap, mat4 toMap, vec3 place, float bias, float nearer, float deep, int i ) {
				vec4 at = toMap * vec4( place, 1.0 );
				at.xyz /= at.w;
				float onMap = at.x * float( SUN_LIGHT_CASCADES ) - float( i );
				if ( onMap < 0.0 || onMap > 1.0 || at.y < 0.0 || at.y > 1.0 || at.z > 1.0 ) return 1.0;
				return texture( shadowMap, vec3( at.xy, at.z + bias - nearer / deep ) );
			}

			float sunDiscShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, mat4 toMap, vec3 place, int i ) {
				float plain = getShadow( shadowMap, shadowMapSize, 1.0, shadowBias, shadowRadius, shadowCoord );
				if ( sunDiscDeep.x <= 0.0 ) return mix( 1.0, plain, shadowIntensity );
				float deep = i == 0 ? sunDiscDeep.x : sunDiscDeep.y;
				// (No crowns in the way of the straight look: then what shades it is near.)
				float clear = sunLook( shadowMap, toMap, place, shadowBias, ${FAR_UP.toFixed(1)}, deep, i );
				float near = ( 1.0 - plain ) * clear;
				if ( near >= 1.0 ) return 1.0 - shadowIntensity;
				vec3 side = normalize( cross( sunDiscToSun, vec3( 0.0, 1.0, 0.0 ) ) );
				vec3 over = cross( side, sunDiscToSun );
				float way = clamp( ( sunDiscCrowns - place.y ) / max( 0.1, sunDiscToSun.y ), ${FAR_UP.toFixed(1)}, 150.0 );
				float turn = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				float shown = 0.0;
				for ( int k = 0; k < ${FIRST + DISC}; k ++ ) {
					// (The first few points spread over the disc; then, if they
					// don't agree, the rest, spread over it again. All turned a
					// different way for each pixel: the same for every pixel,
					// they show the shadow map's own texels as blocks.)
					if ( k == ${FIRST} && ( shown <= 0.0 || shown >= ${FIRST.toFixed(1)} ) ) return mix( 1.0, shown / ${FIRST.toFixed(1)}, shadowIntensity );
					vec2 disc = k < ${FIRST} ? vogelDiskSample( k, ${FIRST}, turn ) : vogelDiskSample( k - ${FIRST}, ${DISC}, turn + 2.4 );
					vec3 through = place + ( side * disc.x + over * disc.y ) * ( ${SUN_WIDE} * way );
					float past = sunLook( shadowMap, toMap, through, shadowBias, ${FAR_UP.toFixed(1)}, deep, i );
					// (Something near, seen through the crowns' gap where the straight look can't see it.)
					float behind = past > 0.0 && clear < 1.0 ? ( 1.0 - sunLook( shadowMap, toMap, through, shadowBias, 0.0, deep, i ) ) * ( 1.0 - clear ) : 0.0;
					shown += past * ( 1.0 - min( 1.0, near + behind ) );
				}
				return mix( 1.0, shown / ${(FIRST + DISC).toFixed(1)}, shadowIntensity );
			}

		#else

			#define sunDiscShadow( map, size, intensity, bias, radius, coord, toMap, place, i ) getShadow( map, size, intensity, bias, radius, coord )

		#endif
`;

const SUN_LOOKUP = 'float getSunShadow(';
const LOOKUP = 'float cascadeShadow = getShadow(';
const COORD = 'sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition';
export const shadowChunkPatched = (() => {
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  if (chunk.includes('cascadeOnMap')) return true;
  if (chunk.split(LOOKUP).length !== 2 || chunk.split(COORD).length !== 2 || chunk.split(SUN_LOOKUP).length !== 2) {
    console.warn('TreeLab: three.js\'s sun shadow code has changed; shadows may show off the stage');
    return false;
  }
  THREE.ShaderChunk.shadowmap_pars_fragment = chunk
    .replace(SUN_LOOKUP, `${SUN_DISC}\n\t\t${SUN_LOOKUP}`)
    .replace(COORD, 'cascadeCoord, sunShadowMatrix[ cascadeOffset + i ], shadowWorldPosition.xyz, i')
    .replace(LOOKUP, [
      `vec4 cascadeCoord = ${COORD};`,
      'float cascadeOnMap = cascadeCoord.x / cascadeCoord.w * float( SUN_LIGHT_CASCADES ) - float( i );',
      'float cascadeShadow = cascadeOnMap < 0.0 || cascadeOnMap > 1.0 ? 1.0 : sunDiscShadow(',
    ].join('\n'));
  return true;
})();

// shadow.stage: the sphere the shadows are drawn in (world, m).
// shadow.split: where the cascades part, from evenly by depth (0) to by the
// ratio of distances (1): nearer the camera, sharper close by.
export class StageShadow extends SunLightShadow {
  constructor() {
    super();
    this.stage = { center: new THREE.Vector3(), radius: 10 };
    this.split = 0.8;
  }

  updateMatrices(light, view) {
    if (view === undefined) return;

    // (Each map inset by the filter's reach, so its look-ups stay in it.)
    const insetX = Math.min(0.25, (Math.ceil(this.radius) + 1) / this.mapSize.x);
    const insetY = Math.min(0.25, (Math.ceil(this.radius) + 1) / this.mapSize.y);
    for (let i = 0; i < CASCADES; i++) this._viewports[i].set(i + insetX, insetY, 1 - 2 * insetX, 1 - 2 * insetY);
    const resolutionX = this.mapSize.x * (1 - 2 * insetX);
    const resolutionY = this.mapSize.y * (1 - 2 * insetY);
    const resolution = Math.min(resolutionX, resolutionY);

    // The depths the stage fills in the view.
    const { near, far, middle } = stageDepths(this.stage, view);
    const splits = this._cascadeSplits;
    splits[0] = near;
    splits[CASCADES] = far;
    for (let i = 1; i < CASCADES; i++) {
      const t = i / CASCADES;
      const even = near + (far - near) * t;
      const ratio = near * Math.pow(far / near, t);
      // (The near map reaches at least to the stage's middle, or halfway, so
      // what the camera turns round is sharp; and past a twentieth of the
      // depth, so a camera right by a tree still has it reach past that.)
      const reach = near + (Math.min(middle, (near + far) / 2) - near) * (i / (CASCADES - 1));
      splits[i] = Math.max(reach, near + (far - near) * 0.05 * i, even + (ratio - even) * this.split);
    }

    // The light's frame: +z toward the sun.
    _travel.setFromMatrixPosition(light.matrixWorld).negate().normalize();
    _up.set(0, 1, 0);
    if (Math.abs(_up.dot(_travel)) > 0.99) _up.set(0, 0, 1);
    _orientation.lookAt(_origin, _travel, _up);
    _worldToLight.copy(_orientation).transpose();
    _viewToLight.copy(_worldToLight).multiply(view.matrixWorld);

    // The view's corners at depth 1, in its own frame.
    unitCorners(view);

    // Whatever can cast a shadow into the view: as high toward the sun as the
    // stage reaches, or the view does.
    _point.copy(this.stage.center).applyMatrix4(_worldToLight);
    let ceiling = _point.z + this.stage.radius;
    for (const depth of [near, far]) {
      for (const c of _unit) ceiling = Math.max(ceiling, corner(c, depth, view, _corner).applyMatrix4(_viewToLight).z);
    }

    const shadowNear = this.camera.near;
    for (let i = 0; i < CASCADES; i++) {
      // Each cascade starts where the one before starts fading, so both are
      // there while they blend.
      const from = i === 0 ? splits[0] : this._cascadeData[i - 1].z;
      const to = splits[i + 1];
      const fadeStart = to - FADE * (to - splits[i]);
      this._cascadeData[i].set(i === 0 ? -1e10 : from, to, fadeStart, 0);

      // The slice's corners in the light's frame, and a sphere round them (it
      // doesn't change as the camera turns, so the shadows don't swim).
      _center.set(0, 0, 0);
      let k = 0;
      for (const depth of [from, to]) {
        for (const c of _unit) {
          corner(c, depth, view, _slice[k]).applyMatrix4(_viewToLight);
          _center.add(_slice[k++]);
        }
      }
      _center.multiplyScalar(1 / _slice.length);
      let radiusSq = 0, lowest = Infinity;
      for (const p of _slice) {
        radiusSq = Math.max(radiusSq, p.distanceToSquared(_center));
        lowest = Math.min(lowest, p.z);
      }
      let radius = Math.sqrt(radiusSq);
      // (No wider than the stage itself, round its middle: beyond it there's
      // nothing to shade.)
      _point.copy(this.stage.center).applyMatrix4(_worldToLight);
      if (radius > this.stage.radius) {
        radius = this.stage.radius;
        _center.x = _point.x;
        _center.y = _point.y;
      }

      // Snapped to the map's texels, so the shadows don't shimmer as the
      // camera moves.
      if (resolution > 1) {
        radius /= 1 - 1 / resolution;
        const texelX = (2 * radius) / resolutionX, texelY = (2 * radius) / resolutionY;
        _center.x = Math.round(_center.x / texelX) * texelX;
        _center.y = Math.round(_center.y / texelY) * texelY;
      }

      _center.z = ceiling + shadowNear;
      _center.applyMatrix4(_orientation);
      const camera = this._cameras[i];
      camera.position.copy(_center);
      camera.quaternion.setFromRotationMatrix(_orientation);
      camera.left = -radius;
      camera.right = radius;
      camera.top = radius;
      camera.bottom = -radius;
      camera.near = shadowNear;
      camera.far = ceiling - Math.min(lowest, _point.z - this.stage.radius) + 2 * shadowNear;
      camera.coordinateSystem = this.camera.coordinateSystem;
      camera._reversedDepth = this.camera.reversedDepth;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      this._updateMatrix(camera, this._matrices[i], this._frustums[i], this._viewports[i]);
    }
    // (For the sun's width in the look-up: how deep the maps reach, and the
    // way to the sun.)
    sunWidth.deep.value.set(this._cameras[0].far - this._cameras[0].near, this._cameras[1].far - this._cameras[1].near);
    sunWidth.toSun.value.copy(_travel).negate();
  }
}

// The nearest and farthest depths of the stage's sphere in the view, within
// the view's own near and far, and the depth of its middle.
export function stageDepths(stage, view) {
  const middle = -_point.copy(stage.center).applyMatrix4(view.matrixWorldInverse).z;
  const near = Math.max(view.near, middle - stage.radius);
  const far = Math.max(near + 1, Math.min(view.far, middle + stage.radius));
  return { near, far, middle };
}

// The sun, its shadows drawn in two cascades fitted to the stage. It shines
// from its position toward the origin.
export function createSun(color, intensity) {
  const sun = new SunLight(color, intensity);
  sun.shadow.dispose();
  sun.shadow = new StageShadow();
  return sun;
}

const _travel = new THREE.Vector3(), _up = new THREE.Vector3(), _origin = new THREE.Vector3();
const _center = new THREE.Vector3(), _point = new THREE.Vector3(), _corner = new THREE.Vector3();
const _orientation = new THREE.Matrix4(), _worldToLight = new THREE.Matrix4(), _viewToLight = new THREE.Matrix4();
const _unit = Array.from({ length: 4 }, () => new THREE.Vector3());
const _slice = Array.from({ length: 8 }, () => new THREE.Vector3());

// The view's four corners at depth 1 (a perspective camera's: they scale
// with depth; an orthographic camera's: they don't).
function unitCorners(view) {
  const zNear = view.reversedDepth ? 1 : -1;
  _unit.forEach((c, i) => {
    const x = i === 0 || i === 1 ? 1 : -1;
    const y = i === 0 || i === 3 ? 1 : -1;
    c.set(x, y, zNear).applyMatrix4(view.projectionMatrixInverse);
    if (view.isPerspectiveCamera) c.multiplyScalar(1 / -c.z);
  });
}

// A corner of the view at `depth`, in its own frame.
function corner(unit, depth, view, out) {
  return view.isPerspectiveCamera ? out.copy(unit).multiplyScalar(depth) : out.set(unit.x, unit.y, -depth);
}
