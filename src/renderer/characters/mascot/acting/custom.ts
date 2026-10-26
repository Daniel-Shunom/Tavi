// Short, deliberately staged gestures that work on the original rig and the v2 remix.
// Feet stay grounded: alternating heel lifts and weight shifts sell the dance without a jump.
import { pulses, shake, type ActingPoses } from './types';

export const customPoses: ActingPoses = {
  'perch-hesitate': {
    pose: { smile: 0.2, browL: -0.55, browR: -0.3 },
    strong: { smile: 0.3, browL: -0.85, browR: -0.45 },
    keys: {
      channels: {
        // Knees load, eyes check the ledge, then the weight unloads onto the same planted feet.
        bob: [
          [0, 0],
          [0.36, 0.018],
          [0.7, 0.018],
          [1.12, 0.004],
          [1.6, 0],
        ],
        squash: [
          [0, 0],
          [0.36, 0.22],
          [0.7, 0.18],
          [1.12, 0.035],
          [1.6, 0],
        ],
        gazeY: [
          [0, 0],
          [0.28, -0.45],
          [0.72, -0.45],
          [1.2, -0.1],
          [1.6, 0],
        ],
        armL: [
          [0, 0],
          [0.4, 0.18],
          [0.76, 0.18],
          [1.2, 0.08],
          [1.6, 0],
        ],
        armR: [
          [0, 0],
          [0.4, 0.18],
          [0.76, 0.18],
          [1.2, 0.08],
          [1.6, 0],
        ],
        headTilt: [
          [0, 0],
          [0.7, 0],
          [1.05, -0.07],
          [1.45, 0],
        ],
        browR: [
          [0, 0],
          [0.65, 0],
          [0.95, 0.45],
          [1.4, 0],
        ],
      },
    },
    living: { drift: 0.2, blinkRate: 12 },
  },
  'thank-you': {
    pose: {
      smile: 0.75,
      browL: -0.45,
      browR: -0.4,
      blinkL: 0.15,
      blinkR: 0.15,
      headTilt: 0.045,
      gazeX: 0.25,
      armR: 0.6,
      lean: 0.015,
    },
    strong: {
      smile: 1,
      browL: -0.65,
      browR: -0.6,
      blinkL: 0.25,
      blinkR: 0.25,
      headTilt: 0.07,
      gazeX: 0.35,
      armR: 0.7,
      lean: 0.025,
    },
    onset: { pose: { browL: -0.65, browR: -0.65, smile: 0.35 }, seconds: 0.25 },
    keys: {
      channels: {
        gazeY: [
          [0.3, 0],
          [0.6, 0.22],
          [1.05, -0.05],
          [1.4, 0],
        ],
        headY: [
          [0.3, 0],
          [0.6, 0.01],
          [1.05, -0.003],
          [1.4, 0],
        ],
        lean: [
          [0.38, 0],
          [0.7, 0.035],
          [1.15, 0],
        ],
        blinkL: pulses([0.47], 0.35, 0.36),
        blinkR: pulses([0.49], 0.35, 0.36),
      },
    },
    towardTarget: true,
    living: { drift: 0.25, blinkRate: 12 },
  },
  'happy-dance': {
    pose: {
      smile: 1,
      mouthY: 0.35,
      browL: -0.7,
      browR: -0.65,
      blinkL: 0.25,
      blinkR: 0.25,
      armL: 0.65,
      armR: 0.65,
      bob: 0.006,
    },
    strong: {
      smile: 1.2,
      mouthY: 0.55,
      browL: -0.95,
      browR: -0.9,
      blinkL: 0.4,
      blinkR: 0.4,
      armL: 0.8,
      armR: 0.8,
      bob: 0.01,
    },
    onset: { pose: { bob: 0.018, squash: 0.2, armL: 0.25, armR: 0.25 }, seconds: 0.24 },
    keys: {
      channels: {
        shift: shake(0.25, 0.44, 0.022, 4),
        lean: shake(0.34, 0.44, -0.055, 4),
        headTilt: shake(0.43, 0.44, 0.08, 4),
        armL: pulses([0.4, 1.28], 0.3, 0.36),
        armR: pulses([0.84, 1.72], 0.3, 0.36),
        footLY: pulses([0.4, 1.28], 0.025, 0.32),
        footRY: pulses([0.84, 1.72], 0.025, 0.32),
        squash: pulses([0.65, 1.09, 1.53, 1.97], 0.08, 0.18),
      },
      every: 2.5,
    },
    living: { drift: 0.35, blinkRate: 9 },
  },
};
