import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OAK_SHAPE, layoutOak } from '../src/oak/oak.js';
import { meshOak, rootLinesOf, rootsOf } from '../src/oak/oakMesh.js';
import { DEFAULT_SHAPES } from '../src/kinds.js';
import { ROOTS_BARE, createPlanter, sunk, triangles } from '../src/tree.js';
import { exportModel } from '../src/exportModel.js';

// Roots on the ground a tree stands on (src/tree.js, src/oak/oakMesh.js:
// rootsOf): on the hills each tree of TreeLab's own kinds is drawn without
// the roots it was grown with, and given roots of its own over the ground
// under it, sunk so far that the downhill side of its foot is in the ground.

const SEED = 11;
// (An oak with long roots, standing straight: its roots lie where its trunk's foot is.)
const shape = { ...OAK_SHAPE, lean: [0, 0], roots: 0.9, flare: 0.6 };
const layout = layoutOak(SEED, shape);
// A slope of 20 degrees rising toward +x, with bumps on it.
const RISE = Math.tan((20 * Math.PI) / 180);
const slope = (x, z) => RISE * x + 0.15 * Math.sin(x * 1.7) * Math.cos(z * 1.3);
const level = () => 0;

test('a tree\'s roots drawn apart, on level ground, are the roots it was grown with', () => {
  const tree = meshOak(layout);
  const wood = tree.wood.attributes.position.array;
  const roots = rootsOf(layout).attributes.position.array;
  assert.ok(tree.rootsFrom > 0 && tree.rootsFrom < wood.length / 3, `roots begin at corner ${tree.rootsFrom} of ${wood.length / 3}`);
  assert.equal(wood.length / 3 - tree.rootsFrom, roots.length / 3, 'as many corners');
  let most = 0;
  for (let i = 0; i < roots.length; i++) most = Math.max(most, Math.abs(roots[i] - wood[tree.rootsFrom * 3 + i]));
  assert.ok(most < 1e-5, `they differ by ${most} m`);
});

test('on a slope a root lies on the ground under it: never off it, and not lost under it', () => {
  for (const bare of [0, ROOTS_BARE]) {
    let off = 0, deep = 0, n = 0;
    for (const line of rootLinesOf(layout, slope, { bare })) {
      // (Its last third goes under for good, on any ground: left out.)
      for (const { p, r } of line.slice(0, Math.ceil(line.length * 0.66))) {
        const above = p[1] - slope(p[0], p[2]);
        off = Math.max(off, above / r);
        deep = Math.max(deep, -above / r);
        n++;
      }
    }
    assert.ok(n > 20, `${n} points`);
    assert.ok(off < 1, `bare ${bare}: a root's middle ${off.toFixed(2)} of its thickness above the ground, so it hangs in the air`);
    assert.ok(deep < 3, `bare ${bare}: a root's middle ${deep.toFixed(2)} of its thickness under the ground`);
  }
});

test('on a slope the roots ride lower uphill and higher downhill, and on level ground the rule changes nothing', () => {
  // How high a root's middle lies above the ground, on average, as a share of its thickness: uphill (x > 0) and downhill. Before it goes under.
  const rides = (ground, bare) => {
    const sum = { up: [0, 0], down: [0, 0] };
    for (const seed of [11, 22, 33, 44]) {
      for (const line of rootLinesOf(layoutOak(seed, shape), ground, { bare })) {
        for (const { p, r } of line.slice(1, Math.ceil(line.length * 0.66))) {
          const side = p[0] > 0 ? sum.up : sum.down;
          side[0] += (p[1] - ground(p[0], p[2])) / r;
          side[1]++;
        }
      }
    }
    return { up: sum.up[0] / sum.up[1], down: sum.down[0] / sum.down[1] };
  };
  const plain = rides(slope, 0), ruled = rides(slope, ROOTS_BARE);
  assert.ok(ruled.up < plain.up - 0.1, `uphill: ${ruled.up.toFixed(2)} of a root's thickness with the rule, ${plain.up.toFixed(2)} without`);
  assert.ok(ruled.down > plain.down + 0.05, `downhill: ${ruled.down.toFixed(2)} with the rule, ${plain.down.toFixed(2)} without`);
  assert.deepEqual(rootLinesOf(layout, level, { bare: ROOTS_BARE }), rootLinesOf(layout, level), 'level ground');
});

// Some oaks and a fir planted on the slope, far apart: { group, numbers, planter, records }.
function forest(ground, { rootsMost, at = [[0, 0], [30, 0], [0, -40], [-55, 10]] } = {}) {
  const planter = createPlanter();
  const group = new THREE.Group();
  const shapes = { ...DEFAULT_SHAPES, oak: shape };
  const records = at.map(([x, z], i) => ({ x, z, y: ground.heightAt(x, z) - 0.3, size: 1 + 0.1 * i, turn: i * 1.3, tint: 0.5, kind: 'oak', seed: SEED, variant: 0 }));
  records.push({ x: 15, z: 25, y: ground.heightAt(15, 25) - 0.3, size: 1, turn: 0, tint: 0.5, kind: 'fir', seed: 7, variant: 0 });
  const numbers = planter.plant(group, records, shapes, { ground, ...(rootsMost ? { rootsMost } : {}) });
  return { group, numbers, planter, records, shapes };
}

test('on the hills an oak stands with its downhill foot in the ground, a fir as before, and each oak has roots of its own', () => {
  const ground = { heightAt: slope };
  const { group, numbers, planter, records, shapes } = forest(ground);
  const { tree } = planter.model('oak', SEED, 0, shapes.oak);
  const oaks = records.filter((t) => t.kind === 'oak');
  for (const t of oaks) {
    const down = sunk(tree, t, slope);
    assert.ok(down > 0.2, `sunk ${down.toFixed(2)} m on a 20 degree slope`);
    assert.ok(Math.abs(t.y - (slope(t.x, t.z) - down)) < 1e-9, `stands at ${t.y.toFixed(2)}, the ground ${slope(t.x, t.z).toFixed(2)}`);
    // (Its foot all round, as wide as the trunk spreads: at or under the ground.)
    const r = tree.layout.wood.girth * (1 + 0.7 * tree.layout.wood.flare) * t.size;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
      assert.ok(t.y <= slope(x, z) + 1e-6, `its foot ${(t.y - slope(x, z)).toFixed(2)} m above the ground`);
    }
  }
  const fir = records.find((t) => t.kind === 'fir');
  assert.equal(fir.y, slope(fir.x, fir.z) - 0.3, 'the workshop\'s fir is sunk as it always was');
  // The oaks' wood without their roots; their roots in a mesh of their own, every oak's.
  const oakWood = group.userData.species.broadleaf.variants.find((v) => v.model.kind === 'oak').meshes[0];
  assert.equal(oakWood.geometry.drawRange.count, tree.rootsFrom);
  const { roots } = group.userData;
  assert.equal(roots.trees.length, oaks.length);
  assert.equal(roots.left, 0);
  const each = (tree.wood.attributes.position.count - tree.rootsFrom) / 3;
  assert.equal(triangles(roots.mesh.geometry), each * oaks.length);
  assert.ok(group.children.includes(roots.mesh) && roots.mesh.castShadow);
  assert.deepEqual(numbers.roots, { trees: oaks.length, left: 0 });
  const counted = group.children.reduce((sum, mesh) => sum + triangles(mesh.geometry) * mesh.count, 0);
  assert.equal(numbers.triangles, counted, 'the triangles the planting reports');
});

test('on level ground an oak stands on the ground, not sunk; with no ground at all it is drawn as grown, roots and all', () => {
  const { records, group } = forest({ heightAt: level });
  for (const t of records.filter((r) => r.kind === 'oak')) assert.equal(t.y, 0);
  assert.ok(group.userData.roots);
  const planter = createPlanter();
  const tab = new THREE.Group();
  planter.plant(tab, [{ x: 0, y: 0, z: 0, size: 1, turn: 0, tint: 0.5, kind: 'oak', seed: SEED, variant: 0 }], { ...DEFAULT_SHAPES, oak: shape });
  assert.equal(tab.userData.roots, null);
  const wood = tab.userData.species.broadleaf.variants[0].meshes[0].geometry;
  assert.equal(triangles(wood), wood.attributes.position.count / 3, 'the Tree tab\'s oak has its roots');
});

test('a click on a root picks its own tree', () => {
  const { group } = forest({ heightAt: slope });
  const { mesh, trees } = group.userData.roots;
  const position = mesh.geometry.attributes.position;
  const raycaster = new THREE.Raycaster();
  mesh.updateMatrixWorld();
  for (const t of trees) {
    // (Straight down onto a root of this tree's, from above: the corner furthest from its trunk that is still near it.)
    let best = null;
    for (let i = 0; i < position.count; i++) {
      const d = Math.hypot(position.getX(i) - t.x, position.getZ(i) - t.z);
      if (d < 3 && d > 1.5 && (!best || position.getY(i) > best.y)) best = { x: position.getX(i), y: position.getY(i), z: position.getZ(i) };
    }
    assert.ok(best, 'no root near the tree');
    raycaster.set(new THREE.Vector3(best.x, best.y + 5, best.z), new THREE.Vector3(0, -1, 0));
    const hit = raycaster.intersectObject(mesh, false)[0];
    assert.ok(hit, 'the ray missed the roots');
    assert.equal(mesh.userData.treeOf(hit.faceIndex), t);
  }
});

test('over the limit, the trees nearest the middle have roots, and those further out none', () => {
  const ground = { heightAt: slope };
  const { tree } = forest(ground).planter.model('oak', SEED, 0, { ...DEFAULT_SHAPES, oak: shape }.oak);
  const each = (tree.wood.attributes.position.count - tree.rootsFrom) / 3;
  const { group, numbers, records } = forest(ground, { rootsMost: each * 2.5 });
  const { roots } = group.userData;
  const oaks = records.filter((t) => t.kind === 'oak').sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  assert.deepEqual(roots.trees, oaks.slice(0, 2));
  assert.equal(roots.left, 2);
  assert.deepEqual(numbers.roots, { trees: 2, left: 2 });
});

// (three.js's exporter makes a .glb with the browser's FileReader; Node has none.)
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};

test('a downloaded forest carries its roots, and its trees\' wood without the roots they were grown with', async () => {
  const { group, numbers } = forest({ heightAt: slope });
  const { buffer, triangles: count } = await exportModel({ trees: group, instancing: true });
  const view = new DataView(buffer);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, view.getUint32(12, true))));
  assert.ok([...json.meshes, ...json.nodes].some((m) => m.name === 'roots'), `no roots in the file: ${json.nodes.map((n) => n.name).join(', ')}`);
  assert.equal(count, numbers.triangles, 'the file\'s triangles and the planting\'s');
});
