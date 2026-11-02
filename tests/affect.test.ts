import { describe, expect, it } from 'vitest';
import {
  Affect,
  affectRules,
  baseline,
  effectiveEnergy,
  neutralAffect,
  restScale,
  type AffectPersona,
} from '../shared/affect';
import { PacingDirector, pacingRules } from '../server/behavior/pacing';
import { StateDirector, type DirectorContext } from '../server/behavior/states';
import { quietSchedule } from '../shared/states';
import { defaults, stateSchema } from '../shared/protocol';
import { AiManager, settingsFromEnv } from '../server/ai/manager';
import { Companion } from '../server/companion';
import { catalog } from '../src/renderer/characters/registry';

const cozy: AffectPersona = { personality: 'cozy', attitude: 'cheeky', energy: 40 };
const minute = 60_000;

describe('affect: emotion -> mood -> personality', () => {
  it('rests at a personality baseline: playful is livelier and bolder than shy', () => {
    const playful = baseline({ ...cozy, personality: 'playful' });
    const shy = baseline({ ...cozy, personality: 'shy' });
    expect(playful.arousal).toBeGreaterThan(shy.arousal);
    expect(playful.dominance).toBeGreaterThan(shy.dominance);
    expect(baseline({ ...cozy, energy: 90 }).arousal).toBeGreaterThan(baseline(cozy).arousal);
  });

  it('a raid lifts pleasure and arousal at once, then mood relaxes back to baseline', () => {
    const affect = new Affect(0, cozy);
    const before = affect.snapshot();
    affect.feel(1000, 'raid');
    const right = affect.snapshot();
    expect(right.pleasure).toBeGreaterThan(before.pleasure);
    expect(right.arousal).toBeGreaterThan(before.arousal);
    affect.step(30 * minute, false);
    const later = affect.snapshot();
    expect(later.arousal).toBeCloseTo(baseline(cozy).arousal, 1);
    expect(later.pleasure).toBeCloseTo(baseline(cozy).pleasure, 1);
  });

  it('saturates: a flood of events never pins mood beyond the scale', () => {
    const affect = new Affect(0, cozy);
    for (let i = 0; i < 200; i++) affect.feel(i * 100, 'support-large');
    const snapshot = affect.snapshot();
    expect(snapshot.pleasure).toBeLessThanOrEqual(1);
    expect(snapshot.arousal).toBeLessThanOrEqual(1);
    expect(snapshot.overload).toBeGreaterThan(0.5);
    expect(snapshot.label).toContain('overwhelmed');
  });

  it('gets bored when nothing happens and perks up when chat talks to her', () => {
    const affect = new Affect(0, cozy);
    affect.step(20 * minute, false);
    expect(affect.snapshot().boredom).toBeGreaterThan(0.6);
    for (let i = 0; i < 4; i++) affect.feel(20 * minute + i * 1000, 'addressed');
    expect(affect.snapshot().boredom).toBe(0);
  });

  it('tires over a long stream and recovers while napping', () => {
    const affect = new Affect(0, cozy);
    affect.step(3 * 3_600_000, false);
    const tired = affect.snapshot().fatigue;
    expect(tired).toBeGreaterThan(0.6);
    expect(affect.snapshot().label).toMatch(/sleepy/);
    affect.step(3 * 3_600_000 + affectRules.recoverFullMs, true);
    expect(affect.snapshot().fatigue).toBe(0);
  });

  it('shades timing and motion, never replaces the streamer settings', () => {
    const tired = { ...neutralAffect, fatigue: 0.9, boredom: 1 };
    const hyped = { ...neutralAffect, arousal: 0.8 };
    expect(restScale(tired)).toBeLessThan(0.6);
    expect(restScale(hyped)).toBeGreaterThan(1.4);
    expect(effectiveEnergy(40, null)).toBe(40);
    expect(effectiveEnergy(40, hyped)).toBeGreaterThan(55);
    expect(effectiveEnergy(40, tired)).toBeLessThan(25);
    expect(effectiveEnergy(100, hyped)).toBe(100);
  });
});

describe('pacing director', () => {
  it('relaxes after a peak: later automatic reactions play softer, then recover', () => {
    const pacing = new PacingDirector(0);
    expect(pacing.react(0, 'large')).toBe(1);
    expect(pacing.react(1000, 'medium')).toBe(1); // crosses the peak
    expect(pacing.phase(2000)).toBe('relax');
    expect(pacing.allowsInitiative(2000)).toBe(false);
    expect(pacing.react(3000, 'small')).toBe(pacingRules.relaxIntensity);
    expect(pacing.phase(5 * minute)).toBe('build');
    expect(pacing.react(5 * minute, 'small')).toBe(1);
  });
});

describe('affect in the body-state rules', () => {
  const persona = {
    personality: 'cozy',
    initiative: 'occasional',
    energy: 40,
    chatEngagement: 20,
  } as const;
  const context = (now: number, partial: Partial<DirectorContext> = {}): DirectorContext => ({
    now,
    persona,
    quiet: false,
    retracted: false,
    body: null,
    streamerBusy: false,
    available: { sit: true, perch: true, lean: true },
    ...partial,
  });
  it('a tired Tavi settles sooner; an excited one stays up', () => {
    const settle = quietSchedule(persona).settle;
    const at = settle * 0.6;
    expect(new StateDirector(0).tick(context(at))).toBeNull();
    expect(new StateDirector(0).tick(context(at, { restScale: 0.5 }))?.reason).toMatch(/settling/);
    expect(new StateDirector(0).tick(context(settle * 1.1, { restScale: 1.5 }))).toBeNull();
  });
});

describe('companion publishes affect', () => {
  it('reports a validated mood snapshot and reacts to support events', () => {
    const clock = { now: 1_000_000 };
    const ai = new AiManager(settingsFromEnv({}), undefined, () => clock.now);
    const companion = new Companion({ config: defaults, catalog, ai, now: () => clock.now });
    let latest = companion.state;
    companion.subscribe((state) => (latest = state));
    expect(stateSchema.parse(latest).performance.affect).not.toBeNull();
    const before = latest.performance.affect?.pleasure ?? 0;
    clock.now += 1000;
    companion.supportEvent(
      {
        id: 'sub-1',
        provider: 'studio-preview',
        kind: 'subscription',
        tier: 'big',
        receivedAt: clock.now,
      },
      true,
    );
    clock.now += 1000;
    companion.tick();
    expect(latest.performance.affect?.pleasure ?? 0).toBeGreaterThan(before);
    expect(stateSchema.safeParse(latest).success).toBe(true);
  });
});
