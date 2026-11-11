import * as THREE from 'three';

// The eye adjusting to what it looks at. The hour sets an exposure for the
// open scene (src/light.js); under the trees there's far less light, and
// an eye, or a camera's meter, opens up for it: the shade shows its detail
// and the spots of sun burn bright. Looking back out at the open, it closes
// down again.
//
// How: every few frames the finished picture (the scene, the mist and the
// light shafts, as shown) is copied, shrunk to a few thousand points and
// read back, and its mean brightness worked out. The exposure that would
// bring that mean to AIM is the goal; the exposure moves toward it over a
// second or so, faster when the view gets brighter than when it gets
// darker, as eyes do.
//
// How far it goes (ADAPTS): a bright view closes it down by up to a stop. A
// dim one opens it, in full for the first stop and by half of what is
// called for beyond that: an eye makes up for a little darkness wholly
// and for a lot only partly, so deep shade still looks dim, but shows what
// is in it. And it opens no further than a fixed way past the brightest
// hour's exposure, whatever the hour: the darker the hour, the more of
// that the hour has used already, so an eye doesn't make dusk as bright as
// noon. (A wood on a misty morning, the sun too low to get in, is far
// darker against the open than the same wood at noon: there the eye opens
// about three stops, at noon a little over two.)
//
// The picture is measured as shown, so what's burnt out counts as white, no
// brighter: a patch of sky seen through the trees doesn't close the eye
// down as far as its true brightness would.

export const AIM = 0.22;         // the picture's mean brightness the eye settles on (0 black, 1 white): an open view's, at the hour's exposure (a little over a photographer's middle grey)
export const ADAPTS = {          // in stops (a stop: half or twice the light let in)
  closes: 1,    // as far as it closes down from the hour's exposure
  fully: 1,     // a dim view: made up for in full this far,
  partly: 0.5,  // and by this share of what's called for beyond it
  opens: 3.2,   // as far as it opens past the brightest hour's exposure, at any hour
};
const BRIGHTER = 0.35, DARKER = 1.4; // s: how fast it follows a view that got brighter, or darker
const WIDE = 64, HIGH = 36;      // the picture is measured this small
const TAPS = 6;                  // each of its points a mean of 6 x 6 places in the picture
const EVERY = 3;                 // frames between looks

// The stops the eye has, [down, up], at an hour whose own exposure is
// `base` (`brightest`: the brightest hour's, src/light.js).
export function rangeAt(base, brightest = base) {
  return [-ADAPTS.closes, Math.max(ADAPTS.fully, ADAPTS.opens - Math.log2(base / brightest))];
}

// The exposure the eye is heading for. base: the hour's; was: the exposure
// the measured picture was drawn with; seen: its mean brightness; follow:
// how far the eye follows (0: stays at base; 1: as far as it goes); range:
// the stops it has at this hour.
export function exposureFor({ base, was, seen, aim = AIM, follow = 1, range = rangeAt(base) }) {
  if (!(seen > 0) || !(was > 0) || !(follow > 0)) return base;
  let stops = Math.log2((was * aim) / (seen * base)); // (what would bring the picture to the aim)
  if (stops > ADAPTS.fully) stops = ADAPTS.fully + (stops - ADAPTS.fully) * ADAPTS.partly;
  return base * 2 ** Math.min(range[1], Math.max(range[0], stops * follow));
}

// The exposure a moment later: `now` moved toward `goal` over dt seconds.
export function eased(now, goal, dt) {
  if (!(dt > 0) || now === goal) return now;
  const next = now * (goal / now) ** (1 - Math.exp(-dt / (goal < now ? BRIGHTER : DARKER)));
  return Math.abs(Math.log2(goal / next)) < 0.004 ? goal : next;
}

// The meter. look(): measures the frame just drawn, without waiting (the
// answer comes a few frames later, in `seen`: { mean, at (the exposure it
// was drawn with) }); measure(): the same at once, waiting for the GPU
// (for the first frame, and for settling before a picture).
export function createEye({ renderer }) {
  let frame = null;
  const small = new THREE.WebGLRenderTarget(WIDE, HIGH, { depthBuffer: false });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const shrink = new THREE.ShaderMaterial({
    name: 'EyeMeter',
    uniforms: { frame: { value: null } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4( position.xy, 0.0, 1.0 );
      }`,
    // (The picture's colours are as the screen takes them, sRGB: back to
    // light before the mean. The mean's square root is kept: finer steps
    // in the dark, in a byte.)
    fragmentShader: /* glsl */ `
      uniform sampler2D frame;
      varying vec2 vUv;
      vec3 light( vec3 c ) {
        return mix( c / 12.92, pow( ( c + 0.055 ) / 1.055, vec3( 2.4 ) ), step( 0.04045, c ) );
      }
      void main() {
        float sum = 0.0;
        for ( int j = 0; j < ${TAPS}; j ++ ) {
          for ( int i = 0; i < ${TAPS}; i ++ ) {
            vec2 at = vUv + ( ( vec2( float( i ), float( j ) ) + 0.5 ) / ${TAPS.toFixed(1)} - 0.5 ) / vec2( ${WIDE.toFixed(1)}, ${HIGH.toFixed(1)} );
            sum += dot( light( texture2D( frame, at ).rgb ), vec3( 0.2126, 0.7152, 0.0722 ) );
          }
        }
        gl_FragColor = vec4( vec3( sqrt( sum / ${(TAPS * TAPS).toFixed(1)} ) ), 1.0 );
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shrink);
  quad.frustumCulled = false;
  const pixels = new Uint8Array(WIDE * HIGH * 4);
  const size = new THREE.Vector2();
  const eye = { seen: null, look, measure, dispose };
  let pending = false, frames = 0;

  // The frame on screen, copied and shrunk into `small`.
  function shrunk() {
    renderer.getDrawingBufferSize(size);
    if (!(size.x > 0 && size.y > 0)) return false;
    if (!frame || frame.image.width !== size.x || frame.image.height !== size.y) {
      frame?.dispose();
      frame = new THREE.FramebufferTexture(size.x, size.y);
      frame.minFilter = frame.magFilter = THREE.LinearFilter;
      shrink.uniforms.frame.value = frame;
    }
    const before = { target: renderer.getRenderTarget(), autoClear: renderer.autoClear };
    renderer.setRenderTarget(null);
    renderer.copyFramebufferToTexture(frame);
    renderer.autoClear = false;
    renderer.setRenderTarget(small);
    renderer.render(quad, camera);
    renderer.setRenderTarget(before.target);
    renderer.autoClear = before.autoClear;
    return true;
  }

  function mean(from = pixels) {
    let sum = 0;
    for (let i = 0; i < from.length; i += 4) sum += (from[i] / 255) ** 2;
    return sum / (WIDE * HIGH);
  }

  function look() {
    if (pending || frames++ % EVERY || !shrunk()) return;
    const at = renderer.toneMappingExposure;
    pending = true;
    renderer.readRenderTargetPixelsAsync(small, 0, 0, WIDE, HIGH, pixels)
      .then(() => { eye.seen = { mean: mean(), at }; })
      .catch(() => {}) // (a lost context: the next look tries again)
      .finally(() => { pending = false; });
  }

  // (Read at once, into its own bytes: a look still on its way keeps its.)
  const atOnce = new Uint8Array(WIDE * HIGH * 4);
  function measure() {
    if (!shrunk()) return eye.seen;
    renderer.readRenderTargetPixels(small, 0, 0, WIDE, HIGH, atOnce);
    return (eye.seen = { mean: mean(atOnce), at: renderer.toneMappingExposure });
  }

  function dispose() {
    for (const o of [frame, small, shrink, quad.geometry]) o?.dispose();
  }

  return eye;
}
