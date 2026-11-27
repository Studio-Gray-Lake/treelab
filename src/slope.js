// Where one tree stands on the hills (its ground: hills): on a slope, so the
// hills show under it, not on whatever the middle of the hills happens to be
// (often all but level). The place within `within` m of the middle whose
// slope is nearest `aim` degrees, and of those about as good, the nearest the
// middle. Worked out from the ground alone, so the same hills always give the
// same place, and a link opens with its tree where it was.
//
//   heightAt(x, z): the ground's height (m).
//   Returns { x, z, slope }: the place, and its slope (°). On ground with no
//   slope worth the name anywhere near, the middle.

// A place's slope (°), from the ground a metre either way.
export function slopeAt(heightAt, x, z) {
  const dx = (heightAt(x + 1, z) - heightAt(x - 1, z)) / 2;
  const dz = (heightAt(x, z + 1) - heightAt(x, z - 1)) / 2;
  return (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI;
}

export function slopeSpot(heightAt, { aim = 12, within = 40, step = 2, near = 2.5, least = 4 } = {}) {
  let best = null;
  for (let x = -within; x <= within; x += step) {
    for (let z = -within; z <= within; z += step) {
      const far = Math.hypot(x, z);
      if (far > within) continue;
      const slope = slopeAt(heightAt, x, z);
      if (slope < least) continue;
      // (Each degree off the aim counts as much as 4 m further from the middle: near the aim, the nearer wins.)
      const off = Math.max(0, Math.abs(slope - aim) - near);
      const score = off * 4 + far;
      if (!best || score < best.score || (score === best.score && (x < best.x || (x === best.x && z < best.z)))) best = { x, z, slope, score };
    }
  }
  return best ? { x: best.x, z: best.z, slope: best.slope } : { x: 0, z: 0, slope: slopeAt(heightAt, 0, 0) };
}
