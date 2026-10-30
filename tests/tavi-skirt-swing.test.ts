import { describe, expect, it } from 'vitest';
import { SkirtSwing, SWING_LIMIT } from '../src/renderer/characters/tavi-refined/cloth';

function run(swing: SkirtSwing, seconds: number, speed: number, start: number, dt = 1 / 60) {
  let x = start;
  const angles: number[] = [];
  for (let t = 0; t < seconds; t += dt) {
    x += speed * dt;
    angles.push(swing.update(dt, x));
  }
  return { x, angles };
}

describe('skirt swing', () => {
  it('trails travel, overshoots on the stop, and settles at rest', () => {
    const swing = new SkirtSwing();
    swing.update(1 / 60, 0);
    const moving = run(swing, 1, 0.5, 0);
    // Travelling right rotates the hem clockwise, trailing to the left.
    expect(moving.angles.at(-1)).toBeGreaterThan(0.05);
    const stop = run(swing, 2, 0, moving.x);
    expect(Math.min(...stop.angles)).toBeLessThan(-0.01);
    expect(Math.abs(stop.angles.at(-1) ?? 1)).toBeLessThan(0.002);
  });
  it('stays within the garment limit and ignores teleports and long frames', () => {
    const swing = new SkirtSwing();
    swing.update(1 / 60, 0);
    for (const angle of run(swing, 1, 20, 0).angles)
      expect(Math.abs(angle)).toBeLessThanOrEqual(SWING_LIMIT + 1e-9);
    const settled = new SkirtSwing();
    settled.update(1 / 60, 0);
    expect(settled.update(0.5, 40)).toBe(0);
    expect(settled.update(1 / 60, 40)).toBe(0);
  });
  it('fades out while seated and behaves the same at 30 and 144 fps', () => {
    const seated = new SkirtSwing();
    seated.update(1 / 60, 0);
    let x = 0;
    for (let i = 0; i < 60; i++) seated.update(1 / 60, (x += 0.01), 0);
    expect(seated.angle).toBe(0);
    const at = (fps: number) => {
      const s = new SkirtSwing();
      s.update(1 / fps, 0);
      return run(s, 0.5, 0.5, 0, 1 / fps).angles.at(-1) ?? 0;
    };
    expect(at(30)).toBeCloseTo(at(144), 2);
  });
});
