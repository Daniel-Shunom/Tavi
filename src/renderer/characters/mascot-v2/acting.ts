// Lyla v2 acting: the mascot's poses plus the controls only the remixed rig has (elbows, hand
// poses, arms in front of the hair, brow tilt, pupils, and the Duolingo-style mouth library).
// Values as in src/renderer/face/channels.ts; hand poses 0 rest, 1 open palm, 2 fist, 3 point,
// 4 thumbs up; mouth shapes from ./mouth.ts (0 = the closed line, whose smile curve the base
// poses already drive).
import type { z } from 'zod';
import type { ExpressionId } from '../../../../shared/expressions';
import type { faceSchema } from '../../face/pose';
import type { ActingPose } from '../mascot/acting/types';
import { mascotFace } from '../mascot/face';
import { MOUTH_SHAPE_COUNT, mouthShapes as M } from './mouth';

type Values = ActingPose['pose'];
interface Extra {
  pose?: Values;
  strong?: Values;
  onset?: Values;
  keys?: NonNullable<ActingPose['keys']>['channels'];
}

const SAD = { browTiltL: -0.8, browTiltR: -0.8 };
const CROSS = { browTiltL: 0.8, browTiltR: 0.8 };

/** Hands, arms, brows and pupils. */
const body: Partial<Record<ExpressionId, Extra>> = {
  point: { pose: { handR: 3 }, strong: { handR: 3 } },
  shrug: {
    pose: { handL: 1, handR: 1, elbowL: 0.45, elbowR: 0.45, browTiltL: -0.4, browTiltR: -0.4 },
    strong: { handL: 1, handR: 1, elbowL: 0.7, elbowR: 0.7, browTiltL: -0.6, browTiltR: -0.6 },
  },
  excited: {
    pose: { handL: 2, handR: 2, armsFront: 1 },
    strong: { handL: 2, handR: 2, armsFront: 1 },
  },
  impressed: {
    pose: { handR: 4, armR: 0.6, elbowR: 1.4, armsFront: 1 },
    strong: { handR: 4, armR: 0.7, elbowR: 1.5, armsFront: 1 },
  },
  celebrate: { pose: { handL: 2, handR: 2 }, strong: { handL: 2, handR: 2 } },
  wave: { pose: { handR: 1 }, strong: { handR: 1 } },
  // Hands to the cheeks.
  shocked: {
    pose: { armL: 2.2, armR: 2.2, armsFront: 1, handL: 1, handR: 1 },
    strong: { armL: 2.3, armR: 2.3, armsFront: 1, handL: 1, handR: 1 },
  },
  // Pupils.
  'eye-roll': {
    keys: {
      pupilY: [
        [0, 0],
        [0.15, -1],
        [0.62, -1],
        [0.95, -0.3],
        [1.2, 0],
      ],
      pupilX: [
        [0, 0],
        [0.15, -0.8],
        [0.62, 0.8],
        [0.95, 0.3],
        [1.2, 0],
      ],
    },
  },
  suspicious: { pose: { browTiltL: 0.5, browTiltR: 0.5, pupilX: 0.8 } },
  thinking: { pose: { pupilX: 0.6, pupilY: -0.8 }, strong: { pupilX: 0.7, pupilY: -1 } },
  innocent: { pose: { pupilX: -0.8, pupilY: -0.6 } },
  embarrassed: { pose: { pupilX: -0.7, pupilY: 0.7 } },
  'look-away': { pose: { pupilX: -1, pupilY: -0.4 } },
  glance: { pose: { pupilX: 1 } },
  bored: { pose: { pupilY: 0.5 } },
  // Brow tilt: inner ends up for sad/worried, down for cross/focused.
  sad: { pose: SAD, strong: { browTiltL: -1, browTiltR: -1 } },
  worried: { pose: SAD, strong: { browTiltL: -1, browTiltR: -1 } },
  sympathetic: { pose: { browTiltL: -0.6, browTiltR: -0.6 }, strong: SAD },
  pout: {
    pose: { browTiltL: -0.4, browTiltR: -0.4 },
    strong: { browTiltL: -0.6, browTiltR: -0.6 },
  },
  frown: { pose: CROSS, strong: { browTiltL: 1, browTiltR: 1 } },
  annoyed: { pose: CROSS, strong: { browTiltL: 1, browTiltR: 1 } },
  'grossed-out': { pose: { browTiltL: 0.8, browTiltR: -0.3 } },
  determined: {
    pose: { browTiltL: 0.5, browTiltR: 0.5 },
    strong: { browTiltL: 0.8, browTiltR: 0.8 },
  },
  focused: { pose: { browTiltL: 0.4, browTiltR: 0.4 }, strong: { browTiltL: 0.6, browTiltR: 0.6 } },
  skeptical: { pose: { browTiltR: 0.6 }, strong: { browTiltR: 0.9 } },
};

/** Mouth per expression: a shape for the typical and strong look, plus the axes. */
const mouth = (
  shape: number,
  open = 0.5,
  extra: Omit<Values, 'mouthShape' | 'mouthOpen'> = {},
  strong?: { shape?: number; open?: number } & Omit<Values, 'mouthShape' | 'mouthOpen'>,
): Extra => {
  const {
    shape: strongShape = shape,
    open: strongOpen = Math.min(1, open + 0.3),
    ...rest
  } = strong ?? {};
  return {
    pose: { mouthShape: shape, mouthOpen: open, ...extra },
    strong: { mouthShape: strongShape, mouthOpen: strongOpen, ...extra, ...rest },
  };
};
const mouths: Partial<Record<ExpressionId, Extra>> = {
  // Joy: from a soft open smile up to a big D grin and a full laugh.
  amused: mouth(M.smileOpen, 0.45, {}, { shape: M.laugh, open: 0.6 }),
  excited: mouth(M.dGrin, 0.7, {}, { shape: M.dGrin, open: 1 }),
  grin: mouth(M.grinTeeth, 0.55, { mouthWide: 0.4 }, { shape: M.dGrin, open: 0.8 }),
  laugh: mouth(M.laugh, 0.8, {}, { open: 1 }),
  celebrate: mouth(M.laugh, 0.85, {}, { shape: M.dGrin, open: 1 }),
  wave: mouth(M.smileOpen, 0.5, {}, { shape: M.grinTeeth }),
  point: mouth(M.smileOpen, 0.35),
  // Surprise.
  impressed: mouth(M.oSmall, 0.55, {}, { shape: M.oBig, open: 0.45 }),
  startled: mouth(M.gasp, 0.7, {}, { shape: M.oBig, open: 0.9 }),
  shocked: mouth(M.oBig, 0.85, {}, { open: 1 }),
  // Cheek and attitude.
  smug: mouth(M.smirk, 0.45, { mouthTilt: 0.35 }),
  smirk: mouth(M.smirk, 0.5, { mouthTilt: 0.5 }),
  teasing: mouth(M.blep, 0.5),
  sassy: mouth(M.pout, 0.5, { mouthTilt: -0.3 }),
  'look-away': mouth(M.pout, 0.5),
  skeptical: mouth(M.flat, 0.5, { mouthTilt: 0.35 }),
  'eye-roll': mouth(M.flat, 0.5, { mouthTilt: 0.3 }),
  suspicious: mouth(M.flat, 0.5, { mouthTilt: -0.25, mouthWide: -0.3 }),
  deadpan: mouth(M.flat, 0.5),
  bored: mouth(M.flat, 0.5, { mouthTilt: 0.2 }),
  determined: mouth(M.flat, 0.5, { mouthWide: 0.2 }, { shape: M.grimace, open: 0.5 }),
  focused: mouth(M.flat, 0.5, { mouthWide: -0.3 }),
  disagreeing: mouth(M.flat, 0.5),
  // Unease and upset.
  confused: mouth(M.squiggle, 0.5),
  worried: mouth(M.worry, 0.45, {}, { open: 0.7 }),
  embarrassed: mouth(M.worry, 0.4, { mouthTilt: -0.2 }),
  frown: mouth(M.frownLine, 0.5, {}, { shape: M.wail, open: 0.35 }),
  sad: mouth(M.frownLine, 0.5, {}, { shape: M.wail, open: 0.55 }),
  pout: mouth(M.pout, 0.5),
  annoyed: mouth(M.flat, 0.5, { mouthTilt: 0.3 }, { shape: M.grimace, open: 0.4 }),
  wince: mouth(M.grimace, 0.55, { mouthTilt: 0.25 }, { open: 0.8 }),
  'grossed-out': mouth(M.grimace, 0.5, { mouthTilt: -0.45 }, { shape: M.wail, open: 0.6 }),
  // Oops: a grimace beat, then the nervous closed smile (the line).
  innocent: { pose: { mouthShape: M.line }, onset: { mouthShape: M.grimace } },
  // Sleepy: closed, then a yawn every few seconds (matches the base pose's yawn keys).
  sleepy: {
    keys: {
      mouthShape: [
        [0, 0],
        [0.75, M.yawn],
        [2.1, 0],
      ],
      mouthOpen: [
        [0.6, 0],
        [1.1, 0.9],
        [1.9, 0.9],
        [2.3, 0],
      ],
    },
  },
};

type Face = z.input<typeof faceSchema>;
type Pose = ActingPose;

function merge(pose: Pose, extra: Extra | undefined): Pose {
  if (!extra) return pose;
  return {
    ...pose,
    pose: { ...pose.pose, ...extra.pose },
    ...(pose.strong || extra.strong
      ? { strong: { ...(pose.strong ?? pose.pose), ...extra.strong } }
      : {}),
    ...(extra.onset
      ? {
          onset: {
            seconds: pose.onset?.seconds ?? 0.3,
            ...pose.onset,
            pose: { ...pose.onset?.pose, ...extra.onset },
          },
        }
      : {}),
    ...(extra.keys
      ? { keys: { ...pose.keys, channels: { ...pose.keys?.channels, ...extra.keys } } }
      : {}),
  };
}

export const mascotV2Face: Face = {
  ...mascotFace,
  channels: {
    ...mascotFace.channels,
    elbowL: { min: -2.2, max: 2.2 },
    elbowR: { min: -2.2, max: 2.2 },
    handL: { min: 0, max: 4 },
    handR: { min: 0, max: 4 },
    armsFront: { min: 0, max: 1 },
    mouthShape: { min: 0, max: MOUTH_SHAPE_COUNT - 1 },
    mouthOpen: { min: 0, max: 1 },
    mouthWide: { min: -1, max: 1 },
    mouthTilt: { min: -1, max: 1 },
    mouthPop: { min: 0, max: 1 },
    browTiltL: { min: -1, max: 1 },
    browTiltR: { min: -1, max: 1 },
    pupilX: { min: -1, max: 1 },
    pupilY: { min: -1, max: 1 },
    // Arms may reach the face when they are drawn in front of the hair.
    armL: { min: -0.4, max: 2.45 },
    armR: { min: -0.4, max: 2.45 },
  },
  poses: Object.fromEntries(
    Object.entries(mascotFace.poses ?? {}).map(([id, pose]) => [
      id,
      merge(merge(pose, body[id as ExpressionId]), mouths[id as ExpressionId]),
    ]),
  ),
};
