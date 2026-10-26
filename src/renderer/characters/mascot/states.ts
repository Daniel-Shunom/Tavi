// Body-state key poses and contact geometry for the mascot rig, measured by rendering the real
// rig (docs/motion/BODY-STATES-RESEARCH.md, "How the rig numbers were measured"). Pose channels
// use motion/types.ts units: node offsets in artboard units / 600 (1 BH = 600 u); `armR` is
// mirrored by the binding (positive raises both arms outward).
import {
  sitFloorSlouch,
  sitFloorUpright,
  sitLedgeSlouch,
  sitLedgeUpright,
} from '../../motion/pose/library/sit';
import { holdPose } from '../../motion/pose/runtime';
import { peekAttentive, peekStandingVariants } from '../../motion/pose/library/peek';
import type { StateRig } from '../../motion/states/types';

const u = (value: number) => value / 600;

export const mascotStates: StateRig = {
  keys: {
    // Bird-like crouch: hips down 90 u, feet splayed 45 u (also the jump anticipation).
    crouch: { bob: u(90), footLX: -u(45), footRX: u(45), squash: 0.3 },
    // Sitting postures are authored as pose beats (pose/library/sit.ts): cross-legged on the
    // floor with the hands planted beside the knees; on an edge with the hands gripping it.
    sitFloor: holdPose(sitFloorUpright),
    sitLedge: holdPose(sitLedgeUpright),
    // Slumped where it sits (cross-legged like the floor sit), head lolled, hands in the lap.
    dozeFloor: {
      bob: u(106),
      footLX: 0.04,
      footRX: -0.02,
      footLY: 0.03,
      footRY: 0.03,
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
    // Chat reading stays standing; a seeded hold variant supplies the upper-body attitude.
    peek: holdPose(peekAttentive),
    perch: { bob: u(90), footLX: -u(45), footRX: u(45), armL: -0.2, armR: -0.2 },
    // Leaning back against an edge behind (opposite the facing side). The torso and head tip
    // slightly toward the edge so the hair, the widest point, makes the contact (measured).
    lean: {
      shift: u(10),
      lean: -0.04,
      headTilt: -0.06,
      footLX: u(20),
      footRX: u(34),
      armL: -0.15,
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
  leanContact: { x: -u(150), y: u(287) },
  head: { x: 0, y: u(345) },
  holds: {
    sit: { floor: [sitFloorUpright, sitFloorSlouch], ledge: [sitLedgeUpright, sitLedgeSlouch] },
    peek: { panel: peekStandingVariants },
  },
};
