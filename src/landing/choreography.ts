// Scroll choreography for the landing page: a small, testable model of where Tavi is and what she
// is doing while the visitor scrolls. Everything here is authored local choreography (not AI).
//
// The story has two paced progress values. `p` (0..1) is the exit from the stream: notice the
// visitor, crouch and brace on the webcam's bottom edge, swing the legs over, drop to the monitor
// bezel, hurry along it, hop onto the ledge beside the copy and sit. It is rate limited so a fast
// scroll never turns the performance into a jump cut, held once at the edge ("Wait for me!") when
// the visitor runs ahead, and latched at 1: once she is on the ledge she never climbs back in.
// `q` (0..1) is the ending: drop from the ledge to the closing floor, walk beside the closing copy
// and present it; it scrubs backwards when the visitor scrolls up, which hops her back onto the
// ledge.
//
// Positions are the soles point in viewport pixels. Seated clips drop the hips onto that line and
// hang the legs below it, so a ledge is drawn at the soles line, behind the body.
import type { TrackApplication } from '../renderer/adapter';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Measures {
  vw: number;
  vh: number;
  scrollY: number;
  maxScroll: number;
  /** Webcam panel inside the stream (she starts on its bottom edge). */
  cam: Rect | null;
  /** The whole stream window (its bottom border is the bezel she drops onto). */
  screen: Rect | null;
  /** Closing copy block and the closing floor line. */
  copy: Rect | null;
  floor: Rect | null;
  mobile: boolean;
  /** Rendered artboard height in pixels (clip root motion scales with it). */
  bodyPx: number;
}

export type Stage =
  | 'idle'
  | 'notice'
  | 'crouch'
  | 'brace'
  | 'leg-over'
  | 'drop'
  | 'walk'
  | 'hop'
  | 'ledge'
  | 'end-drop'
  | 'end-walk'
  | 'present';

export interface Story {
  p: number;
  q: number;
  latched: boolean;
  held: boolean;
  holdUntil: number;
  /** Walk cycles travelled (fractional part is the gait phase). */
  walkPhase: number;
  /** When she arrived on the ledge (ms clock), for the sit-down one-shot. */
  arrivedAt: number;
  /** Last horizontal position, to count walk distance. */
  lastX: number | null;
}

export const initialStory = (): Story => ({
  p: 0,
  q: 0,
  latched: false,
  held: false,
  holdUntil: 0,
  walkPhase: 0,
  arrivedAt: 0,
  lastX: null,
});

interface Band {
  stage: Stage;
  from: number;
  to: number;
  /** Progress units per second when the visitor is ahead: the clip plays at its authored speed. */
  pace: number;
}

/** Exit bands. Paces are band width over the clip's authored length. */
export const EXIT: readonly Band[] = [
  { stage: 'idle', from: 0, to: 0.05, pace: 0.6 },
  { stage: 'notice', from: 0.05, to: 0.15, pace: 0.11 },
  { stage: 'crouch', from: 0.15, to: 0.2, pace: 0.1 },
  { stage: 'brace', from: 0.2, to: 0.3, pace: 0.3 },
  { stage: 'leg-over', from: 0.3, to: 0.48, pace: 0.12 },
  { stage: 'drop', from: 0.48, to: 0.7, pace: 0.15 },
  { stage: 'walk', from: 0.7, to: 0.88, pace: 0.14 },
  { stage: 'hop', from: 0.88, to: 1, pace: 0.1 },
];
/** Ending bands over `q`. */
export const ENDING: readonly Band[] = [
  { stage: 'ledge', from: 0, to: 0.5, pace: 0.6 },
  { stage: 'end-drop', from: 0.5, to: 0.72, pace: 0.15 },
  { stage: 'end-walk', from: 0.72, to: 0.88, pace: 0.23 },
  { stage: 'present', from: 0.88, to: 1, pace: 0.11 },
];

/** How long she holds the edge when the visitor scrolls ahead, ms. */
export const EDGE_HOLD_MS = 900;
/** Sit-down one-shot length after arriving on the ledge, ms. */
const SIT_DOWN_MS = 1000;
const SIT_LIFE_MS = 4000;
const BRACE_MS = 1600;
const PANIC_MS = 1200;
export const RELIEF_MS = 1200;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const smooth = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function band(bands: readonly Band[], value: number): { band: Band; t: number } {
  const last = bands[bands.length - 1] as Band;
  const found = bands.find((entry) => value < entry.to) ?? last;
  return { band: found, t: clamp01((value - found.from) / (found.to - found.from)) };
}

/** Requested exit progress from the scroll position: the first screen of scrolling. */
export function requestedExit(scrollY: number, vh: number) {
  // The climb-out is asked for while the webcam is still on screen: the story is complete by
  // the time the stream window's bottom edge has scrolled to mid-viewport.
  return clamp01(scrollY / Math.min(460, vh * 0.52));
}

/** Requested ending progress: the last 40% of a viewport of scrolling. */
export function requestedEnding(scrollY: number, maxScroll: number, vh: number) {
  if (maxScroll <= 0) return 0;
  return clamp01(1 - (maxScroll - scrollY) / (vh * 0.4));
}

/**
 * Advances the paced story toward what the scroll asks for. Returns the next story and whether
 * she is holding the edge waiting for the visitor (the "Wait for me!" bubble).
 */
export function stepStory(
  story: Story,
  requested: { exit: number; ending: number },
  now: number,
  dt: number,
  reduceMotion: boolean,
): { story: Story; waiting: boolean } {
  const exit = story.latched ? 1 : requested.exit;
  let { holdUntil, held } = story;
  let target = exit;
  // Hold the edge once when the visitor runs ahead while she is braced on it.
  const brace = EXIT.find((entry) => entry.stage === 'brace');
  if (brace && !held && story.p >= brace.from && story.p < brace.to && exit >= brace.to) {
    held = true;
    holdUntil = now + EDGE_HOLD_MS;
  }
  if (now < holdUntil) target = Math.min(target, story.p);
  const current = band(EXIT, story.p).band;
  const ahead = target >= story.p;
  // Authored speed when the visitor is just ahead; up to 2.5x when they have run far ahead, so
  // she catches up without the performance ever turning into a cut.
  const hurry = 1 + Math.min(1.5, Math.abs(target - story.p) * 3);
  const pace = (ahead ? current.pace : current.pace * 1.6) * hurry;
  const p = reduceMotion ? exit : story.p + clamp(target - story.p, -pace * dt, pace * dt);
  const latched = story.latched || p >= 0.999;
  // The ending only runs once she is on the ledge, and scrubs back when scrolling up.
  const ending = latched ? requested.ending : 0;
  const endBand = band(ENDING, story.q).band;
  const endPace = ending >= story.q ? endBand.pace : endBand.pace * 1.4;
  const q = reduceMotion
    ? ending
    : latched
      ? story.q + clamp(ending - story.q, -endPace * dt, endPace * dt)
      : 0;
  const arrivedAt = !story.latched && latched ? now : story.arrivedAt;
  const waiting = now < holdUntil && exit > story.p + 0.05;
  return {
    story: { ...story, p: latched ? 1 : p, q, latched, held, holdUntil, arrivedAt },
    waiting,
  };
}

export interface Placement {
  stage: Stage;
  /** Progress within the stage's clip, 0..1. */
  t: number;
  /** Soles point, viewport pixels. */
  x: number;
  y: number;
  /** Body turn toward screen right (+1) or left (-1); 0 faces the camera. */
  facing: number;
  /** Clip the character to this rectangle (inside the webcam glass). */
  clip: Rect | null;
  /** The ledge is part of the scene from the hop on. */
  ledge: number;
}

/** Where the ledge sits: beside the copy, half way down the viewport. */
export function ledgePoint(m: Measures) {
  // Phones have no free column, so she sits low in the corner like an overlay companion.
  return m.mobile
    ? { x: m.vw - 96, y: Math.round(m.vh - 150) }
    : { x: 118, y: Math.round(m.vh * 0.5) };
}

/** Fall curve for a drop clip: the body leaves at 0.27 and lands at 0.69 (authored contacts). */
function fall(t: number) {
  const u = clamp01((t - 0.27) / 0.42);
  return u * u * (3 - u) * 0.5;
}
/** The small lift of a push-off before a drop. */
const pushOff = (t: number) => -14 * Math.sin(Math.PI * clamp01((t - 0.1) / 0.24));

export function place(story: Story, m: Measures): Placement {
  const ledge = ledgePoint(m);
  const cam = m.cam ?? { left: m.vw * 0.56, top: m.vh * 0.32, width: 176, height: 230 };
  const screen = m.screen ?? { left: 0, top: 0, width: m.vw, height: m.vh * 0.85 };
  const camX = cam.left + cam.width / 2;
  const camFloor = cam.top + cam.height - 1;
  const bezel = screen.top + screen.height - 1;
  const inside: Placement = {
    stage: 'idle',
    t: 0,
    x: camX,
    y: camFloor,
    facing: 0,
    clip: cam,
    ledge: 0,
  };
  if (!story.latched) {
    const { band: exit, t } = band(EXIT, story.p);
    switch (exit.stage) {
      case 'idle':
      case 'notice':
      case 'crouch':
      case 'brace':
        return { ...inside, stage: exit.stage, t };
      case 'leg-over':
        return { ...inside, stage: exit.stage, t, clip: null };
      case 'drop':
        return {
          ...inside,
          stage: exit.stage,
          t,
          clip: null,
          y: camFloor + (bezel - camFloor) * fall(t) + pushOff(t),
        };
      case 'walk': {
        const dir = Math.sign(ledge.x - camX) || -1;
        const turn = Math.min(1, t / 0.12, (1 - t) / 0.12);
        return {
          ...inside,
          stage: exit.stage,
          t,
          clip: null,
          x: lerp(camX, ledge.x, smooth(t)),
          y: bezel,
          facing: dir * clamp01(turn),
        };
      }
      case 'hop': {
        const u = smooth((t - 0.28) / 0.5);
        const lift = 50 + Math.max(0, bezel - ledge.y) * 0.08;
        return {
          ...inside,
          stage: exit.stage,
          t,
          clip: null,
          x: ledge.x,
          y: lerp(bezel, ledge.y, u) - lift * 4 * u * (1 - u),
          ledge: clamp01((t - 0.2) / 0.4),
        };
      }
      default:
        break;
    }
  }
  const seated: Placement = {
    stage: 'ledge',
    t: 0,
    x: ledge.x,
    y: ledge.y,
    facing: 0,
    clip: null,
    ledge: 1,
  };
  const floorY = m.floor ? m.floor.top : m.vh - 150;
  const floorX = m.mobile
    ? m.vw - 92
    : m.copy
      ? clamp(m.copy.left - 128, 110, m.vw - 110)
      : m.vw * 0.22;
  const { band: end, t } = band(ENDING, story.q);
  switch (end.stage) {
    case 'end-drop':
      return {
        ...seated,
        stage: end.stage,
        t,
        y: ledge.y + (floorY - ledge.y) * fall(t) + pushOff(t),
      };
    case 'end-walk': {
      const dir = Math.sign(floorX - ledge.x) || 1;
      const turn = Math.min(1, t / 0.15, (1 - t) / 0.15);
      return {
        ...seated,
        stage: end.stage,
        t,
        x: lerp(ledge.x, floorX, smooth(t)),
        y: floorY,
        facing: dir * clamp01(turn),
      };
    }
    case 'present':
      return { ...seated, stage: end.stage, t, x: floorX, y: floorY };
    default:
      return seated;
  }
}

/** Two steps move 56 artboard units. The 600x600 board is contained in a 0.8-width portrait frame. */
export const walkCyclePx = (bodyPx: number) => (56 / 600) * bodyPx * 0.8;

/** Counts walk distance into the gait phase (capped so a scroll burst cannot blur the legs). */
export function advanceWalk(story: Story, x: number, dt: number, bodyPx: number): Story {
  const moved = story.lastX === null ? 0 : x - story.lastX;
  const cycles = clamp(moved / Math.max(walkCyclePx(bodyPx), 0.001), -2.6 * dt, 2.6 * dt);
  return { ...story, walkPhase: story.walkPhase + cycles, lastX: x };
}

/** Bound root movement to the authored gait so a fast scroll cannot outrun planted feet. */
export function limitWalkStep(previous: Story, next: Story, measures: Measures, dt: number): Story {
  const before = place(previous, measures);
  const after = place(next, measures);
  if (before.stage !== after.stage || (before.stage !== 'walk' && before.stage !== 'end-walk'))
    return next;
  const maxDistance = Math.max(0, dt) * walkCyclePx(measures.bodyPx) * 2.4;
  if (Math.abs(after.x - before.x) <= maxDistance) return next;
  const axis = before.stage === 'walk' ? 'p' : 'q';
  let low = 0;
  let high = 1;
  for (let i = 0; i < 18; i++) {
    const factor = (low + high) / 2;
    const candidate = { ...next, [axis]: lerp(previous[axis], next[axis], factor) };
    if (Math.abs(place(candidate, measures).x - before.x) <= maxDistance) low = factor;
    else high = factor;
  }
  return { ...next, [axis]: lerp(previous[axis], next[axis], low) };
}

const loop = (now: number, ms: number) => (now % ms) / ms;
const sample = (track: string, time: number, mix = 1): TrackApplication => ({
  track,
  time: clamp(time, 0, 0.999),
  mix,
});
/** Turn value (-1..1) on the authored 60-frame turnaround (frame 30 faces the camera). */
const turn = (value: number) => (value + 1) / 2;

/**
 * The clips to apply this frame, in order: the neutral base first, then the stage. `opening`
 * is the stream-start beat she performs inside the cam before any scrolling.
 */
export function stageTracks(
  placement: Placement,
  story: Story,
  now: number,
  opening: { streamStarted: boolean; startedAt: number; reducedMotion?: boolean },
): TrackApplication[] {
  const tracks = [sample('landing.rest', 0)];
  const { stage, t } = placement;
  switch (stage) {
    case 'idle': {
      if (!opening.streamStarted) tracks.push(sample('landing.panic', loop(now, PANIC_MS)));
      else {
        const since = now - opening.startedAt;
        if (since < RELIEF_MS) tracks.push(sample('landing.relief', since / RELIEF_MS));
        else if (!opening.reducedMotion) {
          const elapsed = since - RELIEF_MS - 6000;
          const duration = 2000;
          const interval = 18000;
          if (elapsed >= 0 && elapsed % interval < duration) {
            const t = (elapsed % interval) / duration;
            const clip = Math.floor(elapsed / interval) % 2 ? 'landing.relief' : 'landing.present';
            tracks.push(sample(clip, t, Math.sin(Math.PI * t) ** 2));
          }
        }
      }
      break;
    }
    case 'notice':
      tracks.push(sample('landing.notice', t));
      break;
    case 'crouch':
      tracks.push(sample('landing.crouch', t));
      break;
    case 'brace':
      tracks.push(sample('landing.brace', loop(now, BRACE_MS)));
      break;
    case 'leg-over':
      tracks.push(sample('landing.leg-over', t));
      break;
    case 'drop':
    case 'end-drop':
      tracks.push(sample('landing.drop', t));
      break;
    case 'walk':
    case 'end-walk':
      tracks.push(
        sample(
          'walk-cycle',
          ((story.walkPhase % 1) + 1) % 1,
          smooth(Math.min(t / 0.14, (1 - t) / 0.14)),
        ),
      );
      break;
    case 'hop':
      tracks.push(sample('landing.hop', t));
      break;
    case 'ledge': {
      const since = now - story.arrivedAt;
      if (story.arrivedAt && since < SIT_DOWN_MS)
        tracks.push(sample('landing.sit-down', since / SIT_DOWN_MS));
      else tracks.push(sample('landing.sit-life', loop(now, SIT_LIFE_MS)));
      break;
    }
    case 'present':
      tracks.push(sample('landing.present', t));
      break;
  }
  // Always write the neutral turn too: these clips affect shapes outside the reset-node set.
  tracks.push(sample('ctl.turn-body', turn(placement.facing)));
  tracks.push(sample('ctl.turn-head', turn(placement.facing * 0.8)));
  return tracks;
}

/** Expression the acting layer plays for a stage (face runs concurrently with the body). */
export function stageExpression(stage: Stage, opening: { streamStarted: boolean }) {
  switch (stage) {
    case 'idle':
      return opening.streamStarted ? 'content' : 'startled';
    case 'notice':
      return 'startled';
    case 'crouch':
    case 'brace':
      return 'determined';
    case 'leg-over':
      return 'focused';
    case 'drop':
    case 'end-drop':
    case 'hop':
      return 'excited';
    case 'walk':
    case 'end-walk':
      return 'determined';
    case 'present':
      return 'proud';
    case 'ledge':
      return null;
  }
}
