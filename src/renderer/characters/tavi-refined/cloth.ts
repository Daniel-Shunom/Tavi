// Skirt follow-through: the hem trails travel and hip motion, then swings past
// rest and settles when movement stops. The garment keeps its authored bell
// contour; only the pelvis cloth bone rotates, so the waistband stays fitted.
export const SWING_LIMIT = 0.14;
const DRAG = 0.22; // radians per body-height/second of travel
const OMEGA = 13;
const DAMPING = 0.32;
const STEP = 1 / 240;

export class SkirtSwing {
  angle = 0;
  private velocity = 0;
  private last: number | null = null;

  /** `position` is horizontal travel in body heights; `weight` fades the swing out (sitting). */
  update(dt: number, position: number, weight = 1): number {
    if (!(dt > 0) || dt > 0.25) {
      // Tab switches and first frames carry no meaningful velocity.
      this.last = position;
      return this.angle;
    }
    const speed = this.last === null ? 0 : (position - this.last) / dt;
    this.last = position;
    const target = Math.max(-SWING_LIMIT, Math.min(SWING_LIMIT, speed * DRAG)) * weight;
    for (let t = 0; t < dt - 1e-9; t += STEP) {
      const h = Math.min(STEP, dt - t);
      this.velocity +=
        (OMEGA * OMEGA * (target - this.angle) - 2 * DAMPING * OMEGA * this.velocity) * h;
      this.angle += this.velocity * h;
    }
    if (Math.abs(this.angle) > SWING_LIMIT) {
      this.angle = Math.sign(this.angle) * SWING_LIMIT;
      this.velocity = 0;
    }
    return this.angle;
  }
}
