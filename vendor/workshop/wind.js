// The wind: one field that the swaying trees, the dust, the leaves, the motes
// and the sound all read.
//
// windAt(t, x, y, z, out) gives the wind's velocity in m/s at a point and a
// time. It is a pure function of the time, the point, the ground, the trees
// and the settings: it keeps nothing that changes, so a replay sees the same
// wind without recording it. The page passes the simulated time (sim.time),
// so P freezes the wind and the time scale slows it. It never touches the
// walk: the walk doesn't know there is any wind.
//
// It is made of:
//   - the mean wind, from settings.from (degrees: 0 from ahead, +z; 90 from
//     +x, across the lanes), settings.speed m/s at 2 m up;
//   - gusts as travelling patches ("cells"): seeded ellipses, longer along
//     the wind than across it, that drift downwind at the mean speed, swell,
//     hold and fade over a life of 15-35 s, each with its own strength and a turn
//     of up to ±15°. They come so often that any one spot meets one about
//     every settings.gustEvery seconds;
//   - swirl: a curl-noise field, carried along with the mean wind,
//     settings.turbulence of the local speed. The swirl itself has no
//     sources or sinks, unlike sine waves, which gather what they carry
//     into heaps. Scaled by the local speed it gains a little where that
//     speed changes (across a gust's edge, into a lee), as real wind does:
//     what it carries thins and thickens a little, but isn't swept into
//     points;
//   - height: the log wind profile, calm at the ground and faster above
//     (ROUGHNESS); the speeds above are at 2 m;
//   - lee: calmer behind ground that rises upwind (the ramps across the lane,
//     the wall, the hills), up to about one and a half times its height;
//   - canopy: calmer near the ground under and downwind of the trees' crowns;
//   - up and over: following the ground, the wind rises up a slope that faces
//     it and sinks down the far side;
//   - an extra wind from outside (setExtra: the weather's storms), added to
//     the mean wind and the gusts, so the swirl, the height, lee, canopy and
//     up and over all act on it too.
//
// Lee and canopy are worked out once on a 1 m grid (and again if the
// direction changes); what each gust cell is once per cell, and where the
// cells are once per time asked for.

const ROUGHNESS = 0.05;    // m: the log profile's z0 (short grass, gravel)
const REFERENCE = 2;       // m: the height settings.speed is measured at
const TOP = 30;            // m: the profile stops growing above this
const REGION = 60;         // m: gust cells cover a square this far each way (the ground is 40)
const LIFE = [15, 35];     // s: a gust cell's life (long enough to travel: gusts are carried, not born in place)
const CELL_LENGTH = [12, 30], CELL_WIDTH = [8, 16]; // m
const TURN = 15 * Math.PI / 180;
const FELT = 0.3;          // see cellRate
const SWIRL_SCALE = 6;    // m: the swirl's eddies
const SWIRL_TIME = 4;      // s: how fast the eddies change, as they are carried along
const LEE_REACH = 25;      // m upwind the lee looks for rising ground
const CANOPY_REACH = 8;    // m upwind the canopy counts crowns
const CROWN_BASE = 2.5, CROWN_TOP = 6; // m: under the crowns the canopy slows the wind, above them it doesn't
const GRID = 1;            // m: the lee and canopy grid
const HALF = 40;           // m: the ground, each way from the middle
const TILE = 8;            // texels: fillGrid sorts the gust cells into tiles this many texels across
const PROBE_TILE = 8;      // m: a probe sorts the gust cells into tiles this wide

export const DEFAULT_WIND = {
  on: true,
  speed: 2,          // m/s at 2 m up
  from: 90,          // degrees: where it blows from (0 ahead, 90 from +x)
  gust: 6,           // m/s: the strongest gust adds this at its heart
  gustEvery: 15,     // s: about how often a gust passes any one spot (one lasts its length over the wind speed: 6-15 s at 2 m/s)
  turbulence: 0.15,  // the swirl, as a share of the local speed
  seed: 1,
};

// terrain: { heightAt(x, z) }. trees: [{ x, z, crown }] (crown: its radius, m).
export function createWind({ terrain, trees = [], settings = { ...DEFAULT_WIND } }) {
  const ground = new Ground(terrain, trees);
  // The last time asked for, the settings the gusts were worked out with,
  // and the gusts: windAt is called thousands of times a frame at one time.
  const cellCache = { t: NaN, speed: NaN, from: NaN, gust: NaN, gustEvery: NaN, seed: NaN, cells: [] };
  const v = { x: 0, z: 0 };
  const noise = [0, 0, 0];
  const ax = { from: NaN, dx: 0, dz: 0, nx: 0, nz: 0 };
  // The extra wind (setExtra), and its scratch: zeroed before each call.
  let extra = null;
  const more = { x: 0, z: 0, gust: 0 };

  // The direction it blows toward, and across it, in x and z (worked out
  // again only when the direction changes; read it, don't change it).
  function axes() {
    if (ax.from !== settings.from) {
      const a = settings.from * Math.PI / 180;
      ax.from = settings.from;
      ax.dx = -Math.sin(a);
      ax.dz = -Math.cos(a);
      ax.nx = -ax.dz;
      ax.nz = ax.dx;
    }
    return ax;
  }

  // The gust cells alive at time t, with where they are: [{ k, x, z, length,
  // width, reach2, strength, gx, gz }]. Read them at once, don't keep or
  // change them: the list and its cells are reused for the next time asked.
  // What each cell is (when it's born, how long it lives, its size, where it
  // starts, its turn and its strength) depends only on k and the settings,
  // so it's kept (records, by k); only where it is now and how far it has
  // swelled or faded are worked out for each time.
  function cellsAt(t) {
    const c = cellCache;
    const same = c.speed === settings.speed && c.from === settings.from && c.gust === settings.gust
      && c.gustEvery === settings.gustEvery && c.seed === settings.seed;
    if (same && c.t === t) return c.cells;
    if (!same) {
      records.clear();
      Object.assign(c, { speed: settings.speed, from: settings.from, gust: settings.gust, gustEvery: settings.gustEvery, seed: settings.seed });
    }
    c.t = t;
    const cells = c.cells;
    let n = 0;
    const rate = cellRate(settings);
    if (settings.gust > 0 && rate > 0) {
      const { dx, dz, nx, nz } = axes();
      const drift = driftSpeed(settings);
      const first = Math.max(0, Math.floor((t - LIFE[1]) * rate) - 1);
      const last = Math.floor(t * rate);
      for (let k = first; k <= last; k++) {
        const r = records.get(k) ?? record(k, rate, drift);
        const age = t - r.born;
        if (age < 0 || age >= r.life) continue;
        const s = r.s0 + drift * age;
        // Swells over the first fifth of its life, fades over the last third.
        const f = age / r.life;
        const envelope = smoothstep(0, 0.2, f) * (1 - smoothstep(0.67, 1, f));
        const cell = pool[n] ??= {};
        cells[n++] = cell;
        cell.k = k;
        cell.x = dx * s + nx * r.c0; // its middle
        cell.z = dz * s + nz * r.c0;
        cell.length = r.length;
        cell.width = r.width;
        cell.reach2 = r.reach2;
        cell.strength = r.strength * envelope; // m/s at its heart now
        cell.gx = r.gx;
        cell.gz = r.gz;
      }
      // Only the records of cells that could be alive about now are kept:
      // when there are twice as many as that (time ran on, or jumped), the
      // rest go.
      if (records.size > 2 * (last - first + 1) + 8) {
        for (const k of records.keys()) if (k < first || k > last) records.delete(k);
      }
    }
    cells.length = n;
    return cells;
  }
  const records = new Map();
  const pool = [];

  // What cell k is, for these settings (kept in records).
  function record(k, rate, drift) {
    const { dx, dz } = axes();
    const h = (i) => hash(settings.seed, k, i);
    const life = LIFE[0] + (LIFE[1] - LIFE[0]) * h(2);
    const length = CELL_LENGTH[0] + (CELL_LENGTH[1] - CELL_LENGTH[0]) * h(3);
    const width = CELL_WIDTH[0] + (CELL_WIDTH[1] - CELL_WIDTH[0]) * h(4);
    const turn = TURN * (2 * h(6) - 1);
    const r = {
      born: (k + h(1)) / rate,
      life,
      // Start anywhere along the wind from upwind of the region (far
      // enough that it can drift in) to its far edge, anywhere across.
      s0: -REGION - drift * life + h(7) * (2 * REGION + drift * life),
      c0: (2 * h(8) - 1) * REGION,
      length,
      width,
      reach2: (Math.max(length, width) / 2) ** 2, // nothing of it beyond this (squared, m²)
      strength: settings.gust * (0.35 + 0.65 * h(5)), // m/s at its heart, at its strongest
      // the direction its extra wind blows: the mean direction turned
      gx: dx * Math.cos(turn) - dz * Math.sin(turn), gz: dz * Math.cos(turn) + dx * Math.sin(turn),
    };
    records.set(k, r);
    return r;
  }

  // How much of a cell's strength reaches (x, z): all of it over the middle
  // third, falling smoothly to none at its edge.
  function cellShare(cell, x, z, ax) {
    const ox = x - cell.x, oz = z - cell.z;
    if (ox * ox + oz * oz > cell.reach2) return 0; // (well outside: quick)
    const along = (ox * ax.dx + oz * ax.dz) * 2 / cell.length;
    const across = (ox * ax.nx + oz * ax.nz) * 2 / cell.width;
    const q = along * along + across * across;
    return q < 1 ? 1 - smoothstep(0.35, 1, Math.sqrt(q)) : 0;
  }

  // The gusts at (x, z), m/s at 2 m up: how much they add to the mean wind.
  function gustAt(t, x, z) {
    if (!settings.on) return 0;
    const ax = axes();
    let g = 0;
    for (const cell of cellsAt(t)) g += cell.strength * cellShare(cell, x, z, ax);
    if (extra) g += extraAt(t, x, z).gust;
    return g;
  }

  // The extra wind at (x, z), into the scratch.
  function extraAt(t, x, z) {
    more.x = more.z = more.gust = 0;
    extra.at(t, x, z, more);
    return more;
  }

  // An extra wind from outside (the weather's, say), or null for none:
  // { at(t, x, z, out), version }. at()
  // writes out.x, out.z (m/s at 2 m, like settings.speed) and out.gust (the
  // part of it that is gusts, >= 0) into a scratch zeroed first. It must be
  // pure in (t, x, z) and its own settings, allocate nothing, and give zeros
  // where it doesn't blow: the wind is asked about past times too (the trees'
  // warm-up on a jump steps through the 20 s before it), so whether it blows
  // must depend on t, not on when it was set. Set it once while it applies,
  // and change version whenever its settings change (the wind texture
  // refills then).
  function setExtra(value) {
    extra = value;
  }

  // The wind at 2 m up over (x, z) before height, lee and canopy: the mean
  // wind, the gusts and the swirl, into v (and the gusts alone into
  // v.gust). Returns the swirl's own value (0..1), for its up and down.
  // (fillGrid passes the cells that can reach (x, z), in the same order, and
  // the swirl's corners hashed once for the whole grid: the same wind.)
  function freeWind(t, x, z, cells = cellsAt(t), corners = null) {
    const ax = axes();
    v.x = ax.dx * settings.speed;
    v.z = ax.dz * settings.speed;
    v.gust = 0;
    for (const cell of cells) {
      const share = cellShare(cell, x, z, ax);
      if (share > 0) {
        v.x += cell.gx * cell.strength * share;
        v.z += cell.gz * cell.strength * share;
        v.gust += cell.strength * share;
      }
    }
    if (extra) {
      extraAt(t, x, z);
      v.x += more.x;
      v.z += more.z;
      v.gust += more.gust;
    }
    if (settings.turbulence <= 0) return 0.5;
    const speed = Math.hypot(v.x, v.z);
    const drift = driftSpeed(settings);
    swirl(x - ax.dx * drift * t, z - ax.dz * drift * t, t, settings.seed, noise, corners);
    v.x += noise[0] * settings.turbulence * speed;
    v.z += noise[1] * settings.turbulence * speed;
    return noise[2];
  }

  // The wind at height h above the ground at (x, z), into out ([x, y, z],
  // m/s). For callers that already know the ground there.
  function windAbove(t, x, z, h, out = [0, 0, 0]) {
    if (!settings.on) { out[0] = out[1] = out[2] = 0; return out; }
    return atHeight(x, z, h, freeWind(t, x, z), out);
  }

  // The wind at two heights over (x, z) and the gusts there, for one walk
  // over the gusts instead of three (the wind texture asks this for every
  // texel). Returns the gusts, m/s at 2 m.
  function windColumn(t, x, z, h1, out1, h2, out2) {
    if (!settings.on) { out1[0] = out1[1] = out1[2] = out2[0] = out2[1] = out2[2] = 0; return 0; }
    const value = freeWind(t, x, z);
    atHeight(x, z, h1, value, out1);
    atHeight(x, z, h2, value, out2);
    return v.gust;
  }

  // The free wind (v, from freeWind) brought to height h over (x, z).
  function atHeight(x, z, h, value, out) {
    const p = profile(h);
    const slope = ground.slope(x, z);
    return shaped(p * ground.calm(x, z, h, settings.from), slope.x, slope.z, p, Math.exp(-h / 2), value, out);
  }

  // The free wind (v) at a height, from what the ground does there: k, the
  // share of the wind left (the profile, the lee and the canopy); the
  // ground's slope (sx, sz); and at that height the profile alone (p) and how
  // much the slope still steers the wind (near).
  function shaped(k, sx, sz, p, near, value, out) {
    const freeSpeed = Math.hypot(v.x, v.z);
    out[0] = v.x * k;
    out[2] = v.z * k;
    // Up and over: the wind follows the ground near it.
    out[1] = (out[0] * sx + out[2] * sz) * near + (value - 0.5) * 0.6 * settings.turbulence * freeSpeed * p;
    return out;
  }

  // The wind texture's grid (src/windView.js) in one pass: size × size texels
  // over the square half m each way from the middle, texel (i, j) at
  // x = -half + (i + 0.5) · 2 half / size (z likewise, row j). Into out, four
  // numbers a texel: the wind's x and z at height high, the gusts (m/s at
  // 2 m), and the wind's speed at height low. Exactly what windColumn gives
  // texel by texel (tests/windGrid.test.js), only cheaper: what the ground
  // does at each texel is worked out once per direction, each texel tests
  // only the gust cells that can reach it, and the swirl's noise corners are
  // hashed once for the whole grid.
  function fillGrid(t, size, half, high, low, out) {
    if (!settings.on) { out.fill(0, 0, size * size * 4); return out; }
    const step = 2 * half / size;
    const s = gridStatics(size, half, high, low);
    const ax = axes();
    const drift = driftSpeed(settings);
    const ox = ax.dx * drift * t, oz = ax.dz * drift * t; // (what freeWind takes off for the swirl)
    const tiles = binCells(cellsAt(t), size, half, step);
    // (the first and last texels' middles, worked out as the texels' own are)
    const near = -half + 0.5 * step, far = -half + (size - 0.5) * step;
    const corners = settings.turbulence > 0
      ? noiseCorners((near - ox) / SWIRL_SCALE, (far - ox) / SWIRL_SCALE, (near - oz) / SWIRL_SCALE, (far - oz) / SWIRL_SCALE,
        t / SWIRL_TIME, settings.seed, gridCorners)
      : null;
    const across = Math.ceil(size / TILE);
    for (let j = 0; j < size; j++) {
      const z = -half + (j + 0.5) * step;
      for (let i = 0; i < size; i++) {
        const x = -half + (i + 0.5) * step;
        const p = j * size + i;
        const value = freeWind(t, x, z, tiles[Math.floor(j / TILE) * across + Math.floor(i / TILE)], corners);
        shaped(s.kHigh[p], s.sx[p], s.sz[p], s.pHigh, s.nearHigh, value, gridHigh);
        shaped(s.kLow[p], s.sx[p], s.sz[p], s.pLow, s.nearLow, value, gridLow);
        out[p * 4] = gridHigh[0];
        out[p * 4 + 1] = gridHigh[2];
        out[p * 4 + 2] = v.gust;
        out[p * 4 + 3] = Math.hypot(gridLow[0], gridLow[1], gridLow[2]);
      }
    }
    return out;
  }
  const gridHigh = [0, 0, 0], gridLow = [0, 0, 0];
  const gridCorners = { values: new Float64Array(0) };

  // What the ground does at each texel, for the two heights: it changes only
  // with the direction (lee and canopy), so it's kept until that changes.
  let statics = null;
  function gridStatics(size, half, high, low) {
    const s = statics;
    if (s && s.from === settings.from && s.size === size && s.half === half && s.high === high && s.low === low) return s;
    const n = size * size, step = 2 * half / size;
    statics = {
      from: settings.from, size, half, high, low,
      kHigh: new Float64Array(n), kLow: new Float64Array(n), sx: new Float64Array(n), sz: new Float64Array(n),
      pHigh: profile(high), pLow: profile(low), nearHigh: Math.exp(-high / 2), nearLow: Math.exp(-low / 2),
    };
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const x = -half + (i + 0.5) * step, z = -half + (j + 0.5) * step, p = j * size + i;
        statics.kHigh[p] = statics.pHigh * ground.calm(x, z, high, settings.from);
        statics.kLow[p] = statics.pLow * ground.calm(x, z, low, settings.from);
        const slope = ground.slope(x, z);
        statics.sx[p] = slope.x;
        statics.sz[p] = slope.z;
      }
    }
    return statics;
  }

  // The gust cells by tile of TILE × TILE texels: each tile's list holds the
  // cells whose reach touches it, in the cells' own order (so each texel adds
  // up the same gusts in the same order as freeWind over all of them).
  let tileLists = [];
  function binCells(cells, size, half, step) {
    const across = Math.ceil(size / TILE);
    if (tileLists.length !== across * across) tileLists = Array.from({ length: across * across }, () => []);
    for (const list of tileLists) list.length = 0;
    // (texel i's middle is at -half + (i + 0.5) step: the texels a span of x covers, one spare each side)
    const first = (a) => Math.max(0, Math.floor((a + half) / step - 0.5));
    const last = (a) => Math.min(size - 1, Math.ceil((a + half) / step - 0.5));
    for (const cell of cells) {
      const r = Math.sqrt(cell.reach2);
      const i0 = first(cell.x - r), i1 = last(cell.x + r), j0 = first(cell.z - r), j1 = last(cell.z + r);
      if (i0 > i1 || j0 > j1) continue; // (off the grid)
      for (let tj = Math.floor(j0 / TILE); tj <= Math.floor(j1 / TILE); tj++) {
        for (let ti = Math.floor(i0 / TILE); ti <= Math.floor(i1 / TILE); ti++) tileLists[tj * across + ti].push(cell);
      }
    }
    return tileLists;
  }

  // The wind at many fixed points at one time, each exactly what windAbove
  // gives there (tests/windProbe.test.js), for callers that ask the same
  // points every step (the trees' springs, src/treeSway.js). points:
  // [{ x, z, h }], fixed for the probe's life (a replant makes a new one).
  // Cheaper the way fillGrid is: what the ground does at each point is kept
  // until the direction changes, each point tests only the gust cells that
  // can reach its tile, and the swirl's noise corners are hashed once a
  // call. at(t, out, count): the first count points' winds into out, three
  // numbers ([x, y, z], m/s) a point.
  function probe(points) {
    const n = points.length;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const { x, z } of points) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    // Each point's tile, PROBE_TILE m square from (x0, z0).
    const across = n ? Math.floor((x1 - x0) / PROBE_TILE) + 1 : 0;
    const down = n ? Math.floor((z1 - z0) / PROBE_TILE) + 1 : 0;
    const lists = Array.from({ length: across * down }, () => []);
    const tile = Int32Array.from(points, ({ x, z }) => Math.floor((z - z0) / PROBE_TILE) * across + Math.floor((x - x0) / PROBE_TILE));
    // What the ground does at each point, as atHeight works it out, for the
    // direction it was worked out for.
    let from = null;
    const k = new Float64Array(n), sx = new Float64Array(n), sz = new Float64Array(n), p = new Float64Array(n), near = new Float64Array(n);
    function statics() {
      if (from === settings.from) return;
      from = settings.from;
      points.forEach(({ x, z, h }, i) => {
        p[i] = profile(h);
        const slope = ground.slope(x, z);
        sx[i] = slope.x;
        sz[i] = slope.z;
        k[i] = p[i] * ground.calm(x, z, h, settings.from);
        near[i] = Math.exp(-h / 2);
      });
    }
    const corners = { values: new Float64Array(0) };
    const here = [0, 0, 0];

    function at(t, out, count = n) {
      if (!count) return out; // (none asked: with no points the box is empty, and the swirl's corners can't be hashed over it)
      if (!settings.on) { out.fill(0, 0, count * 3); return out; }
      statics();
      // The gust cells into the tiles their reach touches, in their own
      // order (a cell left out of a tile has no share anywhere in it).
      for (const list of lists) list.length = 0;
      for (const cell of cellsAt(t)) {
        const r = Math.sqrt(cell.reach2) + 0.01; // (a centimetre spare against rounding)
        const i0 = Math.max(0, Math.floor((cell.x - r - x0) / PROBE_TILE)), i1 = Math.min(across - 1, Math.floor((cell.x + r - x0) / PROBE_TILE));
        const j0 = Math.max(0, Math.floor((cell.z - r - z0) / PROBE_TILE)), j1 = Math.min(down - 1, Math.floor((cell.z + r - z0) / PROBE_TILE));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) lists[j * across + i].push(cell);
      }
      // The swirl's corners over the points, as freeWind takes the drift off.
      let hashed = null;
      if (settings.turbulence > 0) {
        const ax = axes();
        const drift = driftSpeed(settings);
        const ox = ax.dx * drift * t, oz = ax.dz * drift * t;
        hashed = noiseCorners((x0 - ox) / SWIRL_SCALE, (x1 - ox) / SWIRL_SCALE, (z0 - oz) / SWIRL_SCALE, (z1 - oz) / SWIRL_SCALE,
          t / SWIRL_TIME, settings.seed, corners);
      }
      for (let i = 0; i < count; i++) {
        const value = freeWind(t, points[i].x, points[i].z, lists[tile[i]], hashed);
        shaped(k[i], sx[i], sz[i], p[i], near[i], value, here);
        out[i * 3] = here[0];
        out[i * 3 + 1] = here[1];
        out[i * 3 + 2] = here[2];
      }
      return out;
    }
    return { at };
  }

  // The wind at a point in the world, into out ([x, y, z], m/s).
  function windAt(t, x, y, z, out = [0, 0, 0]) {
    return windAbove(t, x, z, Math.max(0, y - terrain.heightAt(x, z)), out);
  }

  // For the HUD and the sound: the wind's speed at 2 m, the gusts there, and
  // how sheltered it is at 1 m (0 open, 1 still).
  function info(t, x, z) {
    const w = windAbove(t, x, z, REFERENCE, [0, 0, 0]);
    const at1 = settings.on ? ground.calm(x, z, 1, settings.from) : 1;
    return { speed: Math.hypot(w[0], w[1], w[2]), gust: gustAt(t, x, z), shelter: 1 - at1 };
  }

  // How far the mean wind has carried the air by time t (m, into out, an
  // { x, y, z }): what the fog's wisps drift by. A function of t alone, so a
  // replay puts them where they were; with the wind off the air is still.
  // (Changing the speed or direction moves them at once: it is another wind.)
  function carried(t, out) {
    const k = settings.on ? settings.speed * t : 0;
    const { dx, dz } = axes();
    out.x = dx * k;
    out.y = 0;
    out.z = dz * k;
    return out;
  }

  return {
    settings, windAt, windAbove, windColumn, fillGrid, probe, gustAt, cellsAt, info, axes, carried, setExtra,
    get extra() { return extra; },
    get cellsKept() { return records.size; }, // (how many cells' records are kept, for the tests)
  };
}

// How fast the gust cells and the swirl drift: with the mean wind, but never
// still (a calm day still has a breath of air moving).
function driftSpeed(settings) {
  return Math.max(settings.speed, 1);
}

// How many gust cells are born a second over the region, so that any one
// spot meets about one every settings.gustEvery seconds: a cell sweeps its
// width times its path (its drift over its life, plus its own length).
function cellRate(settings) {
  if (settings.gustEvery <= 0) return 0;
  const width = (CELL_WIDTH[0] + CELL_WIDTH[1]) / 2;
  const length = (CELL_LENGTH[0] + CELL_LENGTH[1]) / 2;
  const life = (LIFE[0] + LIFE[1]) / 2;
  const swept = width * (driftSpeed(settings) * life + length);
  // (FELT, measured: the share of the cells whose path crosses a spot that it
  // feels as a gust over 1 m/s. The rest pass by with their faint edge, or
  // while still swelling or fading, or run into another.)
  return (2 * REGION) ** 2 / (swept * settings.gustEvery * FELT);
}

// The log wind profile: the speed at height h as a share of the speed at
// REFERENCE. 0 at the ground (up to the roughness height), 1 at 2 m.
export function profile(h) {
  const z = Math.min(Math.max(h, ROUGHNESS), TOP);
  return Math.log(z / ROUGHNESS) / Math.log(REFERENCE / ROUGHNESS);
}

// The swirl at a point: the curl of a smooth noise field (so it has no
// sources or sinks), with eddies SWIRL_SCALE across, changing over
// SWIRL_TIME. Into out: [x, z] (about -1..1) and the noise's own value (0..1).
// corners: the noise's corners hashed already (noiseCorners), or null.
export function swirl(x, z, t, seed, out, corners = null) {
  const n = valueNoise(x / SWIRL_SCALE, z / SWIRL_SCALE, t / SWIRL_TIME, seed, out, corners);
  // The noise's slope is per noise unit; the curl of (n · SWIRL_SCALE) is
  // (dn/dz, -dn/dx) in those units: about -1..1.
  const ddx = out[0], ddz = out[1];
  out[0] = ddz * 0.6;
  out[1] = -ddx * 0.6;
  out[2] = n;
  return out;
}

// The ground as the wind sees it: the lee behind rising ground, the canopy
// under crowns, and the slope, on a 1 m grid.
class Ground {
  constructor(terrain, trees) {
    this.terrain = terrain;
    this.trees = trees;
    this.n = Math.round((2 * HALF) / GRID) + 1;
    this.from = null;
    this.gradient = null;
    this._slope = { x: 0, z: 0 };
  }

  // Lee and canopy for a direction: worked out on first use, and again if
  // the direction changes.
  prepare(from) {
    if (this.from === from) return;
    this.from = from;
    const { n, terrain } = this;
    const a = from * Math.PI / 180;
    const ux = Math.sin(a), uz = Math.cos(a); // toward where it blows from: upwind
    const height = this.heights();
    const cover = this.cover();
    const at = (grid, x, z) => sample(grid, n, x, z);
    this.shelter = new Float32Array(n * n);
    this.rise = new Float32Array(n * n);
    this.canopy = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -HALF + i * GRID, z = -HALF + j * GRID;
        const here = terrain.heightAt(x, z);
        let steepest = 0, highest = 0;
        for (let d = 1; d <= LEE_REACH; d++) {
          const rise = at(height, x + ux * d, z + uz * d) - here;
          steepest = Math.max(steepest, rise / d);
          highest = Math.max(highest, rise);
        }
        let crowns = 0;
        for (let d = 0; d <= CANOPY_REACH; d++) crowns += at(cover, x + ux * d, z + uz * d);
        const k = j * n + i;
        this.shelter[k] = smoothstep(0.03, 0.3, steepest);
        this.rise[k] = highest;
        this.canopy[k] = Math.min(1, crowns / (CANOPY_REACH + 1) * 1.5);
      }
    }
  }

  // The ground's height on the grid (out to the grid's own edge).
  heights() {
    if (this._heights) return this._heights;
    const { n } = this;
    this._heights = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) this._heights[j * n + i] = this.terrain.heightAt(-HALF + i * GRID, -HALF + j * GRID);
    // The slope, from the heights either side (one grid step).
    this.gradient = { x: new Float32Array(n * n), z: new Float32Array(n * n) };
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const h = (a, b) => this._heights[Math.min(n - 1, Math.max(0, b)) * n + Math.min(n - 1, Math.max(0, a))];
        this.gradient.x[j * n + i] = (h(i + 1, j) - h(i - 1, j)) / (2 * GRID);
        this.gradient.z[j * n + i] = (h(i, j + 1) - h(i, j - 1)) / (2 * GRID);
      }
    }
    return this._heights;
  }

  // How much of each grid point is under a crown (0..1).
  cover() {
    if (this._cover) return this._cover;
    const { n } = this;
    this._cover = new Float32Array(n * n);
    for (const tree of this.trees) {
      const r = tree.crown;
      for (let j = Math.floor((tree.z - r + HALF) / GRID); j <= Math.ceil((tree.z + r + HALF) / GRID); j++) {
        for (let i = Math.floor((tree.x - r + HALF) / GRID); i <= Math.ceil((tree.x + r + HALF) / GRID); i++) {
          if (i < 0 || j < 0 || i >= n || j >= n) continue;
          const d = Math.hypot(-HALF + i * GRID - tree.x, -HALF + j * GRID - tree.z) / r;
          if (d < 1) this._cover[j * n + i] = Math.min(1, this._cover[j * n + i] + (1 - d * d));
        }
      }
    }
    return this._cover;
  }

  // How much of the wind is left at height h over (x, z), after the lee and
  // the canopy (1: all of it).
  calm(x, z, h, from) {
    this.prepare(from);
    const { n } = this;
    const shelter = sample(this.shelter, n, x, z);
    const rise = sample(this.rise, n, x, z);
    const canopy = sample(this.canopy, n, x, z);
    const lee = 1 - 0.8 * shelter * clamp01(1 - h / (1.5 * rise + 0.5));
    const under = 1 - 0.6 * canopy * clamp01((CROWN_TOP - h) / (CROWN_TOP - CROWN_BASE));
    return lee * under;
  }

  // The ground's slope at (x, z): its rise per metre in x and in z.
  slope(x, z) {
    this.heights();
    this._slope.x = sample(this.gradient.x, this.n, x, z);
    this._slope.z = sample(this.gradient.z, this.n, x, z);
    return this._slope;
  }
}

// A grid value at (x, z), between grid points (outside the grid: its edge).
function sample(grid, n, x, z) {
  const fx = Math.min(n - 1.001, Math.max(0, (x + HALF) / GRID));
  const fz = Math.min(n - 1.001, Math.max(0, (z + HALF) / GRID));
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, w = fz - j;
  const k = j * n + i;
  return (grid[k] * (1 - u) + grid[k + 1] * u) * (1 - w) + (grid[k + n] * (1 - u) + grid[k + n + 1] * u) * w;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
function smoothstep(a, b, v) {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

// A number in [0, 1) from whole numbers: the same every time.
function hash(a, b, c) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The value noise's lattice hashed once, for every point with noise x in
// [x0, x1] and z in [z0, z1] at noise time w: each corner's values at w's
// whole step and the next, into out (its values grown as needed). The same
// numbers valueNoise would hash at each point.
function noiseCorners(x0, x1, z0, z1, w, seed, out) {
  const i0 = Math.floor(Math.min(x0, x1)), i1 = Math.floor(Math.max(x0, x1)) + 1;
  const j0 = Math.floor(Math.min(z0, z1)), j1 = Math.floor(Math.max(z0, z1)) + 1;
  const k = Math.floor(w);
  const width = i1 - i0 + 1, rows = j1 - j0 + 1;
  if (out.values.length < width * rows * 2) out.values = new Float64Array(width * rows * 2);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < width; i++) {
      const si = seed * 131 + i0 + i, q = (j * width + i) * 2;
      out.values[q] = hash(si, j0 + j, k);
      out.values[q + 1] = hash(si, j0 + j, k + 1);
    }
  }
  return Object.assign(out, { i0, j0, width });
}

// The quintic fade and its slope.
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const fadeSlope = (t) => 30 * t * t * (t - 1) * (t - 1);

// Smooth 3D value noise (quintic, so its slope is smooth too), with its
// slope in the first two directions: returns the value (0..1); out[0] and
// out[1] get d/dx and d/dz (per noise unit). corners (or null): the
// lattice's values hashed already, for a span of x and z at this w.
function valueNoise(x, z, w, seed, out, corners = null) {
  const i = Math.floor(x), j = Math.floor(z), k = Math.floor(w);
  const fx = x - i, fz = z - j, fw = w - k;
  const u = fade(fx), v = fade(fz), s = fade(fw);
  let a0, b0, c0, d0, e0, f0, g0, h0;
  if (corners) {
    // (each corner holds its two values, at k and k + 1)
    const { values, i0, j0, width } = corners;
    const q = ((j - j0) * width + (i - i0)) * 2, r = q + width * 2;
    a0 = values[q]; e0 = values[q + 1]; b0 = values[q + 2]; f0 = values[q + 3];
    c0 = values[r]; g0 = values[r + 1]; d0 = values[r + 2]; h0 = values[r + 3];
  } else {
    const si = seed * 131 + i;
    a0 = hash(si, j, k); b0 = hash(si + 1, j, k); c0 = hash(si, j + 1, k); d0 = hash(si + 1, j + 1, k);
    e0 = hash(si, j, k + 1); f0 = hash(si + 1, j, k + 1); g0 = hash(si, j + 1, k + 1); h0 = hash(si + 1, j + 1, k + 1);
  }
  const k1 = b0 - a0, k2 = c0 - a0, k3 = e0 - a0;
  const k4 = a0 - b0 - c0 + d0, k5 = a0 - c0 - e0 + g0, k6 = a0 - b0 - e0 + f0;
  const k7 = -a0 + b0 + c0 - d0 + e0 - f0 - g0 + h0;
  out[0] = fadeSlope(fx) * (k1 + k4 * v + k6 * s + k7 * v * s);
  out[1] = fadeSlope(fz) * (k2 + k5 * s + k4 * u + k7 * s * u);
  return a0 + k1 * u + k2 * v + k3 * s + k4 * u * v + k5 * v * s + k6 * s * u + k7 * u * v * s;
}
