import { describe, expect, it } from 'vitest';
import { defaultScene, resolveSpot } from '../shared/states';
import { mascotStates } from '../src/renderer/characters/mascot/states';
import { lylaV2Proxy } from '../src/renderer/characters/mascot/pose';
import { peekStandingVariants } from '../src/renderer/motion/pose/library/peek';
import { joints } from '../src/renderer/motion/pose/proxy';
import { sampleBeat } from '../src/renderer/motion/pose/sample';
import { enterPlan, exitPlan, heldKey, sampleTimeline } from '../src/renderer/motion/states/plan';
import { applyStateKey } from '../src/renderer/motion/states/apply';
import { neutralPose } from '../src/renderer/motion/types';

const home = { x: 0.23, y: 0.72 };
const chat = resolveSpot('peek', { scene: defaultScene, home });
const context = { rig: mascotStates, gap: 0, edgeDistance: 0.3, reducedMotion: false };

describe('upright chat reading', () => {
  it('chooses three distinct standing postures from visit seeds', () => {
    const poses = [0, 1, 2].map((variant) => heldKey('peek', chat, { ...context, variant }));
    expect(new Set(poses.map((key) => JSON.stringify(key.pose))).size).toBe(3);
    for (const key of poses) {
      expect(key.rot).toBe(0);
      expect(key.lift).toBe(0);
      for (const channel of ['bob', 'footLX', 'footRX', 'footLY', 'footRY'] as const)
        expect(key.pose[channel]).toBe(0);
    }
  });

  it('keeps both soles planted throughout the living hold', () => {
    for (const variant of peekStandingVariants)
      for (let time = 0; time < 20; time += 0.1) {
        const sample = sampleBeat(variant, time, lylaV2Proxy, 7);
        const posed = joints(lylaV2Proxy, sample.pose, sample.place);
        expect(Math.abs(posed.soleL.y)).toBeLessThan(0.003);
        expect(Math.abs(posed.soleR.y)).toBeLessThan(0.003);
        expect(sample.place.rot).toBe(0);
        expect(sample.place.lift).toBe(0);
      }
  });

  it('looks toward the chat panel on either side after composing its facing-local pose', () => {
    for (const direction of [-1, 1])
      for (let variant = 0; variant < 3; variant++) {
        const key = heldKey('peek', chat, { ...context, variant });
        const pose = neutralPose();
        applyStateKey(pose, key, direction);
        expect(pose.gazeX * direction).toBeGreaterThan(0.5);
      }
  });

  it('enters and exits every posture without dropping the hips or lifting a foot', () => {
    for (let variant = 0; variant < 3; variant++) {
      const input = { ...context, variant };
      for (const plan of [enterPlan('peek', chat, input), exitPlan('peek', chat, input, undefined)])
        for (let time = 0; time <= plan.duration; time += 1 / 60) {
          const key = sampleTimeline(plan, time);
          expect(key.rot).toBe(0);
          expect(key.lift).toBe(0);
          expect(key.pose.bob ?? 0).toBe(0);
          expect(key.pose.footLY ?? 0).toBe(0);
          expect(key.pose.footRY ?? 0).toBe(0);
        }
    }
  });
});
