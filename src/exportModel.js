import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { triangles } from './tree.js';

// The trees shown (and the forest's ground) as a .glb file, standing still:
// the sway bends them in a shader, which a model can't carry.
//
// - Flat-shaded as on screen: each triangle gets its own normal, since a
//   model can't ask for flat shading.
// - Each tree's foliage colour on screen (its tint, autumn) is an instance
//   colour, which many tools ignore, so it's baked into the foliage's
//   vertex colours. Trees coloured alike share a mesh: each grown tree's
//   colours are gathered into at most COLORS (k-means).
// - instancing: each grown tree's meshes drawn once a tree with glTF's
//   EXT_mesh_gpu_instancing (smallest; three.js, Babylon.js, Godot, Blender
//   3.6 and later). Otherwise a node a tree, all sharing the grown trees'
//   meshes, which every glTF tool reads.
// - The settings and a link that grows the same trees ride along in the
//   scene's extras; the file is CC0, as LICENSE says.

const COLORS = 8;

// ground: the ground's mesh, cut to a square `groundHalf` m each way (its
// flat facets make a big file; the far hills aren't wanted).
export async function exportModel({ trees, ground = null, groundHalf = Infinity, instancing = true, settings = null, link = '' }) {
  const root = new THREE.Group();
  root.name = 'TreeLab';
  root.userData = { treelab: { settings, link, licence: 'CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/' } };
  const materials = {
    bark: new THREE.MeshStandardMaterial({ name: 'bark', vertexColors: true, roughness: 1 }),
    needles: new THREE.MeshStandardMaterial({ name: 'needles', vertexColors: true, roughness: 0.9 }),
    leaves: new THREE.MeshStandardMaterial({ name: 'leaves', vertexColors: true, roughness: 0.85 }),
    ground: new THREE.MeshStandardMaterial({ name: 'ground', vertexColors: true, roughness: 1 }),
  };
  const made = []; // geometries made here, thrown away once written
  const keep = (g) => (made.push(g), g);
  let count = 0;

  for (const [kind, species] of Object.entries(trees.userData.species ?? {})) {
    const foliageMaterial = kind === 'broadleaf' ? materials.leaves : materials.needles;
    for (const variant of species.variants) {
      const [woodMesh, foliageMesh] = variant.meshes;
      const name = `${kind} ${variant.model.seed}-${variant.model.variant}`;
      const wood = keep(flat(woodMesh.geometry));
      wood.name = `${name} wood`;
      // The foliage once per colour its trees are given.
      const { centres, of } = gather(variant.trees.map((t, i) => foliageMesh.getColorAt(i, new THREE.Color())), COLORS);
      const foliage = centres.map((c, k) => {
        const g = keep(flat(foliageMesh.geometry, c));
        g.name = `${name} foliage ${k + 1}`;
        return g;
      });
      count += variant.trees.length * (triangles(wood) + triangles(foliage[0]));

      if (instancing) {
        root.add(instances(wood, materials.bark, variant.trees, `${name} wood`));
        foliage.forEach((g, k) => {
          const coloured = variant.trees.filter((t, i) => of[i] === k);
          if (coloured.length) root.add(instances(g, foliageMaterial, coloured, `${name} foliage ${k + 1}`));
        });
      } else {
        variant.trees.forEach((t, i) => {
          const node = new THREE.Group();
          node.name = `${name} #${i + 1}`;
          node.position.set(t.x, t.y, t.z);
          node.rotation.y = t.turn;
          node.scale.setScalar(t.size);
          node.add(new THREE.Mesh(wood, materials.bark), new THREE.Mesh(foliage[of[i]], foliageMaterial));
          root.add(node);
        });
      }
    }
  }

  if (ground) {
    const g = keep(cut(ground.geometry, groundHalf));
    g.name = 'ground';
    const mesh = new THREE.Mesh(g, materials.ground);
    mesh.name = 'ground';
    root.add(mesh);
    count += triangles(g);
  }

  try {
    const exporter = new GLTFExporter();
    const buffer = await exporter.parseAsync(root, {
      binary: true,
      copyright: 'CC0 1.0 (public domain). Made with TreeLab by Studio Gray Lake.',
    });
    return { blob: new Blob([buffer], { type: 'model/gltf-binary' }), buffer, triangles: count };
  } finally {
    for (const g of made) g.dispose();
    for (const m of Object.values(materials)) m.dispose();
  }
}

// A copy of a grown tree's geometry as a model wants it: only position,
// normal and colour, every triangle its own (flat) normal, and its colours
// times `tint` if given.
function flat(source, tint = null) {
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'color']) if (source.attributes[name]) g.setAttribute(name, source.attributes[name]);
  if (source.index) g.setIndex(source.index);
  const out = g.index ? g.toNonIndexed() : g.clone();
  out.computeVertexNormals();
  const color = out.attributes.color;
  if (color && tint) {
    for (let i = 0; i < color.count; i++) color.setXYZ(i, color.getX(i) * tint.r, color.getY(i) * tint.g, color.getZ(i) * tint.b);
  }
  return out;
}

// Colours gathered into at most k: { centres (Colors), of (each colour's
// centre) }. As many as there are if they're few; otherwise k-means, from
// k colours spread through the list.
export function gather(colors, k) {
  const key = (c) => c.getHexString();
  const unique = [...new Map(colors.map((c) => [key(c), c])).values()];
  if (unique.length <= k) {
    const index = new Map(unique.map((c, i) => [key(c), i]));
    return { centres: unique, of: colors.map((c) => index.get(key(c))) };
  }
  const centres = Array.from({ length: k }, (_, i) => unique[Math.floor((i * unique.length) / k)].clone());
  let of = [];
  for (let round = 0; round < 8; round++) {
    of = colors.map((c) => {
      let best = 0, d = Infinity;
      centres.forEach((m, i) => {
        const e = (c.r - m.r) ** 2 + (c.g - m.g) ** 2 + (c.b - m.b) ** 2;
        if (e < d) { d = e; best = i; }
      });
      return best;
    });
    centres.forEach((m, i) => {
      const mine = colors.filter((_, j) => of[j] === i);
      if (!mine.length) return;
      m.setRGB(...['r', 'g', 'b'].map((ch) => mine.reduce((s, c) => s + c[ch], 0) / mine.length));
    });
  }
  return { centres, of };
}

// The triangles of a (non-indexed) geometry inside a square `half` m each way.
function cut(source, half) {
  const names = Object.keys(source.attributes);
  const pos = source.attributes.position;
  const keep = [];
  for (let t = 0; t < pos.count; t += 3) {
    const x = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3;
    const z = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
    if (Math.abs(x) <= half && Math.abs(z) <= half) keep.push(t);
  }
  const g = new THREE.BufferGeometry();
  for (const name of names) {
    const a = source.attributes[name];
    const out = new Float32Array(keep.length * 3 * a.itemSize);
    keep.forEach((t, k) => out.set(a.array.subarray(t * a.itemSize, (t + 3) * a.itemSize), k * 3 * a.itemSize));
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  return g;
}

const up = new THREE.Vector3(0, 1, 0);
function instances(geometry, material, trees, name) {
  const mesh = new THREE.InstancedMesh(geometry, material, trees.length);
  mesh.name = name;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  trees.forEach((t, i) => mesh.setMatrixAt(i, m.compose(p.set(t.x, t.y, t.z), q.setFromAxisAngle(up, t.turn), s.setScalar(t.size))));
  return mesh;
}
