import * as THREE from 'three';

// The day's light: from the time of day and where the noon sun stands, the
// sun's direction, colour and strength, the sky's haze, how much light the
// sky gives against the sun, and the camera's exposure.
//
// The sky and the sun are in proportion. A clear sky gives level ground
// about an eighth as much light as the sun gives a surface facing it
// (measured clear days: 100 to 120 W/m2 from the sky against 800 to 900
// from the sun), and nearer a quarter with the sun on the horizon, when the
// sun's own light is thin. src/main.js draws the sky that bright, no
// brighter, and everything takes its light from the sky as drawn: so the
// sky is a mid blue against sunlit ground, as in a photograph exposed for
// the ground, and the shade is lit by the sky and by what the sunlit
// ground throws back.
//
// A summer day: the sun rises at 5:30, stands highest at 13:00 (62° up) and
// sets at 20:30, swinging from the left of its noon direction to the right.
// Low, it turns golden, then orange and dims; the fog warms with it, so far
// hills fade into the sky's own colour.

export const SUNRISE = 5.5, NOON = 13, SUNSET = 20.5;
export const DAY_EXPOSURE = 1.35; // the camera's exposure with the sun high, the brightest hours': a white thing in the noon sun comes out just short of white, as a photographer sets it
export const SKY_SHARE = [0.25, 0.13]; // what the sky gives level ground, over what the sun gives a surface facing it: the sun on the horizon, and high
const NIGHT_SKY = 0.02;           // the least the sky gives (in the sun's own measure: noon's sun is 3). Brighter than a real night's, so the night can be seen
const HIGHEST = 62; // degrees

const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

// Where the sun is: { elevation (degrees above the horizon), direction (a
// unit Vector3 toward the sun) }. from: the compass direction the noon sun
// shines from, degrees (0 from -z, 90 from +x, as the wind's "from").
export function sunAt(hour, from) {
  const day = (hour - SUNRISE) / (SUNSET - SUNRISE); // 0 at sunrise, 1 at sunset
  const elevation = day < 0 || day > 1 ? -4 : HIGHEST * Math.sin(Math.PI * day); // (just under the horizon at night)
  // Morning: 100° to the left of noon's direction; evening: 100° to the right.
  const azimuth = THREE.MathUtils.degToRad(from + (hour - NOON) / ((SUNSET - SUNRISE) / 2) * 100);
  const e = THREE.MathUtils.degToRad(elevation);
  const direction = new THREE.Vector3(Math.sin(azimuth) * Math.cos(e), Math.sin(e), -Math.cos(azimuth) * Math.cos(e)).normalize();
  return { elevation, direction };
}

// How bright a colour of light is (to the eye: green counts for most).
export const brightness = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

// A colour as the screen shows it: `color` (light, as the sky gives it) at
// `exposure`, through three.js's Neutral tone mapping (as its shader does).
// The fog needs it: three.js mixes the fog in after the tone mapping.
export function onScreen(color, exposure, out = new THREE.Color()) {
  const START = 0.8 - 0.04, DESATURATION = 0.15;
  let c = [color.r, color.g, color.b].map((v) => v * exposure);
  const x = Math.min(...c);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c = c.map((v) => v - offset);
  const peak = Math.max(...c);
  if (peak >= START) {
    const d = 1 - START;
    const newPeak = 1 - (d * d) / (peak + d - START);
    const g = 1 - 1 / (DESATURATION * (peak - newPeak) + 1);
    c = c.map((v) => v * (newPeak / peak) * (1 - g) + newPeak * g);
  }
  return out.setRGB(...c);
}

// Everything the scene needs for that hour.
export function lightAt({ hour = 19.25, from = 220 } = {}) {
  const { elevation, direction } = sunAt(hour, from);
  const high = smooth(4, 35, elevation);   // 0 at the horizon, 1 by mid-morning
  const golden = 1 - smooth(2, 22, elevation);
  const day = smooth(-4, 6, elevation);     // 0 after sunset

  const sunColor = mix(0xff7a3c, 0xffb46a, smooth(0, 8, elevation)).lerp(new THREE.Color(0xfff2e0), smooth(3, 20, elevation));
  const fog = mix(0xd08a6a, 0xe8c9a6, smooth(-2, 10, elevation)).lerp(new THREE.Color(0xc4d6e8), high);
  const intensity = 3 * day * (0.6 + 0.4 * high);
  const share = SKY_SHARE[0] + (SKY_SHARE[1] - SKY_SHARE[0]) * smooth(0, 25, elevation);

  return {
    elevation,
    direction,
    sun: { color: sunColor, intensity },
    // What the sky gives level ground (as bright a light, on a surface
    // facing it, as a sun of this strength would be): its share of the
    // sun's, and never quite nothing.
    skyGives: Math.max(NIGHT_SKY, share * intensity * brightness(sunColor)),
    // (The horizon's colour where the sky can't be read back, by its hue only.)
    fog,
    sky: {
      turbidity: 2.5 + 6 * golden,
      rayleigh: 1 + 1.6 * golden,
      mieCoefficient: 0.004 + 0.008 * golden,
      mieDirectionalG: 0.8,
    },
    // (As the eye opens up in the evening: a low sun is weaker. Up to three
    // quarters of a stop by sunset, a stop and a half by night.)
    exposure: DAY_EXPOSURE * (1 + 0.69 * golden + 0.42 * (1 - day)),
    // How much of the sun's light the clear air catches, per metre (the
    // light shafts, src/lightShafts.js): at noon the air of a day when you
    // see 20 km; hazier as the sun sinks, down to 5 km.
    haze: 0.0002 + 0.0006 * (1 - smooth(5, 45, elevation)),
  };
}

// The hour a while later, the day running: `runs` hours of the day pass in
// each minute watched, for `seconds`. The day shown is from `first` to
// `last` (TreeLab has no night): past its end it starts again.
export function hourAfter(hour, runs, seconds, [first, last] = [5, 21]) {
  const on = hour + (runs / 60) * seconds;
  if (on <= last) return Math.max(first, on);
  return first + ((on - last) % (last - first));
}
