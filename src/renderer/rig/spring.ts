/** Closed-form damped oscillator. Exact for a constant target across each step. */
export class Spring {
  value = 0;
  velocity = 0;
  constructor(
    readonly frequency = 13,
    readonly damping = 0.65,
  ) {
    if (!Number.isFinite(frequency) || frequency <= 0 || !Number.isFinite(damping) || damping < 0)
      throw new Error('Invalid spring configuration.');
  }
  reset(value = 0, velocity = 0) {
    if (![value, velocity].every(Number.isFinite)) throw new Error('Invalid spring state.');
    this.value = value;
    this.velocity = velocity;
  }
  step(dt: number, target: number) {
    if (!Number.isFinite(dt) || dt < 0 || !Number.isFinite(target))
      throw new Error('Invalid spring sample.');
    if (dt === 0) return this.value;
    const w = this.frequency,
      z = this.damping,
      x = this.value - target,
      v = this.velocity;
    if (Math.abs(z - 1) < 1e-6) {
      const e = Math.exp(-w * dt),
        b = v + w * x;
      this.value = target + (x + b * dt) * e;
      this.velocity = (v - w * b * dt) * e;
    } else if (z < 1) {
      const a = w * z,
        b = w * Math.sqrt(1 - z * z),
        e = Math.exp(-a * dt);
      const c = Math.cos(b * dt),
        s = Math.sin(b * dt),
        k = (v + a * x) / b;
      this.value = target + e * (x * c + k * s);
      this.velocity = e * (v * c - ((a * v + w * w * x) / b) * s);
    } else {
      const d = Math.sqrt(z * z - 1),
        r1 = -w / (z + d),
        r2 = -w * (z + d);
      const a = (v - r2 * x) / (r1 - r2),
        b = x - a;
      const e1 = Math.exp(r1 * dt),
        e2 = Math.exp(r2 * dt);
      this.value = target + a * e1 + b * e2;
      this.velocity = a * r1 * e1 + b * r2 * e2;
    }
    return this.value;
  }
}

/** Bounded garment follow-through. A pause/teleport establishes a new travel origin. */
export class FollowThrough {
  private readonly spring = new Spring(13, 0.65);
  private last: number | null = null;
  get angle() {
    return this.spring.value;
  }
  update(dt: number, position: number, weight = 1) {
    if (!Number.isFinite(position) || !Number.isFinite(dt) || dt < 0)
      throw new Error('Invalid travel sample.');
    if (dt === 0) {
      this.last = position;
      return this.angle;
    }
    const speed = this.last === null ? 0 : (position - this.last) / dt;
    this.last = position;
    if (dt > 0.25 || Math.abs(speed) > 8) {
      this.spring.reset();
      return 0;
    }
    const target = Math.max(-0.11, Math.min(0.11, speed * 0.22)) * Math.max(0, Math.min(1, weight));
    this.spring.step(dt, target);
    if (Math.abs(this.angle) > 0.14) this.spring.reset(Math.sign(this.angle) * 0.14);
    return this.angle;
  }
}
