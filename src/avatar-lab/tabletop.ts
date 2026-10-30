import { strideDistance, type StrideCurve } from './stride';

export type TabletopPoint = { x: number; z: number; pause?: 'look' | 'brace' };
export type TabletopPhase = 'turn' | 'walk' | 'look' | 'brace';
const smooth = (t: number) => t * t * (3 - 2 * t);
const angleDelta = (from: number, to: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Contact-calibrated travel around an immovable obstacle. All time advances
 * on one clock; animation phase and root displacement share that clock.
 */
export class TabletopPerformance {
  x: number;
  z: number;
  yaw = 0;
  phase: TabletopPhase = 'look';
  elapsed = 0;
  walkTime = 0;
  private index = 0;
  private fromYaw = 0;
  private targetYaw = 0;
  private travelled = 0;
  private segmentLength = 0;
  private attentionTime = 0;
  private start: TabletopPoint;

  constructor(
    private points: readonly TabletopPoint[],
    private stride: StrideCurve,
  ) {
    const first = points[0];
    if (!first || points.length < 2) throw new Error('A tabletop route needs two points');
    this.start = first;
    this.x = first.x;
    this.z = first.z;
  }

  private turn(yaw: number) {
    this.fromYaw = this.yaw;
    this.targetYaw = this.yaw + angleDelta(this.yaw, yaw);
    this.phase = 'turn';
    this.elapsed = 0;
  }

  update(dt: number) {
    // Small deterministic steps keep endpoint deceleration stable across fps.
    for (let remaining = Math.max(0, dt); remaining > 1e-8;) {
      const step = Math.min(remaining, 1 / 120);
      remaining -= step;
      this.elapsed += step;
      if (this.phase === 'look' || this.phase === 'turn') this.attentionTime += step;
      const point = this.points[this.index];
      if (!point) throw new Error('Missing tabletop route point');
      if (this.phase === 'look' || this.phase === 'brace') {
        const duration = this.phase === 'brace' ? 4.2 : 3.4;
        if (this.elapsed >= duration) {
          this.start = { x: this.x, z: this.z };
          this.index = (this.index + 1) % this.points.length;
          const next = this.points[this.index];
          if (!next) throw new Error('Missing next route point');
          this.segmentLength = Math.hypot(next.x - this.x, next.z - this.z);
          this.travelled = 0;
          this.turn(Math.atan2(next.x - this.x, next.z - this.z));
        }
      } else if (this.phase === 'turn') {
        this.yaw =
          this.fromYaw + (this.targetYaw - this.fromYaw) * smooth(Math.min(1, this.elapsed / 0.8));
        if (this.elapsed >= 0.8) {
          this.phase = 'walk';
          this.elapsed = 0;
          this.walkTime = 0;
        }
      } else {
        const remainingDistance = this.segmentLength - this.travelled;
        const ramp = Math.min(1, this.elapsed / 0.3);
        const brake = Math.min(1, Math.max(0.12, remainingDistance / 0.018));
        const before = this.walkTime;
        this.walkTime += step * ramp * brake;
        this.travelled +=
          strideDistance(this.stride, this.walkTime) - strideDistance(this.stride, before);
        const fraction = Math.min(1, this.travelled / Math.max(this.segmentLength, 1e-8));
        this.x = this.start.x + (point.x - this.start.x) * fraction;
        this.z = this.start.z + (point.z - this.start.z) * fraction;
        if (fraction >= 1) {
          this.phase = point.pause ?? 'look';
          this.elapsed = 0;
        }
      }
    }
    return {
      x: this.x,
      z: this.z,
      yaw: this.yaw,
      phase: this.phase,
      clip:
        this.phase === 'walk'
          ? 'Walking_A'
          : this.phase === 'brace'
            ? 'Tavi_Brace'
            : 'Tavi_LookAround',
      clipTime: this.phase === 'walk' ? this.walkTime : this.phase === 'brace' ? this.elapsed : this.attentionTime,
    };
  }
}
