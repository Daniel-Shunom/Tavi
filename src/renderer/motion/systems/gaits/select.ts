// Automatic gait + mood selection: a deliberately small, isolated rules function.
// EXTENSION POINT: replace `selectGait` (or pass explicit `gait`/`mood` on the movement cue) to
// plug in a richer or AI-driven policy; the gait library and locomotion do not change.
// Seeded by the cue id so the studio and every overlay pick the same gait, and it avoids
// repeating the previous automatic choice.
import { pick, rngFor } from '../../core/random';
import type { Attitude, Personality } from '../../types';
import type { GaitId, MoodId } from './library';

/** Why Tavi is moving (derived from the movement cue's source/kind/anchor). */
export type MoveReason = 'dragged' | 'chat' | 'home' | 'wander' | 'peek' | 'cue';

export interface GaitContext {
  reason: MoveReason;
  personality: Personality;
  attitude: Attitude;
  /** 0-100 */
  energy: number;
  distanceBH: number;
  seed: number;
  /** Movement cue id (shared across clients). */
  cue: string;
  previous?: GaitId | undefined;
  /** Current or just-left body state (e.g. 'nap'), when known. */
  bodyState?: string | undefined;
}

export interface GaitChoice {
  gait: GaitId;
  /** Mood override; undefined = the gait's own mood. */
  mood?: MoodId;
}

type Weights = Partial<Record<GaitId, number>>;

const byReason: Record<MoveReason, Record<Personality, Weights>> = {
  // Moved by the streamer: sometimes reluctant or sulky, sometimes happy to go.
  dragged: {
    cozy: { amble: 3, trudge: 2, walk: 1, stomp: 0.4 },
    playful: { skip: 2.5, walk: 2, stomp: 0.8, trudge: 0.8 },
    shy: { scurry: 3, walk: 1, trudge: 1 },
  },
  chat: {
    cozy: { walk: 2, skip: 1, amble: 1 },
    playful: { skip: 3, scurry: 1, run: 0.5 },
    shy: { scurry: 3, walk: 1 },
  },
  home: {
    cozy: { amble: 3, walk: 1 },
    playful: { amble: 2, skip: 1.5, walk: 1 },
    shy: { amble: 2, scurry: 1 },
  },
  wander: {
    cozy: { amble: 3, walk: 1 },
    playful: { amble: 1.5, skip: 2, walk: 1 },
    shy: { amble: 2, sneak: 0.6, scurry: 0.6 },
  },
  peek: { cozy: { sneak: 1 }, playful: { sneak: 1 }, shy: { sneak: 1 } },
  cue: { cozy: { walk: 1 }, playful: { walk: 1 }, shy: { walk: 1 } },
};

export function selectGait(context: GaitContext): GaitChoice {
  const rng = rngFor(context.seed, 'gait:' + context.cue);
  const weights: Weights = { ...byReason[context.reason][context.personality] };
  const bump = (id: GaitId, amount: number) => {
    weights[id] = (weights[id] ?? 0) + amount;
  };
  if (context.energy < 30) bump('trudge', 2);
  if (context.energy > 70 && context.personality !== 'shy') bump('skip', 1);
  if (context.attitude === 'spicy' && context.reason === 'dragged') bump('stomp', 1);
  if (context.bodyState === 'nap' || context.bodyState === 'sleep') bump('trudge', 4);
  if (context.distanceBH > 3.5 && context.energy > 40 && context.personality !== 'cozy')
    bump('run', context.reason === 'chat' ? 2 : 0.6);
  const options = Object.entries(weights)
    .filter(([, weight]) => weight > 0)
    .map(([id, weight]) => ({ id: id as GaitId, weight }));
  const gait = options.length ? pick(rng, options, context.previous) : 'walk';
  let mood: MoodId | undefined;
  if (gait === 'trudge' && context.reason === 'dragged' && rng() < 0.4) mood = 'pout';
  if (gait === 'trudge' && (context.bodyState === 'nap' || context.bodyState === 'sleep'))
    mood = 'sleepy';
  return mood ? { gait, mood } : { gait };
}

/** Default gait for a personality when nothing else is known (no cue, no reason). */
export function defaultGait(personality: Personality): GaitId {
  return personality === 'cozy' ? 'amble' : personality === 'shy' ? 'scurry' : 'walk';
}
