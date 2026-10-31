import { describe, expect, it } from 'vitest';
import { defaultScene, resolveSpot, type BodyCue, type BodyStateId } from '../shared/states';
import { mascotStates } from '../src/renderer/characters/mascot/states';
import { G_BH } from '../src/renderer/motion/core/physics';
import {
  enterPlan,
  exitPlan,
  heldKey,
  sampleTimeline,
  shortcutPlan,
  solveLean,
  solveLie,
  type PlanContext,
  type Timeline,
} from '../src/renderer/motion/states/plan';
import { BodyStatePlayer, type PlayerFrame } from '../src/renderer/motion/states/player';
import { applyStateKey } from '../src/renderer/motion/states/apply';
import { neutralPose } from '../src/renderer/motion/types';
import type { ContactPoint, KeyPose } from '../src/renderer/motion/states/types';

const home = { x: 0.23, y: 0.72 };
const stage = { aspect: 16 / 9, bodyHeight: 176 / 720, margin: 0.02 };
const ledge = resolveSpot('sit', { scene: defaultScene, home, prefer: 'ledge' });
const perch = resolveSpot('perch', { scene: defaultScene, home });
const floor = resolveSpot('sit', { scene: defaultScene, home, prefer: 'floor' });
const gap = ledge ? (ledge.approach.y - ledge.y) / stage.bodyHeight : 0;
const context = (spotGap = 0): PlanContext => ({
  rig: mascotStates,
  gap: spotGap,
  edgeDistance: 0.3,
  reducedMotion: false,
});
/** Height above the floor of a rest-space point under a key pose (BH). */
function heightOf(p: ContactPoint, key: KeyPose) {
  const r = (key.rot * Math.PI) / 180;
  return -p.x * Math.sin(r) + p.y * Math.cos(r) - key.dy + key.lift;
}
const body = new Set([
  'bob',
  'shift',
  'lean',
  'headTilt',
  'headY',
  'armL',
  'armR',
  'footLX',
  'footLY',
  'footRX',
  'footRY',
]);
/** Largest per-frame change (60 fps) of lift and pose channels across a timeline. */
function maxStep(timeline: Timeline) {
  let worst = 0;
  let previous = sampleTimeline(timeline, 0);
  for (let t = 1 / 60; t <= timeline.duration + 0.05; t += 1 / 60) {
    const key = sampleTimeline(timeline, t);
    const channels = new Set([...Object.keys(key.pose), ...Object.keys(previous.pose)]);
    for (const channel of channels) {
      const a = previous.pose[channel as keyof typeof key.pose] ?? 0;
      const b = key.pose[channel as keyof typeof key.pose] ?? 0;
      // Body channels only: faces may snap (startle) and squash spikes on contact; the motion
      // layer's critical springs smooth both downstream.
      if (body.has(channel)) worst = Math.max(worst, Math.abs(b - a));
    }
    worst = Math.max(
      worst,
      Math.abs(key.lift - previous.lift),
      Math.abs(key.rot - previous.rot) / 30,
    );
    previous = key;
  }
  return worst;
}

describe('contacts in held states (no floating, no sinking)', () => {
  it('sits on the ledge with the seat exactly on the edge', () => {
    expect(ledge?.surface).toBe('ledge');
    const held = heldKey('sit', ledge, context(gap));
    expect(held.lift + mascotStates.seatHeight).toBeCloseTo(gap, 6);
    // The feet hang below the edge, the head is above it.
    expect(held.lift).toBeLessThan(gap);
  });
  it('perches with the soles on the top edge', () => {
    const perchGap = perch ? (perch.approach.y - perch.y) / stage.bodyHeight : 0;
    expect(heldKey('perch', perch, context(perchGap)).lift).toBeCloseTo(perchGap, 6);
  });
  it('floor states keep the root on the floor', () => {
    for (const state of ['sit', 'doze', 'peek', 'lean', 'stand'] as BodyStateId[])
      expect(
        heldKey(state, state === 'peek' || state === 'lean' ? null : floor, context()).lift,
      ).toBe(0);
  });
  it('lies with the head and the feet both on the floor, nothing below it', () => {
    const lie = solveLie(mascotStates.lieContacts.head, mascotStates.lieContacts.feet);
    const key = { ...heldKey('nap', floor, context()), rot: lie.rot, dy: lie.dy };
    expect(heightOf(mascotStates.lieContacts.head, key)).toBeCloseTo(0, 4);
    expect(heightOf(mascotStates.lieContacts.feet, key)).toBeCloseTo(0, 4);
    // Lying back, not flat: a two-contact slope between 45 and 80 degrees.
    expect(-lie.rot).toBeGreaterThan(45);
    expect(-lie.rot).toBeLessThan(80);
    // The head centre is above the floor.
    expect(heightOf(mascotStates.head, key)).toBeGreaterThan(0.05);
  });
  it('leans until the head touches the edge', () => {
    const rot = solveLean(mascotStates.leanContact, 0.3);
    const r = (-rot * Math.PI) / 180;
    const reach =
      -mascotStates.leanContact.x * Math.cos(r) + mascotStates.leanContact.y * Math.sin(r);
    expect(reach).toBeCloseTo(0.3, 3);
    expect(rot).toBeLessThan(0);
  });
});

describe('transitions', () => {
  const cases: [string, Timeline][] = [
    ['enter sit ledge', enterPlan('sit', ledge, context(gap))],
    ['exit sit ledge', exitPlan('sit', ledge, context(gap), undefined)],
    ['enter sit floor', enterPlan('sit', floor, context())],
    ['exit sit floor', exitPlan('sit', floor, context(), undefined)],
    ['enter nap', enterPlan('nap', floor, context())],
    ['wake normal', exitPlan('nap', floor, context(), 'normal')],
    ['wake urgent', exitPlan('nap', floor, context(), 'urgent')],
    ['sit -> doze', shortcutPlan('sit', 'doze', floor, context(), undefined) as Timeline],
    ['doze -> nap', shortcutPlan('doze', 'nap', floor, context(), undefined) as Timeline],
    ['enter peek', enterPlan('peek', null, context())],
    ['enter perch', enterPlan('perch', perch, context(gap))],
    ['exit perch', exitPlan('perch', perch, context(gap), undefined)],
    ['enter lean', enterPlan('lean', null, context())],
  ];
  it.each(cases)('%s starts and ends on its key poses and never pops', (_name, timeline) => {
    expect(timeline.duration).toBeGreaterThan(0);
    expect(maxStep(timeline)).toBeLessThan(0.12);
    // Never below the floor at any time.
    for (let t = 0; t <= timeline.duration; t += 1 / 120)
      expect(sampleTimeline(timeline, t).lift).toBeGreaterThanOrEqual(-1e-9);
  });
  it('enters from standing and exits to standing', () => {
    expect(sampleTimeline(enterPlan('sit', ledge, context(gap)), 0)).toMatchObject({
      lift: 0,
      rot: 0,
    });
    const exit = exitPlan('nap', floor, context(), 'normal');
    expect(sampleTimeline(exit, exit.duration + 1)).toMatchObject({ lift: 0, rot: 0, sleep: 0 });
  });
  it('jumps onto the ledge on the shared gravity, landing on the edge', () => {
    const plan = enterPlan('sit', ledge, context(gap));
    const jump = plan.segments.find((segment) => segment.ballistic);
    expect(jump).toBeDefined();
    if (!jump) return;
    const apex = gap + 0.12;
    expect(jump.dur).toBeCloseTo(Math.sqrt((2 * apex) / G_BH) + Math.sqrt((2 * 0.12) / G_BH), 6);
    expect(sampleTimeline(plan, jump.at + jump.dur).lift).toBeCloseTo(gap, 6);
    expect(sampleTimeline(plan, jump.at + Math.sqrt((2 * apex) / G_BH)).lift).toBeCloseTo(apex, 3);
  });
  it('reduced motion uses short crossfades', () => {
    const reduced = { ...context(gap), reducedMotion: true };
    expect(enterPlan('sit', ledge, reduced).duration).toBeCloseTo(0.5);
    expect(exitPlan('nap', floor, reduced, 'normal').duration).toBeCloseTo(0.5);
  });
  it('the wake-up includes a stretch and is longer than the urgent wake', () => {
    const normal = exitPlan('nap', floor, context(), 'normal');
    const urgent = exitPlan('nap', floor, context(), 'urgent');
    expect(normal.duration).toBeGreaterThan(3.5);
    expect(urgent.duration).toBeLessThan(2);
    const peakArms = Math.max(
      ...Array.from(
        { length: 300 },
        (_, i) => sampleTimeline(normal, (i / 300) * normal.duration).pose.armL ?? 0,
      ),
    );
    expect(peakArms).toBeGreaterThan(1.3);
  });
});

function cue(partial: Partial<BodyCue>): BodyCue {
  return {
    id: 'c1',
    sourceEventId: 'e',
    source: 'manual',
    decidedBy: { kind: 'manual', label: 'Studio' },
    priority: 3,
    state: 'sit',
    spot: ledge,
    from: { state: 'stand', spot: null },
    startAt: 0,
    seed: 1,
    ...partial,
  };
}
const frame = (now: number, partial: Partial<PlayerFrame> = {}): PlayerFrame => ({
  now,
  stage,
  reducedMotion: false,
  position: home,
  travelling: false,
  facing: 1,
  target: home,
  breathPeriod: 4,
  personality: 'cozy',
  ...partial,
});

describe('body state player', () => {
  it('carries nap support through wake-up even after the requested state becomes stand', () => {
    const player = new BodyStatePlayer(mascotStates, 1);
    player.sync(cue({ state: 'nap', spot: floor }), 120, frame(0));
    expect(player.evaluate(frame(0)).napSupport).toBe(1);
    player.sync(
      cue({
        id: 'wake',
        state: 'stand',
        spot: null,
        from: { state: 'nap', spot: floor },
        wake: 'normal',
      }),
      0,
      frame(1),
    );
    expect(player.state).toBe('stand');
    expect(player.evaluate(frame(1)).napSupport).toBe(1);
    expect(player.evaluate(frame(1.2)).napSupport).toBeGreaterThan(0);
    for (let t = 1.3; t < 12; t += 0.1) player.evaluate(frame(t));
    expect(player.evaluate(frame(12)).napSupport).toBeUndefined();
  });

  it('a reconnect long after the cue started shows the held state without replaying', () => {
    const player = new BodyStatePlayer(mascotStates, 1);
    const result = player.sync(cue({}), 120, frame(10));
    expect(result.place).toEqual(ledge?.approach);
    const key = player.evaluate(frame(10)).key;
    expect(key.lift).toBeCloseTo(gap - mascotStates.seatHeight, 6);
  });
  it('plays the transition for a fresh cue and holds locomotion while leaving a state', () => {
    const player = new BodyStatePlayer(mascotStates, 1);
    player.sync(null, 0, frame(0));
    player.sync(cue({}), 0.02, frame(1));
    expect(player.evaluate(frame(1)).status).toBe('sit:enter');
    const standing = cue({
      id: 'c2',
      state: 'stand',
      spot: null,
      from: { state: 'sit', spot: ledge },
    });
    player.sync(standing, 0, frame(10));
    expect(player.holdsTravel(10.1)).toBe(true);
    player.evaluate(frame(10.1));
    for (let t = 10.1; t < 12; t += 1 / 30) player.evaluate(frame(t));
    expect(player.holdsTravel(12)).toBe(false);
    expect(player.evaluate(frame(12)).key.lift).toBeCloseTo(0, 6);
  });
  it('emits z z z only once asleep, and a floor shadow while lying', () => {
    const player = new BodyStatePlayer(mascotStates, 1);
    player.sync(cue({ state: 'nap', spot: floor }), 600, frame(1000));
    const results = Array.from({ length: 200 }, (_, i) => player.evaluate(frame(1000 + i * 0.05)));
    expect(results.some((r) => r.effects.length > 0)).toBe(true);
    expect(results.every((r) => r.floorShadow !== null)).toBe(true);
    const awake = new BodyStatePlayer(mascotStates, 1);
    awake.sync(cue({ state: 'sit', spot: floor }), 600, frame(1000));
    expect(awake.evaluate(frame(1001)).effects).toHaveLength(0);
  });
  it('asleep, the state owns the face: expressions are damped and the eyes close', () => {
    const pose = neutralPose();
    pose.smile = 1;
    pose.browL = -1;
    pose.bob = 0.05;
    applyStateKey(pose, { pose: { bob: 0.1 }, lift: 0, dx: 0, dy: 0, rot: 0, sleep: 1 });
    expect(pose.smile).toBeCloseTo(0);
    expect(pose.browL).toBeCloseTo(0);
    expect(pose.bob).toBeCloseTo(0.1);
    expect(pose.blinkL).toBe(1);
    const awake = neutralPose();
    awake.smile = 1;
    applyStateKey(awake, { pose: { bob: 0.1 }, lift: 0, dx: 0, dy: 0, rot: 0, sleep: 0 });
    expect(awake.smile).toBe(1);
    expect(awake.bob).toBeCloseTo(0.1);
  });
});
