import { describe, expect, it } from 'vitest';
import { AiManager, settingsFromEnv } from '../server/ai/manager';
import { Companion } from '../server/companion';
import { commandSchema, configSchema, defaults } from '../shared/protocol';
import {
  defaultSupportSettings,
  supportEventSchema,
  supportSettingsSchema,
  supportTier,
  type SupportEvent,
} from '../shared/support';
import { catalog } from '../src/renderer/characters/registry';

function setup() {
  const clock = { now: 1_000_000 };
  const companion = new Companion({
    config: { ...defaults },
    catalog,
    ai: new AiManager(settingsFromEnv({})),
    now: () => clock.now,
  });
  const event = (id: string, amount = 5): Extract<SupportEvent, { kind: 'donation' }> => ({
    id,
    provider: 'test-adapter',
    receivedAt: clock.now,
    kind: 'donation',
    amount,
    currency: 'USD',
  });
  return { companion, clock, event };
}

describe('support event contract', () => {
  it('uses configured boundaries and never assumes a currency conversion', () => {
    const donation = { kind: 'donation' as const, amount: 9.99, currency: 'USD' };
    expect(supportTier(donation, defaultSupportSettings)).toBe('small');
    expect(supportTier({ ...donation, amount: 10 }, defaultSupportSettings)).toBe('medium');
    expect(supportTier({ ...donation, amount: 50 }, defaultSupportSettings)).toBe('big');
    expect(supportTier({ ...donation, currency: 'EUR' }, defaultSupportSettings)).toBeNull();
    expect(supportTier(donation, { ...defaultSupportSettings, mediumMin: 3, bigMin: 8 })).toBe(
      'big',
    );
    expect(supportSettingsSchema.safeParse({ ...defaultSupportSettings, bigMin: 5 }).success).toBe(
      false,
    );
  });
  it('upgrades existing v2 config and rejects invalid or oversized event inputs', () => {
    const old = { ...defaults };
    const { supportReactions: removed, ...withoutSupport } = old;
    expect(removed).toEqual(defaultSupportSettings);
    expect(configSchema.parse(withoutSupport).supportReactions).toEqual(defaultSupportSettings);
    const { event } = setup();
    expect(supportEventSchema.safeParse({ ...event('bad'), amount: -1 }).success).toBe(false);
    expect(supportEventSchema.safeParse({ ...event('bad'), id: 'x'.repeat(65) }).success).toBe(
      false,
    );
    expect(
      commandSchema.safeParse({
        type: 'preview-support-event',
        event: { kind: 'subscription', tier: 'provider-plan-42' },
      }).success,
    ).toBe(false);
  });
});

describe('support reaction policy', () => {
  it('schedules tiered targeted cues with honest provenance and no AI calls', () => {
    const { companion, event, clock } = setup();
    expect(companion.supportEvent(event('small')).accepted).toBe(true);
    let script = companion.state.performance.script;
    expect(script?.source).toBe('event');
    expect(script?.decidedBy.kind).toBe('rules');
    expect(script?.beats.some((value) => value.expression === 'thank-you')).toBe(true);
    expect(script?.beats.every((value) => value.target === 'chat')).toBe(true);
    clock.now += 9000;
    expect(companion.supportEvent(event('big', 50)).accepted).toBe(true);
    script = companion.state.performance.script;
    expect(script?.beats.some((value) => value.expression === 'happy-dance')).toBe(true);
    expect(script?.settle).toBe(true);
    expect(companion.state.performance.note).toContain('big reaction');
  });
  it('deduplicates per provider, skips stale/future events, and bounds bursts without a queue', () => {
    const { companion, event, clock } = setup();
    const original = event('one');
    expect(companion.supportEvent(original).accepted).toBe(true);
    const script = companion.state.performance.script;
    expect(companion.supportEvent(original).accepted).toBe(false);
    expect(companion.supportEvent(event('burst')).accepted).toBe(false);
    clock.now += 9000;
    expect(
      companion.supportEvent({ ...event('old'), receivedAt: clock.now - 15001 }).accepted,
    ).toBe(false);
    expect(
      companion.supportEvent({ ...event('future'), receivedAt: clock.now + 5001 }).accepted,
    ).toBe(false);
    expect(companion.state.performance.script).toEqual(script);
    expect(companion.supportEvent({ ...event('one'), provider: 'another-adapter' }).accepted).toBe(
      true,
    );
  });
  it('respects quiet, tuck, disable, currency, manual priority and stop', async () => {
    const { companion, event, clock } = setup();
    await companion.handle({ type: 'quiet', value: true });
    const quiet = event('quiet');
    expect(companion.supportEvent(quiet).accepted).toBe(false);
    await companion.handle({ type: 'quiet', value: false });
    expect(companion.supportEvent(quiet).accepted).toBe(false);
    await companion.handle({ type: 'retract', value: true });
    expect(companion.supportEvent(event('hidden')).accepted).toBe(false);
    await companion.handle({ type: 'retract', value: false });
    expect(companion.supportEvent({ ...event('currency'), currency: 'EUR' }).accepted).toBe(false);
    await companion.handle({ type: 'perform', expression: 'wave' });
    const manual = companion.state.performance.script;
    expect(companion.supportEvent(event('manual')).accepted).toBe(false);
    expect(companion.state.performance.script).toEqual(manual);
    await companion.handle({ type: 'cancel' });
    const stop = event('stop');
    expect(companion.supportEvent(stop).accepted).toBe(true);
    await companion.handle({ type: 'cancel' });
    expect(companion.state.performance.script).toBeNull();
    clock.now += 9000;
    expect(companion.supportEvent(stop).accepted).toBe(false);
    await companion.handle({
      type: 'configure',
      patch: { supportReactions: { ...defaultSupportSettings, enabled: false } },
    });
    expect(companion.supportEvent(event('disabled')).accepted).toBe(false);
  });
  it('yields while a streamer decision is pending without replacing it', async () => {
    const { companion, event } = setup();
    const saying = companion.handle({ type: 'say', text: 'Hello Tavi' });
    expect(companion.supportEvent(event('pending')).accepted).toBe(false);
    await saying;
    expect(companion.state.performance.script?.source).toBe('streamer');
  });
  it('labels previews as simulated and keeps subscriptions distinct from donations', async () => {
    const { companion } = setup();
    await companion.handle({
      type: 'preview-support-event',
      event: { kind: 'subscription', tier: 'medium' },
    });
    expect(companion.state.performance.note).toContain('Simulated subscription');
    expect(
      companion.state.performance.script?.beats.some((value) => value.caption === 'Welcome in!'),
    ).toBe(true);
    expect(companion.state.performance.script?.source).toBe('event');
  });
  it('does not start a foot dance over a seated body state', async () => {
    const { companion, event } = setup();
    await companion.handle({ type: 'state', state: 'sit' });
    expect(companion.state.performance.body).not.toBeNull();
    expect(companion.supportEvent(event('seated', 100)).accepted).toBe(true);
    expect(
      companion.state.performance.script?.beats.some((value) => value.expression === 'happy-dance'),
    ).toBe(false);
  });
  it('acknowledges a blocked explicit perch without a fictional ledge or movement', async () => {
    const { companion } = setup();
    await companion.handle({
      type: 'configure',
      patch: {
        scene: {
          ...defaults.scene,
          webcam: { ...defaults.scene.webcam, enabled: false },
          game: { ...defaults.scene.game, enabled: false },
        },
      },
    });
    await companion.handle({ type: 'state', state: 'perch' });
    expect(companion.state.performance.body).toBeNull();
    expect(companion.state.performance.movement).toBeNull();
    expect(companion.state.performance.script?.beats.map((value) => value.expression)).toContain(
      'perch-hesitate',
    );
  });
});
