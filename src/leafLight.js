import * as THREE from 'three';

// Sunlight through the leaves. Looking toward a low sun, the crowns' edges
// glow: light passes through thin leaves, more where there are fewer of
// them between the leaf and the sun. Added to the foliage's own shader
// (MeshStandardMaterial, after the workshop's sway has patched it), from the
// sun (src/sunShadow.js) and its shadow maps:
//
// - through: a leaf lit from behind shows some of the light, as its front
//   shows what falls on it (a little greener: leaves pass on yellow-green);
// - toward the sun: looking into it, much more (leaves scatter light
//   onward), in a lobe round the sun;
// - how much gets through: the sun's shadow map, looked up 1, 2.5 and 5 m
//   toward the sun from the leaf, softly, in the leaf's own cascade. Lit there (past its own clump), the leaf
//   is at a crown's edge and glows; still shaded, it's deep in a crown, or
//   behind another tree or a hill, and doesn't. A clump's edges, seen
//   side-on, glow most.

// Shared by every patched material: the sun's direction (world, toward it)
// and how strong the light through the leaves is (1: as tuned; 0: none).
export const leafLight = {
  sun: { value: new THREE.Vector3(0, 1, 0) },
  leafGlow: { value: 1 },
};

const STEPS = [1, 2.5, 5]; // m toward the sun the shadow map is looked up
const BLUR = 4;            // texels: how soft those look-ups are
// Each look-up is nine looks at the shadow map: its middle, four round it
// halfway out and four at the rim, the same ones for every pixel. (three.js's own soft look-up turns its
// five a different way for each pixel, which is right for a shadow's edge
// one texel wide; over a radius this wide it showed as dots all over the
// glowing leaves, the brighter the glow the plainer.)
const ROUND = [[22.5, 0.5], [112.5, 0.5], [202.5, 0.5], [292.5, 0.5], [67.5, 1], [157.5, 1], [247.5, 1], [337.5, 1]]
  .map(([degrees, out]) => [out * Math.cos((degrees * Math.PI) / 180), out * Math.sin((degrees * Math.PI) / 180)]);

// The light through the leaves on `material` (strength: its share, needles
// pass on less than leaves), on top of whatever patched its shader before.
export function lightThrough(material, strength = 1) {
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.customProgramCacheKey = () => `${key}|leaf-light`;
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer);
    shader.uniforms.leafSun = leafLight.sun;
    shader.uniforms.leafGlow = leafLight.leafGlow;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <shadowmap_pars_fragment>', `#include <shadowmap_pars_fragment>\n${FRAGMENT_PARS}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${fragment(strength)}`);
  };
  material.needsUpdate = true;
}

const SHADOWED = 'defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0';

// (Each cascade has its half of the shadow texture: a point is looked up in
// the near one when it's in its depths and falls on its half, else in the
// far one.)
const FRAGMENT_PARS = /* glsl */ `
#if ${SHADOWED}
  uniform vec3 leafSun;
  uniform float leafGlow;
  float leafOpen( vec3 p, float depth, SunLightShadow s ) {
    vec4 at = sunShadowMatrix[ 0 ] * vec4( p, 1.0 );
    if ( depth >= sunShadowCascade[ 0 ].y || at.x / at.w > 0.5 ) at = sunShadowMatrix[ 1 ] * vec4( p, 1.0 );
    at.xyz /= at.w;
    at.z += s.shadowBias;
    if ( at.x < 0.0 || at.x > 1.0 || at.y < 0.0 || at.y > 1.0 || at.z > 1.0 ) return 1.0;
    vec2 wide = ( s.shadowRadius + ${BLUR.toFixed(1)} ) / s.shadowMapSize;
    float open = texture( sunShadowMap[ 0 ], at.xyz );
${ROUND.map(([x, y]) => `    open += texture( sunShadowMap[ 0 ], vec3( at.xy + wide * vec2( ${x.toFixed(4)}, ${y.toFixed(4)} ), at.z ) );`).join('\n')}
    return open / ${(ROUND.length + 1).toFixed(1)};
  }
#endif
`;

const fragment = (strength) => /* glsl */ `
#if ${SHADOWED} && NUM_SUN_LIGHTS > 0
  {
    vec3 toSun = sunLights[ 0 ].direction;
    float behind = saturate( - dot( geometryNormal, toSun ) );
    float into = pow( saturate( - dot( geometryViewDir, toSun ) ), 4.0 );
    // (A clump's edge, seen side-on, has fewer leaves to pass.)
    float edge = 1.0 - saturate( dot( geometryNormal, geometryViewDir ) );
    SunLightShadow s = sunLightShadows[ 0 ];
    float open = 0.0;
${STEPS.map((d) => `    open += leafOpen( vSunShadowWorldPosition.xyz + leafSun * ${d.toFixed(2)}, vSunShadowWorldPosition.w, s );`).join('\n')}
    open /= ${STEPS.length.toFixed(1)};
    // (Leaves pass on yellow-green: a little greener than they look.)
    vec3 passed = material.diffuseColor * vec3( 0.7, 1.0, 0.55 );
    float amount = ( 0.45 * behind + 1.6 * into * ( 0.4 + 0.6 * behind ) ) * ( 0.6 + 0.8 * edge * edge );
    reflectedLight.directDiffuse += sunLights[ 0 ].color * passed * RECIPROCAL_PI * amount * open * leafGlow * ${strength.toFixed(3)};
  }
#endif
`;
