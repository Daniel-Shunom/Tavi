// Springs for procedural motion.
//
// SecondOrder: t3ssel8r's "Giving Personality to Procedural Animations using Math" (2022).
//   f    natural frequency (Hz): speed of response
//   zeta damping: 0 rings forever, <1 overshoots, 1 critical, >1 sluggish
//   r    initial response: <0 anticipates (moves the wrong way first), >1 overshoots the input
// Integrated in fixed-size sub-steps with the stability-clamped k2 so results barely depend on
// the render frame rate and a long frame hitch cannot explode.
//
// CriticalSpring: Daniel Holden's closed-form critically damped spring ("Spring-It-On"),
// parameterised by half-life; exact for any dt, so it is fully frame-rate independent.

export interface SecondOrderParams {
  f: number;
  zeta: number;
  r: number;
}

const MAX_STEP = 1 / 240;

export class SecondOrder {
  private k1 = 0;
  private k2 = 0;
  private k3 = 0;
  private xp: number;
  y: number;
  velocity = 0;

  constructor(params: SecondOrderParams, initial: number) {
    this.xp = initial;
    this.y = initial;
    this.set(params);
  }

  set({ f, zeta, r }: SecondOrderParams) {
    const w = 2 * Math.PI * Math.max(0.01, f);
    this.k1 = zeta / (Math.PI * Math.max(0.01, f));
    this.k2 = 1 / (w * w);
    this.k3 = (r * zeta) / w;
  }

  /** Jump to a value with no velocity (e.g. after a teleport or reduced-motion snap). */
  reset(value: number) {
    this.xp = value;
    this.y = value;
    this.velocity = 0;
  }

  update(dt: number, x: number, xd?: number) {
    if (dt <= 0) return this.y;
    const inputVelocity = xd ?? (x - this.xp) / dt;
    const steps = Math.ceil(dt / MAX_STEP);
    const h = dt / steps;
    const start = this.xp;
    const k2 = Math.max(this.k2, (h * h) / 2 + (h * this.k1) / 2, h * this.k1);
    for (let i = 1; i <= steps; i++) {
      // Input interpolated across the frame, consistent with the constant inputVelocity.
      const xi = start + (x - start) * (i / steps);
      this.y += h * this.velocity;
      this.velocity += (h * (xi + this.k3 * inputVelocity - this.y - this.k1 * this.velocity)) / k2;
    }
    this.xp = x;
    return this.y;
  }
}

export class CriticalSpring {
  value: number;
  velocity = 0;
  private y: number;

  constructor(halflife: number, initial: number) {
    this.value = initial;
    this.y = (2 * Math.LN2) / Math.max(1e-4, halflife);
  }

  setHalflife(halflife: number) {
    this.y = (2 * Math.LN2) / Math.max(1e-4, halflife);
  }

  reset(value: number) {
    this.value = value;
    this.velocity = 0;
  }

  update(dt: number, goal: number) {
    if (dt <= 0) return this.value;
    const j0 = this.value - goal;
    const j1 = this.velocity + j0 * this.y;
    const e = Math.exp(-this.y * dt);
    this.value = e * (j0 + j1 * dt) + goal;
    this.velocity = e * (this.velocity - j1 * this.y * dt);
    return this.value;
  }
}
