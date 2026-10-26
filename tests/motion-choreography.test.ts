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
  it('drop: fall, a held splat with eyes squeezed shut, get up, knee pats, straighten', () => {
    const { frames } = play('drop');
    expect(frames[0]?.liftBH).toBeGreaterThan(anchor.y / stage.bodyHeight);
    // Splat: hard flatten held long enough to read (>= 0.35 s), eyes shut.
    const splat = frames.filter(
      (f) => f.beat === 'splat' && f.scaleY < 0.75 && (f.pose.blinkL ?? 0) > 0.9,
    );
    expect(splat.length / 60).toBeGreaterThanOrEqual(0.35);
    // Knee pats: arms reaching down with at least 2 pats per side, alternating.
    const dust = frames.filter((f) => f.beat === 'dust off knees');
    let patsL = 0,
      prev = 0;
    for (const f of dust) {
      const v = f.pose.armL ?? 0;
      if (v > 0.3 && prev <= 0.3) patsL++;
      prev = v;
    }
    expect(patsL).toBeGreaterThanOrEqual(2);
    expect(frames.some((f) => f.beat === 'get up')).toBe(true);
    const doneAt = frames.findIndex((f) => f.done) / 60;
    expect(doneAt).toBeGreaterThan(2.5);
    expect(doneAt).toBeLessThan(4.2);
    const end = frames.at(-1);
    expect(end?.liftBH).toBe(0);
    expect(end?.hidden).toBe(false);
    expect(frames.every((f) => f.shake === 0)).toBe(true);
  });

  for (const id of ['tiredWalk', 'climb', 'slideUp', 'drop'])
    it(`${id}: moves every step of the way and ends settled at the anchor`, () => {
      const { frames, loco } = play(id, { seconds: 30 });
      const xs: number[] = [];
      const run = (() => {
        const l = new Locomotion(1);
        l.place(anchor.x, anchor.y);
        const player = new ChoreographyPlayer();
        player.start(id, { at: 0, anchor }, l, stage);
        for (let i = 0; i <= 150; i++) {
          const lf = l.update(i ? 1 / 60 : 0, i / 60, profile, stage, { feet: true });
          const f = player.update(i / 60, profile, stage, lf);
          xs.push(lf.x * 1000 + f.liftBH * 1000);
        }
        return xs;
      })();
      // Frames differ during the opening second (something visibly moves).
      expect(new Set(run.slice(10, 120).map((v) => v.toFixed(3))).size).toBeGreaterThan(20);
      const end = frames.at(-1);
      expect(end?.done).toBe(true);
      expect(end?.hidden).toBe(false);
      expect(end?.liftBH).toBe(0);
      expect(loco.position.x).toBeCloseTo(anchor.x, 2);
    });

  it('tired walk-in comes from the nearer side, slumped', () => {
    const { frames } = play('tiredWalk', { seconds: 2 });
    expect(frames.some((f) => f.expressions.includes('tired'))).toBe(true);
  });

  it('climb hides the body below the ground line while pulling up', () => {
    const { frames } = play('climb', { seconds: 1 });
    expect(
      frames.filter((f) => f.clipBelow === anchor.y && f.liftBH < -0.3).length,
    ).toBeGreaterThan(20);
  });

  it('tucking away mid walk-in cuts straight to an exit', () => {
    const loco = new Locomotion(1);
    loco.place(anchor.x, anchor.y);
    const player = new ChoreographyPlayer();
    player.start('tiredWalk', { at: 0, anchor }, loco, stage);
    let f: ChoreographyFrame | null = null;
    for (let i = 0; i <= 120; i++)
      f = player.update(
        i / 60,
        profile,
        stage,
        loco.update(i ? 1 / 60 : 0, i / 60, profile, stage, { feet: true }),
      );
    expect(f?.done).toBe(false);
    player.start('duck', { at: 2, anchor: loco.position }, loco, stage);
    for (let i = 121; i <= 240; i++)
      f = player.update(
        i / 60,
        profile,
        stage,
        loco.update(1 / 60, i / 60, profile, stage, { feet: true }),
      );
    expect(f?.hidden).toBe(true);
  });

  for (const id of ['hopOff', 'duck', 'jumpOut', 'walkOff'])
    it(`${id} exits below the ground line quickly and ends hidden`, () => {
      const { frames } = play(id);
      const doneAt = frames.findIndex((f) => f.done);
      expect(doneAt / 60).toBeLessThan(id === 'walkOff' ? 5 : 1.5);
      if (id === 'hopOff' || id === 'duck')
        expect(frames.some((f) => f.clipBelow === anchor.y)).toBe(true);
      expect(frames.at(-1)?.hidden).toBe(true);
    });

  it('calm variant (quiet / reduced motion) is a short fade', () => {
    const { frames } = play('drop', { calm: true });
    expect(frames.findIndex((f) => f.done) / 60).toBeLessThan(0.9);
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
