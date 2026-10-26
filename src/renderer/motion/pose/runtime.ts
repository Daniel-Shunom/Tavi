// Beats at runtime: a choreography `act` step that plays a Beat (choreography.ts), and key poses
// for the body-state planner (states/plan.ts). Beats are authored and solved against the Lyla
// skeleton (the proxy below); rigs without elbows fold the bend into the shoulder in their binding.
import { lylaV2Proxy } from '../../characters/mascot/pose';
import type { Pose } from '../types';
import type { ProxyRig } from './proxy';
import { sampleBeat } from './sample';
import { beatDuration, type Beat } from './schema';

/** The skeleton every library beat is solved on. */
export const authoringRig: ProxyRig = lylaV2Proxy;

export interface BeatFrame {
  pose: Partial<Pose>;
  /** Root height above the beat's floor or edge line (BH). */
  lift: number;
  scaleX: number;
  scaleY: number;
  /** The body is hidden below the beat's edge line. */
  clip: boolean;
  rot: number;
  dx: number;
  dy: number;
}

/** A beat sampled at `t` seconds, relative to its origin (lift is beat-space y of the soles). */
export function beatFrame(
  beat: Beat,
  t: number,
  seed = 0,
  rig: ProxyRig = authoringRig,
): BeatFrame {
  const s = sampleBeat(beat, t, rig, seed);
  return {
    pose: s.pose,
    lift: s.place.lift,
    scaleX: s.place.scaleX,
    scaleY: s.place.scaleY,
    clip: s.clipBelow !== null,
    rot: s.place.rot,
    dx: s.place.dx,
    dy: s.place.dy,
  };
}

/** Seconds of keyed motion (the living hold after it is open-ended). */
export function beatLength(beat: Beat) {
  return beatDuration(beat);
}
