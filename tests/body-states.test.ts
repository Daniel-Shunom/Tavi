import { describe, expect, it } from 'vitest';
import { configSchema, defaults, migrateConfig } from '../shared/protocol';
import {
  defaultScene,
  nominalStage,
  quietSchedule,
  resolveSpot,
  atSpotApproach,
  type Scene,
} from '../shared/states';
import { ChatBurst, StateDirector, type DirectorContext } from '../server/behavior/states';
import { AiManager, settingsFromEnv } from '../server/ai/manager';
import { Companion } from '../server/companion';
import { stateRequest } from '../server/ai/rules';
import { decisionSchema } from '../shared/decision';
import { catalog } from '../src/renderer/characters/registry';

const home = { x: defaults.x, y: defaults.y };

describe('scene spots', () => {
  it('sits on the webcam top edge when it is within reach, at the edge height', () => {
    const spot = resolveSpot('sit', { scene: defaultScene, home, prefer: 'ledge' });
    expect(spot?.surface).toBe('ledge');
    expect(spot?.rect).toBe('webcam');
    expect(spot?.y).toBeCloseTo(defaultScene.webcam.y);
    // Walks to the floor below the seat before jumping up.
    expect(spot?.approach.y).toBeCloseTo(home.y);
    expect(spot?.approach.x).toBeCloseTo(spot?.x ?? 0);
  });
  it('falls back to the floor when the ledge is out of reach (above 1.2 body heights)', () => {
    const scene: Scene = { ...defaultScene, webcam: { ...defaultScene.webcam, y: 0.3, h: 0.4 } };
    expect((home.y - 0.3) / nominalStage.bodyHeight).toBeGreaterThan(1.2);
    expect(resolveSpot('sit', { scene, home, prefer: 'ledge' })?.surface).toBe('floor');
    expect(resolveSpot('perch', { scene, home })).toBeNull();
  });
  it('perches on top of the webcam and naps at the same ledge where it sat', () => {
    expect(resolveSpot('perch', { scene: defaultScene, home })?.surface).toBe('top');
    const ledge = resolveSpot('sit', { scene: defaultScene, home, prefer: 'ledge' });
    const nap = resolveSpot('nap', {
      scene: defaultScene,
      home,
      current: { state: 'doze', spot: ledge },
    });
    expect(nap).toEqual(ledge);
  });
  it('dozes where it already sits', () => {
    const ledge = resolveSpot('sit', { scene: defaultScene, home, prefer: 'ledge' });
    const doze = resolveSpot('doze', {
      scene: defaultScene,
      home,
      current: { state: 'sit', spot: ledge },
    });
    expect(doze).toEqual(ledge);
  });
  it('peeks from beside the chat panel, outside it, facing it', () => {
    const spot = resolveSpot('peek', { scene: defaultScene, home });
    expect(spot?.side).toBe(1);
    expect(spot?.approach.x).toBeLessThan(defaultScene.chat.x);
    expect(spot?.edgeX).toBeCloseTo(defaultScene.chat.x);
  });
  it('treats a nearby home location at chat as already at its visit destination', () => {
    const chatHome = { x: 0.82, y: 0.63 };
    const spot = resolveSpot('peek', { scene: defaultScene, home: chatHome });
    expect(atSpotApproach(chatHome, spot)).toBe(true);
    expect(atSpotApproach(home, spot)).toBe(false);
  });
  it('leans on the nearest reachable vertical frame edge, standing outside the frame', () => {
    const spot = resolveSpot('lean', { scene: defaultScene, home });
    expect(spot?.surface).toBe('side');
    const right = defaultScene.webcam.x + defaultScene.webcam.w;
    expect(spot?.edgeX).toBeCloseTo(right);
    expect(spot?.side).toBe(-1);
    expect(spot?.x).toBeGreaterThan(right);
  });
  it('uses the configured floor line instead of home when set', () => {
    const scene: Scene = { ...defaultScene, floor: 0.8 };
    expect(resolveSpot('nap', { scene, home })?.y).toBeCloseTo(0.8);
  });
});

describe('config migration', () => {
  it('adds the default scene to saved v2 configs without one', () => {
    const saved: Record<string, unknown> = { ...defaults };
    delete saved['scene'];
    const parsed = configSchema.parse(saved);
    expect(parsed.scene).toEqual(defaultScene);
    expect(parsed.x).toBe(defaults.x);
  });
  it('adds the default scene to legacy unversioned configs', () => {
    const migrated = configSchema.parse(migrateConfig({ name: 'Pip', anchor: 'chat', x: 0.8 }));
    expect(migrated.scene).toEqual(defaultScene);
    expect(migrated.name).toBe('Pip');
  });
  it('keeps an edited scene', () => {
    const scene = { ...defaultScene, chat: { ...defaultScene.chat, x: 0.5 } };
    expect(configSchema.parse({ ...defaults, scene }).scene.chat.x).toBe(0.5);
  });
});

const persona = {
  personality: 'cozy',
  initiative: 'occasional',
  energy: 40,
  chatEngagement: 20,
} as const;

describe('chat burst detection', () => {
  it('needs the floor count from at least three chatters within 30 s', () => {
    const burst = new ChatBurst();
    for (let i = 0; i < 11; i++) burst.add(1000 + i * 1000, `u${String(i % 4)}`);
    expect(burst.isBurst(12_000, persona)).toBe(false);
    burst.add(12_500, 'u1');
    expect(burst.isBurst(13_000, persona)).toBe(true);
    // Same rate from two people is not a burst.
    const pair = new ChatBurst();
    for (let i = 0; i < 20; i++) pair.add(1000 + i * 500, `u${String(i % 2)}`);
    expect(pair.isBurst(11_000, persona)).toBe(false);
  });
  it('compares against the channel baseline: a busy channel needs 3x its normal rate', () => {
    const burst = new ChatBurst();
    // 30 minutes of steady chat at 10 messages / 30 s.
    for (let t = 0; t < 1_800_000; t += 3000) burst.add(t, `u${String((t / 3000) % 5)}`);
    expect(burst.threshold(persona)).toBeGreaterThan(20);
    expect(burst.isBurst(1_800_000, persona)).toBe(false);
  });
  it('scales the floor with chat engagement and initiative', () => {
    const burst = new ChatBurst();
    expect(burst.threshold(persona)).toBe(12);
    expect(burst.threshold({ ...persona, initiative: 'reserved' })).toBe(24);
    expect(burst.threshold({ ...persona, initiative: 'outgoing' })).toBe(9);
    expect(burst.threshold({ ...persona, chatEngagement: 100 })).toBe(6);
  });
});

function context(now: number, partial: Partial<DirectorContext> = {}): DirectorContext {
  return {
    now,
    persona,
    quiet: false,
    retracted: false,
    body: null,
    streamerBusy: false,
    available: { sit: true, perch: true, lean: true },
    ...partial,
  };
}

describe('quiet-time chain', () => {
  it('settles, dozes and lies down at the scheduled times for the persona', () => {
    const schedule = quietSchedule(persona);
    // cozy x0.7, energy 40 -> x0.95: settle ~2 min, doze ~6 min, lie ~8 min.
    expect(schedule.settle / 1000).toBeCloseTo(119.7, 0);
    expect(schedule.doze / 1000).toBeCloseTo(359.1, 0);
    expect(schedule.lie / 1000).toBeCloseTo(478.8, 0);
    const director = new StateDirector(0);
    let state = 'stand' as 'stand' | 'sit' | 'doze' | 'nap';
    const changes: [number, string][] = [];
    for (let t = 1000; t <= 600_000; t += 1000) {
      const action = director.tick(
        context(t, {
          body:
            state === 'stand'
              ? null
              : {
                  id: 'b',
                  sourceEventId: 'e',
                  source: 'idle',
                  decidedBy: { kind: 'rules', label: 'Rules (not AI)' },
                  priority: 0,
                  state,
                  spot: null,
                  from: null,
                  startAt: t,
                  seed: 1,
                },
          available: { sit: true, perch: false, lean: false },
        }),
      );
      if (action) {
        changes.push([t / 1000, action.state]);
        state = action.state as typeof state;
      }
    }
    expect(changes).toEqual([
      [120, 'sit'],
      [360, 'doze'],
      [479, 'nap'],
    ]);
  });
  it('playful waits longer than cozy, and reserved initiative stretches every stage', () => {
    const cozy = quietSchedule(persona);
    const playful = quietSchedule({ ...persona, personality: 'playful' });
    const reserved = quietSchedule({ ...persona, initiative: 'reserved' });
    expect(playful.settle).toBeGreaterThan(cozy.settle);
    expect(reserved.lie).toBeGreaterThan(cozy.lie);
  });
  it('does nothing in quiet mode, while the streamer is busy or while tucked away', () => {
    const director = new StateDirector(0);
    expect(director.tick(context(1_000_000, { quiet: true }))).toBeNull();
    expect(director.tick(context(1_000_000, { streamerBusy: true }))).toBeNull();
    expect(director.tick(context(1_000_000, { retracted: true }))).toBeNull();
  });
  it('resets the quiet clock on engagement and stays awake while chat is lively', () => {
    const director = new StateDirector(0);
    director.engage(100_000, 'addressed');
    expect(director.tick(context(150_000))).toBeNull();
    const sitting = {
      id: 'b',
      sourceEventId: 'e',
      source: 'idle' as const,
      decidedBy: { kind: 'rules' as const, label: 'Rules (not AI)' },
      priority: 0,
      state: 'sit' as const,
      spot: null,
      from: null,
      startAt: 0,
      seed: 1,
    };
    for (let i = 0; i < 4; i++) director.chat(999_000 + i, 'u' + String(i));
    expect(director.tick(context(1_000_000, { body: sitting }))).toBeNull();
    expect(director.tick(context(1_100_000, { body: sitting }))?.state).toBe('doze');
  });
  it('wakes urgently for the studio, with a stretch for chat, and only stirs for one message', () => {
    const director = new StateDirector(0);
    const nap = {
      id: 'b',
      sourceEventId: 'e',
      source: 'idle' as const,
      decidedBy: { kind: 'rules' as const, label: 'Rules (not AI)' },
      priority: 0,
      state: 'nap' as const,
      spot: null,
      from: null,
      startAt: 0,
      seed: 1,
    };
    expect(director.wakeFor('studio', nap)).toMatchObject({ state: 'stand', wake: 'urgent' });
    expect(director.wakeFor('addressed', nap)).toMatchObject({ state: 'stand', wake: 'normal' });
    expect(director.wakeFor('studio', { ...nap, state: 'doze' })?.state).toBe('sit');
    expect(director.stir(1000, nap)).toBe(true);
    expect(director.stir(5000, nap)).toBe(false);
    expect(director.stir(1000, null)).toBe(false);
  });
});

function companion(config = defaults) {
  const clock = { now: 1_000_000 };
  const ai = new AiManager(settingsFromEnv({}), undefined, () => clock.now);
  const instance = new Companion({ config, catalog, ai, now: () => clock.now });
  return { clock, instance };
}
async function burst(c: ReturnType<typeof companion>, count = 14) {
  for (let i = 0; i < count; i++) {
    c.clock.now += 1000;
    await c.instance.chat({
      id: 'm' + String(c.clock.now),
      userId: 'viewer' + String(i % 5),
      author: 'viewer',
      text: 'LETS GO',
      receivedAt: c.clock.now,
    });
  }
}

describe('companion body states', () => {
  it('does not start a redundant chat approach when home is already at chat', async () => {
    const c = companion({ ...defaults, anchor: 'chat', x: 0.82, y: 0.63 });
    await c.instance.handle({ type: 'state', state: 'peek' });
    expect(c.instance.state.performance.body).toBeNull();
    expect(c.instance.state.performance.movement).toBeNull();
  });
  it('walks over and peeks at chat on a burst, then returns when chat calms down', async () => {
    const c = companion();
    await burst(c);
    const body = c.instance.state.performance.body;
    expect(body?.state).toBe('peek');
    expect(body?.decidedBy.kind).toBe('rules');
    expect(c.instance.state.performance.movement?.to.x).toBeCloseTo(body?.spot?.approach.x ?? 0);
    c.clock.now += 60_000;
    c.instance.tick();
    expect(c.instance.state.performance.body?.state).toBe('stand');
    expect(c.instance.state.performance.movement).toBeNull();
  });
  it('does not peek in quiet mode and peeks at most once per cooldown', async () => {
    const quiet = companion();
    await quiet.instance.handle({ type: 'quiet', value: true });
    await burst(quiet);
    expect(quiet.instance.state.performance.body).toBeNull();
    const busy = companion();
    await burst(busy);
    busy.clock.now += 60_000;
    busy.instance.tick();
    await burst(busy);
    expect(busy.instance.state.performance.body?.state).toBe('stand');
  });
  it('lets the streamer pick a state, labelled manual, and tucking away clears it', async () => {
    const c = companion();
    await c.instance.handle({ type: 'state', state: 'sit' });
    const body = c.instance.state.performance.body;
    expect(body?.state).toBe('sit');
    expect(body?.spot?.surface).toBe('ledge');
    expect(body?.decidedBy.kind).toBe('manual');
    expect(body?.from?.state).toBe('stand');
    await c.instance.handle({ type: 'state', state: 'nap' });
    expect(c.instance.state.performance.body?.from?.state).toBe('sit');
    await c.instance.handle({ type: 'retract', value: true });
    expect(c.instance.state.performance.body).toBeNull();
  });
  it('stands beside chat without returning to or changing configured home', async () => {
    const c = companion();
    await c.instance.handle({ type: 'state', state: 'peek' });
    const position = c.instance.state.performance.body?.spot?.approach;
    expect(position).toBeDefined();
    await c.instance.handle({ type: 'state', state: 'stand' });
    expect(c.instance.state.performance.body?.state).toBe('stand');
    expect(c.instance.state.performance.body?.spot?.approach).toEqual(position);
    expect(c.instance.state.performance.movement?.to).toEqual(position);
    expect({ x: c.instance.state.config.x, y: c.instance.state.config.y }).toEqual(home);
  });
  it('uses the live click position to stop a manual walk in place', async () => {
    const c = companion();
    await c.instance.handle({ type: 'move', kind: 'move-to', to: { x: 0.8, y: 0.85 } });
    const position = { x: 0.48, y: 0.82 };
    await c.instance.handle({ type: 'state', state: 'stand', position });
    expect(c.instance.state.performance.body?.spot?.approach).toEqual(position);
    expect(c.instance.state.performance.movement?.to).toEqual(position);
    expect({ x: c.instance.state.config.x, y: c.instance.state.config.y }).toEqual(home);
  });
  it('a manual state is not overridden by automatic triggers for two minutes', async () => {
    const c = companion();
    await c.instance.handle({ type: 'state', state: 'perch' });
    await burst(c);
    expect(c.instance.state.performance.body?.state).toBe('perch');
  });
  it('wakes from a nap: urgent for a studio gesture, with a stretch for typed lines', async () => {
    const c = companion();
    await c.instance.handle({ type: 'state', state: 'nap' });
    await c.instance.handle({ type: 'perform', expression: 'wave' });
    expect(c.instance.state.performance.body).toMatchObject({ state: 'stand', wake: 'urgent' });
    await c.instance.handle({ type: 'state', state: 'nap' });
    await c.instance.handle({ type: 'say', text: 'hello there' });
    expect(c.instance.state.performance.body).toMatchObject({ state: 'stand', wake: 'normal' });
  });
  it('one unaddressed chat message only stirs a napping Tavi', async () => {
    const c = companion();
    await c.instance.handle({ type: 'state', state: 'nap' });
    c.clock.now += 1000;
    await c.instance.chat({
      id: 'x',
      userId: 'v',
      author: 'v',
      text: 'hi chat',
      receivedAt: c.clock.now,
    });
    const body = c.instance.state.performance.body;
    expect(body?.state).toBe('nap');
    expect(body?.stirAt).toBe(c.clock.now);
  });
  it('the streamer can ask for a state in words; rules decide it, not AI', async () => {
    expect(stateRequest('ok tavi, take a nap')).toBe('nap');
    expect(stateRequest('go check chat')).toBe('peek');
    expect(stateRequest('nice shot')).toBeNull();
    const c = companion();
    await c.instance.handle({ type: 'say', text: 'Tavi, take a nap' });
    const body = c.instance.state.performance.body;
    expect(body?.state).toBe('nap');
    expect(body?.decidedBy.label).toContain('not AI');
  });
  it('validates provider state requests against the allowed vocabulary', () => {
    const schema = decisionSchema();
    const base = {
      react: true,
      reason: '',
      sequence: null,
      caption: '',
      target: 'neutral',
      beats: [],
      move: null,
    };
    expect(schema.parse({ ...base, state: 'nap' }).state).toBe('nap');
    expect(
      schema.parse({ ...base, beats: [{ expression: 'wave' }], state: 'fly' }).state,
    ).toBeNull();
    expect(schema.safeParse({ ...base, state: null }).success).toBe(false);
  });
});
