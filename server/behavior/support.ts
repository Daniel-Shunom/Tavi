import { beat, type Beat } from '../../shared/cue.js';
import type { SupportTier } from '../../shared/support.js';

/** Short reactions directed at the existing chat region; no arbitrary source movement. */
export function supportBeats(
  tier: SupportTier,
  kind: 'donation' | 'subscription',
  canDance: boolean,
): Beat[] {
  const target = 'chat';
  const caption = kind === 'subscription' ? 'Welcome in!' : 'Thank you for the support!';
  const thanks = (offset: number, intensity: number) =>
    beat('thank-you', { target, offset, intensity, hold: 1.7, caption });
  if (tier === 'small')
    return [
      beat('glance', { target, hold: 0.5, intensity: 0.4 }),
      beat('content', { target, offset: 0.15, hold: 1.8, intensity: 0.45 }),
      thanks(0.25, 0.45),
    ];
  if (tier === 'medium')
    return [
      beat('glance', { target, hold: 0.5, intensity: 0.6 }),
      beat('excited', { target, offset: 0.2, hold: 2.1, intensity: 0.7 }),
      thanks(0.35, 0.75),
    ];
  return [
    beat('startled', { target, hold: 0.5, intensity: 0.55 }),
    beat('excited', { target, offset: 0.55, hold: 2.5, intensity: 0.9 }),
    beat(canDance ? 'happy-dance' : 'thank-you', {
      target,
      offset: 0.55,
      hold: canDance ? 2.4 : 1.7,
      intensity: 0.85,
    }),
    thanks(3.5, 0.8),
    beat('content', { target, offset: 3.5, hold: 1.9, intensity: 0.65 }),
  ];
}
