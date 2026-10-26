// BodyStatePlayer: turns the shared BodyCue (service clock) into a per-frame key pose layered
// over the MotionLayer frame. Phases: exit the previous state (at its spot), travel (the normal
// locomotion walk, held back until the exit is done), enter the new state on arrival, hold with
// its own idle life. Deterministic for a given seed and cue timeline; a reconnect long after the
// cue started snaps to the held state without replaying (see shared/states.ts).
import { settledAfter, sleepingStates, type BodyCue, type Spot } from '../../../../shared/states';
import { fbm1 } from '../core/noise';
import { random } from '../core/random';
import { authoringRig } from '../pose/runtime';
import { sampleBeat } from '../pose/sample';
import { beatDuration } from '../pose/schema';
import type { Channel, Pose, Stage } from '../types';
import {
  addPose,
  enterPlan,
  exitPlan,
  heldKey,
  holdBeat,
  lerpKey,
  sampleTimeline,
  shortcutPlan,
  type PlanContext,
  type Timeline,
} from './plan';
import { restKey, type ContactPoint, type KeyPose, type StateRig } from './types';

export interface StateEffect {
  kind: 'z';
  /** Normalized canvas position of the glyph centre. */
  x: number;
  y: number;
  /** Glyph size as a fraction of the body height. */
  size: number;
  opacity: number;
  rotation: number;
}
export interface FloorShadow {
  /** Normalized canvas centre and size (fractions of canvas width/height). */
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
}

export interface PlayerFrame {
  now: number;
  stage: Stage;
  reducedMotion: boolean;
  /** Locomotion position (normalized; y = floor under the soles). */
  position: { x: number; y: number };
  travelling: boolean;
  facing: number;
  /** Where locomotion is heading (home when standing). */
  target: { x: number; y: number };
  breathPeriod: number;
  personality: 'cozy' | 'playful' | 'shy';
}
export interface PlayerResult {
  key: KeyPose;
  /** Surface under the character when it is not the floor (canvas y), for the contact shadow. */
  surfaceY: number | null;
  /** Height above that surface (BH), for shadow scale. */
  height: number;
  /** Rotated poses draw their own floor shadow; the regular one is hidden. */
  floorShadow: FloorShadow | null;
  effects: StateEffect[];
  /** The edge Tavi sits or stands on (normalized), for previews that do not show the scene. */
  ledge: { x: number; y: number; width: number } | null;
  status: string;
}

type Phase = 'idle' | 'exit' | 'travel' | 'enter' | 'shortcut' | 'hold';

const BLEND = 0.35;

function bump(t: number, seed: number, label: string, period: number, duration: number) {
  if (t < 0) return 0;
  const k = Math.floor(t / period);
  const start = k * period + random(seed, label, k) * Math.max(0, period - duration);
  const u = (t - start) / duration;
  if (u < 0 || u > 1) return 0;
  return Math.sin(Math.PI * u) ** 2;
}
/** Regular sleep breath 0..1 (inhale 40%, exhale 60%). */
function sleepBreath(t: number, period: number) {
  const phase = (t / period) % 1;
  return phase < 0.4
    ? Math.sin((phase / 0.4) * (Math.PI / 2)) ** 2
    : Math.cos(((phase - 0.4) / 0.6) * (Math.PI / 2)) ** 2;
}
const u = (value: number) => value / 600;

export class BodyStatePlayer {
  private cue: BodyCue | null = null;
  private phase: Phase = 'idle';
  private start = 0;
  private enterStart = 0;
  private holdStart = 0;
  private travelStart = 0;
  private exit: Timeline | null = null;
  private enter: Timeline | null = null;
  private shortcut: Timeline | null = null;
  private last: KeyPose = restKey;
  private blendFrom: { key: KeyPose; at: number } | null = null;
  private mounted = false;
  private stirLocal = -Infinity;
  private lastStir: number | undefined;

  constructor(
    private readonly rig: StateRig,
    private readonly seed: number,
  ) {}

  get state() {
    return this.cue?.state ?? 'stand';
  }
  get spot(): Spot | null {
    return this.cue?.spot ?? null;
  }

  private context(spot: Spot | null, frame: PlayerFrame, seed = this.cue?.seed ?? 0): PlanContext {
    const gap =
      spot && (spot.surface === 'ledge' || spot.surface === 'top')
        ? Math.max(0, (spot.approach.y - spot.y) / frame.stage.bodyHeight)
        : 0;
    const edgeDistance =
      spot?.edgeX !== undefined
        ? (Math.abs(spot.edgeX - frame.position.x) * frame.stage.aspect) / frame.stage.bodyHeight
        : 0.3;
    return {
      rig: this.rig,
      gap,
      edgeDistance,
      reducedMotion: frame.reducedMotion,
      variant: seed,
    };
  }

  /**
   * Call before the motion layer updates. Returns a point to teleport locomotion to when the cue
   * is already settled (mount or reconnect), so nothing replays.
   */
  sync(
    cue: BodyCue | null,
    elapsed: number,
    frame: PlayerFrame,
  ): { place: { x: number; y: number } | null } {
    const first = !this.mounted;
    this.mounted = true;
    if (cue?.stirAt !== this.lastStir) {
      if (cue?.stirAt !== undefined && this.lastStir !== undefined)
        this.stirLocal = frame.now - Math.max(0, elapsed - (cue.stirAt - cue.startAt) / 1000);
      this.lastStir = cue?.stirAt;
    }
    if (cue?.id === this.cue?.id) return { place: null };
    const now = frame.now;
    this.blendFrom = this.cue || this.phase !== 'idle' ? { key: this.last, at: now } : null;
    const previousSeed = this.cue?.seed ?? 0;
    this.cue = cue;
    this.exit = this.enter = this.shortcut = null;
    if (!cue) {
      this.phase = 'idle';
      return { place: null };
    }
    this.start = now - elapsed;
    const settled =
      (first && elapsed > 1) || elapsed > settledAfter(cue, frame.position) || frame.reducedMotion;
    if (settled && !frame.reducedMotion) {
      this.phase = 'hold';
      this.holdStart = this.start;
      this.blendFrom = null;
      return { place: cue.spot?.approach ?? (cue.state === 'stand' ? null : null) };
    }
    const from = cue.from?.state ?? 'stand';
    const fromSpot = cue.from?.spot ?? null;
    const same =
      fromSpot && cue.spot
        ? Math.abs(fromSpot.approach.x - cue.spot.approach.x) < 1e-3 &&
          Math.abs(fromSpot.approach.y - cue.spot.approach.y) < 1e-3
        : false;
    const shortcut = same
      ? shortcutPlan(from, cue.state, cue.spot, this.context(cue.spot, frame), cue.wake)
      : null;
    if (shortcut) {
      this.shortcut = shortcut;
      this.phase = 'shortcut';
    } else {
      this.exit = exitPlan(from, fromSpot, this.context(fromSpot, frame, previousSeed), cue.wake);
      this.phase = 'exit';
    }
    return { place: null };
  }

  /** While the previous state is still being left, locomotion must not start walking. */
  holdsTravel(now: number) {
    if (this.phase === 'shortcut' || this.phase === 'enter') return true;
    return this.phase === 'exit' && !!this.exit && now - this.start < this.exit.duration;
  }
  /** Facing to arrive with at the state's spot (peek faces the panel, lean faces away). */
  facingOnArrival(): 1 | -1 | undefined {
    const spot = this.cue?.spot;
    if (!spot) return undefined;
    if (this.cue?.state === 'nap' && spot.rect === 'webcam') return spot.side;
    if (this.cue?.state === 'peek') return spot.side;
    if (this.cue?.state === 'lean') return spot.side === 1 ? -1 : 1;
    return undefined;
  }

  evaluate(frame: PlayerFrame): PlayerResult {
    const now = frame.now;
    const cue = this.cue;
    let key = restKey;
    let status = 'stand';
    if (cue) {
      const spot = cue.spot;
      if (this.phase === 'shortcut' && this.shortcut) {
        const t = now - this.start;
        key = sampleTimeline(this.shortcut, t);
        status = `${cue.state}:shortcut`;
        if (t >= this.shortcut.duration) this.toHold(this.start + this.shortcut.duration);
      }
      if (this.phase === 'exit' && this.exit) {
        const t = now - this.start;
        key = sampleTimeline(this.exit, t);
        status = `${cue.from?.state ?? 'stand'}:exit`;
        if (t >= this.exit.duration) {
          this.phase = 'travel';
          this.travelStart = now;
        }
      }
      if (this.phase === 'travel') {
        status = `${cue.state}:travel`;
        const goal = spot?.approach ?? frame.target;
        // Locomotion settles on whole steps, so "arrived" is "stopped near the spot".
        const distance = Math.hypot(goal.x - frame.position.x, goal.y - frame.position.y);
        // Locomotion's arrive creeps the last few pixels for seconds; start once close and
        // already facing the right way (or once it has fully stopped nearby).
        const facingOk =
          (this.facingOnArrival() ?? (frame.facing < 0 ? -1 : 1)) === (frame.facing < 0 ? -1 : 1);
        const arrived = (!frame.travelling && distance < 0.03) || (facingOk && distance < 0.004);
        const overdue = !frame.travelling && now - this.travelStart > 4;
        if (arrived || overdue) {
          if (cue.state === 'stand') this.toHold(now);
          else {
            this.enter = enterPlan(cue.state, spot, this.context(spot, frame));
            this.enterStart = now;
            this.phase = 'enter';
          }
        }
      }
      if (this.phase === 'enter' && this.enter) {
        const t = now - this.enterStart;
        key = sampleTimeline(this.enter, t);
        status = `${cue.state}:enter`;
        if (t >= this.enter.duration) this.toHold(this.enterStart + this.enter.duration);
      }
      if (this.phase === 'hold') {
        key = this.hold(cue, frame);
        status = `${cue.state}:hold`;
      }
    }
    if (this.blendFrom) {
      const k = (now - this.blendFrom.at) / BLEND;
      if (k >= 1) this.blendFrom = null;
      else key = lerpKey(this.blendFrom.key, key, k * k * (3 - 2 * k));
    }
    this.last = key;
    return this.decorate(key, cue, frame, status);
  }

  private toHold(at: number) {
    this.phase = 'hold';
    this.holdStart = at;
  }

  /** Held pose plus the state's own idle life. */
  private hold(cue: BodyCue, frame: PlayerFrame): KeyPose {
    const spot = cue.spot;
    const context = this.context(spot, frame);
    const held = heldKey(cue.state, spot, context);
    const t = frame.now - this.holdStart;
    const seed = this.seed + cue.seed;
    const life: Partial<Pose> = {};
    const add = (values: Partial<Pose>, gain = 1) => {
      for (const [channel, value] of Object.entries(values) as [Channel, number][])
        life[channel] = (life[channel] ?? 0) + value * gain;
    };
    let key = held;
    const ledge = spot?.surface === 'ledge';
    const amp = frame.reducedMotion ? 0.5 : 1;
    // Authored holds (pose beats) carry their own living hold, with planted hands re-solved.
    const beat = holdBeat(cue.state, spot, context);
    if (beat)
      key = { ...held, pose: sampleBeat(beat, beatDuration(beat) + t, authoringRig, seed).pose };
    switch (cue.state) {
      case 'sit': {
        if (!beat)
          add({ lean: 0.035 * fbm1(seed + 1, t * 0.1), headTilt: 0.03 * fbm1(seed + 2, t * 0.13) });
        if (ledge) {
          // Leg-swing bouts (pendulum period by personality), then still for a while.
          const period = { cozy: 1.3, shy: 1.1, playful: 0.9 }[frame.personality];
          const bout = frame.reducedMotion ? 0 : bump(t, seed, 'swing', 15, 8);
          const w = (2 * Math.PI * t) / period;
          add({
            footLX: u(14) * Math.sin(w) * bout,
            footRX: u(14) * Math.sin(w + Math.PI) * bout,
            footLY: u(8) * Math.max(0, Math.sin(w)) * bout,
            footRY: u(8) * Math.max(0, Math.sin(w + Math.PI)) * bout,
          });
          // Looks down into the webcam at the streamer now and then.
          add({ gazeY: 0.7, headTilt: 0.05 }, bump(t, seed, 'look-down', 28, 2.5));
        } else if (!beat) {
          const knees = frame.reducedMotion ? 0 : bump(t, seed, 'knees', 17, 1.2);
          const bounce = Math.sin(2 * Math.PI * 3 * t) * u(6) * knees;
          add({ footLX: bounce, footRX: -bounce });
          add({ armL: 0.35, lean: -0.08 }, bump(t, seed, 'lean-back', 31, 5));
        }
        break;
      }
      case 'doze': {
        // Drowsy first: head sags, snaps back up (a few nod-offs), then properly asleep.
        const awake = t < 32 ? nodOff(t + 7) : 0;
        const sit = heldKey('sit', spot, context);
        key = { ...lerpKey(held, sit, awake), sleep: 1 - 0.55 * awake };
        add({ squash: 0.2 * sleepBreath(t, frame.breathPeriod * 1.15) * amp });
        add({ squintL: 0.4 * awake, squintR: 0.4 * awake });
        break;
      }
      case 'nap': {
        add({ squash: 0.25 * sleepBreath(t, frame.breathPeriod * 1.15) * amp });
        if (!frame.reducedMotion) {
          add({ footRX: u(15) }, bump(t, seed, 'twitch', 41, 0.2));
          add({ mouthY: 0.3, smile: 0.2 }, bump(t, seed, 'murmur', 57, 0.6));
          add({ shift: u(6) }, bump(t, seed, 'resettle', 240, 1.4));
        }
        break;
      }
      case 'peek': {
        // Reading: 220 ms fixations stepping up the chat, a return sweep to the newest message.
        const fix = Math.floor(t / 0.22);
        const line = fix % 5;
        const regress = random(seed, 'regress', fix) < 0.15 ? 1 : 0;
        add({ gazeY: 0.3 - 0.12 * (line - regress), gazeX: 0 });
        // Keeps the streamer in mind: a glance back every 6-10 s.
        add({ gazeX: -1.7, headTilt: 0.15 }, bump(t, seed, 'glance-back', 8, 0.7));
        add({ lean: -0.04 * fbm1(seed + 4, t * 0.2) });
        break;
      }
      case 'perch': {
        add({ lean: 0.15, gazeY: 0.8 }, bump(t, seed, 'peer', 18, 2.5));
        if (frame.personality === 'playful' && !frame.reducedMotion)
          add(
            { bob: u(10) * Math.abs(Math.sin(2 * Math.PI * 2 * t)) },
            bump(t, seed, 'heels', 12, 0.9),
          );
        add({ headTilt: 0.04 * fbm1(seed + 5, t * 0.15) });
        break;
      }
      case 'lean': {
        add({
          shift: u(8) * fbm1(seed + 6, t * 0.12) * amp,
          lean: 0.03 * fbm1(seed + 7, t * 0.09),
          gazeX: 0.3 * fbm1(seed + 8, t * 0.07),
        });
        break;
      }
      case 'stand':
        break;
    }
    // Stir: one unaddressed chat message while asleep - a twitch, half-open eyes, back to sleep.
    const stir = frame.now - this.stirLocal;
    if (stir >= 0 && stir < 1.2 && sleepingStates.includes(cue.state)) {
      const s = Math.sin((Math.PI * stir) / 1.2) ** 2;
      add({ browL: -0.5 * s, browR: -0.3 * s, headTilt: -0.08 * s });
      key = { ...key, sleep: key.sleep * (1 - 0.45 * s) };
    }
    return { ...key, pose: addPose(key.pose, life) };
  }

  /** World-space helpers, shadow and z z z. */
  private decorate(
    key: KeyPose,
    cue: BodyCue | null,
    frame: PlayerFrame,
    status: string,
  ): PlayerResult {
    const stage = frame.stage;
    const facing = frame.facing < 0 ? -1 : 1;
    const toWorld = (p: ContactPoint) => {
      const r = (key.rot * Math.PI) / 180;
      const x = p.x * Math.cos(r) + p.y * Math.sin(r) + key.dx;
      const y = -p.x * Math.sin(r) + p.y * Math.cos(r) - key.dy + key.lift;
      return {
        x: frame.position.x + (facing * x * stage.bodyHeight) / stage.aspect,
        y: frame.position.y - y * stage.bodyHeight,
      };
    };
    const spot = cue?.spot ?? null;
    const raised = spot && (spot.surface === 'ledge' || spot.surface === 'top');
    const gap = raised ? (spot.approach.y - spot.y) / stage.bodyHeight : 0;
    let surfaceY: number | null = null;
    let height = Math.max(0, key.lift);
    if (raised && key.lift > gap * 0.5) {
      surfaceY = spot.y;
      height = Math.max(0, key.lift - gap);
    }
    let floorShadow: FloorShadow | null = null;
    // A rotated body would tilt the regular contact shadow with it: draw a flat one instead.
    if (Math.abs(key.rot) > 8) {
      const lying = Math.abs(key.rot) > 30;
      const head = toWorld(this.rig.lieContacts.head);
      const feet = toWorld(this.rig.lieContacts.feet);
      const width = (0.44 * stage.bodyHeight) / stage.aspect;
      floorShadow = {
        x: lying ? (head.x + feet.x) / 2 : frame.position.x,
        y: frame.position.y,
        width: lying ? Math.abs(head.x - feet.x) + (0.3 * stage.bodyHeight) / stage.aspect : width,
        height: 0.07 * stage.bodyHeight,
        // Crossfades with the regular shadow between 8 and 14 degrees.
        opacity: Math.min(1, (Math.abs(key.rot) - 8) / 6) * (lying ? 0.5 : 0.4),
      };
    }
    const effects: StateEffect[] = [];
    const asleep = cue && sleepingStates.includes(cue.state) && this.phase === 'hold';
    if (asleep && key.sleep > 0.9) {
      const t = frame.now - this.holdStart - (cue.state === 'doze' ? 40 : 0);
      const period = frame.breathPeriod * 1.15 * 2;
      const head = toWorld(this.rig.head);
      if (t > 0)
        for (let i = 0; i < 3; i++) {
          const local = t - i * 0.55;
          if (local < 0) continue;
          const age = local % period;
          const life = frame.reducedMotion ? 1.6 : 2.6;
          if (age > life) continue;
          const k = age / life;
          const fade = Math.min(1, age / 0.3) * Math.min(1, (life - age) / 0.8);
          const drift = frame.reducedMotion ? 0 : k;
          effects.push({
            kind: 'z',
            x:
              head.x +
              (facing * (0.12 + 0.14 * drift + 0.02 * Math.sin(6 * local)) * stage.bodyHeight) /
                stage.aspect,
            y: head.y - (0.12 + 0.3 * drift + 0.05 * i) * stage.bodyHeight,
            size: (cue.state === 'doze' ? 0.08 : 0.1) + 0.035 * i,
            opacity: fade * (cue.state === 'doze' ? 0.75 : 0.9),
            rotation: -12 + 8 * i,
          });
        }
    }
    const ledge =
      surfaceY !== null
        ? { x: frame.position.x, y: surfaceY, width: (0.9 * stage.bodyHeight) / stage.aspect }
        : null;
    return { key, surfaceY, height, floorShadow, effects, ledge, status };
  }
}

/** 0..1 wakefulness while nodding off: sag over 3 s, hold, snap back up in 0.12 s. */
function nodOff(t: number) {
  const cycle = 13;
  const phase = t % cycle;
  if (t > 3 * cycle) return 0;
  if (phase < 0.12) return phase / 0.12;
  if (phase < 4) return 1;
  if (phase < 7) {
    const k = (phase - 4) / 3;
    return 1 - k * k * (3 - 2 * k);
  }
  return 0;
}
