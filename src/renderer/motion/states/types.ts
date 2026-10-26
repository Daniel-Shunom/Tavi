// Vocabulary of the body-state layer (src/renderer/motion/states/). Character-agnostic: a
// character supplies a StateRig (key poses + contact geometry) next to its motion binding.
import type { Pose } from '../types';

/**
 * A key pose of a body state, in the facing-relative character space ("toward" = the side the
 * character faces).
 *  pose  additive pose channels (motion/types.ts units)
 *  lift  root height above the floor, body heights (world travel: ledges, jumps)
 *  dx/dy pose-local root offset, body heights (+x toward facing, +y down), e.g. after rotating
 *  rot   rotation about the soles, degrees, + = clockwise when facing right
 *  sleep 0..1 how much the state owns the face and body (asleep: expressions wait)
 */
export interface KeyPose {
  pose: Partial<Pose>;
  lift: number;
  dx: number;
  dy: number;
  rot: number;
  sleep: number;
}

export const restKey: KeyPose = { pose: {}, lift: 0, dx: 0, dy: 0, rot: 0, sleep: 0 };

/** A point on the character in rest space: body heights from the soles' centre (+x toward facing, +y up). */
export interface ContactPoint {
  x: number;
  y: number;
}

/** Named key poses the planner composes (all facing right, "toward" = screen right). */
export type KeyName =
  | 'crouch'
  | 'sitFloor'
  | 'sitLedge'
  | 'dozeFloor'
  | 'dozeLedge'
  | 'kneelProp'
  | 'lie'
  | 'stretch'
  | 'peek'
  | 'perch'
  | 'lean'
  | 'airTuck';

export interface StateRig {
  /** Key poses (pose channels only; lift/rotation are solved by the planner). */
  keys: Record<KeyName, Partial<Pose>>;
  /** Seat contact above the soles when seated on a ledge (body heights). */
  seatHeight: number;
  /** Lowest points of the lying silhouette: the head's side and the feet (lie pose). */
  lieContacts: { head: ContactPoint; feet: ContactPoint };
  /** Head contact for leaning (side of the head on the edge side, lean pose). */
  leanContact: ContactPoint;
  /** Head centre (for z z z and the nap shadow). */
  head: ContactPoint;
}
