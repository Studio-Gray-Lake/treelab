import * as THREE from 'three';

// Crowns shaded from within. A leaf deep in a crown sees little of the sky
// through the leaves round it, so it is darker than a leaf on the outside,
// and the wood under a crown is darker than a bare trunk. Worked out once
// for a grown tree, into its vertex colours (so an export carries it too).
//
// How: the foliage's surfaces are spread over a grid of cells round the
// tree, as leaf area in each cell. From each point of the tree, rays go out
// toward the sky (and a few toward the ground), and each loses light as it
// passes through leaves. How much a point sees, against the tree's most open
// leaves, sets its shade.

// The rays: [elevation (degrees), how many round the compass, weight].
// More from above: the sky gives most of the light in the shade.
const RINGS = [[90, 1, 1], [50, 5, 0.9], [20, 6, 0.75], [-25, 3, 0.3]];
const RAYS = RINGS.flatMap(([elevation, count, weight], ring) =>
  Array.from({ length: count }, (_, k) => {
    const e = THREE.MathUtils.degToRad(elevation), a = (k + ring * 0.5) / count * Math.PI * 2;
    return { x: Math.cos(e) * Math.sin(a), y: Math.sin(e), z: Math.cos(e) * Math.cos(a), weight };
  }));

const PASS = 0.7;   // how much a surface of leaves stops, crossed straight on (0.7: half gets through)
const OPEN = 0.9;   // the share of the tree's leaves taken as fully open (the most open 10%)

// shade: how dark the darkest leaves and wood get (1: no shading).
export function shadeCrown(tree, { leaves = 0.42, wood = 0.65 } = {}) {
  const { foliage } = tree;
  if (!foliage.attributes.position.count) return;
  const grid = leafGrid(foliage, tree.wood);
  const seen = (geometry) => {
    const points = uniquePoints(geometry);
    return { points, open: points.map((p) => openness(grid, p)) };
  };
  const ofLeaves = seen(foliage);
  const sorted = Float32Array.from(ofLeaves.open).sort();
  const most = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * OPEN))] || 1;
  apply(foliage, ofLeaves, most, leaves);
  if (tree.wood.attributes.color) apply(tree.wood, seen(tree.wood), most, wood);
}

// Each point's shade into its vertices' colours.
function apply(geometry, { points, open }, most, darkest) {
  const color = geometry.attributes.color;
  points.forEach((p, k) => {
    const shade = darkest + (1 - darkest) * Math.sqrt(Math.min(1, open[k] / most));
    for (const i of p.vertices) color.setXYZ(i, color.getX(i) * shade, color.getY(i) * shade, color.getZ(i) * shade);
  });
  color.needsUpdate = true;
}

// The leaf area in a grid of cells round the tree: { cells, n: [nx, ny, nz],
// min, size } (size: a cell's edge, m). A triangle's area goes to the cells
// round its middle, shared by how near it is to each.
function leafGrid(foliage, wood) {
  const box = new THREE.Box3().setFromBufferAttribute(foliage.attributes.position);
  box.union(new THREE.Box3().setFromBufferAttribute(wood.attributes.position));
  const span = box.getSize(new THREE.Vector3());
  const size = Math.max(0.25, Math.max(span.x, span.y, span.z) / 40);
  const min = box.min.clone().subScalar(size * 2);
  const n = [span.x, span.y, span.z].map((s) => Math.ceil(s / size) + 5);
  const cells = new Float32Array(n[0] * n[1] * n[2]);
  const pos = foliage.attributes.position.array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i + 8 < pos.length; i += 9) {
    a.fromArray(pos, i); b.fromArray(pos, i + 3); c.fromArray(pos, i + 6);
    const area = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    const fx = ((a.x + b.x + c.x) / 3 - min.x) / size - 0.5;
    const fy = ((a.y + b.y + c.y) / 3 - min.y) / size - 0.5;
    const fz = ((a.z + b.z + c.z) / 3 - min.z) / size - 0.5;
    const i0 = Math.floor(fx), j0 = Math.floor(fy), k0 = Math.floor(fz);
    const u = fx - i0, v = fy - j0, w = fz - k0;
    for (let d = 0; d < 8; d++) {
      const i1 = i0 + (d & 1), j1 = j0 + ((d >> 1) & 1), k1 = k0 + ((d >> 2) & 1);
      if (i1 < 0 || j1 < 0 || k1 < 0 || i1 >= n[0] || j1 >= n[1] || k1 >= n[2]) continue;
      const share = (d & 1 ? u : 1 - u) * ((d >> 1) & 1 ? v : 1 - v) * ((d >> 2) & 1 ? w : 1 - w);
      cells[(k1 * n[1] + j1) * n[0] + i1] += area * share;
    }
  }
  // (As leaf surfaces crossed per cell's width: a flat sheet of leaves
  // filling a cell is 1.)
  for (let i = 0; i < cells.length; i++) cells[i] /= size * size;
  return { cells, n, min, size };
}

// The leaf area at a point, from the cells round it.
function sample({ cells, n, min, size }, x, y, z) {
  const fx = (x - min.x) / size - 0.5, fy = (y - min.y) / size - 0.5, fz = (z - min.z) / size - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz);
  if (i < 0 || j < 0 || k < 0 || i + 1 >= n[0] || j + 1 >= n[1] || k + 1 >= n[2]) return -1; // (outside)
  const u = fx - i, v = fy - j, w = fz - k;
  const at = (k * n[1] + j) * n[0] + i, row = n[0], layer = n[0] * n[1];
  const c00 = cells[at] + (cells[at + 1] - cells[at]) * u;
  const c10 = cells[at + row] + (cells[at + row + 1] - cells[at + row]) * u;
  const c01 = cells[at + layer] + (cells[at + layer + 1] - cells[at + layer]) * u;
  const c11 = cells[at + layer + row] + (cells[at + layer + row + 1] - cells[at + layer + row]) * u;
  return (c00 + (c10 - c00) * v) + ((c01 + (c11 - c01) * v) - (c00 + (c10 - c00) * v)) * w;
}

// How much of the sky a point sees through the leaves (0 to 1), looking
// most where it faces.
function openness(grid, p) {
  const step = grid.size * 1.5;
  let sum = 0, weights = 0;
  for (const ray of RAYS) {
    const facing = ray.x * p.nx + ray.y * p.ny + ray.z * p.nz;
    const weight = ray.weight * (0.3 + 0.7 * Math.max(0, facing));
    // (Starting a cell out from the surface, off its own leaves.)
    let x = p.x + p.nx * grid.size, y = p.y + p.ny * grid.size, z = p.z + p.nz * grid.size;
    let depth = 0;
    for (;;) {
      const leaves = sample(grid, x, y, z);
      if (leaves < 0) break;
      depth += PASS * leaves * 1.5;
      if (depth > 5) break;
      x += ray.x * step; y += ray.y * step; z += ray.z * step;
    }
    sum += weight * Math.exp(-depth);
    weights += weight;
  }
  return sum / weights;
}

// A geometry's points, each once: { x, y, z, nx, ny, nz (its faces'
// normals, averaged), vertices (the indices sharing it) }.
function uniquePoints(geometry) {
  const pos = geometry.attributes.position, normal = geometry.attributes.normal;
  const byKey = new Map();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
    let p = byKey.get(key);
    if (!p) byKey.set(key, (p = { x, y, z, nx: 0, ny: 0, nz: 0, vertices: [] }));
    p.vertices.push(i);
    if (normal) { p.nx += normal.getX(i); p.ny += normal.getY(i); p.nz += normal.getZ(i); }
  }
  const points = [...byKey.values()];
  for (const p of points) {
    const l = Math.hypot(p.nx, p.ny, p.nz);
    if (l > 0) { p.nx /= l; p.ny /= l; p.nz /= l; }
    else p.ny = 1; // (no normals: as if facing up)
  }
  return points;
}
