// Per-frame extension point for motion layers (procedural motion, locomotion, gaze, breathing).
// The expression system decides WHAT and WHEN; a motion layer decides HOW things move.
// Outputs refer only to manifest handles (motionTracks, nodes, inputs) and are combined
// additively over the base pose. Register from src/renderer/motion/ with registerMotionLayer().
import type { Target } from '../../shared/expressions';
import type { Movement, Point } from '../../shared/locomotion';
import type { PresenceTransition } from '../../shared/presence';
import type { NodeTransform, TrackApplication } from './adapter';
import type { CharacterManifest } from './characters/manifest';
import type { Offset } from './compose';
import type { ActiveLayer } from './timeline';

export interface MotionInput {
  /** Seconds since last frame (clamped to 0.1). */
  dt: number;
  /** Seconds of local animation time. */
  time: number;
  /** Active expression layers with intensity, phase and envelope weight. */
  layers: readonly ActiveLayer[];
  attention: { target: Target; weight: number; side: -1 | 1 } | null;
  persona: {
    attitude: 'gentle' | 'cheeky' | 'spicy';
    initiative: 'reserved' | 'occasional' | 'outgoing';
    personality: 'cozy' | 'playful' | 'shy';
    /** 0..100 */
    energy: number;
  };
  reducedMotion: boolean;
  quiet: boolean;
  retracted: boolean;
  /** Current entrance/exit cue (choreography + seed) and its fallback hidden amount 0..1. */
  presence: { transition: PresenceTransition | null; hidden: number; elapsed: number };
  /** Expressions handed to motion performances by the manifest (`binding.motion`). */
  performances: readonly { id: string; layer: ActiveLayer }[];
  /** The base pose this frame, before motion contributions. */
  base: { offset: Offset };
  locomotion: {
    /** Streamer-chosen home position (normalized). */
    home: Point;
    /** Where the current locomotion cue wants the character to be (normalized). */
    target: Point;
    /** Where the character currently is (normalized), as last reported. */
    position: Point;
    movement: Movement | null;
    /** Canvas size in CSS pixels, for converting speeds. */
    viewport: { width: number; height: number };
  };
  character: {
    id: string;
    motionTracks: readonly string[];
    nodes: readonly string[];
    inputs: readonly string[];
    locomotion: CharacterManifest['locomotion'];
    /** Soles above the artboard bottom (fraction of artboard height); the renderer already
     *  compensates, so placement and shadow y are the floor. */
    soleOffset: number;
  };
}
export interface MotionOutput {
  /** Extra track samples (handles from manifest.motionTracks or locomotion.walk). */
  tracks?: TrackApplication[];
  /** State machine input handle -> value. */
  inputs?: Record<string, number | boolean>;
  /** Node handle -> additive transform. */
  nodes?: Record<string, NodeTransform>;
  /** Added to the base pose offset (reference px, degrees; scale is additive). */
  offset?: Partial<Offset>;
  /** If set, the character's normalized position this frame (locomotion owns movement). */
  position?: Point;
  /** -1 faces left, 1 faces right. The renderer mirrors exactly when this changes. */
  facing?: -1 | 1;
  /**
   * Normalized y of a ground line below which the body is cut (climb, hop-off). null = no mask.
   * When absent during climb choreographies the renderer masks at the character's home line.
   */
  clipBelow?: number | null;
  /**
   * Soft contact shadow on the ground under the feet: normalized position like `position`,
   * scale 1 = standing, opacity 0..1. Shrinks and fades in the air; 0 while below the edge.
   */
  shadow?: { x: number; y: number; scale: number; opacity: number };
  /**
   * Set when the motion layer performs the entrance/exit itself; the renderer then skips its
   * slide-and-fade fallback and uses `hidden` (0 visible .. 1 gone) only for opacity.
   */
  presence?: { hidden: number };
}
export interface MotionLayer {
  /** Motion performance ids this layer performs (e.g. "nod"); their bindings defer to it. */
  readonly performances?: readonly string[];
  update(input: MotionInput): MotionOutput;
  dispose?(): void;
}
export type MotionLayerFactory = (manifest: CharacterManifest) => MotionLayer;

let factory: MotionLayerFactory | null = null;
const listeners = new Set<() => void>();
/** Installs the motion layer used by every Avatar. Returns an unregister function. */
export function registerMotionLayer(next: MotionLayerFactory) {
  factory = next;
  for (const listener of listeners) listener();
  return () => {
    if (factory === next) factory = null;
    for (const listener of listeners) listener();
  };
}
export function createMotionLayer(manifest: CharacterManifest): MotionLayer | null {
  return factory ? factory(manifest) : null;
}
export function onMotionLayerChange(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Fallback locomotion used when no motion layer supplies a position: eases toward the target at
 * a bounded speed. Deliberately simple; real gait comes from the motion layer.
 */
export function fallbackStep(
  position: Point,
  target: Point,
  dt: number,
  speed = 0.22,
  reducedMotion = false,
): Point {
  if (reducedMotion) return { ...target };
  const dx = target.x - position.x,
    dy = target.y - position.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-4) return { ...target };
  const step = Math.min(distance, speed * dt * Math.min(1, 0.35 + distance * 6));
  return { x: position.x + (dx / distance) * step, y: position.y + (dy / distance) * step };
}
