// How Tavi reacts to Twitch stream events: a fixed, readable table (rules, never AI).
// Size feeds the pacing director, the stimulus feeds the affect model, cooldowns keep floods
// (a follow train, a gift bomb) to one reaction. Specific beats generic: a hype-train level 5
// gets a bigger celebration than level 1; a raid of 50 a bigger welcome than a raid of 2.
import type { Stimulus } from '../../shared/affect.js';
import type { BodyStateId } from '../../shared/states.js';
import type { StreamEventBody } from '../../shared/streamEvents.js';
import type { ExpressionId, Target } from '../../shared/expressions.js';
import type { ReactionSize } from './pacing.js';

export interface EventBeat {
  expression: ExpressionId;
  target?: Target;
  offset?: number;
  hold?: number;
  intensity?: number;
}
export interface EventReaction {
  beats: EventBeat[];
  size: ReactionSize;
  stimulus: Stimulus;
  /** Events sharing a key share a cooldown. */
  cooldownKey: string;
  cooldownMs: number;
  /** Walk toward chat to greet (raids). */
  toChat?: boolean;
  /** Body state to end in (hype-train flop, nap reward). */
  body?: BodyStateId;
  /** Wake her up if asleep. */
  wake: boolean;
  note: string;
}

export function streamEventReaction(event: StreamEventBody): EventReaction {
  switch (event.kind) {
    case 'follow':
      return {
        beats: [
          { expression: 'glance', target: 'chat', hold: 1.2 },
          { expression: 'soft-smile', target: 'chat', offset: 1, hold: 1.6, intensity: 0.45 },
        ],
        size: 'small',
        stimulus: 'addressed',
        cooldownKey: 'follow',
        cooldownMs: 30_000,
        wake: false,
        note: `New follower: ${event.user}.`,
      };
    case 'raid': {
      const big = event.viewers >= 20;
      return {
        beats: [
          { expression: 'startled', hold: 0.8, intensity: big ? 0.8 : 0.5 },
          { expression: 'excited', offset: 0.7, hold: 1.6, intensity: big ? 0.9 : 0.6 },
          { expression: 'wave', target: 'chat', offset: 2, hold: 2.2 },
          ...(big
            ? [{ expression: 'celebrate' as const, offset: 4, hold: 2.4, intensity: 0.8 }]
            : []),
        ],
        size: big ? 'large' : 'medium',
        stimulus: 'raid',
        cooldownKey: 'raid',
        cooldownMs: 90_000,
        toChat: true,
        wake: true,
        note: `Raid from ${event.from} with ${String(event.viewers)} viewers!`,
      };
    }
    case 'subscription': {
      const tier = event.tier === '3000' ? 'large' : event.tier === '2000' ? 'medium' : 'small';
      return {
        beats: [
          { expression: 'glance', target: 'chat', hold: 1 },
          { expression: 'thank-you', target: 'chat', offset: 0.8, hold: 2, intensity: 0.6 },
          { expression: 'grin', offset: 2.6, hold: 1.4, intensity: 0.5 },
        ],
        size: tier,
        stimulus:
          tier === 'large'
            ? 'support-large'
            : tier === 'medium'
              ? 'support-medium'
              : 'support-small',
        // Gift bombs arrive as one gift event plus many gifted subs: the gift event reacts.
        cooldownKey: event.gifted ? 'gift' : 'sub',
        cooldownMs: event.gifted ? 60_000 : 20_000,
        wake: true,
        note: `${event.user} ${event.gifted ? 'received a gifted sub' : 'subscribed'}.`,
      };
    }
    case 'gift': {
      const size: ReactionSize =
        event.count >= 10 ? 'large' : event.count >= 3 ? 'medium' : 'small';
      return {
        beats: [
          { expression: 'shocked', hold: 0.9, intensity: size === 'large' ? 0.8 : 0.5 },
          {
            expression: 'celebrate',
            offset: 0.8,
            hold: 2.4,
            intensity: size === 'large' ? 0.9 : 0.6,
          },
          { expression: 'thank-you', target: 'chat', offset: 3.2, hold: 2 },
        ],
        size,
        stimulus: size === 'large' ? 'support-large' : 'support-medium',
        cooldownKey: 'gift',
        cooldownMs: 60_000,
        wake: true,
        note: `${event.user ?? 'Someone'} gifted ${String(event.count)} sub${event.count === 1 ? '' : 's'}!`,
      };
    }
    case 'cheer': {
      const size: ReactionSize =
        event.bits >= 1000 ? 'large' : event.bits >= 100 ? 'medium' : 'small';
      return {
        beats:
          size === 'small'
            ? [
                { expression: 'glance', target: 'chat', hold: 1 },
                { expression: 'soft-smile', offset: 0.9, hold: 1.4, intensity: 0.45 },
              ]
            : [
                { expression: 'impressed', target: 'chat', hold: 1.4, intensity: 0.7 },
                {
                  expression: 'celebrate',
                  offset: 1.2,
                  hold: 2.2,
                  intensity: size === 'large' ? 0.9 : 0.6,
                },
              ],
        size,
        stimulus:
          size === 'large'
            ? 'support-large'
            : size === 'medium'
              ? 'support-medium'
              : 'support-small',
        cooldownKey: 'cheer',
        cooldownMs: size === 'small' ? 30_000 : 20_000,
        wake: size !== 'small',
        note: `${event.user ?? 'Someone'} cheered ${String(event.bits)} bits.`,
      };
    }
    case 'hype-train': {
      if (event.phase === 'begin')
        return {
          beats: [
            { expression: 'startled', hold: 0.7, intensity: 0.6 },
            { expression: 'excited', target: 'chat', offset: 0.6, hold: 2, intensity: 0.8 },
          ],
          size: 'medium',
          stimulus: 'burst',
          cooldownKey: 'hype',
          cooldownMs: 15_000,
          wake: true,
          note: 'Hype train started!',
        };
      if (event.phase === 'progress') {
        const intensity = Math.min(1, 0.5 + 0.1 * event.level);
        return {
          beats: [
            { expression: event.level >= 3 ? 'happy-dance' : 'excited', hold: 2.2, intensity },
          ],
          size: event.level >= 4 ? 'medium' : 'small',
          stimulus: event.level >= 3 ? 'support-medium' : 'support-small',
          cooldownKey: 'hype',
          cooldownMs: 20_000,
          wake: true,
          note: `Hype train level ${String(event.level)}.`,
        };
      }
      // The end: one last cheer, then an exhausted flop onto the floor.
      return {
        beats: [
          { expression: 'celebrate', hold: 2.2, intensity: Math.min(1, 0.5 + 0.1 * event.level) },
          { expression: 'sleepy', offset: 2.4, hold: 2.4, intensity: 0.6 },
        ],
        size: event.level >= 3 ? 'large' : 'medium',
        stimulus: 'support-large',
        cooldownKey: 'hype-end',
        cooldownMs: 30_000,
        body: 'sit',
        wake: true,
        note: `Hype train ended at level ${String(event.level)}. Phew.`,
      };
    }
    case 'redemption':
      return redemption(event.mischief, event.user, event.reward);
  }
}

function redemption(
  mischief: Extract<StreamEventBody, { kind: 'redemption' }>['mischief'],
  user: string,
  reward: string,
): EventReaction {
  const base = { size: 'small' as const, stimulus: 'addressed' as const, wake: true };
  switch (mischief) {
    case 'poke':
      // Body first on surprise (Lasseter), a dizzy wobble, then she laughs it off.
      return {
        ...base,
        beats: [
          { expression: 'startled', hold: 0.6, intensity: 0.8 },
          { expression: 'wince', offset: 0.5, hold: 1, intensity: 0.6 },
          { expression: 'confused', offset: 1.4, hold: 1.4, intensity: 0.6 },
          { expression: 'laugh', offset: 2.8, hold: 1.4, intensity: 0.5 },
        ],
        cooldownKey: 'mischief-poke',
        cooldownMs: 15_000,
        note: `${user} poked Tavi.`,
      };
    case 'dance':
      return {
        ...base,
        size: 'medium',
        beats: [
          { expression: 'grin', hold: 0.6, intensity: 0.6 },
          { expression: 'happy-dance', offset: 0.5, hold: 3.5, intensity: 0.8 },
        ],
        cooldownKey: 'mischief-dance',
        cooldownMs: 20_000,
        note: `${user} made Tavi dance.`,
      };
    case 'snack':
      return {
        ...base,
        beats: [
          { expression: 'excited', hold: 1, intensity: 0.6 },
          { expression: 'content', offset: 1, hold: 2, intensity: 0.7 },
          { expression: 'blush', offset: 2.8, hold: 1.4, intensity: 0.5 },
          { expression: 'thank-you', target: 'chat', offset: 3.8, hold: 1.6 },
        ],
        cooldownKey: 'mischief-snack',
        cooldownMs: 20_000,
        note: `${user} gave Tavi a snack.`,
      };
    case 'wave':
      return {
        ...base,
        beats: [
          { expression: 'glance', target: 'chat', hold: 0.8 },
          { expression: 'wave', target: 'chat', offset: 0.6, hold: 2 },
        ],
        cooldownKey: 'mischief-wave',
        cooldownMs: 10_000,
        note: `${user} said hi with channel points.`,
      };
    case 'nap':
      return {
        ...base,
        beats: [{ expression: 'sleepy', hold: 2, intensity: 0.6 }],
        cooldownKey: 'mischief-nap',
        cooldownMs: 120_000,
        body: 'nap',
        wake: false,
        note: `${user} sent Tavi to bed.`,
      };
    case null:
      return {
        ...base,
        beats: [
          { expression: 'glance', target: 'chat', hold: 1 },
          { expression: 'soft-smile', offset: 0.9, hold: 1.2, intensity: 0.4 },
        ],
        cooldownKey: 'redemption',
        cooldownMs: 30_000,
        wake: false,
        note: `${user} redeemed ${reward}.`,
      };
  }
}
