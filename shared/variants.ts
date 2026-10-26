// Character variant spec: the independent appearance axes a streamer picks in the creator (skin
// tone, undertone, face, build, age, eyes, hair style and colour, features, head covering).
// Every variant keeps the same rig, so motion, acting and attachments work unchanged; the
// renderer turns this spec into in-memory colour/proportion edits and hair/feature shape sets.
// Design rules and sources: docs/character/VARIANTS-RESEARCH.md. Depends only on zod.
import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #rrggbb');

/** Tones 1 (lightest) .. 10 (deepest), plus the mascot's original fantasy pink. */
export const skinTones = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'original'] as const;
export const undertones = ['warm', 'neutral', 'cool', 'olive'] as const;
export const faceShapes = ['round', 'soft-square', 'oval', 'heart', 'full'] as const;
export const builds = ['slim', 'average', 'broad', 'full'] as const;
export const ages = ['young', 'adult', 'elder'] as const;
export const eyeColors = ['dark-brown', 'brown', 'hazel', 'green', 'blue', 'grey', 'teal'] as const;
/** Ordered by research priority (VARIANTS-RESEARCH.md section 7). */
export const hairStyles = [
  'locs',
  'afro',
  'box-braids',
  'puffs',
  'bob',
  'pixie',
  'long',
  'top-bun',
  'bantu-knots',
  'cornrows',
  'waves',
  'ponytail',
  'curls',
  'shaved',
] as const;
export const headCoverings = ['none', 'hijab', 'dastar', 'headwrap'] as const;
export const facialHair = ['none', 'stubble', 'moustache', 'beard'] as const;
export const sides = ['none', 'left', 'right', 'both'] as const;
export const vitiligoAreas = ['none', 'face', 'hands', 'face-hands'] as const;

export type SkinTone = (typeof skinTones)[number];
export type Undertone = (typeof undertones)[number];
export type FaceShape = (typeof faceShapes)[number];
export type Build = (typeof builds)[number];
export type Age = (typeof ages)[number];
export type EyeColor = (typeof eyeColors)[number];
export type HairStyle = (typeof hairStyles)[number];
export type HeadCovering = (typeof headCoverings)[number];

export const variantSchema = z
  .object({
    /** Preset the streamer started from (informational; every field below is authoritative). */
    preset: z
      .string()
      .regex(/^[a-z0-9-]{1,32}$/)
      .optional(),
    skin: z.object({ tone: z.enum(skinTones), undertone: z.enum(undertones) }).strict(),
    face: z.enum(faceShapes),
    build: z.enum(builds),
    age: z.enum(ages),
    eyes: z.enum(eyeColors),
    hair: z
      .object({
        style: z.enum(hairStyles),
        /** Absent: the character's preset hair colour (e.g. the mascot's pink). */
        color: hex.optional(),
      })
      .strict(),
    features: z
      .object({
        freckles: z.boolean(),
        blush: z.boolean(),
        vitiligo: z.enum(vitiligoAreas),
        /** The character's own (built-in) glasses. Eyewear attachments still replace them. */
        glasses: z.boolean(),
        hearingAids: z.enum(sides),
        hearingAidColor: hex,
        facialHair: z.enum(facialHair),
        /** Prosthetic forearm on the character's left/right side. */
        prosthetic: z.enum(['none', 'left', 'right']),
        prostheticColor: hex,
      })
      .strict(),
    covering: z.object({ kind: z.enum(headCoverings), color: hex }).strict(),
  })
  .strict();
export type Variant = z.infer<typeof variantSchema>;

/** The mascot exactly as authored (alisketch's Lyla): saved companions keep looking the same. */
export const originalVariant: Variant = {
  preset: 'original',
  skin: { tone: 'original', undertone: 'neutral' },
  face: 'round',
  build: 'average',
  age: 'adult',
  eyes: 'teal',
  hair: { style: 'curls' },
  features: {
    freckles: false,
    blush: true,
    vitiligo: 'none',
    glasses: true,
    hearingAids: 'none',
    hearingAidColor: '#d9a066',
    facialHair: 'none',
    prosthetic: 'none',
    prostheticColor: '#5b6b7f',
  },
  covering: { kind: 'none', color: '#3f6f8f' },
};
/** Pending the user's decision on a different default (VARIANTS.md, decisions). */
export const defaultVariant: Variant = originalVariant;

/** True when the variant renders exactly like the shipped mascot (no file edits needed). */
export function isOriginal(variant: Variant) {
  return canonical({ ...variant, preset: undefined }) === canonical({ ...originalVariant, preset: undefined });
}
/** JSON with sorted keys, so equal variants compare equal whatever their key order. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}

export type VariantPatch = {
  [K in keyof Variant]?: Variant[K] extends object ? Partial<Variant[K]> : Variant[K];
};
/** Applies a partial change (one creator control) to a variant. */
export function withChanges(variant: Variant, patch: VariantPatch): Variant {
  return variantSchema.parse({
    ...variant,
    ...patch,
    skin: { ...variant.skin, ...patch.skin },
    hair: { ...variant.hair, ...patch.hair },
    features: { ...variant.features, ...patch.features },
    covering: { ...variant.covering, ...patch.covering },
  });
}
