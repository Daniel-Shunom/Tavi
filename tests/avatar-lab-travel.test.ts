import { describe, expect, it } from 'vitest';
import { measureStride, strideDistance, type StrideSample } from '../src/avatar-lab/stride';
import { WalkShuttle } from '../src/avatar-lab/shuttle';
import { required } from './helpers/required';

const samples: StrideSample[] = [
  [
    { y: 0, z: 0.2 },
    { y: 1, z: 0 },
  ],
  [
    { y: 0, z: 0.1 },
    { y: 1, z: 0.1 },
  ],
  [
    { y: 0, z: 0 },
    { y: 0, z: 0.2 },
  ],
  [
    { y: 1, z: 0.1 },
    { y: 0, z: 0.1 },
  ],
  [
    { y: 1, z: 0.2 },
    { y: 0, z: 0 },
  ],
];
const curve = measureStride(samples, 1);

describe('avatar floor travel', () => {
  it('cancels stance-foot motion with root travel', () => {
    expect(curve.distance).toBeCloseTo(0.4);
    for (let i = 0; i < 3; i++)
      expect(strideDistance(curve, i / 4) + required(samples[i])[0].z).toBeCloseTo(0.2);
    for (let i = 2; i < 5; i++)
      expect(strideDistance(curve, i / 4) + required(samples[i])[1].z).toBeCloseTo(0.4);
  });

  it('accumulates the same distance at different render rates and across loop wraps', () => {
    for (const fps of [30, 60, 144]) {
      let distance = 0;
      for (let i = 1; i <= fps * 10; i++)
        distance += strideDistance(curve, i / fps) - strideDistance(curve, (i - 1) / fps);
      expect(distance).toBeCloseTo(4, 8);
    }
  });

  it('rejects a pose with no measured stepping instead of inventing a speed', () => {
    expect(() =>
      measureStride(
        samples.map(() => required(samples[0])),
        1,
      ),
    ).toThrow('stance contact');
  });

  it('stops before reversing and never translates during the turn', () => {
    const shuttle = new WalkShuttle(0.6);
    expect(shuttle.update(0, curve).x).toBe(0.6);
    const directions = new Set<number>();
    for (let i = 0; i < 60 * 22; i++) {
      const before = { x: shuttle.x, state: shuttle.state, direction: shuttle.direction };
      const frame = shuttle.update(1 / 60, curve);
      if (before.state === 'turn' && frame.state === 'turn') expect(frame.x).toBe(before.x);
      if (frame.walking) {
        directions.add(shuttle.direction);
        expect((frame.x - before.x) * shuttle.direction).toBeGreaterThanOrEqual(0);
      }
      if (before.direction !== shuttle.direction) expect(before.state).toBe('idle');
      expect(Math.abs(frame.x)).toBeLessThan(2);
    }
    expect([...directions].sort()).toEqual([-1, 1]);
  });
});
