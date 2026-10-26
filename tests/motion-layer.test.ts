import { describe, expect, it } from 'vitest';
import { MotionLayer } from '../src/renderer/motion/motion';
import type { MotionFrame, MotionSettings, Stage } from '../src/renderer/motion/types';

const stage: Stage = { aspect: 16 / 9, bodyHeight: 220 / 720, margin: 0.02 };

function scenario(personality: MotionSettings['personality']) {
  const layer = new MotionLayer(
    5,
    { personality, attitude: 'spicy', energy: 80, reducedMotion: false, quiet: false },
    stage,
    { feet: true },
  );
  layer.place(0.3, 0.92);
  const frames: MotionFrame[] = [];
  const cues: [number, () => void][] = [
    [
      0.5,
      () => {
        layer.express('approve', { at: 0.5 });
      },
    ],
    [
      2.0,
      () => {
        layer.express('skeptical', { at: 2.0 });
      },
    ], // interrupts the nod
    [
      3.0,
      () => {
        layer.express('caught', { at: 3.0 });
      },
    ], // interrupts skeptical
    [
      6.0,
      () => {
        layer.moveTo({ x: 0.7, at: 6.0 });
      },
    ],
    [
      14,
      () => {
        layer.moveTo({ x: 0.1, at: 14, gait: 'hop' });
      },
    ],
    [20, () => layer.exit({ at: 20, cue: 'a', id: 'hopOff' })],
    [22, () => layer.enter({ at: 22, cue: 'b', anchor: { x: 0.5, y: 0.92 }, id: 'drop' })],
  ];
  for (let i = 0; i <= 60 * 28; i++) {
    const t = i / 60;
    for (const [at, run] of cues)
      if (Math.abs(at - t) < 1e-9 || (at > t - 1 / 60 && at <= t)) run();
    frames.push(layer.update(t));
  }
  return frames;
}

describe('motion layer output', () => {
  for (const personality of ['cozy', 'playful', 'shy'] as const)
    it(`${personality}: hair stays in its plausible range and never balloons`, () => {
      for (const frame of scenario(personality)) {
        expect(Math.abs(frame.pose.hairSwing)).toBeLessThanOrEqual(0.25 + 1e-9);
        expect(Math.abs(frame.pose.hairSwoop)).toBeLessThanOrEqual(0.18 + 1e-9);
        expect(Math.abs(frame.pose.hairSquash)).toBeLessThanOrEqual(0.06 + 1e-9);
      }
    });

  it('channels change smoothly even when one cue interrupts another (no pops)', () => {
    const frames = scenario('playful');
    let worst = 0,
      worstGaze = 0;
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1]?.pose,
        b = frames[i]?.pose;
      if (!a || !b) continue;
      for (const key of ['browL', 'browR', 'smile', 'headTilt', 'lean', 'hairSwing'] as const)
        worst = Math.max(worst, Math.abs(b[key] - a[key]));
      // Gaze is allowed to be quick (saccades, the snappy nod drop) but never a cut.
      for (const key of ['gazeX', 'gazeY'] as const)
        worstGaze = Math.max(worstGaze, Math.abs(b[key] - a[key]));
    }
    // Snappy beats (a startle) may move ~0.2 per frame; a pop would be a full-range jump.
    expect(worst).toBeLessThan(0.25);
    expect(worstGaze).toBeLessThan(0.35);
  });
});
