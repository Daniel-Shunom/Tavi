import { describe, expect, it } from 'vitest';
import { random, rngFor, pick } from '../src/renderer/motion/core/random';
import { noise1, fbm1 } from '../src/renderer/motion/core/noise';
import { SecondOrder, CriticalSpring } from '../src/renderer/motion/core/spring';
import { reactionCurve, smootherstep } from '../src/renderer/motion/core/curves';
import { Inertializer } from '../src/renderer/motion/core/inertialize';

function simulate(step: (dt: number) => number, fps: number, seconds: number) {
  const dt = 1 / fps;
  let value = 0;
  for (let t = 0; t < seconds - 1e-9; t += dt) value = step(dt);
  return value;
}

describe('seeded randomness', () => {
  it('is reproducible for the same seed and label so studio and overlay agree', () => {
    const a = rngFor(42, 'blink'),
      b = rngFor(42, 'blink');
    const seqA = [a(), a(), a()],
      seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(rngFor(42, 'gaze')()).not.toBe(seqA[0]);
    for (const value of seqA) expect(value).toBeGreaterThanOrEqual(0);
    for (const value of seqA) expect(value).toBeLessThan(1);
  });

  it('hashes (seed, label, index) to a stable value', () => {
    expect(random(7, 'fidget', 3)).toBe(random(7, 'fidget', 3));
    expect(random(7, 'fidget', 3)).not.toBe(random(7, 'fidget', 4));
  });

  it('weighted pick never repeats the excluded option', () => {
    const rng = rngFor(1, 'pick');
    for (let i = 0; i < 200; i++)
      expect(
        pick(
          rng,
          [
            { id: 'a', weight: 5 },
            { id: 'b', weight: 1 },
          ],
          'a',
        ),
      ).toBe('b');
  });
});

describe('noise', () => {
  it('is bounded, deterministic and continuous', () => {
    let previous = noise1(3, 0);
    for (let t = 0.01; t < 50; t += 0.01) {
      const value = noise1(3, t);
      expect(Math.abs(value)).toBeLessThanOrEqual(1);
      expect(Math.abs(value - previous)).toBeLessThan(0.05);
      previous = value;
    }
    expect(noise1(3, 12.34)).toBe(noise1(3, 12.34));
    expect(noise1(3, 12.34)).not.toBe(noise1(4, 12.34));
  });

  it('is zero-mean enough over a long window and actually varies', () => {
    let sum = 0,
      min = 1,
      max = -1;
    for (let t = 0; t < 400; t += 0.05) {
      const v = fbm1(9, t, 2);
      sum += v;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(Math.abs(sum / 8000)).toBeLessThan(0.1);
    expect(max - min).toBeGreaterThan(0.8);
  });
});

describe('second-order dynamics (t3ssel8r)', () => {
  it('settles on a step target', () => {
    const spring = new SecondOrder({ f: 2, zeta: 1, r: 0 }, 0);
    expect(simulate((dt) => spring.update(dt, 1), 60, 3)).toBeCloseTo(1, 2);
  });

  it('overshoots when under-damped', () => {
    const spring = new SecondOrder({ f: 2, zeta: 0.3, r: 0 }, 0);
    let peak = 0;
    simulate(
      (dt) => {
        const v = spring.update(dt, 1);
        peak = Math.max(peak, v);
        return v;
      },
      60,
      2,
    );
    expect(peak).toBeGreaterThan(1.2);
  });

  it('anticipates (moves the wrong way first) when r < 0', () => {
    const spring = new SecondOrder({ f: 2, zeta: 0.6, r: -1 }, 0);
    let lowest = 0;
    simulate(
      (dt) => {
        const v = spring.update(dt, 1);
        lowest = Math.min(lowest, v);
        return v;
      },
      60,
      1,
    );
    expect(lowest).toBeLessThan(-0.05);
  });

  it('gives frame-rate independent results (30 vs 144 fps)', () => {
    const run = (fps: number) => {
      const spring = new SecondOrder({ f: 3, zeta: 0.4, r: 0.5 }, 0);
      return simulate((dt) => spring.update(dt, 1), fps, 0.4);
    };
    expect(Math.abs(run(30) - run(144))).toBeLessThan(0.03);
  });

  it('stays stable with a long frame hitch', () => {
    const spring = new SecondOrder({ f: 6, zeta: 0.2, r: 2 }, 0);
    const v = simulate((dt) => spring.update(dt, 1), 4, 4);
    expect(Number.isFinite(v)).toBe(true);
    expect(Math.abs(v - 1)).toBeLessThan(0.2);
  });
});

describe('critically damped spring', () => {
  it('never overshoots and is exactly frame-rate independent', () => {
    const run = (fps: number) => {
      const spring = new CriticalSpring(0.15, 0);
      let peak = 0;
      const value = simulate(
        (dt) => {
          const v = spring.update(dt, 1);
          peak = Math.max(peak, v);
          return v;
        },
        fps,
        0.5,
      );
      return { value, peak };
    };
    const a = run(30),
      b = run(240);
    expect(a.peak).toBeLessThanOrEqual(1);
    expect(Math.abs(a.value - b.value)).toBeLessThan(1e-6);
    expect(a.value).toBeGreaterThan(0.9);
  });
});

describe('reaction curve', () => {
  it('anticipates, overshoots, settles to a hold and releases to zero', () => {
    const shape = {
      anticipation: 0.15,
      attack: 0.25,
      overshoot: 0.2,
      settle: 0.3,
      hold: 1,
      release: 0.5,
    };
    const at = (t: number) => reactionCurve(t, shape);
    expect(at(0)).toBe(0);
    expect(at(0.15)).toBeLessThan(0);
    const peak = Math.max(...[0.3, 0.35, 0.4, 0.45].map(at));
    expect(peak).toBeGreaterThan(1.1);
    expect(at(1.2)).toBeCloseTo(1, 2);
    expect(at(10)).toBe(0);
    for (let t = 0; t < 3; t += 0.005) expect(Math.abs(at(t + 0.005) - at(t))).toBeLessThan(0.08);
  });

  it('smootherstep has zero slope at both ends', () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    expect(smootherstep(0.001)).toBeLessThan(1e-7);
  });
});

describe('inertialization', () => {
  it('keeps the old value at the switch and decays the offset to zero', () => {
    const blend = new Inertializer(0.2);
    blend.transition(1, 0, 0); // value was 1 moving at 0; new target pose is 0
    expect(blend.apply(0, 0)).toBeCloseTo(1, 5);
    let value = 1;
    for (let i = 0; i < 60; i++) value = blend.apply(1 / 60, 0);
    expect(Math.abs(value)).toBeLessThan(0.01);
  });
});
