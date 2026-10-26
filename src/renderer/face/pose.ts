// Face pose data model and pure sampling. Poses are data in a character manifest (`face.poses`),
// keyed by abstract expression id; nothing here names an expression or a rig part.
import { z } from 'zod';
import { expressionIds } from '../../../shared/expressions';
import { discreteChannels, faceChannels, type FaceChannel, type FaceValues } from './channels';

const channel = z.enum(faceChannels);
export const faceValuesSchema = z.partialRecord(channel, z.number());
export const facePoseSchema = z
  .object({
    /** The look at the expression's typical intensity (0.6). */
    pose: faceValuesSchema,
    /** The look at intensity 1. Defaults to `pose` pushed 35% further. */
    strong: faceValuesSchema.optional(),
    /** The look at intensity 0.25. Defaults to half of `pose`. */
    subtle: faceValuesSchema.optional(),
    /**
     * An accent at the start (startle, flinch) that eases into the pose over `seconds`.
     * Authored at full strength (intensity 1); weaker cues scale it down (accentGain).
     */
    onset: z
      .object({
        pose: faceValuesSchema,
        /** Seconds to ease from the accent into the pose. */
        seconds: z.number().positive().max(2),
        /** Seconds the accent holds before easing (a readable beat, e.g. Oops's grimace). */
        hold: z.number().min(0).max(2).optional(),
      })
      .strict()
      .optional(),
    /**
     * Timed offsets during the pose (an eye roll's path, a laugh's bounce): channel -> keys of
     * [seconds since start, value], smoothly interpolated. Repeats every `every` seconds if set.
     */
    keys: z
      .object({
        channels: z.partialRecord(
          channel,
          z.array(z.tuple([z.number().min(0), z.number()])).min(2),
        ),
        every: z.number().positive().optional(),
      })
      .strict()
      .optional(),
    /**
     * Turn toward the attention target: gaze, head tilt, lean and shift are authored for a
     * target on screen right and mirrored (arms swapped) for one on the left.
     */
    towardTarget: z.boolean().optional(),
    /**
     * An authored clip played alongside (role from the character's motion binding, e.g. "hips"),
     * from the cue start at `rate`; `pingPong` swings between two times (seconds) once reached.
     */
    clip: z
      .object({
        role: z.string().regex(/^[a-z0-9-]{1,32}$/),
        mix: z.number().min(0).max(1),
        rate: z.number().positive().max(4).optional(),
        start: z.number().min(0).optional(),
        pingPong: z.tuple([z.number().min(0), z.number().min(0)]).optional(),
      })
      .strict()
      .optional(),
    /** Living hold: never a frozen frame. */
    living: z
      .object({
        /** Micro-motion amount on brows, lids, mouth and gaze (0 still .. 1 restless). */
        drift: z.number().min(0).max(1).optional(),
        /** Blinks per minute while this pose dominates (0 = a stare). */
        blinkRate: z.number().min(0).max(60).optional(),
        /** Seconds a blink stays shut (slow deadpan or sleepy blinks). */
        blinkHold: z.number().min(0).max(1.5).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type FacePose = z.infer<typeof facePoseSchema>;

export const faceSchema = z
  .object({
    /** Safe range of every channel this rig supports. Other channels are never written. */
    channels: z.partialRecord(channel, z.object({ min: z.number(), max: z.number() }).strict()),
    /** Seconds the mouth trails the brows and eyes (overlapping action). */
    mouthLag: z.number().min(0).max(0.3).default(0.07),
    /** Seconds the body trails the face and head. */
    bodyLag: z.number().min(0).max(0.3).default(0.06),
    /** Blinks per minute and closed time when no pose says otherwise. */
    blink: z
      .object({ rate: z.number().min(0).max(60), hold: z.number().min(0).max(1) })
      .strict()
      .default({ rate: 17, hold: 0.04 }),
    poses: z.partialRecord(z.enum(expressionIds), facePoseSchema).default({}),
  })
  .strict();
export type CharacterFace = z.infer<typeof faceSchema>;

export const intensityStops = { subtle: 0.25, base: 0.6, strong: 1 } as const;

function scaled(values: FaceValues, factor: number): FaceValues {
  const out: FaceValues = {};
  for (const [name, value] of Object.entries(values) as [FaceChannel, number][])
    out[name] = value * factor;
  return out;
}
function lerpValues(a: FaceValues, b: FaceValues, t: number): FaceValues {
  const out: FaceValues = {};
  for (const name of faceChannels) {
    const from = a[name] ?? 0,
      to = b[name] ?? 0;
    if (from !== 0 || to !== 0) out[name] = from + (to - from) * t;
  }
  return out;
}
export function smoothstep(x: number) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/** Onsets and keys are authored at full strength and scale down gently with intensity. */
export function accentGain(intensity: number) {
  return Math.min(1, 0.35 + 0.65 * Math.max(0, intensity));
}

/** The held look for an intensity: 0 -> nothing, subtle at 0.25, pose at 0.6, strong at 1. */
export function poseAtIntensity(def: FacePose, intensity: number): FaceValues {
  const i = Math.max(0, Math.min(1, intensity));
  const blended = blendedPose(def, i);
  // Pose indices and switches are chosen, not scaled: strong's choice from 0.8, else the pose's.
  const out: FaceValues = {};
  for (const [name, value] of Object.entries(blended) as [FaceChannel, number][])
    if (!discreteChannels.has(name)) out[name] = value;
  for (const name of discreteChannels) {
    const chosen = i >= 0.8 ? (def.strong?.[name] ?? def.pose[name]) : def.pose[name];
    if (chosen !== undefined) out[name] = chosen;
  }
  return out;
}

function blendedPose(def: FacePose, i: number): FaceValues {
  const subtle = def.subtle ?? scaled(def.pose, 0.5);
  const strong = def.strong ?? scaled(def.pose, 1.35);
  const { subtle: s, base: b } = intensityStops;
  if (i <= s) return scaled(subtle, i / s);
  if (i <= b) return lerpValues(subtle, def.pose, (i - s) / (b - s));
  return lerpValues(def.pose, strong, (i - b) / (1 - b));
}

function sampleKeys(keys: readonly (readonly [number, number])[], t: number) {
  const first = keys[0],
    last = keys[keys.length - 1];
  if (!first || !last) return 0;
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  for (let index = 1; index < keys.length; index++) {
    const b = keys[index],
      a = keys[index - 1];
    if (a && b && t <= b[0]) {
      const span = Math.max(1e-6, b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * smoothstep((t - a[0]) / span);
    }
  }
  return last[1];
}

/**
 * The pose an expression wants `elapsed` seconds after it started, before living micro-motion,
 * blinks and springs. Pure: two renderers sharing the cue clock agree.
 */
export function sampleFacePose(def: FacePose, intensity: number, elapsed: number): FaceValues {
  let values = poseAtIntensity(def, intensity);
  const onsetEnd = def.onset ? (def.onset.hold ?? 0) + def.onset.seconds : 0;
  if (def.onset && elapsed < onsetEnd) {
    const accent = scaled(def.onset.pose, accentGain(intensity));
    const into = elapsed - (def.onset.hold ?? 0);
    values = lerpValues(accent, values, smoothstep(into / def.onset.seconds));
  }
  if (def.keys) {
    const t = def.keys.every ? elapsed % def.keys.every : elapsed;
    const gain = accentGain(intensity);
    for (const [name, keys] of Object.entries(def.keys.channels) as [
      FaceChannel,
      [number, number][],
    ][])
      values[name] = (values[name] ?? 0) + sampleKeys(keys, t) * gain;
  }
  return values;
}

/** Every channel a pose touches in any variant, onset or keys. */
export function poseChannels(def: FacePose): ReadonlySet<FaceChannel> {
  const names = new Set<FaceChannel>();
  for (const values of [def.pose, def.strong ?? {}, def.subtle ?? {}, def.onset?.pose ?? {}])
    for (const name of Object.keys(values) as FaceChannel[]) names.add(name);
  for (const name of Object.keys(def.keys?.channels ?? {}) as FaceChannel[]) names.add(name);
  return names;
}

/** Clamps values into a rig's safe ranges and drops channels it does not support. */
export function clampToRig(values: FaceValues, face: Pick<CharacterFace, 'channels'>) {
  const out: FaceValues = {};
  for (const [name, value] of Object.entries(values) as [FaceChannel, number][]) {
    const range = face.channels[name];
    if (!range) continue;
    out[name] = Math.min(range.max, Math.max(range.min, value));
  }
  return out;
}
