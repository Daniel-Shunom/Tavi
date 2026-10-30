import { strideDistance, type StrideCurve } from './stride';

export type ShuttleState = 'turn' | 'walk' | 'stop' | 'idle';

/** Short, repeatable contact test. Walking always plays forward. Reversals
 * happen after stopping, while the character is planted and in idle.
 */
export class WalkShuttle {
  x: number;
  direction = 1;
  state: ShuttleState = 'turn';
  elapsed = 0;
  walkTime = 0;
  weight = 0;
  private finishAt = Infinity;

  constructor(x = 0) {
    this.x = x;
  }

  update(dt: number, curve: StrideCurve) {
    this.elapsed += dt;
    if (this.state === 'turn' && this.elapsed >= 0.6) {
      this.state = 'walk';
      this.elapsed = 0;
      this.walkTime = 0;
      this.finishAt = Infinity;
    }
    if (this.state === 'walk' || this.state === 'stop') {
      const previous = this.walkTime;
      this.walkTime += dt;
      const nextWeight =
        this.state === 'walk'
          ? Math.min(1, this.elapsed / 0.35)
          : Math.max(0, 1 - this.elapsed / 0.35);
      const distance = strideDistance(curve, this.walkTime) - strideDistance(curve, previous);
      this.x += (distance * this.direction * (this.weight + nextWeight)) / 2;
      this.weight = nextWeight;
      if (this.state === 'walk') {
        if (this.direction * this.x >= 1.05 && !Number.isFinite(this.finishAt))
          this.finishAt = Math.ceil(this.walkTime / (curve.duration / 2)) * (curve.duration / 2);
        if (this.walkTime >= this.finishAt) {
          this.state = 'stop';
          this.elapsed = 0;
        }
      } else if (this.elapsed >= 0.35) {
        this.state = 'idle';
        this.elapsed = 0;
        this.weight = 0;
      }
    } else this.weight = 0;
    if (this.state === 'idle' && this.elapsed >= 0.9) {
      this.direction *= -1;
      this.state = 'turn';
      this.elapsed = 0;
    }
    return {
      x: this.x,
      yaw: this.state === 'idle' ? 0 : (this.direction * Math.PI) / 2,
      walking: this.state === 'walk',
      state: this.state,
    };
  }
}
