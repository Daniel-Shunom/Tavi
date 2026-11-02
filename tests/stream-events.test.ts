import { describe, expect, it } from 'vitest';
import { defaults, commandSchema, type State } from '../shared/protocol';
import { mischiefFor } from '../shared/streamEvents';
import { isScolding } from '../server/behavior/scold';
import { reactionMood, shadeForMood, streamEventReaction } from '../server/behavior/streamEvents';
import { LifeDirector, type LifeContext } from '../server/behavior/life';
import { neutralAffect } from '../shared/affect';
import { AiManager, settingsFromEnv } from '../server/ai/manager';
import { Companion } from '../server/companion';
import { catalog } from '../src/renderer/characters/registry';

function setup() {
  const clock = { now: 1_000_000 };
  const ai = new AiManager(settingsFromEnv({}), undefined, () => clock.now);
  const companion = new Companion({ config: defaults, catalog, ai, now: () => clock.now });
  let state: State = companion.state;
  companion.subscribe((next) => (state = next));
  return { clock, companion, get: () => state };
}
const event = (clock: { now: number }, id: string) => ({ id, receivedAt: clock.now });

describe('stream events', () => {
  it('maps channel-point reward titles to mischief', () => {
    expect(mischiefFor('Poke Tavi')).toBe('poke');
    expect(mischiefFor('Make her DANCE')).toBe('dance');
    expect(mischiefFor('Feed Tavi a snack')).toBe('snack');
    expect(mischiefFor('Hydrate')).toBeNull();
  });

  it('scales reactions: a big raid and a gift bomb are bigger than a small one', () => {
    expect(streamEventReaction({ kind: 'raid', from: 'a', viewers: 50 }).size).toBe('large');
    expect(streamEventReaction({ kind: 'raid', from: 'a', viewers: 3 }).size).toBe('medium');
    expect(streamEventReaction({ kind: 'gift', user: 'a', count: 20 }).size).toBe('large');
    expect(streamEventReaction({ kind: 'follow', user: 'a' }).size).toBe('small');
    expect(streamEventReaction({ kind: 'hype-train', phase: 'end', level: 4 }).body).toBe('sit');
  });

  it('reacts with rules, lifts her mood, and batches a follow train into one reaction', () => {
    const t = setup();
    const before = t.get().performance.affect?.pleasure ?? 0;
    const first = t.companion.streamEvent({ kind: 'follow', user: 'ann', ...event(t.clock, 'f1') });
    expect(first.accepted).toBe(true);
    expect(t.get().performance.script?.decidedBy.label).toMatch(/not AI/);
    t.clock.now += 2000;
    expect(
      t.companion.streamEvent({ kind: 'follow', user: 'bob', ...event(t.clock, 'f2') }).accepted,
    ).toBe(false);
    t.clock.now += 1000;
    t.companion.tick();
    expect(t.get().performance.affect?.pleasure ?? 0).toBeGreaterThanOrEqual(before);
  });

  it('never replays, never acts in quiet mode, and drops stale events', () => {
    const t = setup();
    t.companion.streamEvent({ kind: 'raid', from: 'x', viewers: 5, ...event(t.clock, 'r1') });
    expect(
      t.companion.streamEvent({ kind: 'raid', from: 'x', viewers: 5, ...event(t.clock, 'r1') })
        .accepted,
    ).toBe(false);
    void t.companion.handle({ type: 'quiet', value: true });
    expect(
      t.companion.streamEvent({ kind: 'cheer', user: 'y', bits: 500, ...event(t.clock, 'c1') })
        .accepted,
    ).toBe(false);
    expect(
      t.companion.streamEvent({
        kind: 'cheer',
        user: 'y',
        bits: 500,
        id: 'old',
        receivedAt: t.clock.now - 60_000,
      }).accepted,
    ).toBe(false);
  });

  it('a raid walks her toward chat; the preview command is labelled as not real', async () => {
    const t = setup();
    expect(
      commandSchema.safeParse({
        type: 'preview-stream-event',
        event: { kind: 'raid', from: 'friend', viewers: 30 },
      }).success,
    ).toBe(true);
    await t.companion.handle({
      type: 'preview-stream-event',
      event: { kind: 'raid', from: 'friend', viewers: 30 },
    });
    expect(t.get().performance.note).toMatch(/^Preview \(not real\)/);
    expect(t.get().performance.movement?.source).toBe('chat');
  });
});

describe('scolding', () => {
  it('recognizes being told off, including her configured name', () => {
    for (const line of ['Tavi, stand down', 'bad tavi', 'no tavi!', 'Tavi stop it', 'bad Pip'])
      expect(isScolding(line, line.includes('Pip') ? 'Pip' : 'Tavi')).toBe(true);
    for (const line of ['Tavi you are great', 'that was a bad play', 'stand up tavi'])
      expect(isScolding(line, 'Tavi')).toBe(false);
  });

  it('makes her sad and tired, and she sulks seated by the webcam', async () => {
    const t = setup();
    const before = t.get().performance.affect;
    await t.companion.utterance({
      id: 's1',
      text: 'Tavi, stand down.',
      at: t.clock.now,
      via: 'typed',
    });
    const after = t.get().performance.affect;
    expect(after?.pleasure ?? 0).toBeLessThan(before?.pleasure ?? 0);
    expect(after?.fatigue ?? 0).toBeGreaterThan(before?.fatigue ?? 0);
    expect(t.get().performance.body?.state).toBe('sit');
    expect(t.get().performance.body?.spot?.rect).toBe('webcam');
    expect(t.get().performance.script?.beats.map((value) => value.expression)).toContain('sad');
  });
});

describe('faces follow mood', () => {
  const context = (affect: LifeContext['affect']): LifeContext => ({
    now: 0,
    persona: { personality: 'cozy', initiative: 'occasional', energy: 40 },
    affect,
    body: null,
    manualHold: false,
    quiet: false,
    retracted: false,
    busy: false,
    initiative: true,
    awayFromHome: true,
    places: { chat: true, webcam: true, game: false },
  });
  const faces = (affect: LifeContext['affect']) => {
    const life = new LifeDirector(0);
    const seen: string[] = [];
    for (let t = 0; t < 30 * 60_000; t += 1000) {
      const action = life.tick({ ...context(affect), now: t });
      if (action) seen.push(...action.beats.map((value) => value.expression));
    }
    return seen;
  };
  const negative = [
    'grossed-out',
    'wince',
    'annoyed',
    'eye-roll',
    'sad',
    'frown',
    'pout',
    'worried',
  ];
  it('an overwhelmed or upset Tavi is not smiley; she retreats to decompress', () => {
    const stressed = faces({ ...neutralAffect, overload: 0.9, pleasure: -0.4 });
    expect(stressed.filter((id) => negative.includes(id)).length).toBeGreaterThan(5);
    expect(stressed).not.toContain('grin');
    expect(stressed).not.toContain('soft-smile');
  });
  it('a happy Tavi smiles', () => {
    const happy = faces({ ...neutralAffect, pleasure: 0.5 });
    expect(happy.filter((id) => negative.includes(id))).toEqual([]);
  });
});

describe('stream reactions follow her mood', () => {
  const gift = streamEventReaction({ kind: 'gift', user: 'a', count: 20 });
  const faces = (reaction: ReturnType<typeof streamEventReaction>) =>
    reaction.beats.map((value) => value.expression);
  it('overwhelmed: winces instead of celebrating, stays put, plays muted', () => {
    const shaded = shadeForMood(gift, { ...neutralAffect, overload: 0.8 });
    expect(faces(shaded)).not.toContain('celebrate');
    expect(faces(shaded)).toContain('wince');
    expect(faces(shaded)).toContain('thank-you'); // still acknowledges it
    expect(shaded.note).toMatch(/overwhelmed/);
    const raid = shadeForMood(streamEventReaction({ kind: 'raid', from: 'x', viewers: 50 }), {
      ...neutralAffect,
      overload: 0.8,
    });
    expect(raid.toChat).toBe(false);
  });
  it('down: a small smile; tired: sleepy thanks; hyped: bigger; neutral: as written', () => {
    expect(faces(shadeForMood(gift, { ...neutralAffect, pleasure: -0.5 }))).toContain('soft-smile');
    expect(faces(shadeForMood(gift, { ...neutralAffect, fatigue: 0.8 }))).not.toContain(
      'celebrate',
    );
    const hyped = shadeForMood(gift, { ...neutralAffect, pleasure: 0.6, arousal: 0.5 });
    expect(hyped.beats[1]?.intensity ?? 0).toBeGreaterThan(gift.beats[1]?.intensity ?? 0);
    expect(shadeForMood(gift, neutralAffect)).toEqual(gift);
    expect(reactionMood(null)).toBeNull();
  });
});
