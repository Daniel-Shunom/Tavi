import { describe, expect, it } from 'vitest';
import { LifeDirector, type LifeContext } from '../server/behavior/life';
import { neutralAffect, type AffectSnapshot } from '../shared/affect';
import { defaults } from '../shared/protocol';
import { AiManager, settingsFromEnv } from '../server/ai/manager';
import { Companion } from '../server/companion';
import { catalog } from '../src/renderer/characters/registry';

const context = (now: number, partial: Partial<LifeContext> = {}): LifeContext => ({
  now,
  persona: { personality: 'cozy', initiative: 'occasional', energy: 40 },
  affect: neutralAffect,
  body: null,
  manualHold: false,
  quiet: false,
  retracted: false,
  busy: false,
  initiative: true,
  awayFromHome: false,
  places: { chat: true, webcam: true, game: false },
  ...partial,
});

function run(affect: AffectSnapshot, minutes: number, partial: Partial<LifeContext> = {}) {
  const life = new LifeDirector(0);
  const picks: string[] = [];
  for (let t = 0; t < minutes * 60_000; t += 1000) {
    const action = life.tick(context(t, { affect, ...partial }));
    if (action) picks.push(action.activity);
  }
  return picks;
}

describe('autonomous life', () => {
  it('keeps doing things when nothing happens, without repeating itself back to back', () => {
    const picks = run(neutralAffect, 30);
    expect(picks.length).toBeGreaterThan(15);
    expect(new Set(picks).size).toBeGreaterThanOrEqual(4);
    const repeats = picks.filter((id, i) => i > 0 && id === picks[i - 1]).length;
    expect(repeats / picks.length).toBeLessThan(0.2);
  });

  it('a bored, lively Tavi travels and plays; a tired one stretches and stays put', () => {
    const bored = run({ ...neutralAffect, boredom: 1, arousal: 0.5, pleasure: 0.3 }, 30);
    const tired = run({ ...neutralAffect, fatigue: 0.9 }, 30);
    const travelling = (ids: string[]) =>
      ids.filter((id) => ['wander', 'visit-chat', 'play'].includes(id)).length / ids.length;
    expect(travelling(bored)).toBeGreaterThan(travelling(tired));
    expect(tired.filter((id) => id === 'stretch').length).toBeGreaterThan(0);
    expect(tired.length).toBeLessThan(bored.length);
  });

  it('never acts in quiet mode, while tucked away, asleep, busy or right after a manual choice', () => {
    for (const partial of [
      { quiet: true },
      { retracted: true },
      { body: 'nap' as const },
      { body: 'doze' as const },
      { busy: true },
      { initiative: false },
      { manualHold: true },
    ])
      expect(run(neutralAffect, 10, partial)).toEqual([]);
  });

  it('reserved initiative stays in place', () => {
    const picks = run({ ...neutralAffect, boredom: 1, arousal: 0.6 }, 60, {
      persona: { personality: 'cozy', initiative: 'reserved', energy: 40 },
    });
    expect(picks.some((id) => ['wander', 'visit-chat'].includes(id))).toBe(false);
  });

  it('the companion wanders on her own on an idle stream', () => {
    const clock = { now: 1_000_000 };
    const ai = new AiManager(settingsFromEnv({}), undefined, () => clock.now);
    const companion = new Companion({ config: defaults, catalog, ai, now: () => clock.now });
    const notes = new Set<string>();
    let moved = 0;
    companion.subscribe((state) => {
      notes.add(state.performance.note);
      if (state.performance.movement?.source === 'idle') moved++;
    });
    for (let i = 0; i < 5 * 60; i++) {
      clock.now += 1000;
      companion.tick();
    }
    expect([...notes].some((note) => note.includes('(life:'))).toBe(true);
    expect(moved).toBeGreaterThan(0);
  });
});
