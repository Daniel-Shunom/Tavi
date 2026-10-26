// Lyla v2 acting: the mascot's poses plus the controls only the remixed rig has (elbows, hand
// poses, arms in front of the hair, brow tilt, a mouth that opens from its line). Values as in
// src/renderer/face/channels.ts; hand poses 0 rest, 1 open palm, 2 fist, 3 point, 4 thumbs up;
// mouthWide -1 round (O/U) .. 0.2 open (A) .. 0.8 wide (E).
import type { z } from 'zod';
import type { ExpressionId } from '../../../../shared/expressions';
import type { faceSchema } from '../../face/pose';
import type { ActingPose } from '../mascot/acting/types';
import { mascotFace } from '../mascot/face';

type Values = ActingPose['pose'];
interface Extra {
  pose?: Values;
  strong?: Values;
  keys?: NonNullable<ActingPose['keys']>['channels'];
}

const SAD = { browTiltL: -0.8, browTiltR: -0.8 };
const CROSS = { browTiltL: 0.8, browTiltR: 0.8 };

const extras: Partial<Record<ExpressionId, Extra>> = {
  // Hands and arms.
  point: { pose: { handR: 3 }, strong: { handR: 3 } },
  shrug: {
    pose: { handL: 1, handR: 1, elbowL: 0.45, elbowR: 0.45, browTiltL: -0.4, browTiltR: -0.4 },
    strong: { handL: 1, handR: 1, elbowL: 0.7, elbowR: 0.7, browTiltL: -0.6, browTiltR: -0.6 },
  },
  excited: {
    pose: { handL: 2, handR: 2, armsFront: 1, mouthOpen: 0.6, mouthWide: 0.2 },
    strong: { handL: 2, handR: 2, armsFront: 1, mouthOpen: 0.9, mouthWide: 0.2 },
  },
  impressed: {
    pose: { handR: 4, armR: 0.6, elbowR: 1.4, armsFront: 1, mouthOpen: 0.35, mouthWide: -0.7 },
    strong: { handR: 4, armR: 0.7, elbowR: 1.5, armsFront: 1, mouthOpen: 0.55, mouthWide: -0.7 },
  },
  celebrate: {
    pose: { handL: 2, handR: 2, mouthOpen: 0.7, mouthWide: 0.2 },
    strong: { handL: 2, handR: 2, mouthOpen: 1, mouthWide: 0.2 },
  },
  wave: {
    pose: { handR: 1, mouthOpen: 0.3, mouthWide: 0.8 },
    strong: { handR: 1, mouthOpen: 0.5 },
  },
  // Hands to the cheeks.
  shocked: {
    pose: {
      armL: 2.2,
      armR: 2.2,
      armsFront: 1,
      handL: 1,
      handR: 1,
      mouthOpen: 0.8,
      mouthWide: -0.7,
    },
    strong: {
      armL: 2.3,
      armR: 2.3,
      armsFront: 1,
      handL: 1,
      handR: 1,
      mouthOpen: 1,
      mouthWide: -0.7,
    },
  },
  // Mouths.
  startled: {
    pose: { mouthOpen: 0.7, mouthWide: -0.7 },
    strong: { mouthOpen: 1, mouthWide: -0.7 },
  },
  laugh: { pose: { mouthOpen: 0.85, mouthWide: 0.2 }, strong: { mouthOpen: 1, mouthWide: 0.2 } },
  amused: { pose: { mouthOpen: 0.3, mouthWide: 0.8 }, strong: { mouthOpen: 0.6, mouthWide: 0.2 } },
  grin: { pose: { mouthOpen: 0.35, mouthWide: 0.8 }, strong: { mouthOpen: 0.5, mouthWide: 0.8 } },
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
  sleepy: {
    keys: {
      mouthOpen: [
        [0.6, 0],
        [1.1, 0.9],
        [1.9, 0.9],
        [2.3, 0],
      ],
    },
  },
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

type Face = z.input<typeof faceSchema>;

export const mascotV2Face: Face = {
  ...mascotFace,
  channels: {
    ...mascotFace.channels,
    elbowL: { min: -2.2, max: 2.2 },
    elbowR: { min: -2.2, max: 2.2 },
    handL: { min: 0, max: 4 },
    handR: { min: 0, max: 4 },
    armsFront: { min: 0, max: 1 },
    mouthOpen: { min: 0, max: 1 },
    mouthWide: { min: -1, max: 1 },
    browTiltL: { min: -1, max: 1 },
    browTiltR: { min: -1, max: 1 },
    pupilX: { min: -1, max: 1 },
    pupilY: { min: -1, max: 1 },
    // Arms may reach the face when they are drawn in front of the hair.
    armL: { min: -0.4, max: 2.45 },
    armR: { min: -0.4, max: 2.45 },
  },
  poses: Object.fromEntries(
    Object.entries(mascotFace.poses ?? {}).map(([id, pose]) => {
      const extra = extras[id as ExpressionId];
      if (!extra) return [id, pose];
      return [
        id,
        {
          ...pose,
          pose: { ...pose.pose, ...extra.pose },
          ...(pose.strong || extra.strong
            ? { strong: { ...(pose.strong ?? pose.pose), ...extra.strong } }
            : {}),
          ...(extra.keys
            ? {
                keys: {
                  ...pose.keys,
                  channels: { ...pose.keys?.channels, ...extra.keys },
                },
              }
            : {}),
        },
      ];
    }),
  ),
};
