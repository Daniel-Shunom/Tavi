import type { Measures } from './choreography';
import {
  CROUCH,
  DESK_EDGE,
  FOUNDATIONS,
  GAITS,
  GRAVITY,
  LAND,
  SEAT_DROP,
  STRIDE,
  TV_TOP,
  TabletopCompanion,
  deskPoint,
  deskScale,
  deskX,
  type Action,
  type Foundation,
  type Gait,
  type JumpPose,
  type StopScene,
  type TabletopFrame,
  type Visitor,
} from './tabletop';
import type { ExpressionId } from '../../shared/expressions';

// Local authored choreography for the landing Tavi (not AI): she follows the visitor down the
// page. Each section offers a station built into its art (the top edge of an illustration to
// perch on, or the closing floor), and when the visitor reads on she jumps down to it. Scrolling
// back up, she hops back up station by station to the desk. The page never waits for her: one
// jump runs at a time, always aimed at the station the visitor is reading, so a fast scroll gets
// one long fall instead of a chain of hops. Positions are stage pixels, y down, at her soles.

export type SceneName = StopScene['name'];
export interface PageStation {
  kind: 'perch' | 'floor';
  /** The little scene she plays once settled here. */
  scene?: SceneName;
  /** Surface span and its height at the middle, in stage pixels. */
  left: number;
  right: number;
  top: number;
  /** The surface's tilt in radians (a gently rotated illustration). */
  tilt: number;
  /** Where she settles on it. */
  spot: number;
  /** Something on the floor she can walk behind (the call to action), as a horizontal span. */
  cover?: { left: number; right: number };
}
export interface PageView {
  /** The viewport's top edge and height in stage pixels. */
  top: number;
  height: number;
  /** Scrolled to the end of the page. */
  atBottom: boolean;
  /** How fast the visitor has been scrolling, in viewport heights per second. */
  pace?: number;
}

/**
 * Her tempo for a trip between stations. Getting to where the visitor is reading must feel
 * almost instant, so every trip (getting up, crouch, flight, landing) runs brisk, and faster
 * still with the visitor's scroll: 1.6x for a gentle scroll, up to 4x for a fast flick.
 */
export function tempoFor(pace: number) {
  return Math.max(1.6, Math.min(4, 1.6 + 0.6 * Math.max(0, pace)));
}

/** A station becomes the target once its surface rises above this share of the viewport... */
export const ARRIVE_LINE = 0.8;
/** ...and stays it until the surface sinks below this one, so small scrolls do not ping-pong. */
export const LEAVE_LINE = 0.92;
/** The target has to hold this long before she commits to a jump. */
export const SETTLE = 0.12;
/** The longest any flight between stations lasts, in seconds before tempo. */
export const MAX_AIR = 0.7;

function flight(rise: number, fall: number, gravity: number) {
  const time = (g: number) => Math.sqrt((2 * rise) / g) + Math.sqrt((2 * fall) / g);
  const natural = time(gravity);
  // Flight time goes as 1/sqrt(g): scale the pull to bring a long trip down to MAX_AIR.
  const pull = natural > MAX_AIR ? gravity * (natural / MAX_AIR) ** 2 : gravity;
  return { gravity: pull, air: time(pull) };
}

interface Beat {
  at: number;
  look?: string | null;
  expression?: ExpressionId | null;
  present?: number;
  /** Chat bubbles shown from this beat on. */
  reveal?: number;
}
/**
 * What she does at each station, in seconds after settling (not AI). Each one acts out the
 * section's line: she reads the chat as it pops in, looks along the room's attention line, and
 * presents the call to action. Afterwards the visitor and ambient life have her attention.
 */
export const SCENES: Record<SceneName, readonly Beat[]> = {
  chat: [
    { at: 0.4, reveal: 1, look: 'bubble-0', expression: 'impressed' },
    { at: 2, reveal: 2, look: 'bubble-1' },
    { at: 2.5, expression: 'laugh' },
    { at: 4.4, reveal: 3, look: 'bubble-2', expression: 'content' },
    { at: 6.4, look: null, expression: null },
  ],
  room: [
    { at: 0.4, look: 'dot', expression: 'focused' },
    { at: 1.9, look: 'line-end' },
    { at: 3.4, look: null, expression: 'content' },
    { at: 5.4, expression: null },
  ],
  floor: [
    { at: 0.3, look: 'button', expression: 'excited', present: 1 },
    { at: 2.4, look: null, expression: null, present: 0 },
  ],
};
/** How many chat bubbles there are to reveal. */
export const CHAT_BUBBLES = 3;

type FloorPlace = 'spot' | 'cover' | 'past' | 'left';
type FloorStep =
  | { kind: 'go'; to: FloorPlace; gait: Gait; behind: boolean }
  | { kind: 'rest'; seconds: number; sit?: boolean; expression?: ExpressionId };
export type FloorEpisode = 'peekaboo' | 'sit' | 'wander' | 'stay';
/**
 * Her life on the floor once the closing scene is done (not AI). Each episode has a reason she
 * picks it (see `chooseFloorEpisode`), and she only changes depth clear of the button:
 * - peekaboo: with a visitor around, she hides behind the call to action and peeks out at them;
 * - sit: tired, she wanders a few steps off and sits down for a while;
 * - wander: bored but full of energy, she strolls off and comes back;
 * - stay: otherwise she stays by the button, where her idle moves fill the time.
 */
export const FLOOR_EPISODES: Record<FloorEpisode, readonly FloorStep[]> = {
  peekaboo: [
    { kind: 'go', to: 'cover', gait: 'run', behind: true },
    { kind: 'rest', seconds: 2.2, expression: 'teasing' },
    { kind: 'go', to: 'past', gait: 'skip', behind: true },
    { kind: 'rest', seconds: 0.8 },
    { kind: 'go', to: 'spot', gait: 'run', behind: false },
  ],
  sit: [
    { kind: 'go', to: 'left', gait: 'walk', behind: false },
    { kind: 'rest', seconds: 9, sit: true },
    { kind: 'go', to: 'spot', gait: 'walk', behind: false },
  ],
  wander: [
    { kind: 'go', to: 'left', gait: 'skip', behind: false },
    { kind: 'rest', seconds: 2 },
    { kind: 'go', to: 'spot', gait: 'walk', behind: false },
  ],
  stay: [{ kind: 'rest', seconds: 5 }],
};
/** Her drives (from `TaviLife`), which decide what she does next on the floor. */
export interface Mood {
  energy: number;
  boredom: number;
  interest: number;
}
/** The next floor episode for how she feels; never peekaboo twice running. */
export function chooseFloorEpisode(mood: Mood, last: FloorEpisode | null): FloorEpisode {
  if (mood.interest > 0.5 && last !== 'peekaboo') return 'peekaboo';
  if (mood.energy < 0.45) return 'sit';
  if (mood.boredom > 0.45 && mood.energy > 0.6 && last !== 'wander') return 'wander';
  return 'stay';
}

function sceneLength(name: SceneName | undefined) {
  return name ? (SCENES[name].at(-1)?.at ?? 0) : 0;
}

/** The scene's state at time `t`: every beat so far, folded in order. */
export function sceneAt(name: SceneName, t: number) {
  const state = {
    look: null as string | null,
    expression: null as ExpressionId | null,
    present: 0,
    reveal: 0,
    step: -1,
  };
  SCENES[name].forEach((beat, i) => {
    if (beat.at > t) return;
    if (beat.look !== undefined) state.look = beat.look;
    if (beat.expression !== undefined) state.expression = beat.expression;
    if (beat.present !== undefined) state.present = beat.present;
    if (beat.reveal !== undefined) state.reveal = beat.reveal;
    state.step = i;
  });
  return state;
}

interface Leap {
  to: number;
  from: { x: number; y: number };
  dest: { x: number; y: number };
  t: number;
  air: number;
  /** The pull for this leap (stronger for long trips). */
  gravity: number;
  /** Playback speed, from the visitor's scroll pace (never slows down mid-flight). */
  tempo: number;
  apex: number;
  land: number;
  impact: number;
  /** A long fall: arms stay up and the landing squashes harder. */
  long: number;
  greeting: boolean;
}

const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const smooth = (n: number) => {
  const q = clamp(n);
  return q * q * (3 - 2 * q);
};
const approach = (n: number, to: number, step: number) => n + clamp(to - n, -step, step);

export function surfaceAt(station: PageStation, x: number) {
  return station.top + (x - (station.left + station.right) / 2) * Math.tan(station.tilt);
}

/** The station the visitor is reading: the lowest whose surface has come up the viewport. */
export function readingStation(stations: readonly PageStation[], view: PageView, current: number) {
  let target = 0;
  stations.forEach((station, i) => {
    const line = i + 1 <= current ? LEAVE_LINE : ARRIVE_LINE;
    if (surfaceAt(station, station.spot) < view.top + view.height * line) target = i + 1;
  });
  // The end of the page is always the last station, however short the closing section.
  return view.atBottom ? stations.length : target;
}

export class PageCompanion {
  readonly desk: TabletopCompanion;
  /** 0 while the desk routine has her; otherwise the station she is on or leaping to. */
  private at = 0;
  private home = true;
  private target = 0;
  private wanted = 0;
  private settled = 0;
  private x = 0;
  private y = 0;
  private facing = 0;
  private speed = 0;
  private gait: Gait = 'walk';
  private phases: Record<Foundation, number> = { walk: 0, sprint: 0, skip: 0 };
  private mixes: Record<Foundation, number> = { walk: 1, sprint: 0, skip: 0 };
  private seated = 0;
  private floorSteps: FloorStep[] = [];
  private floorEpisode: FloorEpisode | null = null;
  private floorHold: number | null = null;
  private mood: Mood = { energy: 0.8, boredom: 0.3, interest: 0 };
  private behind = false;
  private wait = 0;
  /** Taking off from behind the TV: she stays behind it until she has risen above its top. */
  private behindTv = false;
  private ctaHover = false;
  private encouraging = false;
  private leap: Leap | null = null;
  private pending = false;
  private reacting = 0;
  private reactions = 0;
  private waved = false;
  private sceneTime = 0;
  private present = 0;
  private shown = 0;
  private still = false;

  constructor(desk = new TabletopCompanion()) {
    this.desk = desk;
  }

  /** Away from the desk, or about to be: the page has to keep drawing her. */
  get away() {
    return !this.home || this.target !== 0 || this.wanted !== 0;
  }

  get station() {
    return this.leap?.to ?? this.at;
  }

  /** Chat bubbles revealed so far; they stay once read (all of them without motion). */
  get revealed() {
    return this.still ? CHAT_BUBBLES : this.shown;
  }

  greet() {
    if (this.home) this.desk.greet();
    else this.pending = true;
  }

  /** Let a move finish before her routine goes on (she is already standing or sitting still). */
  pause(seconds: number) {
    if (this.home) this.desk.pause(seconds);
    else if (!this.leap && this.speed === 0) this.wait = Math.max(this.wait, seconds);
  }

  /** The visitor is hovering the call to action: at the bottom, she stops to cheer them on. */
  setCtaHover(hovering: boolean) {
    this.ctaHover = hovering;
  }

  /** How she feels, from her idle life: it picks what she does next on the floor. */
  setMood(mood: Mood) {
    this.mood = mood;
  }

  /** The floor episode she is in, for inspection and tests. */
  get episode() {
    return this.floorEpisode;
  }

  /** On the desk and free to watch the TV for a few seconds. */
  get canWatchTv() {
    return this.home && this.target === 0 && this.desk.canWatch;
  }

  /** Turn toward the TV (a facing), or back to the visitor (null). */
  watchTv(facing: number | null) {
    this.desk.watch(this.home ? facing : null);
  }

  /** Worn out: calmer choices on the desk. */
  setTired(tired: boolean) {
    this.desk.setTired(tired);
  }

  update(
    dt: number,
    m: Measures,
    stations: readonly PageStation[],
    view: PageView,
    still = false,
    visitor?: Visitor,
  ): TabletopFrame | null {
    if (!m.screen) return null;
    this.still = still;
    dt = still ? 0 : clamp(dt, 0, 0.05);
    const unit = m.bodyPx * 0.8;
    const gravity = GRAVITY * deskScale(m).y;

    const wanted = Math.min(readingStation(stations, view, this.target), stations.length);
    if (wanted !== this.wanted) {
      this.wanted = wanted;
      this.settled = 0;
    } else this.settled += dt;
    const tempo = tempoFor(view.pace ?? 0);
    // A fast scroll also commits her sooner.
    if (still || this.settled >= SETTLE / tempo) this.target = this.wanted;
    // Everything on the way between stations runs at the visitor's tempo.
    const travel = this.leap || this.at !== this.target || (this.home && this.target !== 0);
    const hurry = travel ? tempo : 1;
    if (this.leap) this.leap.tempo = Math.max(this.leap.tempo, tempo);

    if (still) {
      // Reduced motion: no jumps. She is simply at the station being read.
      this.leap = null;
      if (this.target === 0) {
        this.home = true;
        this.at = 0;
      } else {
        const station = stations[this.target - 1];
        if (!station) return null;
        this.home = false;
        this.at = this.target;
        this.x = station.spot;
        this.y = surfaceAt(station, station.spot);
        this.facing = 0;
        this.speed = 0;
        this.seated = station.kind === 'perch' ? 1 : 0;
      }
    }

    if (this.home) {
      if (this.target === 0 || still) {
        this.desk.stay();
        return this.dress(this.desk.update(dt, m, still, visitor));
      }
      this.desk.leave();
      const frame = this.desk.update(dt * hurry, m, still, visitor);
      if (!frame || !this.desk.ready) return this.dress(frame);
      // Off the desk (or the top of the TV), from wherever she is, running or not.
      this.behindTv = frame.depth === 'back';
      this.home = false;
      this.at = 0;
      this.x = frame.placement.x;
      this.y = frame.placement.y;
      this.facing = frame.placement.facing;
      this.speed = 0;
      this.seated = 0;
      this.startLeap(this.target, stations, m, gravity, unit);
    }

    // Widened: the floor helper below sets it from inside a closure.
    let action = 'rest' as Action;
    let pose: JumpPose | null = null;
    let ground = this.y;
    const leap = this.leap;
    if (leap) {
      leap.t += dt * leap.tempo;
      const air = leap.t - CROUCH;
      if (leap.t < CROUCH) {
        action = 'crouch';
        const c = smooth(leap.t / CROUCH);
        pose = { crouch: c, stretch: 0, tuck: 0, arms: 0.45 * c };
        ground = leap.from.y;
      } else if (air < leap.air) {
        action = 'air';
        const s = air / leap.air;
        const rise = Math.sqrt((2 * (leap.from.y - leap.apex)) / leap.gravity);
        this.x = leap.from.x + (leap.dest.x - leap.from.x) * s;
        this.y = leap.from.y - leap.gravity * rise * air + 0.5 * leap.gravity * air * air;
        const tuck = smooth(s / 0.25) * (1 - smooth((s - 0.72) / 0.22));
        pose = {
          crouch: 0,
          stretch: 1 - smooth(s / 0.3),
          tuck: tuck * (1 - 0.6 * leap.long),
          // A long fall keeps the arms up until just before touchdown.
          arms: 1.6 - 0.6 * smooth(leap.long ? (s - 0.8) / 0.2 : s),
        };
        // Over the top of the TV now: she comes round in front of it.
        if (this.behindTv && this.y < deskPoint(0, m, TV_TOP).y) this.behindTv = false;
        // The shadow sits on the nearer surface below her.
        const below = [leap.from.y, leap.dest.y].filter((y) => y >= this.y - 1e-6);
        ground = below.length ? Math.min(...below) : leap.dest.y;
      } else if (leap.to === 0) {
        // Back on the desk: its routine takes the landing from here.
        this.leap = null;
        this.home = true;
        this.at = 0;
        this.desk.arrive(deskX(leap.dest.x, m), leap.impact, this.facing);
        return this.dress(this.desk.update(0, m, still, visitor));
      } else if (air < leap.air + leap.land) {
        action = 'land';
        this.x = leap.dest.x;
        this.y = leap.dest.y;
        this.at = leap.to;
        const q = (1 - smooth((air - leap.air) / leap.land)) * leap.impact;
        pose = { crouch: q, stretch: 0, tuck: 0, arms: q };
        ground = leap.dest.y;
      } else {
        this.x = leap.dest.x;
        this.y = leap.dest.y;
        this.at = leap.to;
        this.leap = null;
        if (leap.greeting) {
          this.reactions++;
          this.reacting = 3;
        }
      }
      if (this.leap) {
        const dx = leap.dest.x - leap.from.x;
        this.facing = approach(
          this.facing,
          Math.abs(dx) > unit * 0.3 ? Math.sign(dx) : 0,
          dt * (Math.abs(dx) > unit * 0.3 ? 6 : 4.2),
        );
      }
    }

    let targetSpeed = 0;
    let goal = this.x;
    this.encouraging = false;
    let routineExpression: ExpressionId | null = null;
    const station = stations[this.at - 1];
    const cover = station?.kind === 'floor' ? station.cover : undefined;
    const reach = m.bodyPx * 0.3;
    // Clear of the cover: the only places she may step behind it or back out in front.
    const clear = (x: number) =>
      !cover ||
      Math.abs(x - (cover.left + cover.right) / 2) >= (cover.right - cover.left) / 2 + reach;
    const go = (x: number, gait: Gait) => {
      goal = x;
      this.gait = gait;
      if (Math.abs(x - this.x) < 1e-4) return false;
      action = gait;
      targetSpeed = Math.sign(x - this.x) * this.maxSpeed(gait, unit);
      return true;
    };
    if (!this.leap && station) {
      // Stations follow the layout, so a resize or late font load carries her along.
      const floor = station.kind === 'floor';
      if (floor) this.x = clamp(this.x, station.left + unit * 0.3, station.right - unit * 0.3);
      else this.x = station.spot;
      this.y = surfaceAt(station, this.x);
      ground = this.y;
      const settled =
        this.at === this.target &&
        !this.pending &&
        this.reacting === 0 &&
        (floor ? this.speed === 0 && Math.abs(station.spot - this.x) < 1e-4 : this.seated > 0.99);
      if (settled) this.sceneTime += dt;
      const sceneOver = this.sceneTime > sceneLength(station.scene);
      if (floor && view.atBottom && !this.waved && sceneOver && settled) {
        // Reaching the end of the page earns a hop and a wave.
        this.waved = true;
        this.pending = true;
      }
      // The visitor moving on cuts a wave short: she follows at once.
      if (this.at !== this.target) this.reacting = 0;
      if (this.reacting > 0) {
        this.reacting = Math.max(0, this.reacting - dt);
        action = 'react';
      } else if (this.behind && this.at !== this.target && !clear(this.x) && cover) {
        // Called away while behind the button: step out from behind it first.
        const mid = (cover.left + cover.right) / 2,
          half = (cover.right - cover.left) / 2 + reach + 1;
        go(this.x < mid ? mid - half : mid + half, 'run');
      } else if (this.pending || this.at !== this.target) {
        // Stand up and brake, face the visitor for a greeting, then go.
        const turned = this.pending ? Math.abs(this.facing) < 0.03 : true;
        if (this.seated < 0.001 && this.speed === 0 && turned) {
          const greeting = this.pending && this.at === this.target;
          this.pending = false;
          // Straight to where the visitor is, up or down, in one leap. A slow scroll still
          // reads as hop by hop, because the station being read changes one at a time.
          this.startLeap(greeting ? this.at : this.target, stations, m, gravity, unit, greeting);
          action = 'crouch';
        }
      } else if (floor && this.ctaHover && sceneOver && !this.behind) {
        // The visitor is weighing up the button: she stops (and stands), points and cheers.
        this.encouraging = true;
        action = 'rest';
      } else if (floor && sceneOver && (this.waved || !view.atBottom)) {
        if (!this.floorSteps.length) {
          this.floorEpisode = chooseFloorEpisode(this.mood, this.floorEpisode);
          this.floorSteps = FLOOR_EPISODES[this.floorEpisode].map((s) => ({ ...s }));
        }
        const step = this.floorSteps[0];
        if (this.wait > 0) {
          // A move is playing: hold still (seated if she was sitting) until it finishes.
          this.wait = Math.max(0, this.wait - dt);
          action = this.seated > 0.5 ? 'sit' : 'rest';
        } else if (step?.kind === 'rest') {
          this.floorHold ??= step.seconds;
          this.floorHold -= dt;
          action = step.sit ? 'sit' : 'rest';
          routineExpression = step.expression ?? null;
          if (this.floorHold <= 0) {
            this.floorHold = null;
            this.floorSteps.shift();
          }
        } else if (step) {
          const limit = (x: number) =>
            clamp(x, station.left + unit * 0.4, station.right - unit * 0.4);
          const mid = cover ? (cover.left + cover.right) / 2 : station.spot;
          const places: Record<FloorPlace, number> = {
            spot: station.spot,
            cover: mid,
            past: cover ? limit(cover.left - reach - 2) : station.spot,
            left: cover ? limit(cover.left - m.bodyPx * 0.85) : station.spot,
          };
          if (this.seated < 0.001 && !go(places[step.to], step.gait)) this.floorSteps.shift();
          if (clear(this.x)) this.behind = step.behind;
        }
      } else if (floor) go(station.spot, 'walk');
      else action = 'sit';
      if (this.at !== this.target && clear(this.x)) this.behind = false;
    }

    // Called away, she is up off a perch in a blink; settling down stays unhurried.
    const leavingSeat = action !== 'sit' && this.at !== this.target;
    this.seated = approach(
      this.seated,
      action === 'sit' ? 1 : 0,
      (dt * hurry) / (leavingSeat ? 0.28 : 0.55),
    );
    const moving =
      action === 'walk' || action === 'run' || action === 'sprint' || action === 'skip';
    if (!this.leap) {
      const desiredFacing = moving ? Math.sign(targetSpeed) : 0;
      this.facing = approach(this.facing, desiredFacing, dt * 4.2);
      if (Math.abs(this.facing - desiredFacing) > 0.15 || this.seated > 0.001) targetSpeed = 0;
      const peak = this.maxSpeed(this.gait, unit);
      this.speed = approach(this.speed, targetSpeed, (peak * dt) / GAITS[this.gait].accel);
      const next = this.x + this.speed * dt;
      const crossed = moving && (goal - this.x) * (goal - next) <= 0 && next !== this.x;
      const x = crossed ? goal : next;
      // Every foundation advances with the distance travelled, so crossfades stay in step.
      for (const f of FOUNDATIONS)
        this.phases[f] += Math.abs(x - this.x) / ((STRIDE[f] / 600) * unit);
      this.x = x;
      if (crossed || !station || station.kind !== 'floor') this.speed = 0;
    }
    const foundation = GAITS[this.gait].foundation;
    for (const f of FOUNDATIONS)
      this.mixes[f] = approach(this.mixes[f], f === foundation ? 1 : 0, dt / 0.18);

    const seat = smooth(this.seated);
    const floorSeat = station?.kind === 'floor';
    const weight = this.leap ? 0 : clamp(Math.abs(this.speed) / this.maxSpeed(this.gait, unit));
    const sceneName = this.leap ? undefined : station?.scene;
    const beat = sceneName ? sceneAt(sceneName, this.sceneTime) : null;
    if (sceneName === 'chat' && beat) this.shown = Math.max(this.shown, beat.reveal);
    const cheering = this.encouraging && this.seated < 0.001 && this.speed === 0;
    this.present = approach(this.present, cheering ? 1 : (beat?.present ?? 0), dt / 0.3);
    const mid = cover ? (cover.left + cover.right) / 2 : (station?.spot ?? this.x);
    const scene: StopScene | null =
      sceneName && beat
        ? {
            name: sceneName,
            look: cheering ? 'button' : beat.look,
            expression: cheering ? 'excited' : (routineExpression ?? beat.expression),
            present: this.present,
            step: beat.step,
            // Toward the button; without one, the arm she presents with by default.
            side: cover && mid > this.x ? 1 : -1,
          }
        : null;
    return this.dress({
      placement: {
        stage: seat > 0 ? 'ledge' : 'walk',
        t: 0.5,
        x: this.x,
        // Perched, the seat drops below the edge; on the floor the pose lowers her itself.
        y: this.y + (floorSeat ? 0 : SEAT_DROP * unit * seat),
        facing: this.facing,
        clip: null,
        ledge: 0,
      },
      depth: this.behindTv ? 'back' : 'front',
      action,
      surface: 'page',
      phase: this.phases[foundation] % 1,
      weight,
      gaits:
        weight > 0
          ? FOUNDATIONS.filter((f) => this.mixes[f] > 0.001).map((f) => ({
              foundation: f,
              phase: this.phases[f] % 1,
              mix: this.mixes[f],
            }))
          : [],
      seated: seat,
      seatPose: floorSeat ? 'floor' : 'perch',
      behind: this.behind,
      reaction: 0,
      jump: pose,
      ground: { y: ground, lift: Math.max(0, ground - this.y) },
      travel: this.x / Math.max(unit, 1),
      scene,
    });
  }

  private maxSpeed(gait: Gait, unit: number) {
    return (GAITS[gait].stride / 600) * unit * GAITS[gait].cycles;
  }

  private dress(frame: TabletopFrame | null): TabletopFrame | null {
    if (!frame) return null;
    // One wave counter across the desk and the page, so every greeting reaches the renderer.
    return {
      ...frame,
      reaction: this.desk.reactions + this.reactions,
      station: this.station,
    };
  }

  private startLeap(
    to: number,
    stations: readonly PageStation[],
    m: Measures,
    gravity: number,
    unit: number,
    greeting = false,
  ) {
    const from = { x: this.x, y: this.y };
    let dest: { x: number; y: number };
    const station = stations[to - 1];
    if (to === 0 || !station) {
      // Home: onto the desk above wherever she is, inside its ends.
      dest = deskPoint(clamp(deskX(this.x, m), -DESK_EDGE, DESK_EDGE), m);
      to = 0;
    } else if (station.kind === 'floor') {
      // Land a few steps short of her spot, so she has a little walk to it.
      const short = clamp(station.spot - this.x, -unit * 0.35, unit * 0.35);
      const x = greeting
        ? this.x
        : clamp(station.spot - short, station.left + unit * 0.4, station.right - unit * 0.4);
      dest = { x, y: surfaceAt(station, x) };
    } else dest = { x: station.spot, y: surfaceAt(station, station.spot) };
    const pxPerY = deskScale(m).y;
    // Apex above the higher end, as model-unit clearances: a hop, a leap up, a drop.
    const clearance = greeting ? 0.05 : dest.y < from.y ? 0.06 : 0.04;
    let apex = Math.min(from.y, dest.y) - clearance * pxPerY;
    // From behind the TV she has to clear its top before coming round in front of it.
    if (this.behindTv) apex = Math.min(apex, deskPoint(0, m, TV_TOP + 0.04).y);
    const fall = dest.y - apex;
    const long = clamp((fall - 2 * unit) / (4 * unit));
    if (!greeting) {
      // A new station: its scene and routine play from the start.
      this.wait = 0;
      this.waved = false;
      this.sceneTime = 0;
      this.floorSteps = [];
      this.floorEpisode = null;
      this.floorHold = null;
      this.behind = false;
    }
    this.leap = {
      to,
      from,
      dest,
      t: 0,
      apex,
      // Cartoon physics: a long trip up or down the page gets a stronger pull, so no flight
      // lasts longer than MAX_AIR before tempo, whatever the distance. Same arc, quicker.
      ...flight(from.y - apex, fall, gravity),
      tempo: 1,
      land: LAND * (1 + 0.8 * long),
      impact: clamp(0.45 + fall / (0.2 * pxPerY)),
      long,
      greeting,
    };
    this.speed = 0;
  }
}
