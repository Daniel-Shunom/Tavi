import { describe, expect, it } from 'vitest';
import { LifeDirector, type LifeContext } from '../server/behavior/life';
import { neutralAffect, type AffectSnapshot } from '../shared/affect';
import { defaults, type Command } from '../shared/protocol';
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

describe('autonomous life over a quiet stream', () => {
  it('keeps getting up and walking around for 20 minutes instead of sitting for good', () => {
    const clock = { now: 1_000_000 };
    const ai = new AiManager(settingsFromEnv({}), undefined, () => clock.now);
    const companion = new Companion({ config: defaults, catalog, ai, now: () => clock.now });
    const walks = new Set<string>();
    const minutesWithWalk = new Set<number>();
    companion.subscribe((state) => {
      const movement = state.performance.movement;
      if (movement?.source === 'idle' && !walks.has(movement.id)) {
        walks.add(movement.id);
        minutesWithWalk.add(Math.floor((clock.now - 1_000_000) / 300_000));
      }
    });
    for (let i = 0; i < 20 * 60; i++) {
      clock.now += 1000;
      companion.tick();
    }
    expect(walks.size).toBeGreaterThanOrEqual(8);
    // Walking happens throughout, not just in the first few minutes: every 5-minute block.
    expect(minutesWithWalk.size).toBe(4);
  });
});

describe('manual controls pause autonomous life, then it resumes', () => {
  async function firstWalkAfter(commands: Command[]) {
    const clock = { now: 1_000_000 };
    const ai = new AiManager(settingsFromEnv({}), undefined, () => clock.now);
    const companion = new Companion({ config: defaults, catalog, ai, now: () => clock.now });
    for (let i = 0; i < 60; i++) {
      clock.now += 1000;
      companion.tick();
    }
    for (const command of commands) {
      await companion.handle(command);
      clock.now += 2000;
      companion.tick();
    }
    const start = clock.now;
    let first = -1;
    const seen = new Set<string>();
    companion.subscribe((state) => {
      const movement = state.performance.movement;
      if (movement?.source === 'idle' && !seen.has(movement.id)) {
        seen.add(movement.id);
        if (first < 0) first = clock.now - start;
      }
    });
    for (let i = 0; i < 10 * 60; i++) {
      clock.now += 1000;
      companion.tick();
    }
    return { first: first / 1000, walks: seen.size };
  }
  it.each([
    ['an expression', [{ type: 'perform', expression: 'wave' }], 0, 30],
    ['cancel', [{ type: 'cancel' }], 0, 30],
    [
      'quiet mode on and off',
      [
        { type: 'quiet', value: true },
        { type: 'quiet', value: false },
      ],
      0,
      40,
    ],
    [
      'tuck away and back',
      [
        { type: 'retract', value: true },
        { type: 'retract', value: false },
      ],
      0,
      40,
    ],
    ['a manual move', [{ type: 'move', kind: 'move-to', anchor: 'chat' }], 50, 75],
    ['a new home spot', [{ type: 'configure', patch: { x: 0.5, y: 0.72 } }], 50, 75],
    ['a manual pose', [{ type: 'state', state: 'sit' }], 110, 140],
  ] as [string, Command[], number, number][])('%s', async (_, commands, low, high) => {
    const result = await firstWalkAfter(commands);
    expect(result.first).toBeGreaterThanOrEqual(low);
    expect(result.first).toBeLessThanOrEqual(high);
    expect(result.walks).toBeGreaterThanOrEqual(8);
  });
});

describe('pacing calms her, sulking stills her', () => {
  it('after a run of big moments she keeps walking, just calmer and without play', () => {
    const calm = run({ ...neutralAffect, boredom: 1, arousal: 0.6, pleasure: 0.4 }, 30, {
      initiative: false,
    });
    const normal = run({ ...neutralAffect, boredom: 1, arousal: 0.6, pleasure: 0.4 }, 30);
    expect(calm.length).toBeGreaterThan(5);
    expect(calm.length).toBeLessThan(normal.length);
    expect(calm).not.toContain('play');
  });

  it('a flurry of stream event previews does not freeze her for long', async () => {
    const clock = { now: 1_000_000 };
    const ai = new AiManager(settingsFromEnv({}), undefined, () => clock.now);
    const companion = new Companion({ config: defaults, catalog, ai, now: () => clock.now });
    const events: Command[] = [
      { type: 'preview-stream-event', event: { kind: 'raid', from: 'a', viewers: 50 } },
      { type: 'preview-stream-event', event: { kind: 'gift', user: 'b', count: 20 } },
      { type: 'preview-stream-event', event: { kind: 'cheer', user: 'c', bits: 5000 } },
      { type: 'preview-stream-event', event: { kind: 'hype-train', phase: 'begin', level: 1 } },
      {
        type: 'preview-stream-event',
        event: { kind: 'subscription', user: 'd', tier: '3000', gifted: false },
      },
    ];
    for (const command of events) {
      await companion.handle(command);
      clock.now += 3000;
      companion.tick();
    }
    const start = clock.now;
    let first = -1;
    companion.subscribe((state) => {
      if (first < 0 && state.performance.movement?.source === 'idle') first = clock.now - start;
    });
    for (let i = 0; i < 5 * 60; i++) {
      clock.now += 1000;
      companion.tick();
    }
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(90_000);
  });

  it('told to stand down, she stays put for about four minutes, longer if scolded again', async () => {
    const clock = { now: 1_000_000 };
    const ai = new AiManager(settingsFromEnv({}), undefined, () => clock.now);
    const companion = new Companion({ config: defaults, catalog, ai, now: () => clock.now });
    const walksBetween = (from: number, to: number, log: number[]) =>
      log.filter((at) => at >= from && at < to).length;
    const walks: number[] = [];
    const seen = new Set<string>();
    companion.subscribe((state) => {
      const movement = state.performance.movement;
      if (movement?.source === 'idle' && !seen.has(movement.id)) {
        seen.add(movement.id);
        walks.push(clock.now);
      }
    });
    const scoldAt = clock.now;
    await companion.utterance({ id: 's1', text: 'Tavi, stand down', at: clock.now, via: 'typed' });
    clock.now += 10_000;
    await companion.utterance({ id: 's2', text: 'bad tavi', at: clock.now, via: 'typed' });
    for (let i = 0; i < 12 * 60; i++) {
      clock.now += 1000;
      companion.tick();
    }
    const minute = 60_000;
    // No walking while sulking (two scoldings: about six minutes).
    expect(walksBetween(scoldAt, scoldAt + 5.5 * minute, walks)).toBe(0);
    // Then she gets going again.
    expect(walksBetween(scoldAt + 5.5 * minute, scoldAt + 12 * minute, walks)).toBeGreaterThan(2);
  });
});

describe('making up after a scolding', () => {
  it.each([
    ['sorry tavi', true],
    ["it's okay Tavi", true],
    ['good girl', true],
    ['tavi come back', true],
    ['the Stand button', false],
  ])('%s gets her walking again within a minute', async (line, spoken) => {
    const clock = { now: 1_000_000 };
    const ai = new AiManager(settingsFromEnv({}), undefined, () => clock.now);
    const companion = new Companion({ config: defaults, catalog, ai, now: () => clock.now });
    await companion.utterance({ id: 's1', text: 'Tavi, stand down', at: clock.now, via: 'typed' });
    clock.now += 20_000;
    companion.tick();
    if (spoken) await companion.utterance({ id: 'f1', text: line, at: clock.now, via: 'typed' });
    else await companion.handle({ type: 'state', state: 'stand' });
    const start = clock.now;
    let first = -1;
    companion.subscribe((state) => {
      if (first < 0 && state.performance.movement?.source === 'idle') first = clock.now - start;
    });
    for (let i = 0; i < 3 * 60; i++) {
      clock.now += 1000;
      companion.tick();
    }
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(spoken ? 60_000 : 130_000);
  });
});
