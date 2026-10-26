// Body-state key poses and contact geometry for the mascot rig, measured by rendering the real
// rig (docs/motion/BODY-STATES-RESEARCH.md, "How the rig numbers were measured"). Pose channels
// use motion/types.ts units: node offsets in artboard units / 600 (1 BH = 600 u); `armR` is
// mirrored by the binding (positive raises both arms outward).
import type { StateRig } from '../../motion/states/types';

const u = (value: number) => value / 600;

export const mascotStates: StateRig = {
  keys: {
    // Bird-like crouch: hips down 90 u, feet splayed 45 u (also the jump anticipation).
    crouch: { bob: u(90), footLX: -u(45), footRX: u(45), squash: 0.3 },
    // Splayed floor sit: the seat (skirt hem) meets the floor at hips down ~106 u (measured;
    // deeper sinks the skirt below the floor). Feet stay planted, splayed 55 u.
    sitFloor: {
      bob: u(106),
      footLX: -u(55),
      footRX: u(55),
      squash: 0.45,
      armL: -0.2,
      armR: -0.2,
    },
    // Seated on an edge: feet lifted 18 u brings the knees toward the camera; hands on the edge.
    sitLedge: {
      bob: u(10),
      footLX: -u(8),
      footRX: u(8),
      footLY: u(18),
      footRY: u(18),
      armL: 0.4,
      armR: 0.4,
    },
    dozeFloor: {
      bob: u(106),
      footLX: -u(55),
      footRX: u(55),
      headTilt: 0.38,
      headY: u(35),
      lean: 0.14,
      armL: -0.3,
      armR: -0.2,
      squash: 0.7,
      gazeY: 1,
      mouthY: 0.35,
      smile: 0.1,
    },
    dozeLedge: {
      bob: u(10),
      footLX: -u(8),
      footRX: u(8),
      footLY: u(14),
      footRY: u(14),
      headTilt: 0.3,
      headY: u(25),
      lean: 0.1,
      armL: 0.3,
      armR: 0.3,
      gazeY: 1,
      mouthY: 0.3,
    },
    // Getting down / up: one hand on the floor, torso over it (placement rotated by the planner).
    kneelProp: {
      bob: u(106),
      shift: -u(20),
      footLX: -u(55),
      footRX: u(55),
      lean: 0.35,
      armL: 0.9,
      headTilt: -0.2,
    },
    // Side-lie, head toward the back: hips shifted 40 u, feet stacked and drawn up a little.
    lie: {
      shift: -u(40),
      footLX: -u(35),
      footRX: -u(50),
      footLY: u(20),
      footRY: u(35),
      headTilt: -0.1,
      armL: -0.2,
      armR: 0.3,
      squash: 0.4,
      mouthY: 0.2,
    },
    // Wake-up V-stretch: arms vanish behind the head above ~1.6 rad, so 1.5 is the limit.
    stretch: {
      armL: 1.5,
      armR: 1.5,
      squash: -1,
      headTilt: 0.12,
      mouthY: 1,
      smile: -0.4,
    },
    // Lean in toward a panel on the facing side, eyes up on the messages.
    peek: {
      bob: u(40),
      shift: u(30),
      lean: -0.38,
      headTilt: -0.3,
      footLX: -u(15),
      footRX: u(40),
      armR: -0.15,
      gazeX: 1,
      gazeY: -0.4,
      browL: -0.6,
      browR: -0.6,
    },
    perch: { bob: u(90), footLX: -u(45), footRX: u(45), armL: -0.2, armR: -0.2 },
    // Leaning back against an edge behind (opposite the facing side).
    lean: {
      shift: u(25),
      lean: 0.12,
      headTilt: 0.1,
      footLX: u(30),
      footRX: u(40),
      armL: -0.2,
    },
    airTuck: { footLY: u(30), footRY: u(30), bob: u(20), armL: 0.6, armR: 0.6 },
  },
  // Seat (bottom of the skirt, hips +10 u) about 105 u above the soles.
  seatHeight: u(105),
  lieContacts: {
    // Widest point of the hair (152 u from centre, 297 u above the soles), shifted with the hips.
    head: { x: -u(152 + 40), y: u(297) },
    feet: { x: -u(42), y: u(18) },
  },
  leanContact: { x: -u(152 - 25), y: u(297) },
  head: { x: 0, y: u(345) },
};
