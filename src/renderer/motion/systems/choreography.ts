// Entrances and exits as data: each choreography is a list of timed steps interpreted below.
// Shipped procedural-first: drop (entrance) and hopOff / duck (exits), plus calm fade variants
// for quiet mode and reduced motion. More (tired walk-in, climb, jump out, walk off) are specified
// in docs/motion/RESEARCH.md and plug in as new step lists.
// Rules: hide is immediate (starting an exit mid-entrance continues from the current pose);
// timing is a function of the cue's start time, so a late joiner (reconnect) jumps to the end
// state instead of replaying; selection is seeded by cue id and never repeats the previous choice.
import { clamp01, easeInCubic, smootherstep } from '../core/curves';
import { pick, rngFor } from '../core/random';
import type { MotionProfile } from '../profile';
import type { Pose, Stage } from '../types';
import type { Gait, Locomotion, LocomotionFrame } from './locomotion';

export type Step =
  | { kind: 'spawnAbove' }
  | { kind: 'fall'; duration: number }
  | { kind: 'impact'; squash: number; bounces: number[]; wobble: number }
  | { kind: 'straighten'; duration: number }
  | { kind: 'expression'; id: string; hold?: number }
  | { kind: 'pause'; duration: number }
  | { kind: 'crouch'; duration: number; amount: number }
  | { kind: 'hop'; height: number; duration: number }
  | { kind: 'sink'; duration: number }
  | { kind: 'fade'; to: 0 | 1; duration: number; rise?: number }
  | { kind: 'spawnSide' }
  | { kind: 'spawnBelow' }
  | { kind: 'walk'; to: 'anchor' | 'side'; gait: Gait; speed: number }
  | { kind: 'release'; id: string }
  | { kind: 'rise'; to: number; duration: number }
  | { kind: 'popUp'; height: number; duration: number }
  | { kind: 'launch'; duration: number };

export interface Choreography {
  type: 'entrance' | 'exit';
  steps: readonly Step[];
  /** Short calm variant for quiet mode and reduced motion. */
  calm: readonly Step[];
}

const calmIn: Step[] = [{ kind: 'fade', to: 1, duration: 0.35, rise: 0.04 }];
const calmOut: Step[] = [{ kind: 'fade', to: 0, duration: 0.25 }];

export const choreographies: Readonly<Record<string, Choreography>> = {
  drop: {
    type: 'entrance',
    steps: [
      { kind: 'spawnAbove' },
      { kind: 'fall', duration: 0.55 },
      { kind: 'impact', squash: 0.28, bounces: [0.12, 0.04], wobble: 0.35 },
      { kind: 'straighten', duration: 0.25 },
      { kind: 'expression', id: 'dustOff' },
      { kind: 'pause', duration: 1.7 },
    ],
    calm: calmIn,
  },
  tiredWalk: {
    type: 'entrance',
    steps: [
      { kind: 'spawnSide' },
      { kind: 'expression', id: 'tired', hold: 60 },
      { kind: 'walk', to: 'anchor', gait: 'tired', speed: 1.8 },
      { kind: 'release', id: 'tired' },
      { kind: 'expression', id: 'sigh' },
      { kind: 'pause', duration: 1.6 },
    ],
    calm: calmIn,
  },
  climb: {
    type: 'entrance',
    steps: [
      { kind: 'spawnBelow' },
      { kind: 'expression', id: 'determined', hold: 2.2 },
      { kind: 'rise', to: -0.55, duration: 0.5 },
      { kind: 'pause', duration: 0.38 },
      { kind: 'rise', to: -0.2, duration: 0.42 },
      { kind: 'pause', duration: 0.22 },
      { kind: 'popUp', height: 0.14, duration: 0.42 },
      { kind: 'release', id: 'determined' },
      { kind: 'impact', squash: 0.14, bounces: [], wobble: 0.25 },
      { kind: 'expression', id: 'happy' },
      { kind: 'pause', duration: 0.6 },
    ],
    calm: calmIn,
  },
  slideUp: {
    type: 'entrance',
    steps: [
      { kind: 'spawnBelow' },
      { kind: 'rise', to: 0, duration: 0.7 },
      { kind: 'impact', squash: 0.1, bounces: [], wobble: 0.2 },
    ],
    calm: calmIn,
  },
  walkOff: {
    type: 'exit',
    steps: [{ kind: 'walk', to: 'side', gait: 'step', speed: 2.2 }],
    calm: calmOut,
  },
  jumpOut: {
    type: 'exit',
    steps: [
      { kind: 'crouch', duration: 0.18, amount: 0.14 },
      { kind: 'launch', duration: 0.5 },
    ],
    calm: calmOut,
  },
  hopOff: {
    type: 'exit',
    steps: [
      { kind: 'crouch', duration: 0.14, amount: 0.12 },
      { kind: 'hop', height: 0.12, duration: 0.3 },
      { kind: 'sink', duration: 0.32 },
    ],
    calm: calmOut,
  },
  duck: {
    type: 'exit',
    steps: [
      { kind: 'crouch', duration: 0.1, amount: 0.1 },
      { kind: 'sink', duration: 0.28 },
    ],
    calm: calmOut,
  },
};

const exitWeights: Record<string, Record<string, number>> = {
  playful: { hopOff: 4, duck: 1 },
  cozy: { hopOff: 2, duck: 2 },
  shy: { duck: 4, hopOff: 1 },
};

export function selectChoreography(
  type: 'entrance' | 'exit',
  options: {
    seed: number;
    cue: string;
    previous?: string | undefined;
    profile: MotionProfile;
    personality?: string;
  },
) {
  const rng = rngFor(options.seed, 'choreography:' + options.cue);
  const weights =
    type === 'entrance'
      ? options.profile.entranceWeights
      : (exitWeights[options.personality ?? 'cozy'] ?? exitWeights['cozy'] ?? {});
  const candidates = Object.entries(weights)
    .filter(([id]) => choreographies[id]?.type === type)
    .map(([id, weight]) => ({ id, weight }));
  if (!candidates.length) return type === 'entrance' ? 'drop' : 'duck';
  return pick(rng, candidates, options.previous);
}

export interface ChoreographyFrame {
  choreography: string | null;
  /** Height above the ground line, body heights (+ up, - below the edge). */
  liftBH: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  /** Hide everything below this y (fraction of height) while sinking/climbing. */
  clipBelow: number | null;
  pose: Partial<Pose>;
  /** Expressions fired this frame (forward to the expression system). */
  expressions: string[];
  /** Hold overrides (seconds) for fired expressions that last until released. */
  holds: Record<string, number>;
  /** Expressions to release this frame. */
  releases: string[];
  /** Optional overlay impact shake in px (off by default). */
  shake: number;
  done: boolean;
  hidden: boolean;
}

interface Running {
  id: string;
  steps: readonly Step[];
  at: number;
  ground: number;
  fromLift: number;
  fired: Set<number>;
  shake: boolean;
  locomotion: Locomotion;
  anchor: { x: number; y: number };
  /** Durations of locomotion-driven steps, known once they finish. */
  lengths: Map<number, number>;
  issued: Set<number>;
}

function stepLength(step: Step, profile: MotionProfile) {
  const k = 1 / Math.max(0.6, Math.min(1.4, profile.tempo));
  switch (step.kind) {
    case 'spawnAbove':
    case 'spawnSide':
    case 'spawnBelow':
    case 'expression':
    case 'release':
      return 0;
    case 'walk':
      return Infinity;
    case 'impact':
      return (
        0.12 + step.bounces.reduce((sum, h) => sum + 2 * Math.sqrt((2 * h) / 9.8), 0) + step.wobble
      );
    case 'fall':
    case 'fade':
      return step.duration;
    default:
      return step.duration * k;
  }
}

export class ChoreographyPlayer {
  private running: Running | null = null;
  private hidden = false;
  private lastLift = 0;

  get active() {
    return this.running?.id ?? null;
  }

  /** Visible again without a choreography (another system performed the entrance). */
  reveal() {
    this.hidden = false;
    this.running = null;
    this.lastLift = 0;
  }

  get isHidden() {
    return this.hidden;
  }

  /** Start a choreography at the cue's shared start time. Exits continue from the current pose. */
  start(
    id: string,
    {
      at,
      anchor,
      impactShake = false,
    }: { at: number; anchor: { x: number; y: number }; seed?: number; impactShake?: boolean },
    locomotion: Locomotion,
    _stage: Stage,
    calm = false,
  ) {
    const def = choreographies[id];
    if (!def) throw new Error('Unknown choreography: ' + id);
    if (def.type === 'entrance') {
      locomotion.place(anchor.x, anchor.y);
      this.hidden = false;
    } else locomotion.stop(at);
    this.running = {
      id,
      steps: calm ? def.calm : def.steps,
      at,
      ground: locomotion.position.y,
      fromLift: def.type === 'exit' ? this.lastLift : 0,
      fired: new Set(),
      shake: impactShake,
      locomotion,
      anchor: { ...anchor },
      lengths: new Map(),
      issued: new Set(),
    };
  }

  update(
    now: number,
    profile: MotionProfile,
    stage: Stage,
    loco: LocomotionFrame,
  ): ChoreographyFrame {
    const frame: ChoreographyFrame = {
      choreography: this.running?.id ?? null,
      liftBH: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: this.hidden ? 0 : 1,
      clipBelow: null,
      pose: {},
      expressions: [],
      holds: {},
      releases: [],
      shake: 0,
      done: this.running === null,
      hidden: this.hidden,
    };
    const run = this.running;
    if (!run) return frame;
    const def = choreographies[run.id];
    const exit = def?.type === 'exit';
    // A late joiner (reconnect) or a stalled walk jumps to the end state instead of replaying.
    if (now - run.at > 30) {
      this.running = null;
      this.lastLift = 0;
      if (exit) this.hidden = true;
      else run.locomotion.place(run.anchor.x, run.anchor.y);
      return {
        ...frame,
        choreography: null,
        done: true,
        hidden: this.hidden,
        opacity: exit ? 0 : 1,
      };
    }
    let t = now - run.at;
    let lift = run.fromLift;
    let finished = true;
    const squash = profile.maxSquash;
    for (let index = 0; index < run.steps.length; index++) {
      const step = run.steps[index];
      if (!step) continue;
      const length = run.lengths.get(index) ?? stepLength(step, profile);
      const local = t;
      const inside = local < length;
      switch (step.kind) {
        case 'spawnAbove':
          lift = (run.ground + 0.03) / stage.bodyHeight + 1;
          break;
        case 'fall': {
          const k = clamp01(local / length);
          const start = (run.ground + 0.03) / stage.bodyHeight + 1;
          lift = start * (1 - k * k); // gravity: distance ~ t^2
          if (inside) {
            frame.scaleY = 1 + 0.12 * k * squash;
            frame.scaleX = 1 / frame.scaleY;
            frame.pose.armL = 0.6 * k;
            frame.pose.armR = 0.6 * k;
            frame.pose.browL = -0.8;
            frame.pose.browR = -0.8;
            frame.pose.hairSwoop = 0.4 * k;
          }
          break;
        }
        case 'impact': {
          if (!inside) {
            lift = 0;
            break;
          }
          lift = 0;
          // Impact squash scaled by the landing speed, recovering over ~120 ms.
          let tt = local;
          const hit = clamp01(1 - tt / 0.12);
          let amount = step.squash * hit;
          tt -= 0.12;
          for (const [i, h] of step.bounces.entries()) {
            const air = 2 * Math.sqrt((2 * h) / 9.8);
            if (tt >= 0 && tt < air) {
              const x = tt / air;
              lift = 4 * h * x * (1 - x);
              amount = -0.06 * Math.sin(x * Math.PI);
            } else if (tt >= air && tt < air + 0.08)
              amount = step.squash * (0.4 / (i + 1)) * (1 - (tt - air) / 0.08);
            tt -= air;
          }
          if (tt >= 0) amount = 0.08 * Math.sin(tt * 30) * Math.exp(-tt * 9); // wobble
          frame.scaleY = 1 - amount * squash;
          frame.scaleX = 1 / frame.scaleY;
          frame.pose.squash = amount * 2;
          if (run.shake && local < 0.15) frame.shake = 4 * (1 - local / 0.15);
          break;
        }
        case 'straighten':
          if (inside) {
            const k = Math.sin(clamp01(local / length) * Math.PI);
            frame.scaleY = 1 + 0.05 * k * squash;
            frame.scaleX = 1 / frame.scaleY;
          }
          break;
        case 'expression':
          if (!run.fired.has(index)) {
            run.fired.add(index);
            frame.expressions.push(step.id);
            if (step.hold !== undefined) frame.holds[step.id] = step.hold;
          }
          break;
        case 'pause':
          break;
        case 'crouch':
          if (inside) {
            const k = smootherstep(local / length);
            frame.scaleY = 1 - step.amount * k * squash;
            frame.scaleX = 1 / frame.scaleY;
            frame.pose.bob = 0.01 * k;
          }
          break;
        case 'hop': {
          const k = clamp01(local / length);
          lift = run.fromLift + 4 * step.height * Math.min(k, 0.5) * (1 - Math.min(k, 0.5));
          if (inside) {
            frame.scaleY = 1 + 0.1 * Math.sin(k * Math.PI) * squash;
            frame.scaleX = 1 / frame.scaleY;
            frame.pose.armL = 0.5;
            frame.pose.armR = 0.5;
          }
          run.fromLift = k >= 0.5 ? lift : run.fromLift;
          break;
        }
        case 'sink': {
          const k = clamp01(local / length);
          const from = lift;
          lift = from + (-1.1 - from) * easeInCubic(k);
          frame.clipBelow = run.ground;
          frame.pose.armL = 0.7 * k;
          frame.pose.armR = 0.7 * k;
          break;
        }
        case 'spawnSide': {
          const side = run.anchor.x < 0.5 ? -1 : 1;
          if (!run.issued.has(index)) {
            run.issued.add(index);
            run.locomotion.place(side < 0 ? -0.1 : 1.1, run.anchor.y);
          }
          break;
        }
        case 'spawnBelow':
          lift = -1.1;
          break;
        case 'walk': {
          if (!run.issued.has(index)) {
            run.issued.add(index);
            const side = run.locomotion.position.x < 0.5 ? -1 : 1;
            const x = step.to === 'anchor' ? run.anchor.x : side < 0 ? -0.12 : 1.12;
            run.locomotion.moveTo({
              x,
              at: now,
              gait: step.gait,
              speed: step.speed,
              unbounded: true,
            });
          } else if (!run.lengths.has(index) && !loco.moving && local > 0.2)
            run.lengths.set(index, local);
          lift = 0;
          break;
        }
        case 'release':
          if (!run.fired.has(index)) {
            run.fired.add(index);
            frame.releases.push(step.id);
          }
          break;
        case 'rise': {
          const k = clamp01(local / length);
          const from = lift;
          // Pull: quick start, eased finish (a heave), arms up gripping the edge.
          lift = from + (step.to - from) * (1 - (1 - k) * (1 - k));
          frame.clipBelow = run.ground;
          frame.pose.armL = 0.9;
          frame.pose.armR = 0.9;
          frame.pose.squash = inside ? -0.3 * Math.sin(k * Math.PI) : 0;
          break;
        }
        case 'popUp': {
          const k = clamp01(local / length);
          const from = lift;
          lift = from * (1 - k) + 4 * step.height * k * (1 - k);
          frame.clipBelow = k < 0.5 ? run.ground : null;
          if (inside) {
            frame.scaleY = 1 + 0.1 * Math.sin(k * Math.PI) * squash;
            frame.scaleX = 1 / frame.scaleY;
            frame.pose.armL = 0.5 * (1 - k);
            frame.pose.armR = 0.5 * (1 - k);
          }
          break;
        }
        case 'launch': {
          const k = clamp01(local / length);
          const top = (run.ground + 0.05) / stage.bodyHeight + 1.2;
          lift = top * Math.pow(k, 1.6);
          if (inside) {
            frame.scaleY = 1 + 0.14 * (1 - k) * squash;
            frame.scaleX = 1 / frame.scaleY;
            frame.pose.armL = 0.8;
            frame.pose.armR = 0.8;
          }
          break;
        }
        case 'fade': {
          const k = smootherstep(local / length);
          frame.opacity = step.to === 1 ? k : 1 - k;
          if (step.rise) lift = step.to === 1 ? -step.rise * (1 - k) : 0;
          break;
        }
      }
      if (inside) {
        finished = false;
        break;
      }
      t -= length;
    }
    frame.liftBH = lift;
    this.lastLift = lift;
    if (finished) {
      frame.done = true;
      frame.scaleX = 1;
      frame.scaleY = 1;
      this.running = null;
      this.lastLift = 0;
      if (exit) {
        this.hidden = true;
        frame.hidden = true;
        frame.opacity = 0;
      } else {
        frame.liftBH = 0;
        frame.opacity = 1;
      }
    }
    return frame;
  }
}
