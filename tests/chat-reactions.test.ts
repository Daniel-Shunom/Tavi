import { expect, it } from 'vitest';
import { chatGate } from '../server/twitch/reactions';
import { initialState } from '../shared/protocol';
const message = { text: 'Hey Tavi!' };
it('reacts only to invitations, respects cooldowns, initiative and streamer controls', () => {
  const state = initialState();
  expect(chatGate(state, { text: 'talking about the game' }, 100000, -Infinity).allowed).toBe(
    false,
  );
  expect(chatGate(state, message, 100000, 90000).allowed).toBe(false);
  expect(chatGate({ ...state, quiet: true }, message, 100000, -Infinity).allowed).toBe(false);
  expect(chatGate({ ...state, retracted: true }, message, 100000, -Infinity).allowed).toBe(false);
  const disabled = initialState();
  disabled.config.chatEngagement = 0;
  expect(chatGate(disabled, message, 100000, -Infinity).allowed).toBe(false);
  expect(chatGate(state, message, 100000, -Infinity).allowed).toBe(true);
  const outgoing = initialState();
  outgoing.config.initiative = 'outgoing';
  expect(chatGate(state, message, 100000, 100000 - 60000).allowed).toBe(false);
  expect(chatGate(outgoing, message, 100000, 100000 - 60000).allowed).toBe(true);
});
