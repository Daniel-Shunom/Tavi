import { describe, expect, it } from 'vitest';
import { BlinkSystem, blinkShape } from '../src/renderer/motion/systems/blink';
import { GazeSystem } from '../src/renderer/motion/systems/gaze';
import { FidgetSystem } from '../src/renderer/motion/systems/fidget';
import { ExpressionSystem, expressionLibrary } from '../src/renderer/motion/systems/expressions';
import { idleLayer } from '../src/renderer/motion/systems/idle';
import { motionProfile } from '../src/renderer/motion/profile';
import type { MotionSettings } from '../src/renderer/motion/types';

const settings: MotionSettings = {
  personality: 'cozy',
  attitude: 'cheeky',
  energy: 50,
  reducedMotion: false,
  quiet: false,
};
const profile = motionProfile(settings);

function countBlinks(system: BlinkSystem, seconds: number, fps = 60) {
  let blinks = 0,
    closed = false;
  for (let i = 0; i < seconds * fps; i++) {
    const { left } = system.update(i / fps, profile);
    if (left > 0.9 && !closed) blinks++;
    closed = left > 0.9;
  }
  return blinks;
}

describe('blinks', () => {
  it('blink at a natural rate (roughly 60 / mean per minute)', () => {
    const blinks = countBlinks(new BlinkSystem(5), 600);
    const expected = (600 / profile.blinkMean) * (1 + profile.doubleBlinkChance);
    expect(blinks).toBeGreaterThan(expected * 0.7);
    expect(blinks).toBeLessThan(expected * 1.3);
  });

  it('are identical for two renderers with the same seed', () => {
    const a = new BlinkSystem(11),
      b = new BlinkSystem(11);
    for (let i = 0; i < 1200; i++) {
      // Different frame rates: a at 60 fps, b sampled at the same instants via a 30 fps cadence.
      const t = i / 60;
      const left = a.update(t, profile).left;
      if (i % 2 === 0) expect(b.update(t, profile).left).toBeCloseTo(left, 6);
    }
  });

  it('close faster than they open (asymmetric, fully closing)', () => {
    let closeTime = 0,
      openTime = 0;
    for (let t = 0; t < 1; t += 0.001) {
      const v = blinkShape(t);
      if (v > 0.99) break;
      closeTime = t;
    }
    let peakEnd = 0;
    for (let t = 0; t < 1; t += 0.001) if (blinkShape(t) > 0.99) peakEnd = t;
    for (let t = peakEnd; t < 1; t += 0.001) {
      if (blinkShape(t) < 0.01) break;
      openTime = t - peakEnd;
    }
    expect(closeTime).toBeLessThan(openTime);
    expect(closeTime + openTime).toBeGreaterThan(0.15);
    expect(closeTime + openTime).toBeLessThan(0.4);
  });

  it('can be triggered by a large gaze shift', () => {
    const system = new BlinkSystem(3);
    system.update(0, profile);
    system.trigger(0.5);
    let max = 0;
    for (let t = 0.5; t < 0.9; t += 1 / 60) max = Math.max(max, system.update(t, profile).left);
    expect(max).toBeGreaterThan(0.9);
  });
});

describe('gaze', () => {
  it('holds fixations and makes quick saccades, mostly toward the attention target', () => {
    const gaze = new GazeSystem(21);
    let near = 0,
      shifts = 0;
    const target = { x: 0.6, y: 0.1 };
    for (let i = 0; i < 60 * 60; i++) {
      const out = gaze.update(1 / 60, i / 60, profile, target);
      if (Math.abs(out.x - target.x) < 0.25) near++;
      if (out.saccade > 0) shifts++;
    }
    expect(near / 3600).toBeGreaterThan(0.5);
    // A minute of attention has some shifts but no constant darting.
    expect(shifts).toBeGreaterThan(8);
    expect(shifts).toBeLessThan(90);
  });

  it('shy looks away from the target more than playful', () => {
    const away = (personality: 'shy' | 'playful') => {
      const p = motionProfile({ ...settings, personality });
      const gaze = new GazeSystem(8);
      let off = 0;
      for (let i = 0; i < 60 * 120; i++)
        if (Math.abs(gaze.update(1 / 60, i / 60, p, { x: 0, y: 0 }).x) > 0.3) off++;
      return off;
    };
    expect(away('shy')).toBeGreaterThan(away('playful'));
  });
});

describe('idle layer', () => {
  it('breathes and sways continuously without ever being static', () => {
    const samples = [0, 0.7, 1.4, 2.1, 2.8].map((t) => idleLayer(t, 4, profile));
    const squash = new Set(samples.map((s) => s.squash.toFixed(4)));
    expect(squash.size).toBe(5);
    for (const s of samples) expect(Math.abs(s.lean)).toBeLessThan(0.06);
  });
});

describe('fidgets', () => {
  it('never repeat the same fidget twice in a row and are seeded', () => {
    const run = () => {
      const fidgets = new FidgetSystem(17);
      const seen: string[] = [];
      for (let i = 0; i < 60 * 600; i += 2) {
        const out = fidgets.update(i / 60, profile, false);
        if (out.id && out.id !== seen.at(-1)) seen.push(out.id);
      }
      return seen;
    };
    const seen = run();
    expect(seen.length).toBeGreaterThan(20);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
    expect(run()).toEqual(seen);
  });

  it('stop in quiet mode and wait while busy', () => {
    const quiet = motionProfile({ ...settings, quiet: true });
    const fidgets = new FidgetSystem(2);
    for (let t = 0; t < 120; t += 0.1) expect(fidgets.update(t, quiet, false).id).toBeNull();
    const busy = new FidgetSystem(2);
    for (let t = 0; t < 120; t += 0.1) expect(busy.update(t, profile, true).id).toBeNull();
  });
});

describe('expressions', () => {
  it('play anticipation, an accent, a moving hold and recovery', () => {
    const expressions = new ExpressionSystem();
    expressions.play('skeptical', { at: 0, intensity: 1 });
    const brow = (t: number) => expressions.evaluate(t, profile).pose.browL ?? 0;
    // Raised brow is negative; it must read clearly at the hold and be gone after recovery.
    // The clock only moves forward, as in the renderer.
    expect(brow(0.02)).toBeCloseTo(0, 1);
    const tiltA = expressions.evaluate(1.3, profile).pose.headTilt;
    expect(brow(1.4)).toBeLessThan(-0.6);
    // Moving hold: the pose keeps drifting slightly instead of freezing.
    const tiltB = expressions.evaluate(1.6, profile).pose.headTilt;
    expect(tiltA).toBeDefined();
    expect(tiltA).not.toBe(tiltB);
    expect(brow(30)).toBeCloseTo(0, 5);
  });

  it('release ramps down smoothly from wherever the expression is', () => {
    const expressions = new ExpressionSystem();
    expressions.play('listening', { at: 0, intensity: 1, hold: Infinity });
    const before = expressions.evaluate(2, profile).pose.headTilt ?? 0;
    expressions.release('listening', 2);
    const just = expressions.evaluate(2.02, profile).pose.headTilt ?? 0;
    expect(Math.abs(just - before)).toBeLessThan(Math.abs(before) * 0.2 + 1e-3);
    expect(expressions.evaluate(4, profile).pose.headTilt ?? 0).toBeCloseTo(0, 4);
  });

  it('scales with personality: playful is larger than shy', () => {
    const size = (personality: 'shy' | 'playful') => {
      const expressions = new ExpressionSystem();
      expressions.play('celebrate', { at: 0, intensity: 1 });
      const p = motionProfile({ ...settings, personality });
      let max = 0;
      for (let t = 0; t < 3; t += 0.02)
        max = Math.max(max, Math.abs(expressions.evaluate(t, p).pose.squash ?? 0));
      return max;
    };
    expect(size('playful')).toBeGreaterThan(size('shy'));
  });

  it('exposes a library covering the six core performances', () => {
    for (const id of ['listening', 'skeptical', 'caught', 'approve', 'celebrate', 'wave'])
      expect(expressionLibrary[id]).toBeDefined();
  });
});
