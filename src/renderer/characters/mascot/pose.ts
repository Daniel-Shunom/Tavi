// Kinematic proxy of the Lyla skeleton for the pose pipeline (src/renderer/motion/pose/),
// measured on Lyla v2 through the production binding with tools/pose-lab/measure.html (bone world
// transforms in rest space: body heights from the soles' centre, +y up). The v1 mascot has the same
// skeleton and art, but its binding drives only the shoulders: no elbows, hands or draw switch.
import type { ProxyRig } from '../../motion/pose/proxy';

const geometry: Omit<ProxyRig, 'id' | 'capabilities'> = {
  hips: { x: 0.012, y: 0.265 },
  torso: { x: 0.013, y: 0.226 },
  neck: { x: 0.013, y: 0.395 },
  shoulders: { L: { x: -0.039, y: 0.355 }, R: { x: 0.061, y: 0.355 } },
  upperArm: 0.087,
  // Forearm bone 0.078 plus the hand to the knuckles.
  foreArm: 0.09,
  handRadius: 0.045,
  armRest: { L: -1.998, R: -1.018 },
  foreRest: { L: 0.044, R: 0.042 },
  // armL + raises the left arm outward (clockwise), armR + the right (counter-clockwise).
  armSign: { L: -1, R: 1 },
  // Measured: elbowL + folds the left forearm inward, elbowR + swings the right one outward (the
  // v2 binding does not mirror the forearms; see docs/motion/POSING-AND-STAGING.md).
  elbowSign: { L: 1, R: 1 },
  legRoots: { L: { x: -0.02, y: 0.265 }, R: { x: 0.037, y: 0.265 } },
  thigh: 0.119,
  shin: 0.115,
  feet: { L: { x: -0.007, y: 0.031 }, R: { x: 0.038, y: 0.033 } },
  soleDrop: 0.032,
  head: { centre: { x: -0.008, y: 0.167 }, rx: 0.252, ry: 0.232 },
  seatBelowHips: 0.08,
  torsoHalf: { top: 0.06, hem: 0.14 },
};

export const lylaProxy: ProxyRig = {
  id: 'mascot',
  ...geometry,
  capabilities: { elbows: false, hands: false, armsFront: false },
};
export const lylaV2Proxy: ProxyRig = {
  id: 'mascot-v2',
  ...geometry,
  capabilities: { elbows: true, hands: true, armsFront: true },
};
