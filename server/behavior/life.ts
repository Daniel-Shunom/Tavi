// Autonomous life: what Tavi does on her own when nothing is happening. Every so often she picks
// an activity by utility scoring (Dave Mark / Kevin Dill): each candidate is scored from mood and
// drives (shared/affect.ts) and personality, recently used activities score lower, and she picks
// at random among the best few so she never loops. Places advertise what they offer (The Sims):
// chat is social, the webcam is "check on the streamer", the open stage is curiosity.
// Deterministic rules, never AI. Pure and clock-injected so tests can simulate hours.
import type { AffectSnapshot } from '../../shared/affect.js';
import type { Gait, Mood } from '../../shared/locomotion.js';
import {
  hash01,
  sleepingStates,
  type BodyStateId,
  type Initiative,
  type Personality,
} from '../../shared/states.js';
import type { ExpressionId } from '../../shared/expressions.js';
import type { Target } from '../../shared/expressions.js';

export const activityIds = [
  'wander', // stroll to an open spot on the stage and look around
  'visit-chat', // walk over and peek at chat
  'check-streamer', // go to the webcam and look at the streamer
  'watch-game', // stay put and watch the game/VOD area
  'look-around', // curious glances in place
  'stretch', // stretch and yawn (tired)
  'play', // a little dance or hop (bored but energetic)
  'go-home', // head back to the home spot
  'decompress', // overwhelmed or upset: retreat home and grumble
  'sulk', // told off: stays put, minimal movement (only via LifeDirector.sulk)
] as const;
export type ActivityId = (typeof activityIds)[number];

export interface LifeBeat {
  expression: ExpressionId;
  target?: Target;
  offset?: number;
  hold?: number;
  intensity?: number;
}
export interface LifeAction {
  activity: ActivityId;
  /** Where to go: an anchor, an open stage x (0..1, on the floor), or home. Absent: stay. */
  destination?: { anchor: 'chat' | 'webcam' } | { stageX: number } | { home: true };
  gait?: Gait;
  mood?: Mood;
  /** Seconds to stay after arriving before drifting home. */
  stay?: number;
  beats: LifeBeat[];
  /** Get up first if sitting or leaning. */
  standUp: boolean;
  note: string;
  /** Scores of the top candidates, for the studio note and debugging. */
  scores: { id: ActivityId; score: number }[];
}

export interface LifeContext {
  now: number;
  persona: { personality: Personality; initiative: Initiative; energy: number };
  affect: AffectSnapshot;
  body: BodyStateId | null;
  /** Manual body state chosen recently by the streamer: respect it. */
  manualHold: boolean;
  quiet: boolean;
  retracted: boolean;
  /** Streamer talking, a streamer cue playing, or any reaction/movement in progress. */
  busy: boolean;
  /**
   * Pacing director allows initiative. False after a run of big moments: she keeps living but
   * calmer (slower rhythm, no play). It never stops her.
   */
  initiative: boolean;
  /** Is Tavi away from home right now? */
  awayFromHome: boolean;
  /** Which places exist in the scene layout. */
  places: { chat: boolean; webcam: boolean; game: boolean };
}

export const lifeRules = {
  /** Mean seconds between activities while standing, by initiative. */
  intervalMs: { reserved: 150_000, occasional: 18_000, outgoing: 12_000 },
  personality: { cozy: 1.2, playful: 0.7, shy: 1.1 },
  /** Sitting is a short break: she gets up to go somewhere after about this long. */
  sittingIntervalScale: 3,
  /** Activities that take her somewhere (the only ones that get her up from a seat). */
  travelling: ['wander', 'visit-chat', 'check-streamer', 'play'] as readonly ActivityId[],
  /** Pick among the best few. */
  topK: 3,
  /** Sulking after being told off: first scolding, and the most it can stack to. */
  sulkMs: 240_000,
  /** Each further scolding while sulking adds this much. */
  sulkExtendMs: 120_000,
  maxSulkMs: 480_000,
} as const;

export class LifeDirector {
  private nextAt: number;
  private history: ActivityId[] = [];
  private count = 0;
  private sulkUntil = -Infinity;
  constructor(now: number) {
    // A short first wait so a fresh overlay comes alive quickly.
    this.nextAt = now + 20_000;
  }
  /** Something else happened (a reaction, a manual move): push the next activity back a little. */
  defer(now: number, ms = 15_000) {
    this.nextAt = Math.max(this.nextAt, now + ms);
  }
  /**
   * Told off: she sulks in place with minimal movement. The first scolding lasts
   * `lifeRules.sulkMs`; scolding again extends it, up to `lifeRules.maxSulkMs` from now.
   */
  sulk(now: number) {
    this.sulkUntil =
      this.sulkUntil > now
        ? Math.min(now + lifeRules.maxSulkMs, this.sulkUntil + lifeRules.sulkExtendMs)
        : now + lifeRules.sulkMs;
    this.nextAt = now + 40_000;
  }
  sulking(now: number) {
    return now < this.sulkUntil;
  }
  /** Made up with her (or the streamer stood her up): back into the loop right away. */
  endSulk(now: number) {
    this.sulkUntil = -Infinity;
    this.nextAt = now + 4_000;
  }
  tick(context: LifeContext): LifeAction | null {
    const { now, body } = context;
    if (context.retracted || context.quiet) return null;
    if (body && (sleepingStates.includes(body) || body === 'peek')) return null;
    if (context.busy || context.manualHold) {
      // Try again soon after whatever is happening ends.
      this.nextAt = Math.max(this.nextAt, now + 5_000);
      return null;
    }
    if (now < this.nextAt) return null;
    const seated = body === 'sit' || body === 'lean' || body === 'perch';
    const seed = `${String(this.count)}:${String(Math.floor(now / 1000))}`;
    this.count++;
    if (this.sulking(now)) {
      // Minimal movement: an occasional sad glance or pout, never a walk.
      this.nextAt = now + 35_000 + 30_000 * hash01('sulk' + seed);
      return {
        activity: 'sulk',
        beats: [
          {
            expression: (['pout', 'look-away', 'sad', 'frown'] as const)[
              Math.floor(hash01('sulkface' + seed) * 4) % 4
            ] as ExpressionId,
            hold: 2.2,
            intensity: 0.5,
          },
        ],
        standUp: false,
        note: 'Still sulking after being told off.',
        scores: [],
      };
    }
    this.nextAt = now + interval(context, seated) * (0.7 + 0.6 * hash01('gap' + seed));

    // Seated, the only question is where to go next: sitting is a break, not a destination.
    const candidates = seated
      ? activityIds.filter((id) => lifeRules.travelling.includes(id))
      : activityIds;
    const scored = candidates
      .filter((id) => id !== 'sulk' && (context.initiative || id !== 'play'))
      .map((id) => ({ id, score: score(id, context, seated) * this.recency(id) }))
      .filter((entry) => entry.score > 0.05)
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best) return null;
    // Variety among the best few, but only real contenders: within 60% of the best.
    const top = scored.slice(0, lifeRules.topK).filter((entry) => entry.score >= best.score * 0.6);
    const total = top.reduce((sum, entry) => sum + entry.score ** 2, 0);
    let roll = hash01('pick' + seed) * total;
    let chosen = best;
    for (const entry of top) {
      roll -= entry.score ** 2;
      if (roll <= 0) {
        chosen = entry;
        break;
      }
    }
    this.history = [chosen.id, ...this.history].slice(0, 4);
    const action = perform(chosen.id, context, seed);
    return {
      ...action,
      standUp: seated && action.destination !== undefined,
      scores: top.map((entry) => ({ id: entry.id, score: round(entry.score) })),
    };
  }
  /** Anti-repetition: the last activity scores much lower, the ones before a bit lower. */
  private recency(id: ActivityId) {
    const index = this.history.indexOf(id);
    return index === 0 ? 0.15 : index === 1 ? 0.5 : index === 2 ? 0.8 : 1;
  }
}

function interval(context: LifeContext, seated: boolean) {
  const base = lifeRules.intervalMs[context.persona.initiative];
  const personality = lifeRules.personality[context.persona.personality];
  const energy = 1.3 - 0.6 * (Math.max(0, Math.min(100, context.persona.energy)) / 100);
  // Aroused: sooner. Tired: later.
  const affect = (1 - 0.35 * context.affect.arousal) * (1 + 0.6 * context.affect.fatigue);
  // After a run of big moments (pacing relaxing) she keeps going, just at a calmer rhythm.
  const calm = context.initiative ? 1 : 1.8;
  return (
    base * personality * energy * affect * calm * (seated ? lifeRules.sittingIntervalScale : 1)
  );
}

/** Utility of each activity right now (0..~1.5). Considerations multiply. */
function score(id: ActivityId, context: LifeContext, seated: boolean): number {
  const a = context.affect;
  const { personality, initiative } = context.persona;
  const awake = 1 - a.fatigue;
  const bored = a.boredom;
  const lively = clamp01(0.5 + 0.5 * a.arousal);
  const bold = clamp01(0.5 + 0.5 * a.dominance);
  const reserved = initiative === 'reserved';
  const travel = reserved ? 0 : 1; // reserved Tavi stays put
  switch (id) {
    case 'wander':
      return (
        travel *
        (0.8 + 0.6 * bored) *
        (0.5 + 0.5 * lively) *
        awake *
        (personality === 'shy' ? 0.7 : 1)
      );
    case 'visit-chat':
      return context.places.chat
        ? travel *
            (0.45 + 0.5 * bored) *
            (0.5 + 0.5 * lively) *
            awake *
            (personality === 'shy' ? 1.1 : 1)
        : 0;
    case 'check-streamer':
      return context.places.webcam
        ? (0.3 + 0.4 * bold) * (0.6 + 0.4 * awake) * (personality === 'cozy' ? 1.2 : 1)
        : 0;
    case 'watch-game':
      return context.places.game ? 0.2 + 0.2 * (1 - lively) : 0;
    case 'look-around':
      return 0.2 + 0.1 * bored;
    case 'stretch':
      return 0.9 * a.fatigue + 0.2 * bored * (1 - lively);
    case 'play':
      return seated && !reserved
        ? 0.2 * bored * lively
        : (reserved ? 0.2 : 1) *
            bored *
            lively *
            awake *
            (personality === 'playful' ? 1.5 : personality === 'shy' ? 0.6 : 1);
    case 'go-home':
      return context.awayFromHome && !seated ? 0.3 + 0.5 * a.fatigue : 0;
    case 'sulk':
      return 0;
    case 'decompress':
      // Prolonged stress (overload) or a sour mood: she wants out of the spotlight.
      return seated ? 0 : 1.2 * a.overload + 0.8 * Math.max(0, -a.pleasure - 0.15);
  }
}

function perform(
  id: ActivityId,
  context: LifeContext,
  seed: string,
): Omit<LifeAction, 'standUp' | 'scores'> {
  const a = context.affect;
  const travel = travelStyle(a, context.persona.personality, seed);
  const pick = <T>(values: readonly T[], salt: string): T =>
    values[Math.floor(hash01(salt + seed) * values.length) % values.length] as T;
  switch (id) {
    case 'wander': {
      const stageX = 0.15 + 0.7 * hash01('x' + seed);
      return {
        activity: id,
        destination: { stageX },
        ...travel,
        stay: 3 + Math.round(4 * hash01('stay' + seed)),
        beats: [
          { expression: 'idle-glance', target: 'neutral', offset: 0.4, hold: 1.4 },
          {
            expression: face(a, seed, ['content', 'soft-smile', 'thinking']),
            offset: 1.8,
            hold: 2,
            intensity: 0.4,
          },
        ],
        note: 'Wandering around the stage.',
      };
    }
    case 'visit-chat':
      return {
        activity: id,
        destination: { anchor: 'chat' },
        ...travel,
        stay: 5 + Math.round(4 * hash01('stay' + seed)),
        beats: [
          { expression: 'glance', target: 'chat', hold: 1.6 },
          {
            expression: face(a, seed, ['soft-smile', 'teasing', 'amused']),
            target: 'chat',
            offset: 1.5,
            hold: 2,
            intensity: 0.45,
          },
        ],
        note: 'Went to see what chat is up to.',
      };
    case 'check-streamer':
      return {
        activity: id,
        destination: { anchor: 'webcam' },
        ...travel,
        stay: 6,
        beats: [
          { expression: 'listening', target: 'streamer', hold: 2 },
          {
            expression: face(a, seed, ['soft-smile', 'content', 'grin']),
            target: 'streamer',
            offset: 1.8,
            hold: 1.8,
            intensity: 0.4,
          },
        ],
        note: 'Checking on you.',
      };
    case 'watch-game':
      return {
        activity: id,
        beats: [
          { expression: 'focused', target: 'game', hold: 4, intensity: 0.45 },
          {
            expression: face(a, seed, ['impressed', 'thinking', 'skeptical']),
            target: 'game',
            offset: 3.5,
            hold: 1.6,
            intensity: 0.35,
          },
        ],
        note: 'Watching the game.',
      };
    case 'look-around':
      return {
        activity: id,
        beats: [
          { expression: 'idle-glance', target: 'neutral', hold: 1.4 },
          { expression: 'look-away', target: 'neutral', offset: 1.4, hold: 1.2 },
          { expression: face(a, seed, ['idle-fidget']), offset: 2.8, hold: 1.4, intensity: 0.45 },
        ],
        note: 'Looking around.',
      };
    case 'stretch':
      return {
        activity: id,
        beats: [
          { expression: 'sleepy', hold: 2.2, intensity: 0.5 },
          { expression: 'idle-fidget', offset: 2, hold: 1.4 },
        ],
        note: a.fatigue > 0.5 ? 'Getting sleepy: stretching.' : 'Stretching.',
      };
    case 'play': {
      const hop = context.persona.initiative !== 'reserved' && hash01('hop' + seed) < 0.25;
      return {
        activity: id,
        ...(hop
          ? {
              destination: { stageX: 0.15 + 0.7 * hash01('x' + seed) },
              gait: context.persona.personality === 'shy' ? ('skip' as const) : ('hop' as const),
              mood: 'grin' as const,
              stay: 5,
            }
          : {}),
        beats: [
          {
            expression: pick(['happy-dance', 'celebrate', 'sassy'] as const, 'move'),
            offset: hop ? 1.2 : 0,
            hold: 2.4,
            intensity: 0.55,
          },
        ],
        note: 'Bored, so making her own fun.',
      };
    }
    case 'go-home':
      return {
        activity: id,
        destination: { home: true },
        ...travel,
        beats: [],
        note: 'Heading back to her spot.',
      };
    case 'sulk':
      return {
        activity: id,
        beats: [{ expression: 'pout', hold: 2.2, intensity: 0.5 }],
        note: 'Sulking.',
      };
    case 'decompress': {
      const overwhelmed = a.overload >= 0.4;
      return {
        activity: id,
        destination: { home: true },
        gait: overwhelmed ? 'stomp' : 'trudge',
        mood: overwhelmed ? 'annoyed' : 'sad',
        beats: overwhelmed
          ? [
              {
                expression: pick(['grossed-out', 'wince'] as const, 'a'),
                hold: 1.6,
                intensity: 0.6,
              },
              {
                expression: pick(['annoyed', 'eye-roll'] as const, 'b'),
                offset: 1.6,
                hold: 1.8,
                intensity: 0.55,
              },
              { expression: 'deadpan', offset: 3.4, hold: 2, intensity: 0.5 },
            ]
          : [
              { expression: pick(['sad', 'worried'] as const, 'a'), hold: 2, intensity: 0.6 },
              {
                expression: pick(['pout', 'frown'] as const, 'b'),
                offset: 2,
                hold: 2,
                intensity: 0.55,
              },
            ],
        note: overwhelmed
          ? 'Overwhelmed: retreating for a breather.'
          : 'Feeling down: keeping to herself.',
      };
    }
  }
}

/**
 * Her face follows her mood, not just the activity: she is not smiley all the time.
 * Overwhelmed reads grossed out and annoyed; down reads sad, pouty, worried; tired reads sleepy;
 * bored reads deadpan. Otherwise the activity's own (usually positive) faces.
 */
function face(a: AffectSnapshot, seed: string, normal: readonly ExpressionId[]): ExpressionId {
  const options: readonly ExpressionId[] =
    a.overload >= 0.5
      ? ['grossed-out', 'wince', 'annoyed', 'eye-roll']
      : a.pleasure <= -0.25
        ? ['sad', 'frown', 'pout', 'worried']
        : a.overload >= 0.3 || a.pleasure <= -0.1
          ? ['skeptical', 'worried', 'deadpan', 'frown']
          : a.fatigue >= 0.6
            ? ['sleepy', 'bored', 'deadpan']
            : a.boredom >= 0.7 && a.arousal < 0
              ? ['bored', 'deadpan', 'eye-roll', ...normal]
              : normal;
  return options[Math.floor(hash01('face' + seed) * options.length) % options.length] ?? 'content';
}

/** How she travels: mood shows in the walk, not in meters (Petz). */
function travelStyle(
  a: AffectSnapshot,
  personality: Personality,
  seed: string,
): { gait: Gait; mood: Mood } {
  // Walking is the norm. A skip is a once-in-a-while treat when she is genuinely happy.
  if (a.overload >= 0.5) return { gait: 'stomp', mood: 'annoyed' };
  if (a.pleasure <= -0.25)
    return { gait: 'trudge', mood: hash01('m' + seed) < 0.5 ? 'sad' : 'pout' };
  if (a.fatigue > 0.6) return { gait: 'trudge', mood: 'sleepy' };
  if (a.arousal > 0.45 && a.pleasure > 0.3 && hash01('skip' + seed) < 0.2)
    return { gait: 'skip', mood: 'excited' };
  if (a.boredom > 0.6 && a.arousal < 0) return { gait: 'amble', mood: 'bored' };
  if (personality === 'shy' && a.dominance < -0.2 && hash01('sneak' + seed) < 0.3)
    return { gait: 'sneak', mood: 'content' };
  return {
    gait: 'walk',
    mood: a.pleasure > 0.3 ? 'grin' : a.pleasure < 0 ? 'frown' : 'content',
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
function round(value: number) {
  return Math.round(value * 100) / 100;
}
