import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TREE_SHAPES } from '@workshop/treeShapes.js';
import { canopyCover } from '../src/canopy.js';
import { createPlanter } from '../src/tree.js';
import { placeForest } from '../src/forest.js';
import { defaultSettings } from '../src/settings.js';
import { DEFAULT_SHAPES } from '../src/kinds.js';

// Canopy cover (src/canopy.js): the share of the forest's ground under a
// crown, looking straight down.

const group = () => ({ children: [], userData: {}, add(...m) { this.children.push(...m); }, remove() {} });
const flat = { heightAt: () => 0, slopeAt: () => 0, normalAt: (x, z, out) => out?.set(0, 1, 0), half: 150 };
const tree = (kind, more = {}) => ({ x: 0, y: 0, z: 0, size: 1, turn: 0, tint: 0.5, kind, seed: 7, variant: 0, ...more });

function plant(records, shapes = DEFAULT_SHAPES) {
  const g = group();
  const planter = createPlanter();
  planter.plant(g, records, shapes);
  return { g, planter };
}

test('a tree covers the ground under each of its clumps, as it stands: turned, sized and placed', () => {
  const record = tree('broadleaf', { x: 3, z: -2, size: 1.3, turn: 1.1 });
  const { g, planter } = plant([record], TREE_SHAPES);
  const { clumps } = planter.model('broadleaf', 7, 0, TREE_SHAPES.broadleaf).tree;
  const area = { shape: 'circle', radius: 12 };
  const { cells, n, cell, half, cover } = canopyCover(g, area);
  // Where three.js puts each clump's middle (as src/tree.js plants the mesh).
  const m = new THREE.Matrix4().compose(new THREE.Vector3(record.x, 0, record.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), record.turn), new THREE.Vector3().setScalar(record.size));
  for (const c of clumps) {
    const p = new THREE.Vector3(c.x, c.y, c.z).applyMatrix4(m);
    const i = Math.floor((p.x + half) / cell), j = Math.floor((p.z + half) / cell);
    assert.equal(cells[j * n + i], 1, `no cover under a clump at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
  }
  // About the clumps' discs' area at most, and not nothing.
  const discs = clumps.reduce((sum, c) => sum + Math.PI * (c.r * record.size) ** 2, 0);
  const covered = cover * Math.PI * area.radius ** 2;
  assert.ok(covered > 0.3 * discs && covered <= discs * 1.05, `${covered.toFixed(1)} m² covered by discs of ${discs.toFixed(1)} m²`);
});

test('a fir, with no clumps, covers a disc as wide as its crown', () => {
  const { g, planter } = plant([tree('fir')], TREE_SHAPES);
  const { crown } = planter.model('fir', 7, 0, TREE_SHAPES.fir).tree;
  const area = { shape: 'square', radius: 8 };
  const { cover } = canopyCover(g, area, { cell: 0.25 });
  const expected = (Math.PI * crown * crown) / (16 * 16);
  assert.ok(Math.abs(cover - expected) < 0.01, `${cover.toFixed(3)} for ${expected.toFixed(3)}`);
});

test('the denser the forest, the more of the ground is covered; no trees, none', () => {
  const s = defaultSettings();
  for (const k of Object.keys(s.forest.mix)) s.forest.mix[k] = { on: k === 'broadleaf', share: k === 'broadleaf' ? 100 : 0 };
  const coverAt = (density) => {
    Object.assign(s.forest, { radius: 30, density });
    const { records } = placeForest(s.forest, flat);
    for (const r of records) r.seed = 7;
    return canopyCover(plant(records).g, { shape: s.forest.area, radius: s.forest.radius }).cover;
  };
  const thin = coverAt(60), dense = coverAt(600);
  assert.ok(thin > 0.03 && thin < dense && dense <= 1, `${thin.toFixed(2)} at 60 a hectare, ${dense.toFixed(2)} at 600`);
  assert.ok(dense > 0.6, `${dense.toFixed(2)} at 600 a hectare`);
  assert.equal(canopyCover(group(), { shape: 'circle', radius: 20 }).cover, 0);
});
