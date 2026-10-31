import { z } from 'zod';
import { scriptSchema } from './cue.js';
import { expressionIdSchema, sequenceIdSchema, targetSchema } from './expressions.js';
import { anchorSchema, movementSchema, movementStyles, pointSchema } from './locomotion.js';
import { choreographyPreferenceSchema, presenceTransitionSchema } from './presence.js';
import type { CharacterCatalog } from './capabilities.js';
import {
  defaultWardrobe,
  normalizeWardrobe,
  wardrobeSchema,
  type ItemCatalog,
} from './wardrobe.js';
// Body states (sit, nap, peek...) and scene geometry: shared/states.ts.
import {
  defaultVariant,
  hairStyles,
  nearestSkinTone,
  variantSchema,
  withChanges,
} from './variants.js';
import { bodyCueSchema, defaultScene, requestableStates, sceneSchema } from './states.js';
import { defaultSupportSettings, supportPreviewSchema, supportSettingsSchema } from './support.js';

export const CONFIG_VERSION = 2;
/** Used when a saved character id is unknown. Characters themselves live in manifests. */
export const fallbackCharacterId = 'mascot-v2';
const slug = z.string().regex(/^[a-z0-9-]{1,24}$/);
export const configObjectSchema = z
  .object({
    version: z.literal(CONFIG_VERSION),
    name: z.string().trim().min(1).max(24),
    character: z.string().regex(/^[a-z0-9-]{1,32}$/),
    /** Appearance slot -> option id, validated against the character manifest by the service. */
    appearance: z.record(slug, slug),
    attitude: z.enum(['gentle', 'cheeky', 'spicy']),
    initiative: z.enum(['reserved', 'occasional', 'outgoing']),
    personality: z.enum(['cozy', 'playful', 'shy']),
    energy: z.number().min(0).max(100),
    chatEngagement: z.number().min(0).max(100),
    anchor: anchorSchema,
    x: z.number().min(0.08).max(0.92),
    y: z.number().min(0.35).max(0.95),
    captions: z.object({ studio: z.boolean(), overlay: z.boolean() }).strict(),
    /** Entrance/exit choreography for tuck away and bring back. */
    presenceStyle: choreographyPreferenceSchema,
    /** How it moves when the studio repositions it: auto (motion layer chooses) or a gait. */
    movementStyle: z.enum(movementStyles),
    /** Equipped attachments, tints and custom colours. Added after v2; defaulted on load. */
    wardrobe: wardrobeSchema,
    /** Webcam, game/VOD and chat rectangles and the floor line. Added after v2; defaulted on load. */
    scene: sceneSchema,
    /** Character variant (skin, build, face, hair, features). Added after v2; defaulted on load. */
    variant: variantSchema,
    /** Donation reaction thresholds and automatic support-event preference. */
    supportReactions: supportSettingsSchema,
  })
  .strict();
export type Config = z.infer<typeof configObjectSchema>;
export const defaults: Config = {
  version: CONFIG_VERSION,
  name: 'Tavi',
  character: fallbackCharacterId,
  appearance: {},
  attitude: 'cheeky',
  initiative: 'occasional',
  personality: 'cozy',
  energy: 40,
  chatEngagement: 20,
  anchor: 'webcam',
  x: 0.23,
  y: 0.72,
  captions: { studio: true, overlay: false },
  presenceStyle: 'random',
  movementStyle: 'auto',
  wardrobe: defaultWardrobe,
  scene: defaultScene,
  variant: defaultVariant,
  supportReactions: defaultSupportSettings,
};
const legacyAppearance = {
  riveHair: 'hair',
  riveOutfit: 'outfit',
  riveGlasses: 'glasses',
} as const;
const legacyRemoved = ['skin', 'hair', 'outfit', 'hairstyle', 'accessory'] as const;
/**
 * Upgrades saved configuration to the current version without losing name, personality or
 * placement. Version 1 (unversioned) files carried renderer-specific palette enums and unused
 * Pixi fields; palette values become generic appearance options (e.g. "light green" ->
 * "light-green") and the Pixi fields are dropped. Unknown values are left for validation.
 */
export function migrateConfig(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  const input = raw as Record<string, unknown>;
  if (input['version'] === CONFIG_VERSION) return { ...defaults, ...input };
  if (input['version'] !== undefined && input['version'] !== 1) return raw;
  const next: Record<string, unknown> = { ...defaults };
  const appearance: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key in legacyAppearance) {
      if (typeof value === 'string')
        appearance[legacyAppearance[key as keyof typeof legacyAppearance]] = value
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-');
    } else if (!(legacyRemoved as readonly string[]).includes(key) && key !== 'version')
      next[key] = value;
  }
  next['appearance'] = appearance;
  next['variant'] = legacyVariant(input);
  next['version'] = CONFIG_VERSION;
  return next;
}
/** Version 1 files carried a skin colour and a hairstyle name: keep them as variant choices. */
function legacyVariant(input: Record<string, unknown>) {
  const skin = input['skin'],
    hairstyle = input['hairstyle'];
  const tone =
    typeof skin === 'string' && /^#[0-9a-fA-F]{6}$/.test(skin) ? nearestSkinTone(skin) : undefined;
  const style = hairStyles.find((id) => id === hairstyle);
  if (!tone && !style) return defaultVariant;
  return withChanges(defaultVariant, {
    ...(tone ? { skin: { tone } } : {}),
    ...(style ? { hair: { style } } : {}),
  });
}
export const configSchema = z.preprocess(migrateConfig, configObjectSchema);
/** Keeps the character id and appearance consistent with what the manifests offer. */
export function normalizeConfig(
  input: Config,
  catalog: CharacterCatalog | undefined,
  items?: ItemCatalog,
): Config {
  const config = { ...input, wardrobe: normalizeWardrobe(input.wardrobe, items) };
  if (!catalog) return config;
  const character =
    catalog[config.character] ?? catalog[fallbackCharacterId] ?? Object.values(catalog)[0];
  if (!character) return config;
  const appearance: Record<string, string> = {};
  for (const [slot, definition] of Object.entries(character.appearance)) {
    const chosen = config.appearance[slot];
    appearance[slot] = definition.options.some((option) => option.id === chosen)
      ? (chosen as string)
      : definition.default;
  }
  return { ...config, character: character.id, appearance };
}

export const configPatchSchema = configObjectSchema.omit({ version: true }).partial().strict();
export const performanceSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    phase: z.enum(['idle', 'listening', 'thinking', 'reacting']),
    script: scriptSchema.nullable(),
    movement: movementSchema.nullable(),
    /** Latest entrance/exit. Hidden state is derived from it and `retracted`. */
    presence: presenceTransitionSchema.nullable(),
    /** Current body state (sit, nap, peek...); null = standing at home. */
    body: bodyCueSchema.nullable().default(null),
    note: z.string().max(400),
  })
  .strict();
export type PerformanceState = z.infer<typeof performanceSchema>;
export const stateSchema = z
  .object({
    config: configObjectSchema,
    retracted: z.boolean(),
    quiet: z.boolean(),
    performance: performanceSchema,
  })
  .strict();
export type State = z.infer<typeof stateSchema>;

const text = z.string().trim().min(1).max(280);
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('configure'), patch: configPatchSchema }).strict(),
  z
    .object({
      type: z.literal('perform'),
      expression: expressionIdSchema.optional(),
      sequence: sequenceIdSchema.optional(),
      intensity: z.number().min(0).max(1).optional(),
      target: targetSchema.optional(),
    })
    .strict()
    .refine(
      (value) => !!value.expression !== !!value.sequence,
      'Choose one expression or sequence.',
    ),
  z
    .object({
      type: z.literal('move'),
      kind: z.enum(['move-to', 'perch', 'wander', 'return']),
      anchor: anchorSchema.optional(),
      to: pointSchema.optional(),
    })
    .strict(),
  z.object({ type: z.literal('cancel') }).strict(),
  z
    .object({
      type: z.literal('retract'),
      value: z.boolean(),
      /** Overrides the saved presence style for this one transition. */
      choreography: choreographyPreferenceSchema.optional(),
    })
    .strict(),
  z.object({ type: z.literal('quiet'), value: z.boolean() }).strict(),
  /** Streamer-chosen body state from the studio (Sit, Nap, Peek at chat, Perch, Lean, Stand). */
  z
    .object({
      type: z.literal('state'),
      state: z.enum(requestableStates),
      /** Live ground position for the manual Stand action; home is a separate destination. */
      position: pointSchema.optional(),
    })
    .strict(),
  /** Typed streamer speech from the studio. Microphone transcription will use the same path. */
  z.object({ type: z.literal('say'), text }).strict(),
  /** Clearly-labelled simulated chat for testing without Twitch. */
  z.object({ type: z.literal('simulate'), source: z.literal('chat'), text }).strict(),
  /** A test event, never a claim that a donation or subscription was received. */
  z.object({ type: z.literal('preview-support-event'), event: supportPreviewSchema }).strict(),
]);
export type Command = z.infer<typeof commandSchema>;
export const serverMessageSchema = z.discriminatedUnion('type', [
  /** `now` is the service clock in ms, so clients render cues on a shared timeline. */
  z.object({ type: z.literal('state'), state: stateSchema, now: z.number() }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export function initialState(config: Config = defaults): State {
  return {
    config: { ...config },
    retracted: false,
    quiet: false,
    performance: {
      revision: 0,
      phase: 'idle',
      script: null,
      movement: null,
      presence: null,
      body: null,
      note: 'Ready to hang out.',
    },
  };
}
/** Pure configuration and control transitions. Performances are scheduled by the service. */
export function reduce(
  state: State,
  command: Command,
  catalog?: CharacterCatalog,
  items?: ItemCatalog,
): State {
  if (command.type === 'configure') {
    const { appearance, ...rest } = command.patch;
    const merged = configObjectSchema.parse({
      ...state.config,
      ...rest,
      appearance: { ...state.config.appearance, ...appearance },
    });
    return { ...state, config: normalizeConfig(merged, catalog, items) };
  }
  if (command.type === 'retract') return { ...state, retracted: command.value };
  if (command.type === 'quiet') return { ...state, quiet: command.value };
  return state;
}
