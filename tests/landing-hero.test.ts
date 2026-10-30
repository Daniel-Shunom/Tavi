import { describe, expect, it } from 'vitest';
import { heroPerformance, heroTimings } from '../src/landing/heroPerformance';
import { walkCyclePx, type Measures } from '../src/landing/choreography';

const measures: Measures = {
  vw: 1536,
  vh: 800,
  scrollY: 0,
  maxScroll: 3000,
  screen: { left: 485, top: 223, width: 411, height: 311 },
  cam: { left: 725, top: 323, width: 140, height: 185 },
  copy: null,
  floor: null,
  mobile: false,
  bodyPx: 236,
};

describe('hero performance', () => {
  it('preserves position across each action and depth handoff', () => {
    const timing = heroTimings(measures);
    expect(timing).not.toBeNull();
    if (!timing) return;
    for (const boundary of [
      0.9,
      1.4,
      2,
      3.5,
      5,
      timing.frontEnd,
      timing.lookEnd,
      timing.backEnd,
      timing.perchStart,
    ]) {
      const before = heroPerformance(boundary - 0.00001, measures);
      const after = heroPerformance(boundary, measures);
      expect(before).not.toBeNull();
      expect(after).not.toBeNull();
      if (!before || !after) continue;
      expect(
        Math.hypot(after.placement.x - before.placement.x, after.placement.y - before.placement.y),
      ).toBeLessThan(0.1);
    }
  });

  it('passes behind the TV and ends seated on its top edge', () => {
    const timing = heroTimings(measures);
    expect(timing).not.toBeNull();
    if (!timing) return;
    const crossing = heroPerformance(timing.lookEnd + 1, measures);
    const seated = heroPerformance(timing.perchStart + 2, measures);
    expect(crossing?.depth).toBe('back');
    expect(crossing?.placement.stage).toBe('walk');
    expect(seated?.depth).toBe('front');
    expect(seated?.placement.stage).toBe('ledge');
    expect(seated?.placement.y).toBeLessThan(measures.screen?.top ?? 0);
    expect(seated?.finished).toBe(true);
    const edge = (measures.screen?.top ?? 0) -
      ((0.4568334 - 0.4042329) / (0.4042329 - 0.1141471)) * (measures.screen?.height ?? 0);
    expect(seated?.placement.y).toBeCloseTo(edge + measures.bodyPx * 0.025);
  });

  it('keeps the visible walk within the distance covered by its gait', () => {
    const timing = heroTimings(measures);
    if (!timing) throw new Error('Scene bounds are required');
    const step = 0.01;
    for (let time = 5; time + step < timing.frontEnd; time += step) {
      const current = heroPerformance(time, measures);
      const next = heroPerformance(time + step, measures);
      if (!current || !next) throw new Error('Performance did not produce a frame');
      expect(Math.abs(next.placement.x - current.placement.x) / step).toBeLessThanOrEqual(
        walkCyclePx(measures.bodyPx) * 2.401,
      );
    }
  });
});
