import { describe, expect, it } from 'vitest';
import { distance, projectSupport, solveLimb, softReach } from '../src/renderer/rig/geometry';
import { Spring, FollowThrough } from '../src/renderer/rig/spring';
import { Transition } from '../src/renderer/rig/transition';
import { resolveOwnership, type RigLayer } from '../src/renderer/rig/ownership';
import { foundationMotion } from '../src/renderer/characters/tavi-foundation/motion';
import { refinedMotion } from '../src/renderer/characters/tavi-refined/motion';
import { getCharacter } from '../src/renderer/characters/registry';

describe('rig foundation mechanics', () => {
  it('preserves both physical segment lengths across reachable targets and both bends', () => {
    for (let angle = -Math.PI; angle < Math.PI; angle += 0.19)
      for (let reach = 5; reach <= 137; reach += 3)
        for (const bend of [-1, 1] as const) {
          const root = [17, -23] as const;
          const target = [
            root[0] + Math.cos(angle) * reach,
            root[1] + Math.sin(angle) * reach,
          ] as const;
          const s = solveLimb(root, target, 71, 67, bend);
          expect(distance(root, s.joint)).toBeCloseTo(71, 7);
          expect(distance(s.joint, s.end)).toBeCloseTo(67, 7);
          expect(distance(s.end, target)).toBeLessThan(1e-7);
        }
  });
  it('handles folded, coincident, far and full-extension targets without NaN', () => {
    for (const length of [67, 71])
      for (const target of [
        [0, 0],
        [10000, 0],
        [138, 0],
      ] as const) {
        const s = solveLimb([0, 0], target, 71, length);
        expect([...s.joint, ...s.end, s.error].every(Number.isFinite)).toBe(true);
        expect(distance([0, 0], s.joint)).toBeCloseTo(71, 7);
        expect(distance(s.joint, s.end)).toBeCloseTo(length, 7);
      }
    expect(solveLimb([0, 0], [300, 0], 71, 67).error).toBe(162);
    expect(() => solveLimb([0, 0], [0, 0], 0, 2)).toThrow();
  });
  it('moves the common pelvis into support without changing contact targets', () => {
    const supports = [
      { root: [-15, -170] as const, target: [-20, 0] as const, reach: 137 },
      { root: [15, -170] as const, target: [20, 0] as const, reach: 137 },
    ];
    const before = JSON.stringify(supports),
      s = projectSupport(supports);
    expect(s.residual).toBeLessThan(1e-5);
    expect(s.offset[1]).toBeGreaterThan(33);
    expect(s.offset[0]).toBeCloseTo(0, 8);
    expect(projectSupport([...supports].reverse()).offset).toEqual(s.offset);
    expect(JSON.stringify(supports)).toBe(before);
    expect(
      projectSupport([
        { root: [0, 0], target: [100, 0], reach: 1 },
        { root: [0, 0], target: [-100, 0], reach: 1 },
      ]).residual,
    ).toBeGreaterThan(100);
  });
  it.each([0.2, 0.65, 1, 1.8])('matches frame rates at damping %s', (damping) => {
    const samples = [30, 60, 120].map((hz) => {
      const s = new Spring(13, damping);
      s.reset(-0.4, 0.7);
      for (let i = 0; i < hz; i++) s.step(1 / hz, 0.8);
      return [s.value, s.velocity];
    });
    for (const sample of samples) {
      expect(sample[0]).toBeCloseTo(samples[0]?.[0] ?? 0, 8);
      expect(sample[1]).toBeCloseTo(samples[0]?.[1] ?? 0, 8);
    }
  });
  it('resets cloth after suspension and teleport; pause does not advance it', () => {
    const cloth = new FollowThrough();
    cloth.update(1 / 60, 0);
    for (let i = 1; i <= 30; i++) cloth.update(1 / 60, i / 60);
    expect(cloth.angle).toBeGreaterThan(0);
    const held = cloth.angle;
    expect(cloth.update(0, 0.5)).toBe(held);
    expect(cloth.update(2, 0.5)).toBe(0);
    expect(cloth.update(1 / 60, 100)).toBe(0);
  });
  it('matches position, velocity and acceleration when reversing mid-flight', () => {
    const t = new Transition();
    t.to(0, 1, 1);
    const before = t.sample(0.37);
    t.to(0.37, -1, 0.8);
    expect(t.sample(0.37)).toEqual(before);
    const end = t.sample(1.17);
    expect(end.value).toBeCloseTo(-1, 10);
    expect(end.velocity).toBeCloseTo(0, 10);
    expect(end.acceleration).toBeCloseTo(0, 10);
  });
  it('arbitrates ownership independently of input order and rejects ambiguous writers', () => {
    const layers: RigLayer[] = [
      { id: 'idle', priority: 0, owns: ['legs', 'arms'] },
      { id: 'walk', priority: 10, owns: ['legs'] },
      { id: 'wave', priority: 20, owns: ['arms'] },
    ];
    expect(Object.fromEntries(resolveOwnership(layers))).toEqual({ legs: 'walk', arms: 'wave' });
    expect(Object.fromEntries(resolveOwnership([...layers].reverse()))).toEqual({
      arms: 'wave',
      legs: 'walk',
    });
    const conflict: RigLayer = { id: 'other', priority: 0, owns: ['legs'] };
    expect(() => resolveOwnership([...layers, conflict])).toThrow('Ambiguous');
    expect(() => resolveOwnership([conflict, ...layers].reverse())).toThrow('Ambiguous');
  });
  it('softens extension with a continuous value and slope while leaving reachable slack alone', () => {
    expect(softReach(100, 138)).toBe(100);
    expect(softReach(1000, 138)).toBeLessThanOrEqual(138);
    const h = 0.00001;
    expect((softReach(130 + h, 138) - softReach(130, 138)) / h).toBeCloseTo(1, 4);
  });
  it('keeps the baseline asset, binding and authored ownership; changes only postprocessing', () => {
    const foundation = getCharacter('tavi-foundation');
    expect(foundation.id).toBe('tavi-foundation');
    expect(foundation.asset).toBe(getCharacter('tavi-refined').asset);
    expect(foundationMotion.states?.keys.lie).toEqual(refinedMotion.states?.keys.lie);
    expect(foundationMotion.states?.napStyle).toBe('supported');
    expect(foundationMotion.createPostprocessor).not.toBe(refinedMotion.createPostprocessor);
  });
});
