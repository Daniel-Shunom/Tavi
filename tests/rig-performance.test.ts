import { handoffKey, keyVelocity } from '../src/renderer/motion/states/handoff';
import { describe, expect, it } from 'vitest';
import { foundationMotion } from '../src/renderer/characters/tavi-foundation/motion';
import { refinedMotion } from '../src/renderer/characters/tavi-refined/motion';
import {
  enterPlan,
  exitPlan,
  heldKey,
  sampleTimeline,
  type PlanContext,
} from '../src/renderer/motion/states/plan';
import { BodyStatePlayer, type PlayerFrame } from '../src/renderer/motion/states/player';
import { restKey } from '../src/renderer/motion/states/types';
import { performanceKey, durationFor } from '../src/renderer/rig/demo';
import type { BodyCue } from '../shared/states';
function context(candidate = true): PlanContext {
  const rig = candidate ? foundationMotion.states : refinedMotion.states;
  if (!rig) throw new Error('Missing body rig');
  return { rig, gap: 0, edgeDistance: 0.3, reducedMotion: false };
}
const playerFrame = (now: number): PlayerFrame => ({
  now,
  stage: { aspect: 16 / 9, bodyHeight: 0.25, margin: 0.02 },
  reducedMotion: false,
  position: { x: 0.23, y: 0.72 },
  travelling: false,
  facing: 1,
  target: { x: 0.23, y: 0.72 },
  breathPeriod: 4,
  personality: 'cozy',
});
function cue(state: 'nap' | 'stand'): BodyCue {
  return {
    id: state,
    sourceEventId: state,
    source: 'manual',
    decidedBy: { kind: 'manual', label: 'Studio' },
    priority: 3,
    state,
    spot: null,
    from: { state: state === 'nap' ? 'stand' : 'nap', spot: null },
    startAt: 0,
    seed: 1,
    wake: 'urgent',
  };
}
describe('supported sleep performances', () => {
  it('plants before lowering and transfers support to the head without a squash impact', () => {
    const c = context(),
      plan = enterPlan('nap', null, c);
    const plant = plan.segments.findIndex((s) => s.to.handSupport === 1);
    const asleep = plan.segments.findIndex((s) => s.to.sleep > 0);
    expect(plant).toBeGreaterThan(0);
    expect(asleep).toBeGreaterThan(plant);
    expect(plan.end).toMatchObject({ ...heldKey('nap', null, c), handSupport: 0 });
    expect(
      enterPlan('nap', null, context(false)).segments.some((s) => s.to.handSupport !== undefined),
    ).toBe(false);
  });
  it('pushes up before stretching and gives urgent wake a shorter exit', () => {
    const normal = exitPlan('nap', null, context(), 'normal'),
      urgent = exitPlan('nap', null, context(), 'urgent');
    const plant = normal.segments.findIndex((s) => s.to.handSupport === 1);
    const stretch = normal.segments.findIndex((s) => (s.to.pose.armL ?? 0) > 1);
    expect(plant).toBeGreaterThan(0);
    expect(stretch).toBeGreaterThan(plant);
    expect(normal.end).toEqual(restKey);
    expect(urgent.end).toEqual(restKey);
    expect(urgent.duration).toBeLessThan(normal.duration);
  });
  it('matches every sampled interruption pose, including partial hand support', () => {
    const c = context(),
      entry = enterPlan('nap', null, c);
    for (let t = 0; t < entry.duration; t += 0.1) {
      const from = sampleTimeline(entry, t),
        wake = exitPlan('nap', null, c, 'urgent', from);
      expect(sampleTimeline(wake, 0)).toEqual(from);
      const next = sampleTimeline(wake, 1 / 120);
      expect(Math.abs(next.rot - from.rot)).toBeLessThan(0.1);
      expect(Math.abs((next.handSupport ?? 0) - (from.handSupport ?? 0))).toBeLessThan(0.01);
    }
  });
  it('the live player starts a mid-entry interruption at the last rendered pose', () => {
    const player = new BodyStatePlayer(context().rig, 1);
    player.sync(null, 0, playerFrame(0));
    player.sync(cue('nap'), 0, playerFrame(0));
    player.evaluate(playerFrame(0));
    const before = player.evaluate(playerFrame(2));
    player.sync(cue('stand'), 0, playerFrame(2));
    const after = player.evaluate(playerFrame(2));
    expect(after.key).toEqual(before.key);
  });
  it.each([30, 60, 120])('carries rendered lowering velocity into wake at %i fps', (fps) => {
    const player = new BodyStatePlayer(context().rig, 1);
    player.sync(null, 0, playerFrame(0));
    player.sync(cue('nap'), 0, playerFrame(0));
    let previous = player.evaluate(playerFrame(0)).key;
    let current = previous;
    for (let i = 1; i <= Math.round(1.2 * fps); i++) {
      previous = current;
      current = player.evaluate(playerFrame(i / fps)).key;
    }
    const velocity = ((current.pose.bob ?? 0) - (previous.pose.bob ?? 0)) * fps;
    expect(Math.abs(velocity)).toBeGreaterThan(0.001);
    player.sync(cue('stand'), 0, playerFrame(1.2));
    expect(player.evaluate(playerFrame(1.2)).key).toEqual(current);
    const epsilon = 0.00001;
    const after = player.evaluate(playerFrame(1.2 + epsilon)).key;
    expect(((after.pose.bob ?? 0) - (current.pose.bob ?? 0)) / epsilon).toBeCloseTo(velocity, 3);
  });
  it('does not replay stale motion after a suspended rendering clock', () => {
    const player = new BodyStatePlayer(context().rig, 1);
    player.sync(null, 0, playerFrame(0));
    player.sync(cue('nap'), 0, playerFrame(0));
    player.evaluate(playerFrame(0));
    player.evaluate(playerFrame(1.18));
    const before = player.evaluate(playerFrame(1.2)).key;
    player.sync(cue('stand'), 0, playerFrame(3.2));
    const after = player.evaluate(playerFrame(3.20001)).key;
    expect(after.pose.bob).toBeCloseTo(before.pose.bob ?? 0, 9);
  });
  it('drops stale momentum and yields exactly to the new plan after the handoff', () => {
    const from = { ...restKey, pose: { bob: 0.1 }, sleep: 1, handSupport: 1 };
    const velocity = keyVelocity(restKey, from, 1 / 60);
    expect(keyVelocity(restKey, from, 2)).toEqual(restKey);
    expect(keyVelocity(restKey, from, -1)).toEqual(restKey);
    expect(handoffKey(from, restKey, velocity, 0.35, 0.35)).toEqual(restKey);
    const middle = handoffKey(from, restKey, velocity, 0.05, 0.35);
    expect(middle.sleep).toBeLessThanOrEqual(1);
    expect(middle.handSupport).toBeLessThanOrEqual(1);
    const epsilon = 0.00001;
    const targetBefore = { ...restKey, pose: { bob: 0.4 * (0.35 - epsilon) } };
    const targetAfter = { ...restKey, pose: { bob: 0.4 * 0.35 } };
    const beforeEnd = handoffKey(from, targetBefore, velocity, 0.35 - epsilon, 0.35);
    const atEnd = handoffKey(from, targetAfter, velocity, 0.35, 0.35);
    expect(((atEnd.pose.bob ?? 0) - (beforeEnd.pose.bob ?? 0)) / epsilon).toBeCloseTo(0.4, 4);
  });
  it('keeps support weights bounded and ends both studies standing', () => {
    for (const scene of ['Sleep cycle', 'Wake interrupt'] as const) {
      for (let t = 0; t <= durationFor(scene); t += 1 / 60) {
        const pose = performanceKey(scene, t, true);
        expect(pose.sleep).toBeGreaterThanOrEqual(0);
        expect(pose.sleep).toBeLessThanOrEqual(1);
        expect(pose.handSupport ?? 0).toBeGreaterThanOrEqual(0);
        expect(pose.handSupport ?? 0).toBeLessThanOrEqual(1);
        expect(
          [pose.rot, pose.dx, pose.dy, pose.lift, ...Object.values(pose.pose)].every(
            Number.isFinite,
          ),
        ).toBe(true);
      }
      expect(performanceKey(scene, durationFor(scene), true)).toEqual(restKey);
    }
  });
  it('reduced motion skips the planted-hand choreography', () => {
    const c = { ...context(), reducedMotion: true };
    const plan = enterPlan('nap', null, c);
    expect(plan.duration).toBeLessThanOrEqual(0.6);
    expect(plan.segments.some((s) => s.to.handSupport)).toBe(false);
  });
});
