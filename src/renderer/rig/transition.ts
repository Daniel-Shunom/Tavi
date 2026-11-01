export interface MotionSample {
  value: number;
  velocity: number;
  acceleration: number;
}
/** Quintic boundary matching: position, velocity and acceleration survive interruption. */
export class Transition {
  private start = 0;
  private duration = 0;
  private coefficients = [0, 0, 0, 0, 0, 0];
  constructor(value = 0) {
    if (!Number.isFinite(value)) throw new Error('Invalid transition value.');
    this.coefficients[0] = value;
  }
  sample(time: number): MotionSample {
    if (!Number.isFinite(time)) throw new Error('Invalid transition time.');
    const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = this.coefficients;
    const t = Math.max(0, Math.min(this.duration, time - this.start));
    return {
      value: a + t * (b + t * (c + t * (d + t * (e + t * f)))),
      velocity: b + t * (2 * c + t * (3 * d + t * (4 * e + t * 5 * f))),
      acceleration: 2 * c + t * (6 * d + t * (12 * e + t * 20 * f)),
    };
  }
  to(time: number, target: number, duration: number) {
    if (![time, target, duration].every(Number.isFinite) || duration <= 0)
      throw new Error('Invalid transition.');
    const s = this.sample(time),
      t = duration;
    const delta = target - s.value;
    this.coefficients = [
      s.value,
      s.velocity,
      s.acceleration / 2,
      (10 * delta - 6 * s.velocity * t - 1.5 * s.acceleration * t * t) / t ** 3,
      (-15 * delta + 8 * s.velocity * t + 1.5 * s.acceleration * t * t) / t ** 4,
      (6 * delta - 3 * s.velocity * t - 0.5 * s.acceleration * t * t) / t ** 5,
    ];
    this.start = time;
    this.duration = duration;
  }
}
