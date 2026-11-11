// The figure's clips: none here, so it moves by its hand-keyed cycles
// (src/figureKeys.js).
//
// Clips fitted from files of your own (Mixamo's: scripts/bake-clips.mjs,
// `npm run bake:clips`) are written to .mixamo/figureClips.js, a folder
// that's kept out of git, and are used in its place when you run or build
// TreeLab on your own computer (vite.config.js). They're never part of
// TreeLab's source, and a build made for the site doesn't have them.
//
// Their layout, for src/figure.js: { walk: { from, round, seconds, speed,
// stride, hips: [[x, y, z]], feet: [left, right] (each moment [x, y, z, qx,
// qy, qz, qw, on the ground]), bones: { name: [[qx, qy, qz, qw]] } }, ... }.

export default {};
