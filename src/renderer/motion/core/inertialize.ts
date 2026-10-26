// Offset inertialization (Bollo, "Inertialization", GDC 2018; Holden, "Dead Blending").
// On a pose switch, record how far the old output is from the new target and decay that offset
// to zero with a critically damped spring. The new pose takes over instantly but the output
// stays continuous in position and velocity, so cuts between expressions never pop.
import { CriticalSpring } from './spring';

export class Inertializer {
  private offset: CriticalSpring;

  constructor(halflife: number) {
    this.offset = new CriticalSpring(halflife, 0);
  }

  /** Start a transition from `current` (with `velocity`) to a pose whose value is `target`. */
  transition(current: number, velocity: number, target: number) {
    this.offset.value = current - target;
    this.offset.velocity = velocity;
  }

  apply(dt: number, target: number) {
    return target + this.offset.update(dt, 0);
  }

  get active() {
    return Math.abs(this.offset.value) > 1e-4;
  }
}
