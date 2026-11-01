// The companion conductor: owns authoritative state and turns input (studio controls, typed
// streamer lines, live chat) into prioritized, expiring cues on the service clock.
//
// Priority: streamer controls (retract/quiet/cancel) > manual studio cues > streamer
// conversation > chat > idle. A conversation turn plays an immediate local "listening/thinking"
// cue, then the provider's beats, then settles. Late, superseded or cancelled decisions are dropped.
import {
  resolveBeats,
  type CharacterCatalog,
  type CharacterCapabilities,
} from '../shared/capabilities.js';
import {
  beat,
  expandSequence,
  isScriptActive,
  priorities,
  scriptDuration,
  type Beat,
  type DecidedBy,
  type ExpressionScript,
} from '../shared/cue.js';
import type { Decision } from '../shared/decision.js';
import {
  anchors,
  clampPoint,
  wanderTarget,
  type Movement,
  type MovementKind,
  type Point,
} from '../shared/locomotion.js';
import { hiddenAmount, pickChoreography, type ChoreographyPreference } from '../shared/presence.js';
import {
  normalizeConfig,
  reduce,
  type Command,
  type Config,
  type State,
} from '../shared/protocol.js';
import type { ChatMessage } from '../shared/twitch.js';
import { anchorPoint, describeLayout } from '../shared/attention.js';
import type { ItemCatalog } from '../shared/wardrobe.js';
import { ConversationContext } from './ai/context.js';
import type { AiManager, DecisionResult } from './ai/manager.js';
import type { ContextEvent, ProviderInfo, StreamerUtterance } from './ai/types.js';
import { chatGate } from './twitch/reactions.js';
import { StateDirector, type Engagement, type StateAction } from './behavior/states.js';
import { supportEventSchema, supportTier, type SupportEvent } from '../shared/support.js';
import { supportBeats } from './behavior/support.js';
import { PacingDirector, type ReactionSize } from './behavior/pacing.js';
import { Affect, restScale, type AffectPersona, type Stimulus } from '../shared/affect.js';
import { clampIntensity } from '../shared/expressions.js';
import {
  atSpotApproach,
  bodyStates,
  hash01,
  resolveSpot,
  sameSpot,
  sleepingStates,
  type BodyCue,
  type BodyStateId,
  type Spot,
} from '../shared/states.js';

export interface CompanionOptions {
  config: Config;
  catalog: CharacterCatalog;
  /** Bundled attachment ids -> slot; unknown or mis-slotted items are dropped. */
  items?: ItemCatalog | undefined;
  ai: AiManager;
  save?: ((config: Config) => Promise<void>) | undefined;
  now?: () => number;
  /** Evaluate body-state triggers on this interval (ms). Off when absent (tests call tick()). */
  tickMs?: number | undefined;
}
interface Pending {
  controller: AbortController;
  eventId: string;
  priority: number;
  deadline: number;
}
const MOVE_COOLDOWN_MS = 45_000;
/** A provider may change the body state at most this often. */
const AI_STATE_COOLDOWN_MS = 90_000;
/** Decisions arriving later than this after their input are stale and dropped. */
const MAX_DECISION_AGE_MS = 12_000;

export class Companion {
  private current: State;
  private readonly listeners = new Set<(state: State) => void>();
  private readonly context = new ConversationContext();
  private pending: Pending | null = null;
  private lastChatReaction = -Infinity;
  private lastSupportReaction = -Infinity;
  private readonly seenSupport = new Set<string>();
  private lastAiMove = -Infinity;
  private sequence = 0;
  private readonly now: () => number;
  private readonly director: StateDirector;
  /** Inner life: emotions, mood, fatigue, boredom (rules, never AI). */
  private readonly affect: Affect;
  /** Intensity budget for automatic reactions. */
  private readonly pacing: PacingDirector;
  private lastAiState = -Infinity;
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(private readonly options: CompanionOptions) {
    this.now = options.now ?? Date.now;
    this.director = new StateDirector(this.now());
    this.affect = new Affect(this.now(), affectPersona(options.config));
    this.pacing = new PacingDirector(this.now());
    if (options.tickMs) {
      this.timer = setInterval(() => {
        this.tick();
      }, options.tickMs);
      this.timer.unref();
    }
    const config = normalizeConfig(options.config, options.catalog, options.items);
    this.current = {
      config,
      retracted: false,
      quiet: false,
      performance: {
        revision: 0,
        phase: 'idle',
        script: null,
        movement: null,
        presence: null,
        body: null,
        affect: this.affect.snapshot(),
        note: 'Ready to hang out.',
      },
    };
  }
  get state() {
    return this.current;
  }
  clock() {
    return this.now();
  }
  subscribe(listener: (state: State) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  close() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.abortPending('Service closing.');
  }
  private id(prefix: string) {
    this.sequence++;
    return `${prefix}-${this.now().toString(36)}-${String(this.sequence)}`;
  }
  private character(): CharacterCapabilities {
    const found =
      this.options.catalog[this.current.config.character] ?? Object.values(this.options.catalog)[0];
    if (!found) throw new Error('No characters available.');
    return found;
  }
  private set(next: State) {
    this.current = next;
    for (const listener of this.listeners) listener(next);
  }
  private perform(patch: Partial<State['performance']>) {
    this.set({
      ...this.current,
      performance: {
        ...this.current.performance,
        ...patch,
        revision: this.current.performance.revision + 1,
      },
    });
  }
  private abortPending(reason: string) {
    if (!this.pending) return;
    this.pending.controller.abort(new Error(reason));
    this.pending = null;
  }
  private asleep() {
    const body = this.current.performance.body;
    return !!body && sleepingStates.includes(body.state);
  }
  /** Feeds the affect model. Never changes what plays by itself; it shades timing and motion. */
  private feel(stimulus: Stimulus) {
    this.affect.feel(this.now(), stimulus, this.asleep());
  }
  /** Automatic reactions spend the pacing budget; while relaxing they play softer. */
  private paced(beats: Beat[], size: ReactionSize): Beat[] {
    const scale = this.pacing.react(this.now(), size);
    if (scale === 1) return beats;
    return beats.map((value) => ({
      ...value,
      intensity: clampIntensity(value.expression, value.intensity * scale),
    }));
  }
  /** Publishes the affect snapshot when it changes (quantized, so rarely). No revision bump. */
  private publishAffect() {
    this.affect.setPersona(affectPersona(this.current.config));
    this.affect.step(this.now(), this.asleep());
    const next = this.affect.snapshot();
    const previous = this.current.performance.affect;
    if (previous && JSON.stringify(previous) === JSON.stringify(next)) return;
    this.set({ ...this.current, performance: { ...this.current.performance, affect: next } });
  }
  private activeScript() {
    const script = this.current.performance.script;
    return isScriptActive(script, this.now()) ? script : null;
  }

  // Script construction -------------------------------------------------------------
  private script(input: {
    source: ExpressionScript['source'];
    sourceEventId: string;
    decidedBy: DecidedBy;
    priority: number;
    beats: Beat[];
    settle: boolean;
  }): { script: ExpressionScript; resolution: ReturnType<typeof resolveBeats> } {
    const resolution = resolveBeats(input.beats, this.character());
    const now = this.now();
    return {
      resolution,
      script: {
        id: this.id('cue'),
        sourceEventId: input.sourceEventId,
        source: input.source,
        decidedBy: input.decidedBy,
        priority: input.priority,
        startAt: now,
        expiresAt: now + 3000,
        beats: resolution.beats,
        settle: input.settle,
        dropped: resolution.dropped.slice(0, 8),
      },
    };
  }
  /** Installs a script if nothing more important is playing. Returns whether it was accepted. */
  private schedule(
    script: ExpressionScript,
    phase: State['performance']['phase'],
    note: string,
  ): boolean {
    const active = this.activeScript();
    if (active && active.id !== script.id && active.priority > script.priority) return false;
    if (this.now() > script.expiresAt) return false;
    if (!script.beats.length) {
      this.perform({ note: note + ' Nothing this character can perform.' });
      return false;
    }
    this.perform({ script, phase, note });
    return true;
  }
  private movement(input: {
    kind: MovementKind;
    to: Point;
    anchor?: keyof typeof anchors;
    source: Movement['source'];
    decidedBy: DecidedBy;
    priority: number;
    sourceEventId: string;
    gait?: Movement['gait'];
    stay?: number;
  }): boolean {
    const active = this.current.performance.movement;
    const now = this.now();
    if (
      active &&
      active.priority > input.priority &&
      (active.stay === undefined || now < active.startAt + (active.stay + 10) * 1000)
    )
      return false;
    const movement: Movement = {
      id: this.id('move'),
      sourceEventId: input.sourceEventId,
      source: input.source,
      decidedBy: input.decidedBy,
      priority: input.priority,
      kind: input.kind,
      to: clampPoint(input.to),
      startAt: now,
      expiresAt: now + 3000,
      ...(input.anchor ? { anchor: input.anchor } : {}),
      ...(input.gait ? { gait: input.gait } : {}),
      ...(input.stay !== undefined ? { stay: input.stay } : {}),
    };
    this.perform({ movement });
    return true;
  }
  private home(): Point {
    return { x: this.current.config.x, y: this.current.config.y };
  }

  // Commands -------------------------------------------------------------------------
  async handle(command: Command): Promise<void> {
    const manual: DecidedBy = { kind: 'manual', label: 'Studio' };
    if (
      command.type !== 'quiet' &&
      command.type !== 'say' &&
      command.type !== 'simulate' &&
      command.type !== 'preview-support-event'
    )
      this.engage('studio', command.type === 'perform');
    switch (command.type) {
      case 'configure': {
        const next = reduce(this.current, command, this.options.catalog, this.options.items);
        if (this.options.save) await this.options.save(next.config);
        const moved =
          next.config.x !== this.current.config.x || next.config.y !== this.current.config.y;
        const rescened =
          JSON.stringify(next.config.scene) !== JSON.stringify(this.current.config.scene);
        this.set(next);
        // Home or scene changed under a state: stand up first (the move below walks home).
        if ((moved || rescened) && this.current.performance.body?.state !== undefined)
          this.setBody('stand', {
            source: 'manual',
            decidedBy: { kind: 'manual', label: 'Studio placement' },
            priority: priorities.manual,
            sourceEventId: this.id('config'),
            keepMovement: true,
          });
        if (moved && !this.current.retracted)
          this.movement({
            kind: 'move-to',
            to: this.home(),
            ...(command.patch.anchor ? { anchor: command.patch.anchor } : {}),
            source: 'config',
            decidedBy: { kind: 'manual', label: 'Studio placement' },
            priority: priorities.manual,
            sourceEventId: this.id('config'),
            // Auto: the motion layer picks gait and mood (reason: moved by the streamer).
            ...(this.current.config.movementStyle !== 'auto'
              ? { gait: this.current.config.movementStyle }
              : {}),
          });
        return;
      }
      case 'retract':
        this.retract(command.value, command.choreography);
        return;
      case 'quiet': {
        this.set(reduce(this.current, command));
        if (command.value) {
          this.abortPending('Quiet mode.');
          const active = this.activeScript();
          const movement = this.current.performance.movement;
          this.perform({
            ...(active && active.source !== 'manual'
              ? { script: null, phase: 'idle' as const }
              : {}),
            ...(movement && movement.priority < priorities.manual ? { movement: null } : {}),
            note: 'Quiet mode: no automatic reactions.',
          });
          const body = this.current.performance.body;
          if (body && body.source !== 'manual' && body.state === 'peek')
            this.setBody('stand', {
              source: 'idle',
              decidedBy: rulesDecider,
              priority: priorities.control,
              sourceEventId: this.id('quiet'),
            });
        }
        return;
      }
      case 'cancel':
        this.abortPending('Cancelled by the streamer.');
        this.perform({
          script: null,
          movement: null,
          phase: 'idle',
          note: 'Stopped. Back to idle.',
        });
        return;
      case 'perform': {
        if (this.current.retracted) {
          this.perform({ note: 'Tucked away. Bring the companion back first.' });
          return;
        }
        this.abortPending('Replaced by a studio cue.');
        const target = command.target ?? 'neutral';
        const beats = command.sequence
          ? expandSequence(command.sequence, {
              target,
              ...(command.intensity !== undefined ? { intensity: command.intensity } : {}),
            })
          : command.expression
            ? [
                beat(command.expression, {
                  target,
                  ...(command.intensity !== undefined ? { intensity: command.intensity } : {}),
                }),
              ]
            : [];
        const { script, resolution } = this.script({
          source: 'manual',
          sourceEventId: this.id('studio'),
          decidedBy: manual,
          priority: priorities.manual,
          beats,
          settle: true,
        });
        this.schedule(
          script,
          'reacting',
          describe(manual, command.sequence ?? command.expression ?? '', resolution),
        );
        return;
      }
      case 'state': {
        if (this.current.retracted) {
          this.perform({ note: 'Tucked away. Bring the companion back first.' });
          return;
        }
        if (
          command.state === 'perch' &&
          !resolveSpot('perch', { scene: this.current.config.scene, home: this.home() })
        ) {
          this.abortPending('Replaced by a studio cue.');
          const { script } = this.script({
            source: 'manual',
            sourceEventId: this.id('blocked-perch'),
            decidedBy: manual,
            priority: priorities.manual,
            beats: [beat('perch-hesitate', { target: 'neutral', intensity: 0.7, hold: 1.2 })],
            settle: true,
          });
          this.schedule(
            script,
            'reacting',
            'No reachable webcam ledge with enough room. Staying safely on the ground.',
          );
          return;
        }
        this.setBody(command.state, {
          source: 'manual',
          decidedBy: manual,
          priority: priorities.manual,
          sourceEventId: this.id('studio'),
          prefer: 'ledge',
          ...(command.state === 'stand'
            ? {
                standAt:
                  command.position ??
                  this.current.performance.body?.spot?.approach ??
                  this.current.performance.movement?.to ??
                  this.home(),
              }
            : {}),
          ...(command.state === 'peek' ? { until: this.now() + 60_000 } : {}),
        });
        return;
      }
      case 'move': {
        if (this.current.retracted) return;
        if (this.current.performance.body)
          this.setBody('stand', {
            source: 'manual',
            decidedBy: manual,
            priority: priorities.manual,
            sourceEventId: this.id('studio'),
            keepMovement: true,
          });
        const to =
          command.kind === 'return'
            ? this.home()
            : command.kind === 'wander'
              ? wanderTarget(this.home(), this.id('wander'))
              : (command.to ??
                (command.anchor
                  ? anchorPoint(command.anchor, this.current.config.scene)
                  : this.home()));
        this.movement({
          kind: command.kind,
          to,
          ...(command.anchor ? { anchor: command.anchor } : {}),
          source: 'manual',
          decidedBy: manual,
          priority: priorities.manual,
          sourceEventId: this.id('studio'),
          ...(command.kind === 'wander' ? { stay: 4 } : {}),
        });
        return;
      }
      case 'say':
        await this.utterance({
          id: this.id('say'),
          text: command.text,
          at: this.now(),
          via: 'typed',
        });
        return;
      case 'simulate':
        await this.chat(
          {
            id: this.id('sim'),
            userId: 'simulated',
            author: 'Simulated viewer',
            text: command.text,
            receivedAt: this.now(),
          },
          true,
        );
        return;
      case 'preview-support-event':
        this.supportEvent(
          {
            ...command.event,
            id: this.id('support-preview'),
            provider: 'studio-preview',
            receivedAt: this.now(),
          },
          true,
        );
        return;
    }
  }

  /** Trusted adapter boundary. No live donation/subscription connector is installed yet. */
  supportEvent(input: SupportEvent, simulated = false): { accepted: boolean; reason: string } {
    const parsed = supportEventSchema.safeParse(input);
    const skip = (reason: string) => {
      if (simulated) this.perform({ note: `Simulated support event skipped: ${reason}` });
      return { accepted: false, reason };
    };
    if (!parsed.success) return skip('the event is invalid.');
    const event = parsed.data;
    const key = `${event.provider}:${event.id}`;
    if (this.seenSupport.has(key)) return skip('this event was already handled.');
    // Remember suppressed events too: ending quiet mode must not replay old donations.
    this.seenSupport.add(key);
    if (this.seenSupport.size > 256) {
      const oldest = this.seenSupport.values().next().value;
      if (oldest !== undefined) this.seenSupport.delete(oldest);
    }
    const now = this.now();
    if (now - event.receivedAt > 15_000 || event.receivedAt - now > 5_000)
      return skip('the event is stale or its clock is out of sync.');
    const settings = this.current.config.supportReactions;
    if (!settings.enabled) return skip('support reactions are switched off.');
    if (this.current.quiet || this.current.retracted)
      return skip('quiet mode or tuck away is active.');
    if (this.pending || (this.activeScript()?.priority ?? -1) >= priorities.chat)
      return skip('another reaction has the floor. The streamer comes first.');
    if (now - this.lastSupportReaction < 8000) return skip('support reactions are cooling down.');
    const tier = supportTier(event, settings);
    if (!tier)
      return skip(`the currency does not match ${settings.currency}; no conversion is assumed.`);
    const { script } = this.script({
      source: 'event',
      sourceEventId: event.id,
      decidedBy: { kind: 'rules', label: 'Support event rules (not AI)' },
      priority: priorities.chat,
      beats: this.paced(
        supportBeats(tier, event.kind, this.current.performance.body === null),
        tier === 'big' ? 'large' : tier,
      ),
      settle: true,
    });
    const accepted = this.schedule(
      script,
      'reacting',
      `${simulated ? 'Simulated' : 'Received'} ${event.kind}: ${tier} reaction, looking toward chat.`,
    );
    this.feel(
      tier === 'big' ? 'support-large' : tier === 'medium' ? 'support-medium' : 'support-small',
    );
    if (accepted) {
      this.lastSupportReaction = now;
      this.engage('addressed', false);
    }
    return { accepted, reason: accepted ? `${tier} reaction` : 'A higher priority cue is active.' };
  }

  private retract(value: boolean, override?: ChoreographyPreference) {
    const now = this.now();
    if (value === this.current.retracted) {
      // Acknowledge repeated controls so every client resynchronizes.
      this.set(this.current);
      return;
    }
    this.abortPending(value ? 'Tucked away.' : 'Returning.');
    const previous = this.current.performance.presence;
    const seed = (now + this.sequence * 7919) % 100000;
    const presence = {
      id: this.id(value ? 'exit' : 'enter'),
      kind: value ? ('exit' as const) : ('enter' as const),
      choreography: pickChoreography(
        override ?? this.current.config.presenceStyle,
        seed,
        previous?.choreography,
        this.current.config.personality,
      ),
      seed,
      startAt: now,
      from: hiddenAmount(previous, now),
    };
    this.set({
      ...reduce(this.current, { type: 'retract', value }),
      performance: {
        ...this.current.performance,
        revision: this.current.performance.revision + 1,
        script: null,
        movement: null,
        presence,
        // Tucking away overrides every body state; Tavi comes back standing.
        body: null,
        phase: 'idle',
        note: value ? 'Taking a little break.' : 'Back again.',
      },
    });
  }

  /** Moderation removed chat: forget it and stop any reaction to it. */
  moderate(
    change:
      { type: 'delete'; id: string } | { type: 'clearUser'; userId: string } | { type: 'clear' },
  ) {
    this.feel('moderation');
    const script = this.current.performance.script;
    const affected = (eventId: string | undefined) =>
      change.type === 'delete' ? eventId === change.id : eventId !== undefined;
    if (change.type === 'delete') this.context.remove(change.id);
    else this.context.removeSource('chat');
    if (this.pending && this.pending.priority === priorities.chat && affected(this.pending.eventId))
      this.abortPending('Message removed by moderation.');
    if (script && script.source === 'chat' && affected(script.sourceEventId))
      this.perform({
        script: null,
        phase: 'idle',
        note: 'A chat message was removed by moderation.',
      });
  }

  // Conversation -----------------------------------------------------------------------
  /** Entry point for streamer speech: typed today, microphone transcripts later. */
  async utterance(utterance: StreamerUtterance) {
    const event: ContextEvent = {
      id: utterance.id,
      source: 'streamer',
      text: utterance.text,
      at: utterance.at,
      simulated: false,
    };
    this.context.add(event);
    if (!this.current.retracted) this.engage('streamer', true);
    if (this.current.retracted) {
      this.perform({ note: 'Heard you, but tucked away.' });
      return;
    }
    if (this.current.quiet) {
      this.perform({ note: 'Quiet mode: heard you, staying quiet.' });
      return;
    }
    await this.converse(event, priorities.streamer);
  }
  async chat(message: ChatMessage, simulated = false) {
    // Every message feeds the chat-burst detector, addressed or not.
    this.director.chat(this.now(), message.userId + (simulated ? ':' + message.id : ''));
    this.feel('chat');
    const gate = chatGate(this.current, message, this.now(), this.lastChatReaction);
    if (gate.allowed) {
      this.feel('addressed');
      this.engage('addressed', false);
    } else if (this.director.stir(this.now(), this.current.performance.body)) {
      const body = this.current.performance.body;
      if (body) this.perform({ body: { ...body, stirAt: this.now() } });
    }
    this.tick();
    const event: ContextEvent = {
      id: message.id,
      source: 'chat',
      author: message.author,
      text: message.text,
      at: message.receivedAt,
      simulated,
    };
    if (!gate.allowed) {
      if (simulated) this.perform({ note: `Simulated chat skipped: ${gate.reason}` });
      return;
    }
    this.context.add(event);
    // Chat never interrupts the streamer: skip while a streamer decision or cue is in progress.
    const active = this.activeScript();
    if (
      (this.pending && this.pending.priority > priorities.chat) ||
      (active && active.priority > priorities.chat)
    ) {
      if (simulated) this.perform({ note: 'Simulated chat skipped: the streamer comes first.' });
      return;
    }
    this.lastChatReaction = this.now();
    await this.converse(event, priorities.chat);
  }

  private async converse(event: ContextEvent, priority: number) {
    this.abortPending('Superseded by newer input.');
    const ai = this.options.ai;
    const source = event.source === 'streamer' ? 'streamer' : 'chat';
    const target = event.source === 'streamer' ? 'streamer' : 'chat';
    const label = event.simulated
      ? 'simulated chat'
      : event.source === 'streamer'
        ? 'you'
        : `chat (${event.author ?? 'viewer'})`;
    // Immediate local acknowledgement while a model thinks. Rules decide instantly, so skip it.
    if (ai.active.kind === 'ai') {
      const { script } = this.script({
        source,
        sourceEventId: event.id,
        decidedBy: { kind: 'local', label: 'Local cue while thinking' },
        priority,
        beats: [
          beat(event.source === 'streamer' ? 'listening' : 'glance', { target, hold: 1.1 }),
          beat('thinking', { offset: 0.9, hold: 2, intensity: 0.45 }),
        ],
        settle: false,
      });
      this.schedule(script, 'thinking', `Thinking about ${label}...`);
    }
    const controller = new AbortController();
    const pending: Pending = {
      controller,
      eventId: event.id,
      priority,
      deadline: event.at + MAX_DECISION_AGE_MS,
    };
    this.pending = pending;
    const now = this.now();
    let result: DecisionResult;
    try {
      result = await ai.decide(
        {
          persona: {
            name: this.current.config.name,
            attitude: this.current.config.attitude,
            initiative: this.current.config.initiative,
            personality: this.current.config.personality,
            energy: this.current.config.energy,
            chatEngagement: this.current.config.chatEngagement,
          },
          character: this.character(),
          recent: this.context.recent(now),
          trigger: event,
          layout: describeLayout({
            scene: this.current.config.scene,
            position: this.current.performance.movement?.to ?? this.home(),
            bodyHeight: 220 / 720,
          }),
          canMove:
            this.current.config.initiative !== 'reserved' &&
            now - this.lastAiMove > MOVE_COOLDOWN_MS,
          canChangeState:
            (event.source === 'streamer' || this.current.config.initiative !== 'reserved') &&
            now - this.lastAiState > AI_STATE_COOLDOWN_MS,
          bodyState: this.current.performance.body?.state ?? 'stand',
          ...(this.current.performance.affect
            ? { mood: this.current.performance.affect.label }
            : {}),
        },
        controller.signal,
      );
    } catch {
      return; // Superseded or cancelled; a newer cue owns the stage.
    }
    if (this.pending !== pending || controller.signal.aborted) return;
    this.pending = null;
    if (this.now() > pending.deadline) {
      this.clearLocal(event.id, `Dropped a late reaction to ${label}.`);
      return;
    }
    if (this.current.retracted || (this.current.quiet && priority < priorities.manual)) return;
    this.apply(result, event, priority, label);
  }
  private clearLocal(eventId: string, note: string) {
    const script = this.current.performance.script;
    if (script?.sourceEventId === eventId && script.decidedBy.kind === 'local')
      this.perform({ script: null, phase: 'idle', note });
    else this.perform({ note });
  }
  private apply(result: DecisionResult, event: ContextEvent, priority: number, label: string) {
    const { decision, by } = result;
    const decidedBy: DecidedBy = {
      kind: by.kind,
      label: result.fallbackReason ? `${by.label} (AI unavailable)` : by.label,
    };
    const fallback = result.fallbackReason ? ` ${result.fallbackReason}` : '';
    if (!decision.react) {
      this.clearLocal(event.id, `${by.label} chose not to react to ${label}.${fallback}`);
      return;
    }
    const target = event.source === 'streamer' ? 'streamer' : 'chat';
    const chosen = this.beatsFrom(decision, target);
    const beats = priority <= priorities.chat ? this.paced(chosen, 'small') : chosen;
    if (!beats.length && decision.state) {
      // A body-state request on its own ("take a nap").
      const changed = this.applyState(decision.state, event, priority, decidedBy);
      this.clearLocal(
        event.id,
        changed
          ? `${decidedBy.label}: ${bodyStates[decision.state].label.toLowerCase()}. Reacting to ${label}.${fallback}`
          : `${decidedBy.label} asked to ${decision.state}, but that is not allowed right now.${fallback}`,
      );
      return;
    }
    const { script, resolution } = this.script({
      source: event.source === 'streamer' ? 'streamer' : 'chat',
      sourceEventId: event.id,
      decidedBy,
      priority,
      beats,
      settle: true,
    });
    const accepted = this.schedule(
      script,
      'reacting',
      describe(
        decidedBy,
        decision.sequence ?? decision.beats.map((value) => value.expression).join(' > '),
        resolution,
      ) + ` Reacting to ${label}.${fallback}`,
    );
    if (!accepted)
      this.clearLocal(
        event.id,
        `Skipped a reaction to ${label}: something more important is playing.`,
      );
    if (accepted && decision.move)
      this.applyMove(decision.move, event, priority, decidedBy, scriptDuration(script));
    if (accepted && decision.state) this.applyState(decision.state, event, priority, decidedBy);
  }
  /** Provider-requested body state: limited by initiative and a cooldown; the streamer may ask directly. */
  private applyState(
    state: BodyStateId,
    event: ContextEvent,
    priority: number,
    decidedBy: DecidedBy,
  ): boolean {
    const now = this.now();
    const direct = event.source === 'streamer';
    if (!direct && this.current.config.initiative === 'reserved') return false;
    if (now - this.lastAiState < AI_STATE_COOLDOWN_MS) return false;
    const changed = this.setBody(state, {
      source: direct ? 'streamer' : 'chat',
      decidedBy,
      priority,
      sourceEventId: event.id,
      prefer: 'ledge',
      ...(state === 'peek' ? { until: now + 30_000 } : {}),
    });
    if (changed) this.lastAiState = now;
    return changed;
  }

  // Body states -------------------------------------------------------------------------
  /** Something worth staying awake for: resets the quiet clock and wakes a sleeping Tavi. */
  private engage(kind: Engagement, wake: boolean) {
    this.director.engage(this.now(), kind);
    if (kind === 'studio' || kind === 'streamer') this.feel(kind);
    if (!wake || this.current.retracted) return;
    const action = this.director.wakeFor(kind, this.current.performance.body);
    if (!action) return;
    this.feel('woken');
    this.setBody(action.state, {
      source: action.source,
      decidedBy: kind === 'addressed' ? rulesDecider : { kind: 'manual', label: 'Studio' },
      priority: kind === 'addressed' ? priorities.chat : priorities.manual,
      sourceEventId: this.id('wake'),
      wake: kind === 'studio' ? 'urgent' : 'normal',
    });
  }
  /** Evaluates quiet-time and chat-burst triggers. Called on an interval and on chat. */
  tick() {
    const now = this.now();
    const state = this.current;
    const active = this.activeScript();
    const scene = { scene: state.config.scene, home: this.home() };
    this.publishAffect();
    const affect = this.current.performance.affect;
    const action = this.director.tick({
      now,
      persona: {
        personality: state.config.personality,
        initiative: state.config.initiative,
        energy: state.config.energy,
        chatEngagement: state.config.chatEngagement,
      },
      quiet: state.quiet,
      retracted: state.retracted,
      body: state.performance.body,
      streamerBusy:
        (this.pending !== null && this.pending.priority >= priorities.streamer) ||
        (active !== null && active.priority >= priorities.streamer),
      available: {
        sit: true,
        perch: resolveSpot('perch', scene) !== null,
        lean: resolveSpot('lean', scene) !== null,
      },
      restScale: affect ? restScale(affect) : 1,
      initiative: this.pacing.allowsInitiative(now),
    });
    if (action) this.applyAction(action);
  }
  private applyAction(action: StateAction) {
    if (action.state === 'peek' && action.source === 'chat') {
      this.feel('burst');
      this.pacing.react(this.now(), 'medium');
    }
    this.setBody(action.state, {
      source: action.source,
      decidedBy: rulesDecider,
      priority: action.source === 'chat' ? priorities.chat : priorities.idle,
      sourceEventId: this.id('state'),
      pick: action.pick,
      reason: action.reason,
      ...(action.wake ? { wake: action.wake } : {}),
      ...(action.until !== undefined ? { until: action.until } : {}),
    });
  }
  /**
   * Installs a body-state cue (and the walk to its spot). Returns whether it changed anything.
   * Automatic requests never override a fresh manual choice, except to go deeper into rest
   * (sit -> doze -> nap) or to wake.
   */
  private setBody(
    state: BodyStateId,
    options: {
      source: BodyCue['source'];
      decidedBy: DecidedBy;
      priority: number;
      sourceEventId: string;
      wake?: 'urgent' | 'normal';
      pick?: number;
      prefer?: 'ledge' | 'floor';
      until?: number;
      reason?: string;
      /** The caller sets the movement itself (placement changes). */
      keepMovement?: boolean;
      /** Explicit manual Stand holds this ground point instead of returning home. */
      standAt?: Point;
    },
  ): boolean {
    const now = this.now();
    const current = this.current.performance.body;
    const from = current?.state ?? 'stand';
    const deeper =
      (state === 'doze' && ['sit', 'perch', 'lean'].includes(from)) ||
      (state === 'nap' && from === 'doze');
    if (
      current &&
      current.source === 'manual' &&
      options.source !== 'manual' &&
      now - current.startAt < 120_000 &&
      !deeper &&
      !options.wake
    )
      return false;
    if (state === 'stand' && from === 'stand' && !options.standAt && !current?.spot) return false;
    const standAt = options.standAt ? clampPoint(options.standAt) : null;
    const spot: Spot | null = standAt
      ? { surface: 'floor', ...standAt, approach: standAt, side: 1 }
      : resolveSpot(state, {
          scene: this.current.config.scene,
          home: this.home(),
          current: current ? { state: current.state, spot: current.spot } : undefined,
          pick: options.pick ?? hash01(options.sourceEventId),
          prefer: options.prefer,
        });
    if (state !== 'stand' && !spot) {
      this.perform({
        note: `${bodyStates[state].label}: no place for that in this scene. Check the scene layout.`,
      });
      return false;
    }
    if (
      state === from &&
      sameSpot(spot, current?.spot) &&
      (!standAt ||
        (this.current.performance.movement?.to.x === standAt.x &&
          this.current.performance.movement.to.y === standAt.y))
    )
      return false;
    const currentPosition =
      current?.spot?.approach ?? this.current.performance.movement?.to ?? this.home();
    if (state === 'peek' && atSpotApproach(currentPosition, spot)) return false;
    const asleep = sleepingStates.includes(from) && !sleepingStates.includes(state);
    const body: BodyCue = {
      id: this.id('body'),
      sourceEventId: options.sourceEventId,
      source: options.source,
      decidedBy: options.decidedBy,
      priority: options.priority,
      state,
      spot,
      from: { state: from, spot: current?.spot ?? null },
      startAt: now,
      seed: Math.floor(hash01(options.sourceEventId) * 100000),
      ...(asleep ? { wake: options.wake ?? 'normal' } : {}),
      ...(options.until !== undefined ? { until: options.until } : {}),
    };
    const home = this.home();
    const away =
      spot && Math.hypot(spot.approach.x - home.x, spot.approach.y - home.y) > 0.004
        ? spot.approach
        : null;
    const movement: Movement | null = away
      ? {
          id: this.id('move'),
          sourceEventId: options.sourceEventId,
          source: options.source,
          decidedBy: options.decidedBy,
          priority: options.priority,
          kind: 'move-to',
          to: clampPoint(away),
          startAt: now,
          expiresAt: now + 3000,
          gait: 'walk',
        }
      : null;
    const where =
      spot?.surface === 'ledge'
        ? ` on the ${spot.rect ?? 'frame'} edge`
        : spot?.surface === 'top'
          ? ` on top of the ${spot.rect ?? 'frame'}`
          : '';
    this.perform({
      body,
      ...(options.keepMovement ? {} : { movement }),
      note: `${options.decidedBy.label}: ${bodyStates[state].label.toLowerCase()}${where}.${
        options.reason ? ' ' + options.reason : ''
      }`,
    });
    return true;
  }
  private beatsFrom(decision: Decision, fallbackTarget: 'streamer' | 'chat'): Beat[] {
    const beats: Beat[] = [];
    let offset = 0;
    if (decision.sequence) {
      const sequenceBeats = expandSequence(decision.sequence, {
        target: decision.target === 'neutral' ? fallbackTarget : decision.target,
        ...(decision.caption ? { caption: decision.caption } : {}),
      });
      beats.push(...sequenceBeats);
      offset = Math.max(0, ...sequenceBeats.map((value) => value.offset + value.hold));
    }
    for (const value of decision.beats)
      beats.push(
        beat(value.expression, {
          intensity: value.intensity,
          target: value.target,
          offset: offset + value.offset,
          hold: value.hold,
          ...(value.caption ? { caption: value.caption } : {}),
        }),
      );
    return beats.slice(0, 8);
  }
  private applyMove(
    move: NonNullable<Decision['move']>,
    event: ContextEvent,
    priority: number,
    decidedBy: DecidedBy,
    duration: number,
  ) {
    const now = this.now();
    if (this.current.config.initiative === 'reserved' || now - this.lastAiMove <= MOVE_COOLDOWN_MS)
      return;
    const to =
      move.kind === 'wander' || !move.anchor
        ? wanderTarget(this.home(), event.id)
        : anchorPoint(move.anchor, this.current.config.scene);
    const accepted = this.movement({
      kind: move.kind,
      to,
      ...(move.anchor && move.kind !== 'wander' ? { anchor: move.anchor } : {}),
      source: event.source === 'streamer' ? 'streamer' : 'chat',
      decidedBy,
      priority,
      sourceEventId: event.id,
      ...(move.gait ? { gait: move.gait } : {}),
      stay: move.kind === 'perch' ? 20 : Math.max(4, duration),
    });
    if (accepted) this.lastAiMove = now;
  }
}

const rulesDecider: DecidedBy = { kind: 'rules', label: 'Rules (not AI)' };

function describe(
  by: DecidedBy | ProviderInfo,
  choice: string,
  resolution: ReturnType<typeof resolveBeats>,
): string {
  const parts = [`${by.label}: ${choice || 'reaction'}.`];
  if (resolution.substituted.length)
    parts.push(
      `Adapted ${resolution.substituted.map((value) => `${value.from} as ${value.to}`).join(', ')}.`,
    );
  if (resolution.dropped.length)
    parts.push(`Skipped ${resolution.dropped.map((value) => value.expression).join(', ')}.`);
  return parts.join(' ');
}

function affectPersona(config: Config): AffectPersona {
  return { personality: config.personality, attitude: config.attitude, energy: config.energy };
}
