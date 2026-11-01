// When body states happen: deterministic rules (never AI). Pure and clock-injected so tests can
// simulate chat bursts and hours of quiet. The Companion applies the returned actions through its
// priority rules. Thresholds live in shared/states.ts (burstRules, quietRules).
import {
  burstRules,
  hash01,
  quietRules,
  quietSchedule,
  sleepingStates,
  type BodyCue,
  type BodyStateId,
  type Initiative,
  type Personality,
} from '../../shared/states.js';

export interface Persona {
  personality: Personality;
  initiative: Initiative;
  energy: number;
  chatEngagement: number;
}

/** Sliding 30 s chat window with an EWMA baseline of the per-window count. */
export class ChatBurst {
  private messages: { at: number; user: string }[] = [];
  private baseline = 0;
  private updatedAt: number | null = null;
  add(at: number, user: string) {
    this.update(at);
    this.messages.push({ at, user });
  }
  private prune(now: number) {
    const start = now - burstRules.windowMs;
    while (this.messages.length && (this.messages[0]?.at ?? now) < start) this.messages.shift();
  }
  /** Advances the baseline to `now` (exact for any call pattern: exponential decay toward the window count). */
  update(now: number) {
    this.prune(now);
    if (this.updatedAt === null) {
      this.updatedAt = now;
      return;
    }
    const dt = Math.max(0, now - this.updatedAt);
    this.updatedAt = now;
    const k = 1 - Math.exp(-dt / burstRules.baselineTauMs);
    this.baseline += (this.messages.length - this.baseline) * k;
  }
  window(now: number) {
    this.update(now);
    return {
      count: this.messages.length,
      chatters: new Set(this.messages.map((m) => m.user)).size,
      baseline: this.baseline,
    };
  }
  /** Messages per window needed for a burst at this persona. */
  threshold(persona: Persona) {
    const floor =
      burstRules.floor(persona.chatEngagement) * burstRules.floorScale[persona.initiative];
    return Math.max(floor, burstRules.multiple * this.baseline);
  }
  isBurst(now: number, persona: Persona) {
    const window = this.window(now);
    return window.chatters >= burstRules.minChatters && window.count >= this.threshold(persona);
  }
  /** Current rate is calm: below half the threshold. */
  isCalm(now: number, persona: Persona) {
    return this.window(now).count < this.threshold(persona) / 2;
  }
}

/** `activity`: Tavi got up to do something on her own (restarts the quiet clock only). */
export type Engagement = 'studio' | 'streamer' | 'addressed' | 'burst' | 'activity';

export interface DirectorContext {
  now: number;
  persona: Persona;
  quiet: boolean;
  retracted: boolean;
  body: BodyCue | null;
  /** A streamer-priority script is playing or a streamer decision is pending. */
  streamerBusy: boolean;
  /** Which settle states the scene supports. */
  available: Readonly<Record<'sit' | 'perch' | 'lean', boolean>>;
  /** Multiplies the quiet-time schedule (affect: tired or bored settles sooner). Default 1. */
  restScale?: number;
  /** False while the pacing director is relaxing after a peak: no chat-burst peeks. */
  initiative?: boolean;
}
export interface StateAction {
  state: BodyStateId;
  source: 'idle' | 'chat';
  reason: string;
  wake?: 'urgent' | 'normal';
  /** 0..1 deterministic choice for spot selection. */
  pick: number;
  /** Planned end for a peek (service ms). */
  until?: number;
}

export class StateDirector {
  readonly burst = new ChatBurst();
  private lastEngagement: number;
  private lastStreamer = -Infinity;
  private lastPeek = -Infinity;
  private peeks: number[] = [];
  private calmSince: number | null = null;
  private lastStir = -Infinity;
  private sleepWakeAt: number | null = null;
  constructor(now: number) {
    this.lastEngagement = now;
  }
  /** Something worth staying awake for happened. */
  engage(now: number, kind: Engagement) {
    this.lastEngagement = now;
    if (kind === 'streamer' || kind === 'studio') this.lastStreamer = now;
  }
  get quietSince() {
    return this.lastEngagement;
  }
  /** Every chat message, addressed or not (the streamer's own lines are not counted). */
  chat(now: number, user: string) {
    this.burst.add(now, user);
  }
  /** One unaddressed message while asleep: a stir at most every 20 s. */
  stir(now: number, body: BodyCue | null) {
    if (!body || !sleepingStates.includes(body.state) || now - this.lastStir < 20_000) return false;
    this.lastStir = now;
    return true;
  }
  /** How to wake for an engagement, or null when not asleep. */
  wakeFor(kind: Engagement, body: BodyCue | null): StateAction | null {
    if (!body || !sleepingStates.includes(body.state)) return null;
    const wake = kind === 'studio' || kind === 'streamer' ? 'urgent' : 'normal';
    return {
      state: body.state === 'doze' ? 'sit' : 'stand',
      source: kind === 'addressed' || kind === 'burst' ? 'chat' : 'idle',
      reason: 'Woke up.',
      wake,
      pick: 0,
    };
  }
  private chatAwake(now: number) {
    return this.burst.window(now).count > quietRules.awakeChatPer30s;
  }
  private canPeek(now: number, persona: Persona) {
    this.peeks = this.peeks.filter((at) => now - at < 3_600_000);
    return (
      now - this.lastPeek >= burstRules.cooldownMs[persona.initiative] &&
      this.peeks.length < burstRules.maxPerHour
    );
  }

  /** Called every second or so and on chat. Returns at most one state change. */
  tick(context: DirectorContext): StateAction | null {
    const { now, persona, body } = context;
    if (context.retracted) return null;
    const state = body?.state ?? 'stand';
    const seed = String(Math.floor(now / 1000));

    // An ongoing peek: end it when planned, or once chat calms down after the minimum.
    if (state === 'peek') {
      const calm = this.burst.isCalm(now, persona);
      if (!calm) this.calmSince = null;
      else this.calmSince ??= now;
      const started = body?.startAt ?? now;
      const manual = body?.source === 'manual';
      const until = body?.until ?? started + (manual ? 60_000 : burstRules.maxPeekMs);
      const calmEnd =
        !manual &&
        this.calmSince !== null &&
        now - this.calmSince >= burstRules.calmEndMs &&
        now - started >= burstRules.minPeekMs;
      if (now >= until || calmEnd) {
        this.calmSince = null;
        return {
          state: 'stand',
          source: manual ? 'idle' : 'chat',
          reason: 'Done peeking.',
          pick: 0,
        };
      }
      return null;
    }

    // Chat burst: walk over and peek (initiative-driven, never in quiet mode or streamer focus).
    if (
      !context.quiet &&
      !context.streamerBusy &&
      context.initiative !== false &&
      now - this.lastStreamer >= quietRules.streamerGraceMs &&
      this.burst.isBurst(now, persona) &&
      this.canPeek(now, persona) &&
      !(body?.source === 'manual' && now - body.startAt < 120_000)
    ) {
      this.lastPeek = now;
      this.peeks.push(now);
      this.lastEngagement = now;
      this.calmSince = null;
      const action: StateAction = {
        state: 'peek',
        source: 'chat',
        reason: 'Chat got busy: peeking at chat.',
        pick: 0,
        // Ends early once chat calms down (after the minimum), at the latest here.
        until: now + burstRules.maxPeekMs,
      };
      if (body && sleepingStates.includes(body.state)) action.wake = 'normal';
      return action;
    }

    // Asleep long enough: wake up by itself, stretch, settle again.
    if (state === 'nap') {
      if (this.sleepWakeAt === null) {
        const [low, high] = quietRules.selfWakeMs;
        this.sleepWakeAt = (body?.startAt ?? now) + low + (high - low) * hash01('wake' + seed);
      }
      if (now >= this.sleepWakeAt) {
        this.sleepWakeAt = null;
        // Restart the quiet clock at "just settled" so it dozes again after the doze interval.
        const schedule = scaled(quietSchedule(persona), context.restScale);
        this.lastEngagement = now - schedule.settle;
        return {
          state: 'sit',
          source: 'idle',
          reason: 'Woke up from a nap.',
          wake: 'normal',
          pick: 0,
        };
      }
      return null;
    }
    this.sleepWakeAt = null;

    if (context.quiet || context.streamerBusy) return null;
    if (now - this.lastStreamer < quietRules.streamerGraceMs) return null;
    const quiet = now - this.lastEngagement;
    const schedule = scaled(quietSchedule(persona), context.restScale);
    const awake = this.chatAwake(now);
    if (state === 'doze' && quiet >= schedule.lie && !awake)
      return {
        state: 'nap',
        source: 'idle',
        reason: 'Quiet for a long time: lying down.',
        pick: 0,
      };
    if (
      (state === 'sit' || state === 'perch' || state === 'lean') &&
      quiet >= schedule.doze &&
      !awake
    )
      return {
        state: 'doze',
        source: 'idle',
        reason: 'Quiet for a while: nodding off.',
        pick: hash01('doze' + seed),
      };
    if (state === 'stand' && quiet >= schedule.settle) {
      const weights = quietRules.settleWeights[persona.personality];
      const options = (['sit', 'perch', 'lean'] as const).filter(
        (id) => context.available[id] && weights[id] > 0,
      );
      if (!options.length) options.push('sit');
      const total = options.reduce((sum, id) => sum + weights[id], 0) || 1;
      let roll = hash01('settle' + seed) * total;
      let choice: 'sit' | 'perch' | 'lean' = options[0] ?? 'sit';
      for (const id of options) {
        roll -= weights[id];
        if (roll <= 0) {
          choice = id;
          break;
        }
      }
      return {
        state: choice,
        source: 'idle',
        reason: 'Quiet for a bit: settling in.',
        // Below the personality's ledge chance -> ledge.
        pick: hash01('ledge' + seed) < quietRules.ledgeChance[persona.personality] ? 0 : 1,
      };
    }
    return null;
  }
}

function scaled(schedule: { settle: number; doze: number; lie: number }, scale = 1) {
  return {
    settle: schedule.settle * scale,
    doze: schedule.doze * scale,
    lie: schedule.lie * scale,
  };
}
