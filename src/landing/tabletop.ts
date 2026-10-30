import type { NodeTransform, TrackApplication } from '../renderer/adapter';
import type { Measures, Placement } from './choreography';
import type { GazeFrame } from './heroGaze';
import type { ExpressionId } from '../../shared/expressions';

// Local authored choreography for the landing Tavi (not AI). She runs a varied routine of
// episodes on the desk and the TV, and the visitor can join in: a fast pointer sweep along the
// desk makes her chase it, clicking her makes her hop and wave, and an idle visitor finds her
// climbing up to sit on top of the TV. Positions are TV model units: x along the desk, y height
// above the desk surface.

export type Depth = 'front' | 'back';
export type Gait = 'walk' | 'run' | 'sprint' | 'skip';
export type Surface = 'desk' | 'tv' | 'page';
export type Foundation = 'walk' | 'sprint' | 'skip';
export type Action = Gait | 'rest' | 'sit' | 'react' | 'crouch' | 'air' | 'land';
export interface JumpPose {
  /** Anticipation and landing compression, 0..1. */
  crouch: number;
  /** Launch stretch, 0..1. */
  stretch: number;
  /** Knees tucked in the air, 0..1. */
  tuck: number;
  /** Arm raise in radians from rest (outward). */
  arms: number;
}
/** A little scene at a page station: where she looks, her face, and what she does. */
export interface StopScene {
  name: 'chat' | 'room' | 'studio' | 'floor';
  /** A named thing in the section to look at, or null for the visitor and ambient life. */
  look: string | null;
  expression: ExpressionId | null;
  /** Presenting arm raise toward the call to action, 0..1. */
  present: number;
  /** Which side the call to action is on: -1 screen left, 1 screen right. */
  side?: number;
  /** Beat index, for page-side highlights. */
  step: number;
}
export interface TabletopFrame {
  placement: Placement;
  depth: Depth;
  action: Action;
  surface: Surface;
  /** Phase of the active locomotion foundation, 0..1. */
  phase: number;
  /** Locomotion weight, 0..1 of the current gait's peak speed. */
  weight: number;
  /** Per-foundation track phases and mixes, for crossfades between gaits. */
  gaits: { foundation: Foundation; phase: number; mix: number }[];
  seated: number;
  reaction: number;
  jump: JumpPose | null;
  /** Ground contact under her: where the shadow goes, and how lifted she is (0 = touching). */
  ground: { y: number; lift: number };
  /** Horizontal world position in body heights, for cloth follow-through. */
  travel: number;
  /** Turned to watch the TV: blend into the three-quarter standing pose, 0..1. */
  watch?: number;
  /** Page station she is at or heading for: 0 is the desk, then each section below. */
  station?: number;
  /** The scene she is playing at a page station. */
  scene?: StopScene | null;
  /** Seated on an edge with the legs hanging, or cross-legged on the floor. */
  seatPose?: 'perch' | 'floor';
  /** Behind something on the page (the call to action), which draws over her. */
  behind?: boolean;
  /** Her idle life, set by the page: leg swing while perched, and whether a move is playing. */
  life?: { legSwing: number; moving: boolean; clock: number };
}
export interface Visitor {
  /** Pointer in TV model units, or null when it is off the page. */
  x: number | null;
  y: number | null;
  /** Pointer speed in model units per second. */
  speed: number;
  /** Seconds since the pointer last moved. */
  idleFor: number;
}
type Step =
  | { kind: 'go'; x: number; gait: Gait; depth?: Depth }
  | { kind: 'rest'; seconds: number; sit?: boolean }
  | { kind: 'jump'; x: number; to: Surface };
interface Jump {
  from: { x: number; y: number };
  to: { x: number; y: number };
  surface: Surface;
  /** Time into the jump, through crouch, air and landing. */
  t: number;
  air: number;
  apex: number;
  impact: number;
  /** A greeting hop waves once it has landed. */
  greeting: boolean;
}

const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const smooth = (n: number) => {
  const q = clamp(n);
  return q * q * (3 - 2 * q);
};
const approach = (n: number, to: number, step: number) => n + clamp(to - n, -step, step);

/** Peak walking pace in strides per second: a brisk, playful cadence for the landing Tavi. */
export const STRIDES_PER_SECOND = 1.7;
/** Authored stride per foundation cycle (artboard units) and the landing's cadence for each gait. */
export const GAITS: Record<
  Gait,
  { foundation: Foundation; stride: number; cycles: number; accel: number }
> = {
  walk: { foundation: 'walk', stride: 60, cycles: STRIDES_PER_SECOND, accel: 0.24 },
  run: { foundation: 'sprint', stride: 104, cycles: 1.5, accel: 0.28 },
  sprint: { foundation: 'sprint', stride: 104, cycles: 2.1, accel: 0.4 },
  skip: { foundation: 'skip', stride: 160, cycles: 0.8, accel: 0.3 },
};
export const FOUNDATIONS: Foundation[] = ['walk', 'sprint', 'skip'];
export const STRIDE: Record<Foundation, number> = { walk: 60, sprint: 104, skip: 160 };

// TV 01's measured bounds in model units (see crtScreen.ts GLASS).
const GLASS_LEFT = -0.2571352;
const GLASS_WIDTH = 0.1263319 + 0.2571352;
const GLASS_HEIGHT = 0.4042329 - 0.1141471;
const DESK_Y = 0.4042329 + 0.001;
export const TV_TOP = 0.4568334 + 0.001;
export const DESK_EDGE = 0.36;
const TV_SEAT = 0.2;
const TV_LAUNCH = 0.36;
const TV_DROP = 0.08;
// Cartoon gravity: about 0.7 s from the desk to the top of the TV, 0.35 s for a little hop.
export const GRAVITY = 3.2;
export const CROUCH = 0.18;
export const LAND = 0.22;
/** How far the seated body drops below the soles line, in artboard heights. */
export const SEAT_DROP = 114.218 / 600;

/** Pixels per model unit along the desk and up from it, for the measured TV. */
export function deskScale(m: Measures) {
  const screen = m.screen ?? { width: GLASS_WIDTH, height: GLASS_HEIGHT };
  return { x: screen.width / GLASS_WIDTH, y: screen.height / GLASS_HEIGHT };
}
/** A point on the desk (`y` model units above it) in stage pixels. */
export function deskPoint(x: number, m: Measures, y = 0) {
  const screen = m.screen ?? { left: 0, top: 0, width: GLASS_WIDTH, height: GLASS_HEIGHT };
  const scale = deskScale(m);
  return {
    x: screen.left + (x - GLASS_LEFT) * scale.x,
    y: screen.top + (DESK_Y / GLASS_HEIGHT) * screen.height - y * scale.y,
  };
}
/** A stage pixel x as a position along the desk, in model units. */
export function deskX(px: number, m: Measures) {
  const screen = m.screen ?? { left: 0, width: GLASS_WIDTH };
  return (px - screen.left) / deskScale(m).x + GLASS_LEFT;
}

const EPISODES: Record<string, Step[]> = {
  perch: [
    { kind: 'go', x: -DESK_EDGE, gait: 'walk', depth: 'front' },
    { kind: 'rest', seconds: 5.5, sit: true },
  ],
  stroll: [
    { kind: 'go', x: DESK_EDGE, gait: 'walk', depth: 'front' },
    { kind: 'rest', seconds: 1.4 },
    { kind: 'go', x: -DESK_EDGE, gait: 'run', depth: 'front' },
    { kind: 'rest', seconds: 1 },
  ],
  tv: [
    { kind: 'go', x: TV_LAUNCH, gait: 'run', depth: 'front' },
    { kind: 'rest', seconds: 0.5 },
    { kind: 'jump', x: TV_SEAT, to: 'tv' },
    { kind: 'rest', seconds: 9, sit: true },
    { kind: 'jump', x: TV_DROP, to: 'desk' },
    { kind: 'go', x: -DESK_EDGE, gait: 'skip', depth: 'front' },
    { kind: 'rest', seconds: 0.8 },
  ],
  behind: [
    { kind: 'go', x: -DESK_EDGE, gait: 'walk', depth: 'front' },
    { kind: 'go', x: -0.28, gait: 'walk', depth: 'back' },
    { kind: 'rest', seconds: 0.8 },
    { kind: 'go', x: -DESK_EDGE, gait: 'walk', depth: 'back' },
    { kind: 'rest', seconds: 1.2 },
  ],
  zoomies: [
    { kind: 'go', x: DESK_EDGE, gait: 'sprint', depth: 'front' },
    { kind: 'rest', seconds: 0.3 },
    { kind: 'go', x: -DESK_EDGE, gait: 'sprint', depth: 'front' },
    { kind: 'jump', x: -DESK_EDGE, to: 'desk' },
    { kind: 'rest', seconds: 1 },
  ],
};
// The TV comes first so a visitor sees the big jump within the first half minute.
const ROUTINE = ['tv', 'zoomies', 'perch', 'behind', 'stroll'] as const;
/** A visitor who stops moving for this long gets the cosy TV-top episode next. */
export const IDLE_VISITOR = 10;
/** Pointer sweeps faster than this (model units/s, about 1.2 body heights/s) start a chase. */
export const CHASE_SPEED = 0.25;

/** The ballistic height above the higher end, in model units. */
function apexFor(from: number, to: number, hop: boolean) {
  // Clear the TV's edge without leaving the hero: the TV sits close to the top of the page.
  return Math.max(from, to) + (hop ? 0.05 : to > from ? 0.035 : 0.03);
}
function airtime(from: number, to: number, apex: number) {
  return Math.sqrt((2 * (apex - from)) / GRAVITY) + Math.sqrt((2 * (apex - to)) / GRAVITY);
}

export class TabletopCompanion {
  private x = -DESK_EDGE;
  private y = 0;
  private surface: Surface = 'desk';
  private facing = 0;
  private speed = 0;
  private gait: Gait = 'walk';
  private phases: Record<Foundation, number> = { walk: 0, sprint: 0, skip: 0 };
  private mixes: Record<Foundation, number> = { walk: 1, sprint: 0, skip: 0 };
  private depth: Depth = 'front';
  private steps: Step[] = [];
  private episode = 0;
  private holding = 3;
  private holdingSit = false;
  private seated = 0;
  private reacting = 0;
  private reaction = 0;
  private greeted = false;
  private pending = false;
  private jump: Jump | null = null;
  private chase: { x: number; until: number } | null = null;
  private chaseCooldown = 0;
  private clock = 0;
  private visitorIdle = 0;
  private leaving = false;
  private tired = false;
  private watchFacing: number | null = null;
  /** How far she has turned into her watching pose, 0..1. */
  private watching = 0;

  greet() {
    this.pending = true;
  }

  /** Turn to face the TV while she rests (a facing to hold), or null to face the visitor again. */
  watch(facing: number | null) {
    this.watchFacing = facing;
  }

  /** Standing still in front of the desk with nowhere to be: she could watch the TV for a bit. */
  get canWatch() {
    return (
      !this.jump &&
      !this.leaving &&
      this.surface === 'desk' &&
      this.depth === 'front' &&
      this.seated < 0.001 &&
      this.speed === 0 &&
      this.reacting === 0 &&
      this.chase === null &&
      this.holding > 0 &&
      !this.holdingSit
    );
  }

  /** Let a move finish: when she is standing still, the routine waits this long before going on. */
  pause(seconds: number) {
    if (this.jump || this.leaving || this.speed !== 0 || this.reacting > 0) return;
    this.holding = Math.max(this.holding, seconds);
  }

  /** Tired, she picks calm episodes and slower gaits (sprints become runs, runs become walks). */
  setTired(tired: boolean) {
    this.tired = tired;
  }

  /** The visitor scrolled on: stop the routine, come out front and stand ready to jump off. */
  leave() {
    this.leaving = true;
  }

  /** The visitor came back before she jumped: carry on with the routine. */
  stay() {
    if (!this.leaving) return;
    this.leaving = false;
    this.steps = [];
    this.holding = 0.6;
    this.holdingSit = false;
  }

  /** Standing still in front of the TV, on the desk or on its top, ready to jump off. */
  get ready() {
    // On her feet and not mid-jump: she takes off from wherever she is, running or not, from in
    // front of the TV or behind it (the page leaps her up over it).
    return this.leaving && !this.jump && this.seated < 0.001;
  }

  /** Greetings so far, so the page can count waves across the desk and the sections. */
  get reactions() {
    return this.reaction;
  }

  /** Back from the page below: land on the desk at `x` and pick the routine up again. */
  arrive(x: number, impact: number, facing: number) {
    this.leaving = false;
    this.x = clamp(x, -DESK_EDGE, DESK_EDGE);
    this.y = 0;
    this.surface = 'desk';
    this.depth = 'front';
    this.facing = facing;
    this.speed = 0;
    this.seated = 0;
    this.steps = [];
    // Catch a breath before the routine picks up again.
    this.holding = 1.6;
    this.holdingSit = false;
    this.chase = null;
    this.reacting = 0;
    this.pending = false;
    // Straight into the landing compression of a zero-length jump.
    this.jump = {
      from: { x: this.x, y: 0 },
      to: { x: this.x, y: 0 },
      surface: 'desk',
      t: CROUCH,
      air: 0,
      apex: 0,
      impact,
      greeting: false,
    };
  }

  /** Where she is in model units, for page-side hit testing and tests. */
  get position() {
    return { x: this.x, y: this.y, surface: this.surface, depth: this.depth };
  }

  private next(): Step {
    let step = this.steps[0];
    while (!step) {
      // An idle visitor gets the cosy TV-top episode; otherwise the routine cycles.
      let name: string | undefined =
        this.visitorIdle > IDLE_VISITOR ? 'tv' : ROUTINE[this.episode % ROUTINE.length];
      this.episode = name === 'tv' ? 1 : this.episode + 1;
      // Worn out, she sits down on the edge of the desk instead of racing around.
      if (this.tired && (name === 'zoomies' || name === 'stroll')) name = 'perch';
      const calmer: Partial<Record<Gait, Gait>> = this.tired ? { sprint: 'run', run: 'walk' } : {};
      this.steps =
        EPISODES[name ?? 'perch']?.map((s) =>
          s.kind === 'go' ? { ...s, gait: calmer[s.gait] ?? s.gait } : { ...s },
        ) ?? [];
      step = this.steps[0];
    }
    return step;
  }

  private startJump(x: number, to: Surface, greeting = false) {
    const y = to === 'tv' ? TV_TOP : 0;
    const hop = Math.abs(x - this.x) < 0.01 && to === this.surface;
    const apex = apexFor(this.y, y, hop);
    this.jump = {
      from: { x: this.x, y: this.y },
      to: { x, y },
      surface: to,
      t: 0,
      apex,
      air: airtime(this.y, y, apex),
      // Landing compression follows the fall height.
      impact: clamp(0.45 + (apex - y) / 0.2),
      greeting,
    };
    this.speed = 0;
  }

  update(dt: number, m: Measures, still = false, visitor?: Visitor): TabletopFrame | null {
    if (!m.screen) return null;
    dt = still ? 0 : clamp(dt, 0, 0.05);
    this.clock += dt;
    this.visitorIdle = visitor ? visitor.idleFor : 0;
    const scale = m.screen.width / GLASS_WIDTH;
    const pxPerY = m.screen.height / GLASS_HEIGHT;
    const unit = m.bodyPx * 0.8;
    const strideOf = (g: Gait) => ((GAITS[g].stride / 600) * unit) / scale;
    const maxSpeed = (g: Gait) => strideOf(g) * GAITS[g].cycles;
    let action: Action = 'rest';
    let targetSpeed = 0;
    let pose: JumpPose | null = null;

    this.chaseCooldown = Math.max(0, this.chaseCooldown - dt);
    const free =
      !this.jump &&
      this.surface === 'desk' &&
      this.depth === 'front' &&
      this.reacting === 0 &&
      this.seated < 0.001;
    if (visitor && visitor.x !== null && free && !this.leaving && this.chaseCooldown === 0) {
      const target = clamp(visitor.x, -DESK_EDGE + 0.02, DESK_EDGE - 0.02);
      // A fast sweep starts the chase and keeps it alive; a slowing pointer still steers it.
      if (visitor.speed > CHASE_SPEED && (this.chase || Math.abs(target - this.x) > 0.08))
        this.chase = { x: target, until: this.clock + 0.8 };
      else if (this.chase && visitor.speed > CHASE_SPEED * 0.4)
        this.chase = { x: target, until: this.chase.until };
    }
    if (this.pending && this.depth === 'front' && this.reacting === 0 && !this.jump) {
      this.pending = false;
      this.reacting = 4.4;
      this.greeted = false;
      this.chase = null;
    }

    if (this.leaving && !this.jump) {
      // Drop everything and get up: the visitor is moving on and she goes with them.
      this.chase = null;
      this.reacting = 0;
      this.pending = false;
      this.steps = [];
      this.holding = Infinity;
      this.holdingSit = false;
    }

    if (this.jump) {
      const j = this.jump;
      j.t += dt;
      const air = j.t - CROUCH;
      if (j.t < CROUCH) {
        action = 'crouch';
        const c = smooth(j.t / CROUCH);
        pose = { crouch: c, stretch: 0, tuck: 0, arms: 0.45 * c };
      } else if (air < j.air) {
        action = 'air';
        const s = air / j.air;
        const up = Math.sqrt((2 * (j.apex - j.from.y)) / GRAVITY);
        const vy = GRAVITY * up;
        this.x = j.from.x + (j.to.x - j.from.x) * s;
        this.y = j.from.y + vy * air - 0.5 * GRAVITY * air * air;
        const tuck = smooth(s / 0.25) * (1 - smooth((s - 0.72) / 0.22));
        pose = {
          crouch: 0,
          stretch: 1 - smooth(s / 0.3),
          tuck,
          arms: 1.6 - 0.6 * smooth(s),
        };
      } else if (air < j.air + LAND) {
        action = 'land';
        this.x = j.to.x;
        this.y = j.to.y;
        this.surface = j.surface;
        const q = (1 - smooth((air - j.air) / LAND)) * j.impact;
        pose = { crouch: q, stretch: 0, tuck: 0, arms: 1.0 * q };
      } else {
        this.x = j.to.x;
        this.y = j.to.y;
        this.surface = j.surface;
        this.jump = null;
        if (j.greeting) {
          this.reaction++;
          this.reacting = 3;
        } else if (this.steps[0]?.kind === 'jump') this.steps.shift();
      }
      if (this.jump) {
        const direction = Math.sign(j.to.x - j.from.x);
        if (Math.abs(j.to.x - j.from.x) > 0.02)
          this.facing = approach(this.facing, direction, dt * 6);
        else this.facing = approach(this.facing, 0, dt * 4.2);
      }
    }

    if (!this.jump) {
      if (this.reacting > 0) {
        this.reacting = Math.max(0, this.reacting - dt);
        action = 'react';
      } else if (this.chase && free) {
        const distance = Math.abs(this.chase.x - this.x);
        this.gait = distance > 0.3 ? 'sprint' : distance > 0.14 ? 'run' : this.gait;
        if (distance < 0.0001) {
          this.speed = 0;
          if (this.clock > this.chase.until) {
            // Caught up with a pointer that has settled: catch a breath, then carry on.
            this.chase = null;
            this.chaseCooldown = 2.5;
            this.steps = [{ kind: 'rest', seconds: 1.2 }];
          }
        } else {
          action = this.gait;
          targetSpeed = Math.sign(this.chase.x - this.x) * maxSpeed(this.gait);
        }
      } else if (this.holding > 0) {
        this.holding = Math.max(0, this.holding - dt);
        action = this.holdingSit ? 'sit' : 'rest';
      } else if (this.seated < 0.001) {
        const step = this.next();
        if (step.kind === 'rest') {
          this.steps.shift();
          this.holding = step.seconds;
          this.holdingSit = step.sit ?? false;
          action = this.holdingSit ? 'sit' : 'rest';
        } else if (step.kind === 'jump') {
          if (Math.abs(this.speed) < 1e-6) this.startJump(step.x, step.to);
        } else {
          // Change depth only beside the TV, where its silhouette cannot cut her off.
          if (Math.abs(this.x) > DESK_EDGE - 0.01) this.depth = step.depth ?? this.depth;
          this.gait = step.gait;
          if (Math.abs(step.x - this.x) < 0.0001) {
            this.steps.shift();
            this.speed = 0;
          } else {
            action = this.gait;
            targetSpeed = Math.sign(step.x - this.x) * maxSpeed(this.gait);
          }
        }
      }
    }

    const desiredSit = action === 'sit' ? 1 : 0;
    this.seated = approach(this.seated, desiredSit, dt / 0.55);
    const moving =
      action === 'walk' || action === 'run' || action === 'sprint' || action === 'skip';
    if (!this.jump) {
      // At rest she faces the visitor, unless she has turned to watch the TV.
      const desiredFacing = moving
        ? Math.sign(targetSpeed)
        : this.reacting > 0 || this.seated > 0.001
          ? 0
          : (this.watchFacing ?? 0);
      this.facing = approach(this.facing, desiredFacing, dt * 4.2);
      // Turned to the TV and standing still, she settles into her three-quarter standing pose.
      const watchingNow = !moving && desiredFacing !== 0 && this.watchFacing !== null;
      this.watching = approach(this.watching, watchingNow ? 1 : 0, dt / 0.35);
      // Turn first and brake before greeting, sitting or jumping. Translation and clip
      // phase share the same travelled distance, including acceleration and braking.
      if (Math.abs(this.facing - desiredFacing) > 0.15 || this.seated > 0.001) targetSpeed = 0;
      const peak = maxSpeed(this.gait);
      this.speed = approach(this.speed, targetSpeed, (peak * dt) / GAITS[this.gait].accel);
      if (still) this.speed = 0;
      const goal = this.chase?.x ?? (this.steps[0]?.kind === 'go' ? this.steps[0].x : this.x);
      const next = clamp(this.x + this.speed * dt, -DESK_EDGE, DESK_EDGE);
      const crossed = moving && (goal - this.x) * (goal - next) <= 0 && next !== this.x;
      const x = crossed ? goal : next;
      const moved = Math.abs(x - this.x);
      // Every foundation advances with the actual distance, so crossfades stay in step.
      for (const f of FOUNDATIONS) this.phases[f] += (moved * scale) / ((STRIDE[f] / 600) * unit);
      this.x = x;
      if (crossed) this.speed = 0;
    }
    const foundation = GAITS[this.gait].foundation;
    for (const f of FOUNDATIONS)
      this.mixes[f] = approach(this.mixes[f], f === foundation ? 1 : 0, dt / 0.18);
    if (still) for (const f of FOUNDATIONS) this.mixes[f] = f === foundation ? 1 : 0;

    if (
      this.reacting > 0 &&
      !this.greeted &&
      !this.jump &&
      Math.abs(this.speed) < maxSpeed(this.gait) * 0.03 &&
      this.seated < 0.001 &&
      Math.abs(this.facing) < 0.03
    ) {
      // Greet with a happy hop; the wave follows the landing.
      this.greeted = true;
      this.startJump(this.x, this.surface, true);
    }

    const surfaceY = (surface: Surface) =>
      m.screen
        ? m.screen.top +
          ((DESK_Y - (surface === 'tv' ? TV_TOP : 0)) / GLASS_HEIGHT) * m.screen.height
        : 0;
    const seat = smooth(this.seated);
    const solesY = surfaceY('desk') - this.y * pxPerY;
    // The TV top catches her shadow only while she is over the cabinet and above it.
    const overTv = Math.abs(this.x) < 0.3 && this.y >= TV_TOP - 1e-9;
    const groundY = surfaceY(overTv ? 'tv' : 'desk');
    const weight = this.jump
      ? 0
      : clamp(Math.abs(this.speed) / Math.max(maxSpeed(this.gait), 1e-4));
    const gaits = FOUNDATIONS.filter((f) => this.mixes[f] > 0.001).map((f) => ({
      foundation: f,
      phase: this.phases[f] % 1,
      mix: this.mixes[f],
    }));
    const placementX = m.screen.left + (this.x - GLASS_LEFT) * scale;
    return {
      placement: {
        stage: seat > 0 ? 'ledge' : 'walk',
        t: 0.5,
        x: placementX,
        y: solesY + SEAT_DROP * unit * seat,
        facing: this.facing,
        clip: null,
        ledge: 0,
      },
      depth: this.depth,
      action,
      surface: this.surface,
      phase: this.phases[foundation] % 1,
      weight,
      gaits,
      seated: seat,
      reaction: this.reaction,
      jump: pose,
      ground: { y: groundY, lift: Math.max(0, groundY - solesY) },
      travel: placementX / Math.max(unit, 1),
      watch: this.jump ? 0 : this.watching,
    };
  }
}

export function tabletopTracks(frame: TabletopFrame, gaze?: GazeFrame | null): TrackApplication[] {
  const tracks: TrackApplication[] = [];
  const side = frame.placement.facing < 0 ? 'left' : 'right';
  if (frame.weight > 0.001) {
    // Crossfade between foundations. Tracks apply in order, each blending over the last, so
    // a track's mix is its share divided by what the later tracks leave of it.
    const total = frame.gaits.reduce((sum, g) => sum + g.mix, 0) || 1;
    const shares = frame.gaits.map((g) => (frame.weight * g.mix) / total);
    let later = 0;
    const mixes = shares.map(() => 0);
    for (let i = shares.length - 1; i >= 0; i--) {
      const share = shares[i] ?? 0;
      mixes[i] = clamp(share / Math.max(1 - later, 1e-6));
      later += share;
    }
    frame.gaits.forEach((g, i) =>
      tracks.push({
        track: `runtime.gait.${g.foundation}-${side}`,
        time: g.phase,
        mix: mixes[i] ?? 0,
      }),
    );
  }
  // Watching the TV: the side view's standing frame (the walk's first, legs together).
  const watch = frame.weight < 0.001 && frame.seated === 0 ? (frame.watch ?? 0) : 0;
  if (watch > 0.001) tracks.push({ track: `runtime.gait.walk-${side}`, time: 0, mix: watch });
  if (frame.seated > 0)
    tracks.push({
      track: `runtime.pose.${frame.seatPose ?? 'perch'}-front`,
      time: frame.seated,
      mix: 1,
    });
  if (frame.jump || (frame.scene?.present ?? 0) > 0.001)
    tracks.push({ track: 'runtime.arms-front', time: 0.5, mix: 1 });
  tracks.push(
    { track: 'ctl.turn-body', time: (frame.placement.facing + 1) / 2, mix: 1 },
    {
      track: 'ctl.turn-head',
      time: ((gaze?.turnHead ?? frame.placement.facing * 0.85) + 1) / 2,
      mix: 1,
    },
  );
  return tracks;
}

export function tabletopNodes(
  frame: TabletopFrame,
  gaze?: GazeFrame | null,
): Record<string, NodeTransform> {
  // The page owns the pupils so the look stays continuous between ambient, travel and the visitor.
  const eyes = gaze ? { eyes: { x: gaze.eyes.x, y: gaze.eyes.y } } : {};
  const j = frame.jump;
  if (j) {
    // Crouch, stretch and tuck through the real leg IK: the hips drop or the feet lift, and
    // the post-processor bends the knees. Front views splay the knees so the bend reads.
    const front = Math.abs(frame.placement.facing) < 0.5;
    const splay = Math.max(j.crouch * 0.5, j.tuck * 0.6);
    const tuckX = 10 * j.tuck;
    return {
      ...eyes,
      'runtime-mode': {
        x: front ? 3 : 1,
        y: Math.sign(frame.placement.facing),
        rotation: front ? splay : 0,
      },
      body: {
        x: 0,
        y: 32 * j.crouch - 10 * j.stretch,
        rotation: 0,
        scaleX: 1 + 0.08 * j.crouch - 0.08 * j.stretch,
        scaleY: 1 - 0.09 * j.crouch + 0.11 * j.stretch,
      },
      upper: { rotation: 0 },
      'foot-l': { x: tuckX, y: -58 * j.tuck },
      'foot-r': { x: -tuckX, y: -50 * j.tuck },
      'arm-l': { rotation: j.arms },
      'arm-r': { rotation: -j.arms },
      'arm-l-fore': { rotation: 0.5 * j.crouch },
      'arm-r-fore': { rotation: -0.5 * j.crouch },
    };
  }
  const present = frame.scene?.present ?? 0;
  if (present > 0.001 && frame.weight < 0.001 && frame.seated === 0) {
    // Ta-da: one arm swings out toward the call to action, the elbow a little soft.
    const p = smooth(present);
    return {
      ...eyes,
      'runtime-mode': { x: 3, y: 0, rotation: 0 },
      body: { x: 0, y: -4 * p, rotation: 0, scaleX: 1, scaleY: 1 + 0.02 * p },
      upper: { rotation: 0.05 * p },
      'foot-l': { x: 0, y: 0 },
      'foot-r': { x: 0, y: 0 },
      // The arm on the button's side swings out toward it: arm-l reaches screen left,
      // arm-r screen right.
      'arm-l': { rotation: (frame.scene?.side ?? -1) < 0 ? 1.25 * p : 0 },
      'arm-r': { rotation: (frame.scene?.side ?? -1) < 0 ? 0 : -1.25 * p },
      'arm-l-fore': { rotation: (frame.scene?.side ?? -1) < 0 ? -0.3 * p : 0 },
      'arm-r-fore': { rotation: (frame.scene?.side ?? -1) < 0 ? 0 : 0.3 * p },
    };
  }
  if (frame.weight < 0.001 && frame.seated === 0 && (frame.watch ?? 0) < 0.001) return eyes;
  // Perched with her legs over an edge, a bored Tavi swings them, one then the other.
  const swing = frame.seatPose === 'floor' ? 0 : (frame.life?.legSwing ?? 0) * frame.seated;
  const kick = (offset: number) =>
    -18 * swing * (0.5 + 0.5 * Math.sin((frame.life?.clock ?? 0) * Math.PI * 1.7 + offset));
  return {
    ...eyes,
    'runtime-mode': { x: 6, rotation: 0, y: 0 },
    body: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    upper: { rotation: 0 },
    'foot-l': { x: 0, y: kick(0) },
    'foot-r': { x: 0, y: kick(Math.PI) },
    // A move in progress (a seated wave, a yawn) owns the arms.
    ...(frame.life?.moving
      ? {}
      : {
          'arm-l': { rotation: 0 },
          'arm-r': { rotation: 0 },
          'arm-l-fore': { rotation: 0 },
          'arm-r-fore': { rotation: 0 },
        }),
  };
}

/**
 * The visitor's pointer in the companion's terms. Only a pointer over the desk band (from a body
 * above the TV down to just below the desk) can start a chase; its speed eases off once it stops.
 */
export class VisitorTracker {
  private last: { x: number; y: number } | null = null;
  private speed = 0;

  update(
    dt: number,
    /** Pointer in the desk's layout pixels, or null when off the page. */
    local: { x: number; y: number } | null,
    m: Measures,
    idleFor: number,
  ): Visitor {
    if (!m.screen) return { x: null, y: null, speed: 0, idleFor };
    const scale = m.screen.width / GLASS_WIDTH;
    const pxPerY = m.screen.height / GLASS_HEIGHT;
    const deskY = m.screen.top + (DESK_Y / GLASS_HEIGHT) * m.screen.height;
    const point = local
      ? { x: (local.x - m.screen.left) / scale + GLASS_LEFT, y: (deskY - local.y) / pxPerY }
      : null;
    const body = m.bodyPx / pxPerY;
    const inBand = point !== null && point.y < TV_TOP + body && point.y > -body * 0.5;
    if (point && this.last && dt > 0) {
      const instant = Math.abs(point.x - this.last.x) / dt;
      // Fast attack, ~0.15 s release: a sweep registers at once and fades when it stops.
      this.speed = Math.max(instant, this.speed * Math.exp(-dt / 0.15));
    } else this.speed *= dt > 0 ? Math.exp(-dt / 0.15) : 1;
    this.last = point;
    return {
      x: inBand ? point.x : null,
      y: inBand ? point.y : null,
      speed: inBand ? this.speed : 0,
      idleFor,
    };
  }
}
