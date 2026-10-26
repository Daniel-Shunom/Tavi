// The rig contract as the pose pipeline sees it: safe range and kind of every channel, and which
// channels only v2-contract rigs have (RIG-SPEC §1b). Ranges are the probed safe ranges
// (RIG-SPEC §1, EXPRESSIONS.md) widened where body states measured more (deep sit, lean, lie).
import type { Channel } from '../types';

export interface ChannelSpec {
  min: number;
  max: number;
  discrete?: boolean;
  /** Only rigs with the v2 contract have it; others ignore it. */
  v2?: boolean;
}

export const channelSpecs: Readonly<Record<Channel, ChannelSpec>> = {
  gazeX: { min: -1, max: 1 },
  gazeY: { min: -1, max: 1 },
  blinkL: { min: 0, max: 1 },
  blinkR: { min: 0, max: 1 },
  browL: { min: -1.25, max: 1 },
  browR: { min: -1.25, max: 1 },
  squintL: { min: 0, max: 1 },
  squintR: { min: 0, max: 1 },
  smile: { min: -1.25, max: 1.25 },
  mouthX: { min: -1, max: 1 },
  mouthY: { min: -1, max: 1 },
  squash: { min: -1.2, max: 1.2 },
  hairSwing: { min: -0.25, max: 0.25 },
  hairSwoop: { min: -0.18, max: 0.18 },
  hairSquash: { min: -0.06, max: 0.35 },
  headTilt: { min: -0.6, max: 0.6 },
  headY: { min: -0.06, max: 0.09 },
  lean: { min: -0.6, max: 0.6 },
  // Hips may not rise above standing while grounded (grounding contract); deep sit is 0.177.
  bob: { min: -0.004, max: 0.2 },
  shift: { min: -0.12, max: 0.12 },
  armL: { min: -0.8, max: 2.6 },
  armR: { min: -0.8, max: 2.6 },
  footLX: { min: -0.14, max: 0.14 },
  footLY: { min: -0.02, max: 0.24 },
  footRX: { min: -0.14, max: 0.14 },
  footRY: { min: -0.02, max: 0.24 },
  elbowL: { min: -2.4, max: 2.4, v2: true },
  elbowR: { min: -2.4, max: 2.4, v2: true },
  handL: { min: 0, max: 4, discrete: true, v2: true },
  handR: { min: 0, max: 4, discrete: true, v2: true },
  armsFront: { min: 0, max: 1, discrete: true, v2: true },
  mouthOpen: { min: 0, max: 1, v2: true },
  mouthWide: { min: -1, max: 1, v2: true },
  browTiltL: { min: -1, max: 1, v2: true },
  browTiltR: { min: -1, max: 1, v2: true },
  pupilX: { min: -1, max: 1, v2: true },
  pupilY: { min: -1, max: 1, v2: true },
};

/** Hand pose indices (handL/handR). */
export const hand = { rest: 0, open: 1, fist: 2, point: 3, thumb: 4 } as const;
