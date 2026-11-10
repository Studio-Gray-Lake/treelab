import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { VENDOR_DIR } from '../workshop.config.js';

// The figure that stands by the trees for scale is the workshop's character
// (vendor/workshop/rig.glb). If the workshop reshapes or recolours it, these
// say so before the page shows something else.

function gltf(file) {
  const buffer = readFileSync(file);
  assert.equal(buffer.readUInt32LE(0), 0x46546c67, 'not a .glb');
  return JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString('utf8'));
}

const json = gltf(path.join(VENDOR_DIR, 'rig.glb'));

test('the figure is the workshop\'s whole character: head, arms, hands, legs, feet', () => {
  const names = json.nodes.map((n) => n.name);
  for (const bone of ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'UpperArm_L', 'Hand_L', 'UpperArm_R', 'Hand_R', 'UpperLeg_L', 'Foot_L', 'UpperLeg_R', 'Foot_R']) {
    assert.ok(names.includes(bone), `no ${bone}`);
  }
});

test('orange on its left, blue on its right', () => {
  const color = (name) => json.materials.find((m) => m.name === name)?.pbrMetallicRoughness?.baseColorFactor;
  for (const part of ['Arm', 'Leg']) {
    const [lr, , lb] = color(`${part}_L`);
    const [rr, , rb] = color(`${part}_R`);
    assert.ok(lr > lb, `${part}_L isn't orange`);
    assert.ok(rb > rr, `${part}_R isn't blue`);
  }
});

test('the figure carries nothing but itself: no textures, no names or notes', () => {
  assert.equal((json.images ?? []).length, 0);
  const text = JSON.stringify({ asset: json.asset, extras: json.extras, scenes: json.scenes });
  assert.doesNotMatch(text, /@|copyright|author/i);
});
