import { describe, it, expect } from 'vitest';
import { configSchema, defaults, commandSchema } from '../shared/protocol';
import { Director, sceneDuration, performancePose } from '../src/renderer/performance';
describe('Rive configuration and performances', () => {
  it('loads earlier saved characters without losing their existing settings', () => {
    const legacy: Record<string, unknown> = { ...defaults };
    for (const key of ['riveHair', 'riveOutfit', 'riveGlasses', 'attitude']) delete legacy[key];
    const config = configSchema.parse({ ...legacy, name: 'Existing companion' });
    expect(config.name).toBe('Existing companion');
    expect(config.riveHair).toBe('Pink');
    expect(config.attitude).toBe('cheeky');
  });
  it('accepts supported palette choices and rejects nonexistent variants', () => {
    expect(
      commandSchema.safeParse({
        type: 'configure',
        patch: { riveHair: 'Brown', riveGlasses: 'white' },
      }).success,
    ).toBe(true);
    expect(
      commandSchema.safeParse({ type: 'configure', patch: { riveHair: 'Blue' } }).success,
    ).toBe(false);
  });
  it('finishes the listening scene at idle and replaces it with a manual action', () => {
    const director = new Director();
    director.runScene(0);
    expect(director.snapshot(2).action).toBe('listening');
    expect(director.snapshot(5.5).action).toBe('skeptical');
    expect(director.snapshot(sceneDuration + 0.1).action).toBe('idle');
    director.runScene(20);
    director.play('wave', 21);
    expect(director.snapshot(22).action).toBe('wave');
    expect(director.snapshot(22).scene).toBe(false);
    expect(director.snapshot(30).action).toBe('idle');
  });
  it('stays tucked until restored and removes host motion with reduced motion', () => {
    const director = new Director();
    director.play('tuck', 0);
    expect(director.snapshot(10).hidden).toBe(true);
    director.idle();
    expect(director.snapshot(11).hidden).toBe(false);
    director.play('skeptical', 12);
    const pose = performancePose(director.snapshot(13), { reducedMotion: true });
    expect(pose.rotation).toBe(0);
    expect(pose.x).toBe(0);
  });
});

it('does not reset appearance when changing another setting', () => {
  expect(commandSchema.parse({ type: 'configure', patch: { name: 'Nova' } })).toEqual({
    type: 'configure',
    patch: { name: 'Nova' },
  });
});
