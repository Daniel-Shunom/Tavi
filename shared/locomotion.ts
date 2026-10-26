// Locomotion cues: WHERE Tavi goes and WHEN. HOW it walks (gait, path, facing, start/stop and
// settle) belongs to the motion layer (src/renderer/motion/). Movement runs in its own lane and
// overlaps freely with expressions: Tavi can wave or glance at chat while walking.
import { z } from 'zod';
import { decidedBySchema } from './cue.js';

/** Safe on-screen bounds, normalized to the overlay canvas. Matches config x/y limits. */
export const bounds = { minX: 0.08, maxX: 0.92, minY: 0.35, maxY: 0.95 } as const;
export const anchors = {
  webcam: { x: 0.23, y: 0.72, label: 'Webcam panel' },
  chat: { x: 0.82, y: 0.63, label: 'Chat panel' },
  corner: { x: 0.9, y: 0.92, label: 'Bottom corner' },
} as const;
export type AnchorId = keyof typeof anchors;
export const anchorIds = Object.keys(anchors) as [AnchorId, ...AnchorId[]];
export const anchorSchema = z.enum(anchorIds);

export const gaits = ['stroll', 'walk', 'hurry', 'tiptoe', 'hop'] as const;
export type Gait = (typeof gaits)[number];

export const movementKinds = {
  'move-to': {
    label: 'Move to',
    meaning: 'Walk to a point or named area and stay there until the cue ends.',
    useWhen: 'Going to look at chat up close, joining the streamer by the webcam.',
    avoidWhen: 'A reaction does not need movement; do not wander around constantly.',
  },
  perch: {
    label: 'Perch',
    meaning: 'Walk to a named area and settle in as if sitting or leaning there.',
    useWhen: 'Making itself at home at a favourite spot for a while.',
    avoidWhen: 'Quick reactions.',
  },
  wander: {
    label: 'Wander',
    meaning: 'A short, aimless stroll near home, then back.',
    useWhen: 'Boredom, idle downtime, or restlessness.',
    avoidWhen: 'Someone is talking to Tavi or the stream is busy.',
  },
  return: {
    label: 'Return home',
    meaning: 'Walk back to the streamer-chosen home position.',
    useWhen: 'Finishing a visit elsewhere.',
    avoidWhen: 'Already at home.',
  },
} as const;
export type MovementKind = keyof typeof movementKinds;
export const movementKindIds = Object.keys(movementKinds) as [MovementKind, ...MovementKind[]];

const point = z
  .object({
    x: z.number().min(bounds.minX).max(bounds.maxX),
    y: z.number().min(bounds.minY).max(bounds.maxY),
  })
  .strict();
export type Point = z.infer<typeof point>;
export const pointSchema = point;

export const movementSchema = z
  .object({
    id: z.string().max(64),
    sourceEventId: z.string().max(64),
    source: z.enum(['manual', 'streamer', 'chat', 'idle', 'config']),
    decidedBy: decidedBySchema,
    priority: z.number().int().min(0).max(4),
    kind: z.enum(movementKindIds),
    /** Resolved destination (always inside safe bounds). */
    to: point,
    anchor: anchorSchema.optional(),
    gait: z.enum(gaits).optional(),
    /** 0..1 hint; the motion layer maps it to the character's real speed. */
    speed: z.number().min(0).max(1).optional(),
    startAt: z.number(),
    expiresAt: z.number(),
    /** Seconds to stay after arriving before returning home; absent = stay until replaced. */
    stay: z.number().min(0).max(120).optional(),
  })
  .strict();
export type Movement = z.infer<typeof movementSchema>;

export function clampPoint(value: { x: number; y: number }): Point {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, value.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, value.y)),
  };
}
/** Deterministic small wander target near home, seeded by the cue id. */
export function wanderTarget(home: Point, seed: string): Point {
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  const direction = hash & 1 ? 1 : -1;
  const distance = 0.04 + ((hash >>> 1) % 40) / 1000;
  const sideways = home.x + direction * distance;
  return clampPoint({
    x:
      sideways > bounds.maxX - 0.02 || sideways < bounds.minX + 0.02
        ? home.x - direction * distance
        : sideways,
    y: home.y,
  });
}
/**
 * Where a character should be heading at `now`: the active movement's destination, or home.
 * Pure so studio, overlay and tests agree.
 */
export function locomotionTarget(
  movement: Movement | null,
  home: Point,
  now: number,
  arrivalSeconds = 0,
): { to: Point; movement: Movement | null } {
  if (!movement || now < movement.startAt || movement.kind === 'return')
    return { to: home, movement };
  if (
    movement.stay !== undefined &&
    now > movement.startAt + (arrivalSeconds + movement.stay) * 1000
  )
    return { to: home, movement: null };
  return { to: movement.to, movement };
}
