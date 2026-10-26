// Shared vocabulary of the motion layer. Character-agnostic: a RigBinding maps these channels
// onto whatever a specific .riv exposes (see rigs/ and docs/motion/INTEGRATION.md).

export type Personality = 'cozy' | 'playful' | 'shy';
export type Attitude = 'gentle' | 'cheeky' | 'spicy';

export interface MotionSettings {
  personality: Personality;
  attitude: Attitude;
  /** 0-100, as in the saved character configuration. */
  energy: number;
  reducedMotion: boolean;
  /** Quiet mode: no initiative; keep calm life (breath, blinks, gaze) only. */
  quiet: boolean;
}

/**
 * Abstract procedural channels. Units:
 *  gaze*      -1..1 look direction (x: screen right, y: down)
 *  blink*     0 open .. 1 closed
 *  brow*      -1 raised .. 1 furrowed
 *  squint*    0 relaxed .. 1 lower lid up (smile eyes / suspicion)
 *  smile      -1 frown/"o" .. 1 smile
 *  mouthX/Y   -1..1 mouth offset (sideways smirk, open/drop)
 *  squash     -1 stretch .. 1 squash (volume-preserving, rig-authored)
 *  hair*      -1..1 secondary motion
 *  headTilt, lean, armL/armR  radians (armL/armR: positive raises the arm outward)
 *  bob, shift body offset in body heights (+bob = down/crouch)
 *  footLX..   foot offsets in body heights (+y = up/lift)
 *  "L"/"R" are screen-left / screen-right in the unmirrored artboard.
 */
export const channelNames = [
  'gazeX',
  'gazeY',
  'blinkL',
  'blinkR',
  'browL',
  'browR',
  'squintL',
  'squintR',
  'smile',
  'mouthX',
  'mouthY',
  'squash',
  'hairSwing',
  'hairSwoop',
  'hairSquash',
  'headTilt',
  'lean',
  'bob',
  'shift',
  'armL',
  'armR',
  'footLX',
  'footLY',
  'footRX',
  'footRY',
] as const;

export type Channel = (typeof channelNames)[number];
export type Pose = Record<Channel, number>;

export function neutralPose(): Pose {
  const pose = {} as Pose;
  for (const name of channelNames) pose[name] = 0;
  return pose;
}

/** Placement of the character on the stage, in normalised stage units. */
export interface Stage {
  /** Canvas width / height. */
  aspect: number;
  /** Rendered character height as a fraction of canvas height (e.g. 220/720). */
  bodyHeight: number;
  /** Safe horizontal margin as a fraction of width. */
  margin: number;
}

export interface MotionPlacement {
  /** Feet position: x as fraction of width, y as fraction of height (1 = bottom edge). */
  x: number;
  y: number;
  /** Lean around the feet, radians. */
  lean: number;
  /** 1 facing right (authored), -1 mirrored; values between while turning. */
  facing: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  /** When set, hide anything below this y (fraction of height): climbing out of an edge. */
  clipBelow: number | null;
}

export interface ClipRequest {
  /** Logical clip role from the manifest (e.g. 'wave'); the binding resolves the clip name. */
  role: string;
  time: number;
  mix: number;
  /** Channel groups this clip animates itself, so procedural writes yield to it. */
  owns?: readonly ('face' | 'body' | 'arms' | 'hair')[];
}

export interface MotionFrame {
  time: number;
  pose: Pose;
  clips: ClipRequest[];
  placement: MotionPlacement;
  /** What the layer is doing, for studio diagnostics and data attributes. */
  status: {
    expressions: string[];
    locomotion: string;
    choreography: string | null;
    fidget: string | null;
    hidden: boolean;
  };
}
