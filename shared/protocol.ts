import { z } from 'zod';
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
export const configSchema = z
  .object({
    name: z.string().trim().min(1).max(24),
    riveHair: z.enum(['Pink', 'Orange', 'Brown']).default('Pink'),
    riveOutfit: z.enum(['green', 'black', 'light green']).default('green'),
    riveGlasses: z.enum(['blue', 'white', 'grey']).default('blue'),
    attitude: z.enum(['gentle', 'cheeky', 'spicy']).default('cheeky'),
    skin: color,
    hair: color,
    outfit: color,
    hairstyle: z.enum(['bob', 'short', 'buns']),
    accessory: z.enum(['none', 'glasses', 'headphones']),
    personality: z.enum(['cozy', 'playful', 'shy']),
    energy: z.number().min(0).max(100),
    chatEngagement: z.number().min(0).max(100),
    anchor: z.enum(['webcam', 'chat', 'corner']),
    x: z.number().min(0.08).max(0.92),
    y: z.number().min(0.35).max(0.95),
  })
  .strict();
export type Config = z.infer<typeof configSchema>;
export const gestureSchema = z.enum([
  'wave',
  'smile',
  'surprise',
  'point',
  'peek',
  'idle',
  'listening',
  'skeptical',
  'caught',
  'nod',
  'celebrate',
  'scene',
]);
export type Gesture = z.infer<typeof gestureSchema>;
export const commandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('configure'),
      patch: configSchema.partial().extend({
        riveHair: configSchema.shape.riveHair.removeDefault().optional(),
        riveOutfit: configSchema.shape.riveOutfit.removeDefault().optional(),
        riveGlasses: configSchema.shape.riveGlasses.removeDefault().optional(),
        attitude: configSchema.shape.attitude.removeDefault().optional(),
      }),
    })
    .strict(),
  z.object({ type: z.literal('gesture'), gesture: gestureSchema }).strict(),
  z.object({ type: z.literal('retract'), value: z.boolean() }).strict(),
  z.object({ type: z.literal('quiet'), value: z.boolean() }).strict(),
  z
    .object({
      type: z.literal('simulate'),
      source: z.enum(['streamer', 'chat']),
      text: z.string().trim().min(1).max(280),
    })
    .strict(),
]);
export type Command = z.infer<typeof commandSchema>;
export const stateSchema = z.object({
  config: configSchema,
  retracted: z.boolean(),
  quiet: z.boolean(),
  action: z.object({
    id: z.number().int().nonnegative(),
    gesture: gestureSchema,
    note: z.string(),
    source: z.enum(['manual', 'demo', 'twitch']),
  }),
});
export type State = z.infer<typeof stateSchema>;
export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('state'), state: stateSchema }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export const defaults: Config = {
  name: 'Tavi',
  riveHair: 'Pink',
  riveOutfit: 'green',
  riveGlasses: 'blue',
  attitude: 'cheeky',
  skin: '#f1c8ae',
  hair: '#56416d',
  outfit: '#aaa0eb',
  hairstyle: 'bob',
  accessory: 'headphones',
  personality: 'cozy',
  energy: 40,
  chatEngagement: 20,
  anchor: 'webcam',
  x: 0.23,
  y: 0.72,
};
export function initialState(config: Config = defaults): State {
  return {
    config: { ...config },
    retracted: false,
    quiet: false,
    action: { id: 0, gesture: 'idle', note: 'Ready to hang out.', source: 'manual' },
  };
}
// Deterministic demo adapter. Real speech and chat will enter through this boundary.
export function reduce(state: State, command: Command): State {
  if (command.type === 'configure')
    return { ...state, config: configSchema.parse({ ...state.config, ...command.patch }) };
  if (command.type === 'retract') return { ...state, retracted: command.value };
  if (command.type === 'quiet') return { ...state, quiet: command.value };
  if (command.type === 'gesture')
    return {
      ...state,
      action: {
        id: state.action.id + 1,
        gesture: command.gesture,
        note: `${command.gesture} from the studio`,
        source: 'manual',
      },
    };
  if (state.quiet || state.retracted)
    return {
      ...state,
      action: {
        ...state.action,
        note: 'Demo reaction skipped while quiet or tucked away.',
        source: 'demo',
      },
    };
  if (command.source === 'chat' && state.config.chatEngagement === 0)
    return {
      ...state,
      action: {
        ...state.action,
        note: 'Chat engagement is off. Demo reaction skipped.',
        source: 'demo',
      },
    };
  const gesture: Gesture =
    state.config.personality === 'shy'
      ? 'peek'
      : state.config.personality === 'playful'
        ? command.source === 'chat'
          ? 'point'
          : 'wave'
        : 'smile';
  return {
    ...state,
    action: {
      id: state.action.id + 1,
      gesture,
      note: `Demo ${command.source}: ${command.text}`,
      source: 'demo',
    },
  };
}
