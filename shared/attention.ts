// Scene-aware attention: the ONE resolver that turns an attention target into a point on the
// overlay canvas from the live scene layout and Tavi's current position, and from that the
// direction, distance and side every layer uses (gaze, head tilt, lean, pointing, peeking,
// facing, the AI's spatial summary). All coordinates are normalized to the overlay canvas,
// with y pointing down.
import type { Target } from './expressions.js';
import { anchors, clampPoint, type AnchorId, type Point } from './locomotion.js';
import type { Scene, SceneRect } from './states.js';

export type AttentionTarget = Target;
export interface AttentionVector {
  target: AttentionTarget;
  /** Target point (canvas-normalized). */
  point: Point;
  /** From Tavi's head to the target (canvas-normalized; y down). */
  dx: number;
  dy: number;
  distance: number;
  /** Screen side of the target: -1 left, 1 right. Directly above/below keeps `facing`. */
  side: -1 | 1;
  /** Unit-ish gaze direction in screen space (x right, y down), components in -1..1. */
  gaze: { x: number; y: number };
  /** The target is behind the current facing (the head should turn first). */
  behind: boolean;
  /** Set when the layout lacks the rectangle and a fallback direction was used. */
  fallback?: string;
}
export interface AttentionInput {
  scene: Scene;
  /** Tavi's feet position (canvas-normalized), mid-walk included. */
  position: Point;
  /** Body height in canvas-normalized units (for the head position). */
  bodyHeight: number;
  /** Current facing: 1 right, -1 left. */
  facing?: -1 | 1;
  /** Studio pointer (canvas-normalized); ignored outside the studio. */
  pointer?: Point | null;
}

/** Tavi's head, about 80% of the body height above the feet. */
export function headPoint(position: Point, bodyHeight: number): Point {
  return { x: position.x, y: position.y - 0.8 * bodyHeight };
}
function nearestOnRect(rect: SceneRect, from: Point): Point {
  return {
    x: Math.min(rect.x + rect.w, Math.max(rect.x, from.x)),
    y: Math.min(rect.y + rect.h, Math.max(rect.y, from.y)),
  };
}
/** Where a target is, or a labelled fallback when the layout lacks it. */
export function targetPoint(
  target: AttentionTarget,
  input: AttentionInput,
): { point: Point; fallback?: string } | null {
  const head = headPoint(input.position, input.bodyHeight);
  const { scene } = input;
  switch (target) {
    case 'chat': {
      const rect = scene.chat;
      if (rect.enabled) {
        // Nearest point on the panel, pulled toward its centre so Tavi reads it, not its edge.
        const near = nearestOnRect(rect, head);
        const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
        return { point: { x: (near.x + centre.x) / 2, y: (near.y + centre.y) / 2 } };
      }
      return {
        point: { x: Math.min(1, head.x + 0.3), y: head.y },
        fallback: 'No chat panel is placed; looking to the right.',
      };
    }
    case 'streamer': {
      const rect = scene.webcam;
      // The face area: upper centre of the webcam frame.
      if (rect.enabled) return { point: { x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.35 } };
      return {
        point: { x: Math.max(0, head.x - 0.3), y: head.y },
        fallback: 'No webcam frame is placed; looking to the left.',
      };
    }
    case 'game': {
      const rect = scene.game;
      if (rect.enabled) return { point: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 } };
      return null;
    }
    case 'pointer':
      return input.pointer ? { point: input.pointer } : null;
    case 'neutral':
      return null;
  }
}
export function resolveAttention(
  target: AttentionTarget,
  input: AttentionInput,
): AttentionVector | null {
  const found = targetPoint(target, input);
  if (!found) return null;
  const head = headPoint(input.position, input.bodyHeight);
  const dx = found.point.x - head.x,
    dy = found.point.y - head.y;
  const distance = Math.hypot(dx, dy);
  const facing = input.facing ?? 1;
  // A target (nearly) straight above or below keeps the current facing instead of flipping.
  const side: -1 | 1 = Math.abs(dx) < 0.01 ? facing : dx < 0 ? -1 : 1;
  const scale = Math.max(distance, 0.08);
  const vector: AttentionVector = {
    target,
    point: found.point,
    dx,
    dy,
    distance,
    side,
    gaze: {
      x: Math.max(-1, Math.min(1, dx / scale)),
      y: Math.max(-1, Math.min(1, dy / scale)),
    },
    behind: Math.abs(dx) >= 0.01 && side !== facing,
  };
  if (found.fallback) vector.fallback = found.fallback;
  return vector;
}

/** Where Tavi stands to visit a named area, from the live scene (falls back to anchors). */
export function anchorPoint(anchor: AnchorId, scene: Scene): Point {
  if (anchor === 'chat' && scene.chat.enabled)
    return clampPoint({
      x: scene.chat.x + scene.chat.w / 2,
      y: scene.chat.y + scene.chat.h + 0.05,
    });
  if (anchor === 'webcam' && scene.webcam.enabled)
    return clampPoint({
      x: scene.webcam.x + scene.webcam.w / 2,
      y: scene.webcam.y + scene.webcam.h - 0.05,
    });
  return { x: anchors[anchor].x, y: anchors[anchor].y };
}

function direction(vector: AttentionVector): string {
  const horizontal = Math.abs(vector.dx) < 0.04 ? '' : vector.dx < 0 ? 'left' : 'right';
  const vertical = Math.abs(vector.dy) < 0.06 ? '' : vector.dy < 0 ? 'above' : 'below';
  if (horizontal && vertical) return `${vertical}-${horizontal}`;
  if (horizontal) return `to your ${horizontal}`;
  if (vertical) return vertical === 'above' ? 'above you' : 'below you';
  return 'right in front of you';
}
/** A short spatial summary for the AI, e.g. "chat is to your right; webcam is above-left". */
export function describeLayout(input: AttentionInput): string {
  const parts: string[] = [];
  for (const [target, label] of [
    ['chat', 'chat'],
    ['streamer', 'the webcam (streamer)'],
    ['game', 'the game'],
  ] as const) {
    const vector = resolveAttention(target, input);
    if (!vector || vector.fallback) continue;
    parts.push(`${label} is ${direction(vector)}`);
  }
  return parts.length ? parts.join('; ') + '.' : 'No layout has been placed.';
}
