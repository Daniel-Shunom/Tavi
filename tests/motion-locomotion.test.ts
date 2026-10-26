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

  it('cheat turn (front-facing chibi): head leads, no mirror, no squeeze', () => {
    const loco = new Locomotion(7);
    loco.place(0.3, 0.9);
    loco.moveTo({ x: 0.45, at: 0 });
    run(loco, 6, 60, profile, 0);
    loco.moveTo({ x: 0.3, at: 6.05, gait: 'walk' });
    let gazeAt = Infinity,
      moveAt = Infinity,
      lastX = loco.position.x;
    run(loco, 8, 60, profile, 6, (f, t) => {
      expect(f.facing).toBe(1);
      expect(f.scaleX).toBeGreaterThan(0.9);
      if ((f.pose.gazeX ?? 0) < -0.3 && gazeAt === Infinity) gazeAt = t;
      if (f.x < lastX - 1e-6 && moveAt === Infinity) moveAt = t;
      lastX = f.x;
    });
    expect(gazeAt).toBeLessThan(Infinity);
    expect(moveAt - gazeAt).toBeGreaterThanOrEqual(0.08);
  });

  it('authored turnaround: head leads body, the whole sprite faces travel, then returns front', () => {
    const caps = { feet: true, turnStyle: 'authored' as const };
    const loco = new Locomotion(7);
    loco.place(0.45, 0.9);
    loco.moveTo({ x: 0.3, at: 0, gait: 'walk' });
    let headAt = Infinity,
      bodyAt = Infinity,
      arrivedAt = Infinity,
      settledAt = Infinity,
      hold = 0;
    for (let i = 0; i <= 60 * 12; i++) {
      const t = i / 60;
      const f = loco.update(i ? 1 / 60 : 0, t, profile, stage, caps);
      if (f.state === 'moving') expect(f.facing).toBe(-1);
      const head = f.pose.turnHead ?? 0,
        body = f.pose.turnBody ?? 0;
      const worldTurn = (value: number) => value * f.facing * -1;
      if (worldTurn(head) > 0.3 && headAt === Infinity) headAt = t;
      if (worldTurn(body) > 0.3 && bodyAt === Infinity) bodyAt = t;
      if (f.state === 'moving') hold = Math.max(hold, worldTurn(body));
      if (!f.moving && t > 1 && arrivedAt === Infinity) arrivedAt = t;
      if (
        arrivedAt < Infinity &&
        Math.abs(head) < 0.05 &&
        Math.abs(body) < 0.05 &&
        settledAt === Infinity
      )
        settledAt = t;
    }
    expect(bodyAt - headAt).toBeGreaterThanOrEqual(0.08);
    expect(hold).toBeCloseTo(0.6, 1);
    expect(settledAt - arrivedAt).toBeLessThan(0.6);
  });

  it('mirror-hidden turn swaps facing once, instantly, at the apex of a pivot hop', () => {
    const caps = { feet: true, turnStyle: 'mirror-hidden' as const };
    const loco = new Locomotion(7);
    loco.place(0.3, 0.9);
    loco.moveTo({ x: 0.45, at: 0 });
    for (let i = 0; i <= 360; i++) loco.update(i ? 1 / 60 : 0, i / 60, profile, stage, caps);
    loco.moveTo({ x: 0.3, at: 6.05, gait: 'walk' });
    let previous = 1,
      flips = 0;
    let last: LocomotionFrame | null = null;
    for (let i = 361; i <= 840; i++) {
      const f = loco.update(1 / 60, i / 60, profile, stage, caps);
      if (Math.sign(f.facing) !== Math.sign(previous)) {
        flips++;
        expect(Math.abs(f.facing)).toBe(1);
        expect(f.lift).toBeGreaterThan(0);
      }
      previous = f.facing;
      last = f;
    }
    expect(flips).toBe(1);
    expect(last?.facing).toBe(-1);
  });

  it('authored turnaround plants the body instead of squeezing through a full mirror rotation', () => {
    const loco = new Locomotion(7);
    loco.place(0.45, 0.9);
    loco.moveTo({ x: 0.2, at: 0, gait: 'walk' });
    let turning = 0;
    let stepped = false;
    for (let i = 0; i <= 60; i++) {
      const frame = loco.update(i ? 1 / 60 : 0, i / 60, profile, stage, {
        feet: true,
        turnStyle: 'authored',
      });
      if (frame.state !== 'turning') continue;
      turning++;
      expect(Math.abs(frame.facing)).toBe(1);
      expect(frame.lift).toBe(0);
      expect(frame.x).toBeCloseTo(0.45, 6);
      if ((frame.pose.footLY ?? 0) > 0 || (frame.pose.footRY ?? 0) > 0) stepped = true;
    }
    expect(turning).toBeGreaterThan(10);
    expect(stepped).toBe(true);
  });

  it('walks back through the route after a mid-stride reversal instead of snapping to the target', () => {
    const loco = new Locomotion(7);
    const caps = { feet: true, turnStyle: 'authored' as const, authored: ['walk'] as const };
    loco.place(0.3, 0.9);
    loco.moveTo({ x: 0.8, at: 0, gait: 'walk', beats: 'none' });
    let previousX = 0.3;
    let reverseX = 0.3;
    let travelledBack = false;
    for (let i = 0; i <= 60 * 5; i++) {
      if (i === 60) {
        reverseX = previousX;
        loco.moveTo({ x: 0.2, at: 1, gait: 'walk', beats: 'none' });
      }
      const frame = loco.update(i ? 1 / 60 : 0, i / 60, profile, stage, caps);
      expect(Math.abs(frame.x - previousX)).toBeLessThan(0.01);
      if (i > 60 && frame.x < reverseX - 0.005 && frame.x > 0.205) travelledBack = true;
      previousX = frame.x;
    }
    expect(travelledBack).toBe(true);
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
