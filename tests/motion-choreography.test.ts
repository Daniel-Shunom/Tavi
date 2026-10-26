import { describe, expect, it } from 'vitest';
import {
  ChoreographyPlayer,
  selectChoreography,
  type ChoreographyFrame,
} from '../src/renderer/motion/systems/choreography';
import { Locomotion } from '../src/renderer/motion/systems/locomotion';
import { motionProfile } from '../src/renderer/motion/profile';
import type { MotionSettings, Stage } from '../src/renderer/motion/types';

const stage: Stage = { aspect: 16 / 9, bodyHeight: 220 / 720, margin: 0.02 };
const settings: MotionSettings = {
  personality: 'playful',
  attitude: 'cheeky',
  energy: 60,
  reducedMotion: false,
  quiet: false,
};
const profile = motionProfile(settings);
const anchor = { x: 0.82, y: 0.95 };

function play(id: string, { seconds = 6, p = profile, calm = false } = {}) {
  const loco = new Locomotion(1);
  loco.place(anchor.x, anchor.y);
  const player = new ChoreographyPlayer();
  player.start(id, { at: 0, anchor }, loco, stage, calm);
  const frames: ChoreographyFrame[] = [];
  for (let i = 0; i <= seconds * 60; i++) {
    const t = i / 60;
    frames.push(
      player.update(t, p, stage, loco.update(i ? 1 / 60 : 0, t, p, stage, { feet: true })),
    );
  }
  return { frames, player, loco };
}

describe('choreography', () => {
  it('drop from the top: falls, squashes on impact, bounces and dusts off', () => {
    const { frames } = play('drop');
    expect(frames[0]?.liftBH).toBeGreaterThan(anchor.y / stage.bodyHeight);
    expect(Math.min(...frames.map((f) => f.scaleY))).toBeLessThan(0.85);
    const bounces = frames.filter(
      (f, i) => i > 0 && f.liftBH > 0.02 && (frames[i - 1]?.liftBH ?? 1) <= 0.02,
    ).length;
    expect(bounces).toBeGreaterThanOrEqual(1);
    expect(frames.some((f) => f.expressions.includes('dustOff'))).toBe(true);
    const end = frames.at(-1);
    expect(end?.done).toBe(true);
    expect(end?.liftBH).toBe(0);
    expect(end?.hidden).toBe(false);
    expect(frames.every((f) => f.shake === 0)).toBe(true);
  });

  for (const id of ['hopOff', 'duck'])
    it(`${id} exits below the ground line quickly and ends hidden`, () => {
      const { frames } = play(id);
      const doneAt = frames.findIndex((f) => f.done);
      expect(doneAt / 60).toBeLessThan(1);
      expect(frames.some((f) => f.clipBelow === anchor.y)).toBe(true);
      expect(frames.at(-1)?.hidden).toBe(true);
    });

  it('calm variant (quiet / reduced motion) is a short fade', () => {
    const { frames } = play('drop', { calm: true });
    expect(frames.findIndex((f) => f.done) / 60).toBeLessThan(0.5);
    expect(Math.max(...frames.map((f) => Math.abs(f.liftBH)))).toBeLessThan(0.1);
  });

  it('hiding mid-entrance continues from the current pose', () => {
    const loco = new Locomotion(1);
    loco.place(anchor.x, anchor.y);
    const player = new ChoreographyPlayer();
    player.start('drop', { at: 0, anchor }, loco, stage);
    let frame: ChoreographyFrame | null = null;
    const lf = loco.update(0, 0, profile, stage, { feet: true });
    for (let i = 0; i <= 20; i++) frame = player.update(i / 60, profile, stage, lf);
    player.start('duck', { at: 20 / 60, anchor }, loco, stage);
    const next = player.update(21 / 60, profile, stage, lf);
    expect(Math.abs(next.liftBH - (frame?.liftBH ?? 0))).toBeLessThan(0.1);
    expect(next.choreography).toBe('duck');
  });

  it('a late joiner skips to the end state instead of replaying', () => {
    const loco = new Locomotion(1);
    loco.place(anchor.x, anchor.y);
    const player = new ChoreographyPlayer();
    player.start('drop', { at: 0, anchor }, loco, stage);
    const frame = player.update(
      120,
      profile,
      stage,
      loco.update(0, 120, profile, stage, { feet: true }),
    );
    expect(frame.done).toBe(true);
    expect(frame.liftBH).toBe(0);
  });

  it('selection is seeded per cue and never repeats the previous choice', () => {
    let previous: string | undefined;
    for (let cue = 0; cue < 40; cue++) {
      const id = selectChoreography('exit', {
        seed: 2,
        cue: String(cue),
        previous,
        profile,
        personality: 'playful',
      });
      expect(id).not.toBe(previous);
      expect(
        selectChoreography('exit', {
          seed: 2,
          cue: String(cue),
          previous,
          profile,
          personality: 'playful',
        }),
      ).toBe(id);
      previous = id;
    }
  });
});
