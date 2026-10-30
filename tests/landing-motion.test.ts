import { describe, expect, it } from 'vitest';
import { cubicBezier } from '../src/landing/crtScreen';
import { lookPath } from '../src/landing/lookLine';

describe('landing motion helpers', () => {
  it('solves the --ease-out curve like CSS cubic-bezier(0.23, 1, 0.32, 1)', () => {
    const ease = cubicBezier(0.23, 1, 0.32, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    let previous = 0;
    for (let x = 0.01; x < 1; x += 0.01) {
      const y = ease(x);
      expect(y).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = y;
    }
    // A strong ease-out: well past halfway by a quarter of the time.
    expect(ease(0.25)).toBeGreaterThan(0.7);
    expect(cubicBezier(0, 0, 1, 1)(0.37)).toBeCloseTo(0.37, 5);
  });

  it('draws the look line from just off her face to just short of the target, bowed upward', () => {
    const { start, end, control } = lookPath({ x: 100, y: 100 }, { x: 400, y: 300 }, 30);
    expect(Math.hypot(start.x - 100, start.y - 100)).toBeCloseTo(30, 6);
    expect(Math.hypot(end.x - 400, end.y - 300)).toBeCloseTo(7, 6);
    expect(control.y).toBeLessThan((start.y + end.y) / 2);
  });
});
