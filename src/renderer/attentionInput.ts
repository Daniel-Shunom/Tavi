// Converts a resolved attention vector (shared/attention.ts) into the motion-hook input.
// The body is drawn and then mirrored when facing left, so face/gaze channels need the side and
// gaze relative to facing; host transforms keep the screen side. Gaze retargets smoothly when the
// scene is edited live.
import type { AttentionVector } from '../../shared/attention';
import type { Target } from '../../shared/expressions';
import type { MotionInput } from './motionHook';

export class AttentionSmoother {
  private gaze = { x: 0, y: 0 };
  private primed = false;
  update(
    attention: { target: Target; weight: number } | null,
    attend: (target: Target) => AttentionVector | null,
    facing: -1 | 1,
    dt: number,
  ): MotionInput['attention'] {
    const vector = attention ? attend(attention.target) : null;
    if (!attention || !vector) {
      this.primed = false;
      return null;
    }
    const follow = this.primed ? 1 - Math.exp(-dt * 8) : 1;
    this.primed = true;
    this.gaze = {
      x: this.gaze.x + (vector.gaze.x - this.gaze.x) * follow,
      y: this.gaze.y + (vector.gaze.y - this.gaze.y) * follow,
    };
    return {
      target: attention.target,
      weight: attention.weight,
      side: vector.side === facing ? 1 : -1,
      screenSide: vector.side,
      dx: vector.dx,
      dy: vector.dy,
      distance: vector.distance,
      gaze: { x: this.gaze.x * facing, y: this.gaze.y },
      behind: vector.behind,
    };
  }
}
