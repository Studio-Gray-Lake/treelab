import { mulberry32 } from '@workshop/treeShapes.js';

// Seeded 2D gradient noise (Perlin's improved noise, in two dimensions) and
// its fractal sum: the hills, the forest's groves and clearings, and its
// stands of one kind. The same seed always gives the same noise.

const GRADIENTS = Array.from({ length: 16 }, (_, i) => [Math.cos((i / 16) * Math.PI * 2), Math.sin((i / 16) * Math.PI * 2)]);
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function createNoise(seed) {
  const random = mulberry32(seed >>> 0);
  const p = new Uint8Array(256).map((_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const dot = (hash, x, z) => {
    const g = GRADIENTS[hash & 15];
    return g[0] * x + g[1] * z;
  };

  // About -1 to 1 (rarely past ±0.75), smooth, with features about 1 apart.
  function noise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const X = xi & 255, Z = zi & 255;
    const u = fade(xf), v = fade(zf);
    const aa = perm[perm[X] + Z], ab = perm[perm[X] + Z + 1];
    const ba = perm[perm[X + 1] + Z], bb = perm[perm[X + 1] + Z + 1];
    const x1 = dot(aa, xf, zf) + u * (dot(ba, xf - 1, zf) - dot(aa, xf, zf));
    const x2 = dot(ab, xf, zf - 1) + u * (dot(bb, xf - 1, zf - 1) - dot(ab, xf, zf - 1));
    return (x1 + v * (x2 - x1)) * 1.4;
  }

  // Octaves of noise, each twice as fine and `gain` times as strong as the
  // last, scaled back to about -1 to 1.
  function fractal(x, z, octaves = 4, gain = 0.5) {
    let sum = 0, amplitude = 1, total = 0, f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += amplitude * noise(x * f + o * 17.3, z * f - o * 9.1);
      total += amplitude;
      amplitude *= gain;
      f *= 2;
    }
    return sum / total;
  }

  return { noise, fractal };
}

// The value below which `share` of the values fall (0 to 1).
export function quantile(values, share) {
  const sorted = Float64Array.from(values).sort();
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(share * (sorted.length - 1))));
  return sorted[i];
}

export const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
