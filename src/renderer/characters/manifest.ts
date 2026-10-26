// Character manifest contract. A manifest is the ONLY place that names renderer-specific details
// (asset file, artboard, animation clips, state machine inputs, nodes). Everything else refers to
// abstract expression ids from shared/expressions.ts and to the manifest's own track handles.
import { z } from 'zod';
import { expressionIds, targets } from '../../../shared/expressions';
import { choreographyIds } from '../../../shared/presence';
import type { CharacterCapabilities } from '../../../shared/capabilities';
import { faceSchema, poseAtIntensity } from '../face/pose';

const handle = z.string().regex(/^[a-z0-9.-]{1,48}$/, 'Use lower-case handles like "hair.pink"');
const unit = z.number().min(0).max(1);
export const trackSampleSchema = z
  .object({
    track: handle,
    /** Fixed normalized position in the clip (0..1). */
    at: unit.optional(),
    /** Play from..to across the anticipation + hold phases. */
    play: z.object({ from: unit, to: unit }).strict().optional(),
    /** Loop the clip every N seconds while active. */
    loop: z.number().positive().optional(),
    /**
     * With `play`: after reaching `to`, swing back and forth between from..to every N seconds
     * during the hold instead of stopping, so held poses stay alive.
     */
    pingpong: z.number().positive().optional(),
    mix: unit.default(1),
  })
  .strict();
export const transformSchema = z
  .object({
    x: z.number().optional(),
    y: z.number().optional(),
    rotation: z.number().optional(),
    scale: z.number().optional(),
  })
  .strict();
const bindingCore = z
  .object({
    tracks: z.array(trackSampleSchema).default([]),
    /** Host offsets at full weight, in reference pixels (720p) and degrees. */
    transform: transformSchema.optional(),
    oscillate: z
      .object({
        property: z.enum(['x', 'y', 'rotation', 'scale']),
        amplitude: z.number(),
        hz: z.number().positive(),
      })
      .strict()
      .optional(),
    presence: z.object({ peek: unit.optional(), tuck: unit.optional() }).strict().optional(),
    anticipation: z.number().min(0).max(2).optional(),
    recovery: z.number().min(0).max(3).optional(),
    /** Built from other clips and transforms rather than an authored native expression. */
    composed: z.boolean().default(false),
    /**
     * Hands the accent and hold to a motion-layer performance (e.g. "nod"). When a registered
     * motion layer lists this id in `performances`, the binding's own tracks and transforms are
     * skipped and the layer drives the expression; cue timing, priority and captions are kept.
     */
    motion: z
      .string()
      .regex(/^[a-z0-9-]{1,32}$/)
      .optional(),
  })
  .strict();
export const bindingSchema = bindingCore.extend({
  /** Intensity variants: subtle below 0.35, strong above 0.75. */
  variants: z
    .object({ subtle: bindingCore.optional(), strong: bindingCore.optional() })
    .strict()
    .optional(),
});
export type Binding = z.infer<typeof bindingSchema>;
export type BindingCore = z.infer<typeof bindingCore>;
export type TrackSample = z.infer<typeof trackSampleSchema>;

export const manifestSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,32}$/),
    name: z.string().min(1),
    credit: z.string(),
    creditUrl: z.string(),
    license: z.string(),
    renderer: z.literal('rive'),
    /** File name next to the manifest. */
    asset: z.string().regex(/^[\w.-]+\.riv$/),
    artboard: z.string(),
    stateMachine: z.string().nullable().default(null),
    /** Track handle -> clip name. The only place clip names may appear. */
    tracks: z.record(handle, z.string()),
    /** Input handle -> state machine input name. */
    inputs: z.record(handle, z.string()).default({}),
    /** Node handle -> artboard node/bone name, for motion layers. */
    nodes: z.record(handle, z.string()).default({}),
    /** Track handles exposed to motion layers (blink, sway...). */
    motionTracks: z.array(handle).default([]),
    /** Applied every frame before anything else to restore a neutral pose. */
    rest: z.array(trackSampleSchema).default([]),
    /** Ambient loop under everything (e.g. blinking); suppressed by reduced motion. */
    idleLoop: z.object({ track: handle, seconds: z.number().positive() }).strict().optional(),
    /** Width of the drawn box relative to its height. */
    aspect: z.number().positive().default(0.8),
    /**
     * Locomotion capability. "procedural": no authored walk; the motion layer synthesizes steps.
     * "clip": an authored walk cycle track, optionally with speed/direction state machine inputs.
     */
    locomotion: z
      .discriminatedUnion('mode', [
        z.object({ mode: z.literal('procedural') }).strict(),
        z
          .object({
            mode: z.literal('clip'),
            walk: handle,
            /** Reference-pixel distance covered by one walk cycle at speed 1. */
            stride: z.number().positive(),
            speedInput: handle.optional(),
            directionInput: handle.optional(),
          })
          .strict(),
      ])
      .default({ mode: 'procedural' }),
    expressions: z.partialRecord(z.enum(expressionIds), bindingSchema),
    fallbacks: z.partialRecord(z.enum(expressionIds), z.enum(expressionIds).nullable()).default({}),
    /** How the character orients toward each supported attention target. */
    attention: z.partialRecord(z.enum(targets), transformSchema).default({}),
    controls: z.object({ tuck: bindingSchema }).strict(),
    /**
     * Authored entrance/exit clips per choreography. Missing ones are performed procedurally by
     * the motion layer (or by the renderer's simple slide fallback).
     */
    choreographies: z
      .object({
        enter: z.partialRecord(z.enum(choreographyIds), bindingSchema).default({}),
        exit: z.partialRecord(z.enum(choreographyIds), bindingSchema).default({}),
      })
      .strict()
      .default({ enter: {}, exit: {} }),
    /**
     * Facial rig: supported face channels with safe ranges, and per-expression face poses that
     * the face layer (src/renderer/face/) blends additively over body bindings and motion.
     */
    face: faceSchema.optional(),
    appearance: z.record(
      z.string().regex(/^[a-z][a-z0-9-]{0,23}$/),
      z
        .object({
          label: z.string(),
          default: z.string(),
          options: z
            .array(
              z
                .object({
                  id: z.string().regex(/^[a-z0-9-]{1,24}$/),
                  label: z.string(),
                  track: handle,
                })
                .strict(),
            )
            .min(1),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((manifest, context) => {
    const known = new Set(Object.keys(manifest.tracks));
    const check = (track: string, path: (string | number)[]) => {
      if (!known.has(track))
        context.addIssue({ code: 'custom', message: `Unknown track handle "${track}"`, path });
    };
    const checkBinding = (binding: BindingCore, path: (string | number)[]) => {
      binding.tracks.forEach((sample, index) => {
        check(sample.track, [...path, 'tracks', index]);
      });
    };
    for (const [id, binding] of Object.entries(manifest.expressions)) {
      checkBinding(binding, ['expressions', id]);
      if (binding.variants?.subtle)
        checkBinding(binding.variants.subtle, ['expressions', id, 'subtle']);
      if (binding.variants?.strong)
        checkBinding(binding.variants.strong, ['expressions', id, 'strong']);
    }
    checkBinding(manifest.controls.tuck, ['controls', 'tuck']);
    manifest.rest.forEach((sample, index) => {
      check(sample.track, ['rest', index]);
    });
    manifest.motionTracks.forEach((track, index) => {
      check(track, ['motionTracks', index]);
    });
    if (manifest.idleLoop) check(manifest.idleLoop.track, ['idleLoop']);
    if (manifest.locomotion.mode === 'clip')
      check(manifest.locomotion.walk, ['locomotion', 'walk']);
    for (const [slot, value] of Object.entries(manifest.appearance)) {
      value.options.forEach((option, index) => {
        check(option.track, ['appearance', slot, 'options', index]);
      });
      if (!value.options.some((option) => option.id === value.default))
        context.addIssue({
          code: 'custom',
          message: 'Unknown default option',
          path: ['appearance', slot],
        });
    }
    if (manifest.face) {
      const face = manifest.face;
      for (const [id, pose] of Object.entries(face.poses)) {
        if (!Object.hasOwn(manifest.expressions, id))
          context.addIssue({
            code: 'custom',
            message: `Face pose for ${id}, which has no binding`,
            path: ['face', 'poses', id],
          });
        const looks = {
          pose: pose.pose,
          strong: poseAtIntensity(pose, 1),
          subtle: poseAtIntensity(pose, 0.25),
          ...(pose.onset ? { onset: pose.onset.pose } : {}),
        };
        for (const [look, values] of Object.entries(looks))
          for (const [channel, value] of Object.entries(values)) {
            const range = face.channels[channel as keyof typeof face.channels];
            if (!range || value < range.min || value > range.max)
              context.addIssue({
                code: 'custom',
                message: `${id}.${look}.${channel}=${String(value)} is outside the rig's safe range`,
                path: ['face', 'poses', id, look, channel],
              });
          }
      }
    }
    for (const [from, to] of Object.entries(manifest.fallbacks)) {
      if (to && !Object.hasOwn(manifest.expressions, to))
        context.addIssue({
          code: 'custom',
          message: `Fallback for ${from} points at unsupported ${to}`,
          path: ['fallbacks', from],
        });
    }
  });
export type CharacterManifest = z.infer<typeof manifestSchema>;
export type ManifestInput = z.input<typeof manifestSchema>;

export function capabilitiesOf(manifest: CharacterManifest): CharacterCapabilities {
  return {
    id: manifest.id,
    name: manifest.name,
    credit: manifest.credit,
    creditUrl: manifest.creditUrl,
    expressions: expressionIds.filter((id) => Object.hasOwn(manifest.expressions, id)),
    fallbacks: manifest.fallbacks,
    targets: targets.filter(
      (target) => target === 'neutral' || Object.hasOwn(manifest.attention, target),
    ),
    locomotion: manifest.locomotion.mode,
    appearance: Object.fromEntries(
      Object.entries(manifest.appearance).map(([slot, value]) => [
        slot,
        {
          label: value.label,
          default: value.default,
          options: value.options.map((option) => ({ id: option.id, label: option.label })),
        },
      ]),
    ),
  };
}
