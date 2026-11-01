// Gate for live chat: only invitations (Tavi is named), within cooldown and streamer controls.
// What to express is decided afterwards by the shared decision pipeline.
import type { State } from '../../shared/protocol.js';
import type { ChatMessage } from '../../shared/twitch.js';

const initiativeCooldown = { reserved: 1.5, occasional: 1, outgoing: 0.6 } as const;
export function chatCooldown(state: State, recentCalls = 1) {
  const base =
    (90000 - state.config.chatEngagement * 600) * initiativeCooldown[state.config.initiative];
  return Math.min(30_000, base + Math.max(0, recentCalls - 1) * 3000);
}
export function addressesTavi(state: State, message: Pick<ChatMessage, 'text'>) {
  const text = message.text.toLocaleLowerCase();
  const words = text.split(/[^\p{L}\p{N}_]+/u);
  const name = state.config.name.toLocaleLowerCase();
  return words.includes('tavi') || text.includes('@' + name) || words.includes(name);
}
export function chatGate(
  state: State,
  message: Pick<ChatMessage, 'text'>,
  now: number,
  lastReaction: number,
  recentCalls = 1,
): { allowed: true } | { allowed: false; reason: string } {
  if (state.retracted) return { allowed: false, reason: 'Tucked away.' };
  if (state.quiet) return { allowed: false, reason: 'Quiet mode.' };
  if (state.config.chatEngagement === 0)
    return { allowed: false, reason: 'Chat engagement is off.' };
  if (!addressesTavi(state, message))
    return { allowed: false, reason: 'Not addressed to the companion.' };
  if (now - lastReaction < chatCooldown(state, recentCalls))
    return { allowed: false, reason: 'Chat cooldown.' };
  return { allowed: true };
}
