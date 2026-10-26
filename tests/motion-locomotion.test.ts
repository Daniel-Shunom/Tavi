import { describe, expect, it } from 'vitest';
import {
  Locomotion,
  chooseGait,
  type LocomotionFrame,
} from '../src/renderer/motion/systems/locomotion';
import { motionProfile } from '../src/renderer/motion/profile';
import type { MotionSettings, Stage } from '../src/renderer/motion/types';

const stage: Stage = { aspect: 16 / 9, bodyHeight: 220 / 720, margin: 0.02 };
const settings: MotionSettings = {
  personality: 'cozy',
  attitude: 'cheeky',
  energy: 50,
  reducedMotion: false,
  quiet: false,
};
const profile = motionProfile(settings);
const feet = { feet: true };

function run(
  loco: Locomotion,
  seconds: number,
  fps = 60,
  p = profile,
  start = 0,
  onFrame?: (frame: LocomotionFrame, t: number) => void,
) {
  let frame = loco.update(0, start, p, stage, feet);
  for (let i = 1; i <= Math.round(seconds * fps); i++) {
    const t = start + i / fps;
    frame = loco.update(1 / fps, t, p, stage, feet);
    onFrame?.(frame, t);
  }
  return frame;
}

describe('locomotion', () => {
  it('walks to a target, faces the way it travels, and settles', () => {
    const loco = new Locomotion(1);
    loco.place(0.3, 0.9);
    loco.moveTo({ x: 0.5, at: 0 });
    let facedRight = false;
    const end = run(loco, 12, 60, profile, 0, (f) => {
      if (f.moving && f.facing > 0.9) facedRight = true;
    });
    expect(end.x).toBeCloseTo(0.5, 2);
    expect(end.moving).toBe(false);
    expect(facedRight).toBe(true);
  });

  it('is frame-rate independent', () => {
    const final = (fps: number) => {
      const loco = new Locomotion(1);
      loco.place(0.2, 0.9);
      loco.moveTo({ x: 0.45, at: 0 });
      let arrived = Infinity;
      run(loco, 20, fps, profile, 0, (f, t) => {
        if (!f.moving && arrived === Infinity && t > 0.5) arrived = t;
      });
      return arrived;
    };
    expect(Math.abs(final(30) - final(120))).toBeLessThan(0.25);
  });

  it('keeps the stance foot planted on the ground (no sliding)', () => {
    const loco = new Locomotion(4);
    loco.place(0.3, 0.9);
    loco.moveTo({ x: 0.42, at: 0, gait: 'walk' });
    // World x of the screen-left foot, in stage units, while it is in stance.
    let anchor: number | null = null;
    let worst = 0;
    run(loco, 6, 120, profile, 0, (f) => {
      if (f.gait !== 'walk' || !f.moving) return;
      const bh = stage.bodyHeight;
      const footWorld = f.x * stage.aspect + f.facing * (f.pose.footLX ?? 0) * bh;
      const stance = (f.pose.footLY ?? 0) < 1e-4;
      if (stance) {
        anchor ??= footWorld;
        worst = Math.max(worst, Math.abs(footWorld - anchor));
      } else anchor = null;
    });
    // Less than 1.5 px of slip at 720p.
    expect(worst * 720).toBeLessThan(1.5);
  });

  it('hops: lifts during flight and barely moves while touching the ground', () => {
    const loco = new Locomotion(2);
    loco.place(0.1, 0.9);
    loco.moveTo({ x: 0.8, at: 0, gait: 'hop' });
    let maxLift = 0,
      groundSlip = 0,
      last: LocomotionFrame | null = null;
    run(loco, 3, 120, profile, 0, (f) => {
      maxLift = Math.max(maxLift, f.lift);
      if (last && f.lift === 0 && last.lift === 0 && f.moving)
        groundSlip = Math.max(groundSlip, Math.abs(f.x - last.x));
      last = f;
    });
    // Hop apex ~8-20% of body height (research); 0.305 BH of canvas height.
    expect(maxLift).toBeGreaterThan(0.08 * stage.bodyHeight);
    expect(groundSlip * 1280).toBeLessThan(1.2);
  });

  it('leans into acceleration and back on braking', () => {
    const loco = new Locomotion(3);
    loco.place(0.2, 0.9);
    loco.moveTo({ x: 0.6, at: 0, gait: 'walk' });
    let forward = 0,
      back = 0;
    run(loco, 10, 60, profile, 0, (f) => {
      forward = Math.max(forward, f.pose.lean ?? 0);
      back = Math.min(back, f.pose.lean ?? 0);
    });
    expect(forward).toBeGreaterThan(0.02);
    expect(back).toBeLessThan(-0.01);
  });

  it('keeps targets inside the safe stage bounds', () => {
    const loco = new Locomotion(5);
    loco.place(0.5, 0.9);
    loco.moveTo({ x: 1.4, at: 0 });
    const end = run(loco, 20);
    expect(end.x).toBeLessThan(0.98);
    expect(end.x).toBeGreaterThan(0.85);
  });

  it('reduced motion fades and relocates instead of walking', () => {
    const reduced = motionProfile({ ...settings, reducedMotion: true });
    const loco = new Locomotion(6);
    loco.place(0.2, 0.9);
    loco.moveTo({ x: 0.7, at: 0 });
    let minOpacity = 1,
      midway = 0;
    const end = run(loco, 2, 60, reduced, 0, (f) => {
      minOpacity = Math.min(minOpacity, f.opacity);
      if (f.x > 0.3 && f.x < 0.6) midway++;
    });
    expect(minOpacity).toBeLessThan(0.05);
    expect(midway).toBe(0);
    expect(end.x).toBeCloseTo(0.7, 3);
    expect(end.opacity).toBeCloseTo(1, 2);
  });

  it('turns readably when walking back: crouch, flip at the narrow point, then walk', () => {
    const loco = new Locomotion(7);
    loco.place(0.3, 0.9);
    loco.moveTo({ x: 0.45, at: 0 });
    run(loco, 6, 60, profile, 0);
    loco.moveTo({ x: 0.3, at: 6.05, gait: 'walk' }); // reverse mid-way or after arrival
    const flipStates = new Set<string>();
    let previous = 1,
      flips = 0,
      crouched = false,
      last: LocomotionFrame | null = null;
    run(loco, 8, 60, profile, 6, (f) => {
      if (f.state === 'turning' && (f.pose.bob ?? 0) > 0.004) crouched = true;
      if (Math.sign(f.facing) !== Math.sign(previous)) {
        flips++;
        flipStates.add(f.state);
        expect(Math.abs(f.facing)).toBeLessThan(0.3);
      }
      previous = f.facing;
      last = f;
    });
    expect(flips).toBe(1);
    expect([...flipStates]).toEqual(['turning']);
    expect(crouched).toBe(true);
    expect((last as LocomotionFrame | null)?.facing).toBeCloseTo(-1, 3);
  });

  it('chooses gait from distance and personality', () => {
    const shy = motionProfile({ ...settings, personality: 'shy' });
    const playful = motionProfile({ ...settings, personality: 'playful' });
    // Fallback only (selection rules live in gaits/select.ts); never an automatic hop.
    expect(chooseGait(0.6, shy, feet)).toBe('scurry');
    expect(chooseGait(0.6, profile, feet)).toBe('amble');
    expect(chooseGait(3, playful, feet)).toBe('walk');
    expect(chooseGait(0.6, profile, { feet: false })).toBe('hop');
  });
});
