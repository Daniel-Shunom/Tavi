import { describe, expect, it } from 'vitest';
import {
  commandSchema,
  configSchema,
  defaults,
  initialState,
  normalizeConfig,
  reduce,
} from '../shared/protocol';
import { catalog } from '../src/renderer/characters/registry';

const legacy = {
  name: 'Existing companion',
  riveHair: 'Orange',
  riveOutfit: 'light green',
  riveGlasses: 'grey',
  attitude: 'spicy',
  skin: '#f1c8ae',
  hair: '#56416d',
  outfit: '#aaa0eb',
  hairstyle: 'bob',
  accessory: 'headphones',
  personality: 'shy',
  energy: 55,
  chatEngagement: 35,
  anchor: 'chat',
  x: 0.82,
  y: 0.63,
};
describe('configuration migration', () => {
  it('loads unversioned saved characters without losing name, personality or placement', () => {
    const config = configSchema.parse(legacy);
    expect(config).toMatchObject({
      version: 2,
      name: 'Existing companion',
      attitude: 'spicy',
      personality: 'shy',
      energy: 55,
      chatEngagement: 35,
      anchor: 'chat',
      x: 0.82,
      y: 0.63,
      character: 'mascot-v2',
      appearance: { hair: 'orange', outfit: 'light-green', glasses: 'grey' },
      initiative: 'occasional',
    });
    for (const key of ['skin', 'hair', 'outfit', 'hairstyle', 'accessory', 'riveHair'])
      expect(config).not.toHaveProperty(key);
  });
  it('loads the oldest files that predate palette and attitude settings', () => {
    const older = Object.fromEntries(
      Object.entries(legacy).filter(
        ([key]) => !['riveHair', 'riveOutfit', 'riveGlasses', 'attitude'].includes(key),
      ),
    );
    const config = normalizeConfig(configSchema.parse(older), catalog);
    expect(config.attitude).toBe('cheeky');
    expect(config.appearance).toEqual({ hair: 'pink', outfit: 'green', glasses: 'blue' });
  });
  it('round-trips current files and rejects unknown fields', () => {
    expect(configSchema.parse(JSON.parse(JSON.stringify(defaults)))).toEqual(defaults);
    expect(configSchema.safeParse({ ...defaults, secret: 'value' }).success).toBe(false);
  });
  it('validates appearance against the character manifest', () => {
    const state = initialState(normalizeConfig(defaults, catalog));
    const next = reduce(
      state,
      { type: 'configure', patch: { appearance: { hair: 'brown' } } },
      catalog,
    );
    expect(next.config.appearance['hair']).toBe('brown');
    expect(next.config.appearance['outfit']).toBe('green');
    const invalid = reduce(
      state,
      { type: 'configure', patch: { appearance: { hair: 'blue', hat: 'red' } } },
      catalog,
    );
    expect(invalid.config.appearance).toEqual({ hair: 'pink', outfit: 'green', glasses: 'blue' });
    const unknown = reduce(state, { type: 'configure', patch: { character: 'nobody' } }, catalog);
    expect(unknown.config.character).toBe('mascot-v2');
  });
  it('keeps the WebSocket protocol strict', () => {
    for (const input of [
      { type: 'configure', patch: { x: 4 } },
      { type: 'configure', patch: { secret: 'value' } },
      { type: 'configure', patch: { riveHair: 'Pink' } },
      { type: 'perform', expression: 'click-desktop' },
      { type: 'perform', expression: 'wave', sequence: 'greeting' },
      { type: 'gesture', gesture: 'wave' },
      { type: 'say', text: '' },
      { type: 'move', kind: 'move-to', to: { x: 2, y: 0.5 } },
    ])
      expect(commandSchema.safeParse(input).success, JSON.stringify(input)).toBe(false);
    expect(commandSchema.parse({ type: 'configure', patch: { name: 'Nova' } })).toEqual({
      type: 'configure',
      patch: { name: 'Nova' },
    });
    expect(commandSchema.safeParse({ type: 'perform', sequence: 'big-win' }).success).toBe(true);
    expect(
      commandSchema.safeParse({ type: 'retract', value: true, choreography: 'drop' }).success,
    ).toBe(true);
  });
});

describe('movement style', () => {
  it('defaults older saved configs to auto and accepts a chosen gait', () => {
    const older: Record<string, unknown> = { ...defaults };
    delete older['movementStyle'];
    expect(configSchema.parse(older).movementStyle).toBe('auto');
    const patch = { type: 'configure', patch: { movementStyle: 'skip' } };
    expect(commandSchema.safeParse(patch).success).toBe(true);
    const bad = { type: 'configure', patch: { movementStyle: 'teleport' } };
    expect(commandSchema.safeParse(bad).success).toBe(false);
  });
});
