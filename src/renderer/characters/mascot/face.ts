// Acting (face, head and body poses) for the mascot's joystick rig (lyla animation), in face-channel units
// (src/renderer/face/channels.ts). Ranges and channel meanings were probed with
// tools/expression-sheet/probe.mjs (see docs/character/RIG-SPEC.md):
// - brows only translate vertically: -1 lifts into a high arch, +1 drops them onto the glasses
//   rim, and beyond ~0.8 they vanish behind it. There is no inner/outer tilt, so anger and worry
//   read through brow height plus lids and mouth.
// - squint lowers the upper lid (flat top edge); blink brings the lash line down.
// - the mouth is a single stroked curve: smile bends it, mouthY lowers and widens it (no open
//   mouth or teeth), mouthX slides it.
// - gaze turns the whole face plane (no separate pupils).
import type { z } from 'zod';
import type { faceSchema } from '../../face/pose';
import { corePoses } from './acting/core';
import { facePoses } from './acting/faces';

export const mascotFace: z.input<typeof faceSchema> = {
  channels: {
    gazeX: { min: -1, max: 1 },
    gazeY: { min: -1, max: 1 },
    browL: { min: -1.25, max: 0.85 },
    browR: { min: -1.25, max: 0.85 },
    squintL: { min: 0, max: 0.9 },
    squintR: { min: 0, max: 0.9 },
    blinkL: { min: 0, max: 1 },
    blinkR: { min: 0, max: 1 },
    smile: { min: -1.25, max: 1.25 },
    mouthX: { min: -1, max: 1 },
    mouthY: { min: -1, max: 1 },
    squash: { min: -0.9, max: 0.7 },
    headTilt: { min: -0.24, max: 0.24 },
    // Head and body acting (probed: arms ~1.4 horizontal, ~2 raised overhead; beyond ~2.5 the
    // arm folds back toward the face).
    headY: { min: -0.03, max: 0.03 },
    lean: { min: -0.13, max: 0.13 },
    bob: { min: -0.04, max: 0.04 },
    shift: { min: -0.035, max: 0.035 },
    armL: { min: -0.4, max: 2.45 },
    armR: { min: -0.4, max: 2.45 },
    footLY: { min: 0, max: 0.06 },
    footRY: { min: 0, max: 0.06 },
  },
  mouthLag: 0.075,
  bodyLag: 0.06,
  blink: { rate: 17, hold: 0.04 },
  // Expressions acted with face, head and body (acting/core.ts), then face-led ones.
  poses: { ...facePoses, ...corePoses },
};
