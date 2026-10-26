import { expect, it } from 'vitest';
import { chatReaction } from '../server/twitch/reactions';
import { initialState } from '../shared/protocol';
const message = {
  id: 'message',
  userId: 'viewer',
  author: 'Pixel',
  text: 'Hey Tavi!',
  receivedAt: 0,
};
it('reacts only to invitations, respects cooldowns and streamer controls', () => {
  const state = initialState();
  expect(
    chatReaction(state, { ...message, text: 'talking about the game' }, 100000, -Infinity),
  ).toBe(state);
  expect(chatReaction(state, message, 100000, 90000)).toBe(state);
  expect(chatReaction({ ...state, quiet: true }, message, 100000, -Infinity).action.id).toBe(0);
  expect(chatReaction({ ...state, retracted: true }, message, 100000, -Infinity).action.id).toBe(0);
  const disabled = initialState();
  disabled.config.chatEngagement = 0;
  expect(chatReaction(disabled, message, 100000, -Infinity)).toBe(disabled);
  expect(chatReaction(state, message, 100000, -Infinity).action.source).toBe('twitch');
});
