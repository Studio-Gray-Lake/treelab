// Where a forest's trees stand: point patterns over an area, at a density.
//
//   even spacing   trees at random, but none closer than about 3/4 of the
//                  average spacing to another (a Poisson disk): looks most
//                  like a natural stand, where trees crowd each other out
//   random         every spot equally likely, wherever the others are
//   jittered grid  a square grid, each tree nudged off its spot (the
//                  workshop's own forest)
//   clumps         groups of trees round random centres (a Thomas process)
//   rows           a plantation: rows across the ground at an angle
//
// area: { shape: 'circle' | 'square', radius } (m: the radius, or half the
// square's side). density: trees per square metre. random: () => 0..1.

export function inArea(area, x, z) {
  return area.shape === 'square' ? Math.abs(x) <= area.radius && Math.abs(z) <= area.radius : x * x + z * z <= area.radius * area.radius;
}

export function areaOf(area) {
  return area.shape === 'square' ? (2 * area.radius) ** 2 : Math.PI * area.radius ** 2;
}

export const PATTERNS = {
  'even spacing': even,
  random: uniform,
  'jittered grid': jittered,
  clumps,
  rows,
};

// The points of a pattern inside the area: [{ x, z }].
export function scatter(pattern, { area, density, random, ...options }) {
  const make = PATTERNS[pattern] ?? even;
  return make({ area, density, random, half: area.radius, ...options }).filter((p) => inArea(area, p.x, p.z));
}

// (Each pattern fills the square round the area; scatter keeps what's in it.)
const count = (density, half) => Math.round(density * (2 * half) ** 2);

function uniform({ density, half, random }) {
  return Array.from({ length: count(density, half) }, () => ({ x: (random() * 2 - 1) * half, z: (random() * 2 - 1) * half }));
}

function jittered({ density, half, random, jitter = 0.8 }) {
  const s = 1 / Math.sqrt(density);
  const n = Math.max(1, Math.round((2 * half) / s));
  const step = (2 * half) / n;
  const points = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      points.push({
        x: -half + (i + 0.5) * step + (random() - 0.5) * step * jitter,
        z: -half + (j + 0.5) * step + (random() - 0.5) * step * jitter,
      });
    }
  }
  return points;
}

// Darts thrown until the count is reached or no more fit, each kept only if
// no other is within `gap` (a grid of cells finds the neighbours).
function even({ density, half, random, spacing = 0.75 }) {
  const target = count(density, half);
  const gap = spacing / Math.sqrt(density);
  return darts({ target, gap, half, random, next: () => ({ x: (random() * 2 - 1) * half, z: (random() * 2 - 1) * half }) });
}

function clumps({ density, half, random, clumpTrees = 8, clumpSpread = 4 }) {
  // (Centres also fall just outside, so clumps reach over the edge as much
  // as into it: as many more centres as that wider square holds.)
  const target = count(density, half) * ((half + clumpSpread) / half) ** 2;
  const centres = Math.max(1, Math.round(target / clumpTrees));
  const points = [];
  // A tree's trunk is never on top of another's (1 m apart at least).
  const gap = Math.min(1, 0.5 / Math.sqrt(density));
  const near = grid(gap, half);
  for (let c = 0; c < centres; c++) {
    const cx = (random() * 2 - 1) * (half + clumpSpread), cz = (random() * 2 - 1) * (half + clumpSpread);
    const trees = Math.max(1, Math.round(clumpTrees * (0.5 + random())));
    for (let t = 0; t < trees; t++) {
      const [gx, gz] = gaussian(random);
      const p = { x: cx + gx * clumpSpread, z: cz + gz * clumpSpread };
      if (Math.abs(p.x) > half || Math.abs(p.z) > half || near.crowded(p)) continue;
      near.add(p);
      points.push(p);
    }
  }
  return points;
}

// Rows `ratio` times as far apart as the trees in a row, turned by
// rowAngle (degrees), each tree nudged a little.
function rows({ density, half, random, rowAngle = 0, ratio = 1.6 }) {
  const s = 1 / Math.sqrt(density);
  const across = s * Math.sqrt(ratio), along = s / Math.sqrt(ratio);
  const a = (rowAngle * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const reach = half * Math.SQRT2;
  const points = [];
  for (let r = -Math.ceil(reach / across); r <= Math.ceil(reach / across); r++) {
    const offset = (r & 1) * along * 0.5; // (staggered)
    for (let t = -Math.ceil(reach / along); t <= Math.ceil(reach / along); t++) {
      const u = t * along + offset + (random() - 0.5) * along * 0.15;
      const v = r * across + (random() - 0.5) * across * 0.1;
      const p = { x: u * cos - v * sin, z: u * sin + v * cos };
      if (Math.abs(p.x) <= half && Math.abs(p.z) <= half) points.push(p);
    }
  }
  return points;
}

function darts({ target, gap, half, random, next }) {
  const near = grid(gap, half);
  const points = [];
  for (let tries = 0; points.length < target && tries < target * 30; tries++) {
    const p = next();
    if (near.crowded(p)) continue;
    near.add(p);
    points.push(p);
  }
  return points;
}

// Points sorted into square cells `gap` across, to ask whether a new one
// has another within `gap`.
function grid(gap, half) {
  const size = Math.max(gap, 1e-3);
  const n = Math.ceil((2 * half) / size) + 4;
  const cells = new Map();
  const key = (i, j) => (j + 2) * n + (i + 2);
  const cell = (v) => Math.floor((v + half) / size);
  return {
    add(p) {
      const k = key(cell(p.x), cell(p.z));
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(p);
    },
    crowded(p) {
      const i = cell(p.x), j = cell(p.z);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          for (const q of cells.get(key(i + di, j + dj)) ?? []) {
            if ((q.x - p.x) ** 2 + (q.z - p.z) ** 2 < gap * gap) return true;
          }
        }
      }
      return false;
    },
  };
}

// Two independent standard normal numbers (Box-Muller).
function gaussian(random) {
  const u = Math.max(1e-12, random()), v = random();
  const r = Math.sqrt(-2 * Math.log(u));
  return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)];
}
