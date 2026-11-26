import { KINDS } from './kinds.js';

// Ready-made woods (the mix's first row, "a wood of"): a mix by cover to
// start from, each layer's cover and its kinds' shares of it (src/cover.js).
// A wood is only settings: it moves the mix's own rows, in plain sight, and
// is "custom" once one of them is moved. It changes nothing else: not the
// kinds' shapes, the ground or the light.
//
// Where the numbers come from (looked up on 2026-11-19; rules of thumb for
// a picture, not a survey of one wood):
//   oak over hazel: tall oaks over a hazel underwood, as an English wood
//     was kept. Woodland handbooks ask of the tall trees a third of the
//     canopy when the underwood is cut, growing to two thirds before it is
//     cut again: half here. They give 30 to 100 oaks a hectare.
//   beech wood: a closed canopy and a heavy shade; little grows under it,
//     and a holly is the one that does.
//   birch and oak on high ground: a low and rather open canopy, and a thin
//     underwood of hazel and holly (and rowan, which TreeLab doesn't grow).
//
//   layers: each layer's cover (percent of the ground);
//   mix: the kinds that grow, each with its share of its layer.
export const WOODS = {
  'oak over hazel': { layers: { canopy: 50, underwood: 60 }, mix: { oak: 100, hazel: 70, hawthorn: 20, holly: 10 } },
  'beech wood': { layers: { canopy: 90, underwood: 10 }, mix: { beech: 100, holly: 100 } },
  'birch and oak on high ground': { layers: { canopy: 60, underwood: 15 }, mix: { birch: 60, oak: 40, hazel: 50, holly: 50 } },
};

// A wood put into the forest's settings (in place: the panel's rows stay bound).
export function plantWood(forest, name) {
  const wood = WOODS[name];
  if (!wood) return forest;
  forest.mixBy = 'by cover';
  Object.assign(forest.layers, wood.layers);
  for (const kind of KINDS) {
    forest.mix[kind].on = kind in wood.mix;
    if (kind in wood.mix) forest.mix[kind].share = wood.mix[kind];
  }
  return forest;
}

// Which ready-made wood the forest's mix is, if any ('custom' otherwise).
// (A kind that doesn't grow may have any share.)
export function woodOf(forest) {
  if (forest.mixBy !== 'by cover') return 'custom';
  const same = ([, wood]) => Object.entries(wood.layers).every(([layer, cover]) => forest.layers[layer] === cover)
    && KINDS.every((kind) => (kind in wood.mix ? forest.mix[kind].on && forest.mix[kind].share === wood.mix[kind] : !forest.mix[kind].on));
  return Object.entries(WOODS).find(same)?.[0] ?? 'custom';
}
