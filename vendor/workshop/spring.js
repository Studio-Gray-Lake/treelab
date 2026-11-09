// A value pulled toward a target like a mass on a spring with friction:
//
//   acceleration = ω²·(target − value) − 2ζω·velocity + push
//
// frequency (Hz, ω = 2π·frequency) sets how quickly it responds; damping (ζ)
// how much it overshoots a sudden change of target: 1 not at all, 0.7 by 5%,
// 0.5 by 16%. A little overshoot is what reads as weight.
//
// push is an outside acceleration on the mass: the way inertia gets in. A
// mass riding on a body that brakes is pushed forward. pushFor() is a push
// that lasts a moment, for an impact (a landing); kick() changes the velocity
// at once.
//
// It moves in equal sub-steps of at most SUBSTEP, each solved exactly (the
// damped oscillator's own formula, for a target and push that hold over the
// sub-step), so the motion is the same at 30, 60 or 144 fps and the same
// time steps always give the same result: recordings replay exactly. Only a
// sub-step whose acceleration is capped takes a simple step instead (with the
// capped acceleration). Damping above 1 counts as 1.
const SUBSTEP = 1 / 240;

export class Spring {
  constructor(value = 0) {
    this.value = value;
    this.velocity = 0;
    this.acceleration = 0; // over the last update, for whatever hangs from it
    this.pushing = 0;      // a push lasting a while (pushFor), and how long it has left
    this.pushLeft = 0;
  }

  // Move toward `target` over dt seconds. limits (optional): min and max for
  // the value (it loses the velocity that would carry it out), and accel(a, v)
  // to limit the acceleration.
  update(target, dt, frequency, damping, push = 0, limits = null) {
    if (dt <= 0) return this.value;
    const before = this.velocity;
    if (this.pushLeft > 0) {
      // The lasting push covers its share of this update, exactly.
      const pushed = Math.min(dt, this.pushLeft);
      this.pushLeft -= pushed;
      this.move(target, pushed, frequency, damping, push + this.pushing, limits);
      if (pushed < dt) this.move(target, dt - pushed, frequency, damping, push, limits);
    } else {
      this.move(target, dt, frequency, damping, push, limits);
    }
    this.acceleration = (this.velocity - before) / dt;
    return this.value;
  }

  move(target, dt, frequency, damping, push, limits) {
    const w = 2 * Math.PI * frequency;
    const z = Math.min(damping, 1);
    const steps = Math.ceil(dt / SUBSTEP - 1e-9);
    const h = dt / steps;
    // A push moves where the spring comes to rest.
    const rest = target + push / (w * w);
    const decay = Math.exp(-z * w * h);
    const wd = w * Math.sqrt(1 - z * z);
    const cos = Math.cos(wd * h);
    const sin = Math.sin(wd * h);
    for (let i = 0; i < steps; i++) {
      const was = this.value;
      const x = this.value - rest;
      const v = this.velocity;
      const a = -w * w * x - 2 * z * w * v;
      const capped = limits?.accel ? limits.accel(a, v) : a;
      if (capped !== a) {
        this.velocity += capped * h;
        this.value += this.velocity * h;
      } else if (wd > 1e-9) {
        this.value = rest + decay * (x * cos + ((v + z * w * x) / wd) * sin);
        this.velocity = decay * (v * cos - ((w * w * x + z * w * v) / wd) * sin);
      } else {
        this.value = rest + (x + (v + w * x) * h) * decay;
        this.velocity = (v - w * (v + w * x) * h) * decay;
      }
      if (limits?.max !== undefined && this.value > limits.max) {
        this.value = Math.max(limits.max, Math.min(was, limits.max));
        this.velocity = Math.min(this.velocity, (this.value - was) / h);
      }
      if (limits?.min !== undefined && this.value < limits.min) {
        this.value = Math.min(limits.min, Math.max(was, limits.min));
        this.velocity = Math.max(this.velocity, (this.value - was) / h);
      }
    }
  }

  // An impact: change the velocity at once.
  kick(velocity) {
    this.velocity += velocity;
  }

  // The kick that takes a spring at rest on its target `depth` away from it
  // at the furthest (negative depth: down).
  static kickFor(depth, frequency, damping) {
    const w = 2 * Math.PI * frequency;
    // At rest, a kick v reaches v/ω · e^(−ζ·φ/√(1−ζ²)), φ = atan(√(1−ζ²)/ζ);
    // e^−1 when critically damped.
    const z = Math.min(damping, 1);
    const r = Math.sqrt(1 - z * z);
    return (depth * w) / (r < 1e-6 ? Math.exp(-1) : Math.exp((-z * Math.atan2(r, z)) / r));
  }

  // A push that lasts `seconds`: an impact spread over a moment, as a body's
  // weight comes onto a landing foot, rather than all in one frame. Replaces
  // any push still going.
  pushFor(acceleration, seconds) {
    this.pushing = acceleration;
    this.pushLeft = seconds;
  }

  // The deepest a push of 1 (per second²) lasting `seconds` takes a spring
  // at rest. Divide the depth you want by this to get the push.
  static pushDepth(frequency, damping, seconds) {
    const key = `${frequency} ${damping} ${seconds}`;
    if (!depths.has(key)) {
      const probe = new Spring(0);
      probe.pushFor(1, seconds);
      let deepest = 0;
      for (let t = 0; t < seconds + 2 / frequency; t += SUBSTEP) {
        deepest = Math.max(deepest, probe.update(0, SUBSTEP, frequency, damping));
      }
      depths.set(key, deepest);
    }
    return depths.get(key);
  }

  // Jump straight to a value, at rest.
  reset(value) {
    this.value = value;
    this.velocity = 0;
    this.acceleration = 0;
    this.pushLeft = 0;
  }

  saveState() {
    return [this.value, this.velocity, this.acceleration, this.pushing, this.pushLeft];
  }

  loadState([value, velocity, acceleration, pushing, pushLeft]) {
    this.value = value;
    this.velocity = velocity;
    this.acceleration = acceleration;
    this.pushing = pushing;
    this.pushLeft = pushLeft;
  }
}

const depths = new Map(); // Spring.pushDepth's answers
