import { describe, it, expect } from 'vitest';
import { commandSchema, initialState, reduce } from '../shared/protocol';
describe('companion behavior boundary', () => {
  it('expresses personality differently for identical streamer input', () => {
    const input = { type: 'simulate', source: 'streamer', text: 'Hello Tavi' } as const;
    const cozy = initialState();
    const shy = {
      ...initialState(),
      config: { ...initialState().config, personality: 'shy' as const },
    };
    expect(reduce(cozy, input).action.gesture).toBe('smile');
    expect(reduce(shy, input).action.gesture).toBe('peek');
  });
  it('suppresses automatic reactions in quiet and retracted modes', () => {
    for (const flag of ['quiet', 'retracted'] as const) {
      const state = { ...initialState(), [flag]: true };
      expect(reduce(state, { type: 'simulate', source: 'chat', text: 'hello' }).action.id).toBe(0);
    }
  });
  it('turns off chat reactions at zero engagement while retaining streamer reactions', () => {
    const state = initialState();
    state.config.chatEngagement = 0;
    expect(reduce(state, { type: 'simulate', source: 'chat', text: 'hello' }).action.id).toBe(0);
    expect(reduce(state, { type: 'simulate', source: 'streamer', text: 'hello' }).action.id).toBe(
      1,
    );
  });
  it('rejects invalid colors, positions, unknown actions and fields', () => {
    for (const input of [
      { type: 'configure', patch: { hair: 'url(bad)' } },
      { type: 'configure', patch: { x: 4 } },
      { type: 'gesture', gesture: 'click-desktop' },
      { type: 'configure', patch: { secret: 'value' } },
    ])
      expect(commandSchema.safeParse(input).success).toBe(false);
  });
});
