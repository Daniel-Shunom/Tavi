// Grounding: the character stands on a floor. While grounded the placement never moves
// vertically (body motion comes from hips/knees over planted feet), the hips never rise above
// standing height (feet would leave the floor), channels have bounded per-frame acceleration,
// planted feet do not slip, and airborne phases follow one constant gravity.
import { describe, expect, it } from 'vitest';
import { MotionLayer } from '../src/renderer/motion/motion';
import { expressionLibrary } from '../src/renderer/motion/systems/expressions';
import { choreographies } from '../src/renderer/motion/systems/choreography';
import { G_BH } from '../src/renderer/motion/core/physics';
import type { MotionFrame, Stage } from '../src/renderer/motion/types';

const stage: Stage = { aspect: 16 / 9, bodyHeight: 220 / 720, margin: 0.02 };
const PX = 720; // canvas height in px
const BH_PX = stage.bodyHeight * PX;

function layer(personality: 'cozy' | 'playful' | 'shy' = 'playful') {
  const l = new MotionLayer(
    3,
    { personality, attitude: 'spicy', energy: 85, reducedMotion: false, quiet: false },
    stage,
    { feet: true },
  );
  l.place(0.5, 0.92);
  return l;
}

function run(l: MotionLayer, seconds: number, start = 0, cue?: (t: number) => void) {
  const frames: MotionFrame[] = [];
  for (let i = 0; i <= seconds * 60; i++) {
    const t = start + i / 60;
    cue?.(t);
    frames.push(l.update(t));
  }
  return frames;
}

interface Report {
  groundedAccelPx: number;
  hipRiseBH: number;
  channelAccel: number;
  footSlipPx: number;
}

function analyse(frames: MotionFrame[]): Report {
  const report: Report = { groundedAccelPx: 0, hipRiseBH: 0, channelAccel: 0, footSlipPx: 0 };
  let anchor: number | null = null;
  for (let i = 2; i < frames.length; i++) {
    const [a, b, c] = [frames[i - 2], frames[i - 1], frames[i]] as [
      MotionFrame,
      MotionFrame,
      MotionFrame,
    ];
    const grounded = [a, b, c].every((f) => f.status.airborne === 0 && f.placement.opacity > 0.99);
    if (grounded) {
      const accel = Math.abs(c.placement.y - 2 * b.placement.y + a.placement.y) * PX;
      report.groundedAccelPx = Math.max(report.groundedAccelPx, accel);
      report.hipRiseBH = Math.max(report.hipRiseBH, -c.pose.bob);
      for (const key of ['bob', 'shift', 'lean', 'headTilt'] as const) {
        const scale = key === 'bob' || key === 'shift' ? BH_PX : 30; // px, or ~px at head radius
        report.channelAccel = Math.max(
          report.channelAccel,
          Math.abs(c.pose[key] - 2 * b.pose[key] + a.pose[key]) * scale,
        );
      }
      // Planted screen-left foot: world x must not move while it is on the floor.
      if (c.pose.footLY < 1e-4) {
        const world =
          (c.placement.x * stage.aspect + c.placement.facing * c.pose.footLX * stage.bodyHeight) *
          PX;
        anchor ??= world;
        report.footSlipPx = Math.max(report.footSlipPx, Math.abs(world - anchor));
        if (Math.abs(c.placement.x - b.placement.x) < 1e-9 && b.pose.footLY < 1e-4) anchor = world;
      } else anchor = null;
    } else anchor = null;
  }
  return report;
}

const limits = { groundedAccelPx: 0.05, hipRiseBH: 0.0045, channelAccel: 1.5, footSlipPx: 1.5 };

function expectGrounded(report: Report) {
  expect(report.groundedAccelPx).toBeLessThanOrEqual(limits.groundedAccelPx);
  expect(report.hipRiseBH).toBeLessThanOrEqual(limits.hipRiseBH);
  expect(report.channelAccel).toBeLessThanOrEqual(limits.channelAccel);
  expect(report.footSlipPx).toBeLessThanOrEqual(limits.footSlipPx);
}

describe('grounding', () => {
  it('idle stands on the floor (weight shift, no float)', () => {
    expectGrounded(analyse(run(layer('cozy'), 30)));
  });

  for (const id of Object.keys(expressionLibrary))
    it(`expression ${id} acts over planted feet`, () => {
      const l = layer();
      expectGrounded(analyse(run(l, 5, 0, (t) => t === 0.5 && l.express(id, { at: 0.5 }))));
    });

  it('walking keeps planted feet still and the body on the floor', () => {
    const l = layer('cozy');
    expectGrounded(
      analyse(run(l, 14, 0, (t) => t === 0.2 && l.moveTo({ x: 0.75, at: 0.2, gait: 'step' }))),
    );
  });

  for (const id of Object.keys(choreographies))
    it(`choreography ${id} is grounded whenever it is not airborne`, () => {
      const l = layer();
      const entrance = choreographies[id]?.type === 'entrance';
      const frames = run(l, 14, 0, (t) => {
        if (t === 0.2) l.exit({ at: 0.2, cue: 'pre', id: entrance ? 'duck' : 'duck' });
        if (t === (entrance ? 1.5 : 1.5)) {
          if (entrance) l.enter({ at: 1.5, cue: 'x', anchor: { x: 0.5, y: 0.92 }, id });
          else l.enter({ at: 1.5, cue: 'y', anchor: { x: 0.5, y: 0.92 }, id: 'slideUp' });
        }
        if (!entrance && t === 6) l.exit({ at: 6, cue: 'z', id });
      });
      expectGrounded(analyse(frames));
    });

  it('airborne phases share one gravity (hop and drop)', () => {
    const l = layer();
    const frames = run(l, 6, 0, (t) => {
      if (t === 0.1) l.exit({ at: 0.1, cue: 'a', id: 'duck' });
      if (t === 1) l.enter({ at: 1, cue: 'b', anchor: { x: 0.5, y: 0.92 }, id: 'drop' });
    });
    // During free fall the vertical acceleration equals g (in body heights / s^2).
    const falling = frames.filter(
      (f) => f.status.choreography === 'drop' && f.status.airborne > 0.5,
    );
    let measured = 0;
    for (let i = 2; i < falling.length; i++) {
      const [a, b, c] = [falling[i - 2], falling[i - 1], falling[i]] as [
        MotionFrame,
        MotionFrame,
        MotionFrame,
      ];
      if (c.time - a.time > 0.04) continue;
      measured = Math.max(
        measured,
        ((c.placement.y - 2 * b.placement.y + a.placement.y) / stage.bodyHeight) * 3600,
      );
    }
    expect(measured).toBeGreaterThan(G_BH * 0.8);
    expect(measured).toBeLessThan(G_BH * 1.2);
  });

  it('casts a contact shadow that shrinks and fades when airborne', () => {
    const l = layer();
    const frames = run(l, 3, 0, (t) => {
      if (t === 0.1) l.exit({ at: 0.1, cue: 'a', id: 'duck' });
      if (t === 1) l.enter({ at: 1, cue: 'b', anchor: { x: 0.5, y: 0.92 }, id: 'drop' });
    });
    const air = frames.find((f) => f.status.airborne > 1);
    const ground = frames.at(-1);
    expect(air?.shadow.scale).toBeLessThan(0.7);
    expect(ground?.shadow.opacity).toBeGreaterThan(0.5);
    expect(ground?.shadow.scale).toBeCloseTo(1, 1);
    expect(ground?.shadow.y).toBeCloseTo(0.92, 3);
  });
});
