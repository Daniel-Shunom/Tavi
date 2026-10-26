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
import type { ItemCatalog } from '../shared/wardrobe.js';
import { ConversationContext } from './ai/context.js';
import type { AiManager, DecisionResult } from './ai/manager.js';
import type { ContextEvent, ProviderInfo, StreamerUtterance } from './ai/types.js';
import { chatGate } from './twitch/reactions.js';

export interface CompanionOptions {
  config: Config;
  catalog: CharacterCatalog;
  /** Bundled attachment ids -> slot; unknown or mis-slotted items are dropped. */
  items?: ItemCatalog | undefined;
  ai: AiManager;
  save?: ((config: Config) => Promise<void>) | undefined;
  now?: () => number;
}
interface Pending {
  controller: AbortController;
  eventId: string;
  priority: number;
  deadline: number;
}
const MOVE_COOLDOWN_MS = 45_000;
/** Decisions arriving later than this after their input are stale and dropped. */
const MAX_DECISION_AGE_MS = 12_000;

export class Companion {
  private current: State;
  private readonly listeners = new Set<(state: State) => void>();
  private readonly context = new ConversationContext();
  private pending: Pending | null = null;
  private lastChatReaction = -Infinity;
  private lastAiMove = -Infinity;
  private sequence = 0;
  private readonly now: () => number;
  constructor(private readonly options: CompanionOptions) {
    this.now = options.now ?? Date.now;
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
    switch (command.type) {
      case 'configure': {
        const next = reduce(this.current, command, this.options.catalog, this.options.items);
        if (this.options.save) await this.options.save(next.config);
        const moved =
          next.config.x !== this.current.config.x || next.config.y !== this.current.config.y;
        this.set(next);
        if (moved && !this.current.retracted)
          this.movement({
            kind: 'move-to',
            to: this.home(),
            ...(command.patch.anchor ? { anchor: command.patch.anchor } : {}),
            source: 'config',
            decidedBy: { kind: 'manual', label: 'Studio placement' },
            priority: priorities.manual,
            sourceEventId: this.id('config'),
            gait: 'walk',
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
      case 'move': {
        if (this.current.retracted) return;
        const to =
          command.kind === 'return'
            ? this.home()
            : command.kind === 'wander'
              ? wanderTarget(this.home(), this.id('wander'))
              : (command.to ?? (command.anchor ? anchors[command.anchor] : this.home()));
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
    }
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
    const gate = chatGate(this.current, message, this.now(), this.lastChatReaction);
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
          canMove:
            this.current.config.initiative !== 'reserved' &&
            now - this.lastAiMove > MOVE_COOLDOWN_MS,
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
    const beats = this.beatsFrom(decision, target);
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
        : anchors[move.anchor];
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
