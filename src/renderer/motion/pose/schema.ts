// Pose as data. A Beat is a short performance (a choreography beat, a state's enter/exit, or a
// held pose with its life) written as key poses with timing and easing, the contacts each key
// makes with the scene, hand targets the solver keeps planted, and what the scene hides (clip).
// Channels are the motion layer's (motion/types.ts); the v2 rig contract (RIG-SPEC §1b) defines
// what they do, and `contract.ts` their safe ranges. Rigs without the v2 extras use a fallback.
import { z } from 'zod';
import { channelNames } from '../types';

export const channelSchema = z.enum(channelNames);
export const poseValuesSchema = z.partialRecord(channelSchema, z.number());

export const placementSchema = z
  .object({
    /** Soles above the beat's floor line (BH); negative = below an edge. */
    lift: z.number(),
    /** Pose-local offset (+x toward facing, +y down), BH. */
    dx: z.number(),
    dy: z.number(),
    /** Degrees about the soles, + clockwise when facing right. */
    rot: z.number().min(-120).max(120),
    scaleX: z.number().min(0.5).max(1.6),
    scaleY: z.number().min(0.5).max(1.6),
  })
  .partial()
  .strict();

/** Horizontal lines (floor, ledge) and vertical lines (wall) in beat space (BH from the anchor). */
export const surfaceSchema = z
  .object({
    id: z.string().regex(/^[a-z][\w-]*$/),
    kind: z.enum(['floor', 'ledge', 'wall']),
    /** y of a floor or ledge; x of a wall. */
    at: z.number(),
    /** Extent along the line (optional, for drawing). */
    from: z.number().optional(),
    to: z.number().optional(),
  })
  .strict();

export const partIds = [
  'soleL',
  'soleR',
  'seat',
  'handL',
  'handR',
  'kneeL',
  'kneeR',
  'head',
] as const;
export const partSchema = z.enum(partIds);
export type PartId = (typeof partIds)[number];

export const contactSchema = z
  .object({
    part: partSchema,
    surface: z.string(),
    /** Allowed distance from the surface (BH); default 0.012 (about 2 px at 720p). */
    tolerance: z.number().positive().max(0.1).optional(),
  })
  .strict();

const point = z.object({ x: z.number(), y: z.number() }).strict();
export const reachSchema = z
  .object({
    /** Hand target in beat space, or `surface` + x to sit on a surface line. */
    at: point,
    bend: z.enum(['out', 'in', 'down', 'up']).optional(),
  })
  .strict();

export const easeSchema = z.enum(['linear', 'in', 'out', 'inOut', 'hold', 'overshoot']);
export type Ease = z.infer<typeof easeSchema>;

export const keySchema = z
  .object({
    name: z.string().min(1),
    /** Seconds from the beat start. */
    at: z.number().min(0),
    /** Easing into this key from the previous one. */
    ease: easeSchema.default('inOut'),
    pose: poseValuesSchema.default({}),
    place: placementSchema.default({}),
    contacts: z.array(contactSchema).default([]),
    /** Hand targets the solver holds (hands planted on an edge, a knee, the chin). */
    reach: z.object({ L: reachSchema.optional(), R: reachSchema.optional() }).strict().default({}),
    /** Hide the body below this surface line while in this key's segment. */
    clipBelow: z.string().nullable().default(null),
    /** Where discrete channels (hand poses, draw order) switch, 0..1 into the segment. */
    switchAt: z.number().min(0).max(1).default(0.5),
    /** Pose meant to be symmetric (skips the twins warning). */
    symmetric: z.boolean().default(false),
    /** Fast moves allowed to exceed the pop threshold (impacts, snaps). */
    fast: z.boolean().default(false),
    note: z.string().optional(),
  })
  .strict();

export const lifeSchema = z
  .object({
    channel: channelSchema,
    amplitude: z.number(),
    /** Seconds per cycle (sine), or the mean interval between bumps. */
    period: z.number().positive(),
    shape: z.enum(['sine', 'noise', 'bump']).default('sine'),
    phase: z.number().default(0),
    /** Bump length (s). */
    length: z.number().positive().optional(),
  })
  .strict();

export const beatSchema = z
  .object({
    id: z.string().regex(/^[a-z][\w-]*$/),
    label: z.string(),
    /** What uses it: a choreography beat, a state transition or a state's held pose. */
    use: z.enum(['choreography', 'enter', 'exit', 'hold', 'gesture']),
    /**
     * Where the beat's origin sits in the scene (for the pose lab and the runtime): `floor` = the
     * floor under the soles, `ledge` = a seat or standing point on a frame's top edge, `edge` = the
     * ground line used as an edge to climb over or sink behind.
     */
    frame: z.enum(['floor', 'ledge', 'edge']).default('floor'),
    surfaces: z.array(surfaceSchema).default([{ id: 'floor', kind: 'floor', at: 0 }]),
    keys: z.array(keySchema).min(1),
    /** Living hold layered over the last key after the keys finish (and over `hold` beats). */
    life: z.array(lifeSchema).default([]),
    notes: z.string().optional(),
  })
  .strict();

export type PoseValues = z.infer<typeof poseValuesSchema>;
export type Surface = z.infer<typeof surfaceSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type Key = z.infer<typeof keySchema>;
export type KeyInput = z.input<typeof keySchema>;
export type Life = z.infer<typeof lifeSchema>;
export type Beat = z.infer<typeof beatSchema>;
export type BeatInput = z.input<typeof beatSchema>;

/** Validates and fills defaults; keys must be in time order. */
export function defineBeat(input: BeatInput): Beat {
  const beat = beatSchema.parse(input);
  for (let i = 1; i < beat.keys.length; i++) {
    const previous = beat.keys[i - 1],
      key = beat.keys[i];
    if (previous && key && key.at <= previous.at)
      throw new Error(`${beat.id}: key "${key.name}" is not after "${previous.name}"`);
  }
  const ids = new Set(beat.surfaces.map((s) => s.id));
  for (const key of beat.keys) {
    for (const contact of key.contacts)
      if (!ids.has(contact.surface))
        throw new Error(`${beat.id}/${key.name}: unknown surface ${contact.surface}`);
    if (key.clipBelow && !ids.has(key.clipBelow))
      throw new Error(`${beat.id}/${key.name}: unknown clip surface ${key.clipBelow}`);
  }
  return beat;
}

export function beatDuration(beat: Beat) {
  return beat.keys[beat.keys.length - 1]?.at ?? 0;
}
