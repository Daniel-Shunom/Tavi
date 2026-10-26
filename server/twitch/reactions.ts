import type { State, Gesture } from '../../shared/protocol.js';
import type { ChatMessage } from '../../shared/twitch.js';
export function chatReaction(
  state: State,
  message: ChatMessage,
  now: number,
  lastReaction: number,
): State {
  if (state.quiet || state.retracted || state.config.chatEngagement === 0) return state;
  const cooldown = 90000 - state.config.chatEngagement * 600;
  if (now - lastReaction < cooldown) return state;
  const words = message.text.toLocaleLowerCase().split(/[^\p{L}\p{N}_]+/u);
  const name = state.config.name.toLocaleLowerCase();
  if (
    !words.includes('tavi') &&
    !message.text.toLocaleLowerCase().includes('@' + name) &&
    !words.includes(name)
  )
    return state;
  const gesture: Gesture =
    state.config.personality === 'shy'
      ? 'peek'
      : state.config.personality === 'playful'
        ? 'wave'
        : 'smile';
  return {
    ...state,
    action: {
      id: state.action.id + 1,
      gesture,
      note: `Chat from ${message.author}: ${message.text}`,
      source: 'twitch',
    },
  };
}
