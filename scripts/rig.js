import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { VENDOR_DIR } from '../workshop.config.js';

// The workshop's figure (vendor/workshop/rig.glb) as bare bones: every node
// of the file as an Object3D of its name, placed and turned as in the file,
// parent to child. No meshes: enough to pose it and measure it without a
// browser (the tests, and scripts/bake-clips.mjs).
export function rigBones(file = path.join(VENDOR_DIR, 'rig.glb')) {
  const buffer = readFileSync(file);
  const json = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString('utf8'));
  const nodes = json.nodes.map((n) => {
    const o = new THREE.Object3D();
    o.name = n.name;
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => nodes[i].add(nodes[c])));
  const root = new THREE.Group();
  root.name = 'figure';
  for (const o of nodes) if (!o.parent) root.add(o);
  root.updateWorldMatrix(true, true);
  return root;
}
