import { describe, expect, it } from 'vitest';
import { expressionIds } from '../shared/expressions';
import { gaits as cueGaits, moods as cueMoods, movementStyles } from '../shared/locomotion';
import {
  gaitIds,
  gaitLibrary,
  moodIds,
  resolveGait,
} from '../src/renderer/motion/systems/gaits/library';
import { selectGait, type GaitContext } from '../src/renderer/motion/systems/gaits/select';
import { Locomotion, type LocomotionFrame } from '../src/renderer/motion/systems/locomotion';
import { motionProfile } from '../src/renderer/motion/profile';
import type { Stage } from '../src/renderer/motion/types';

const stage: Stage = { aspect: 16 / 9, bodyHeight: 220 / 720, margin: 0.02 };
const profile = motionProfile({
  personality: 'playful',
  attitude: 'cheeky',
  energy: 60,
  reducedMotion: false,
  quiet: false,
});

describe('gait library', () => {
  it('matches the cue schema, the studio styles and real expression ids', () => {
    for (const id of gaitIds) expect(cueGaits).toContain(id);
    for (const id of cueGaits) expect(resolveGait(id)).toBeDefined();
    expect([...moodIds].sort()).toEqual([...cueMoods].sort());
    for (const mood of moodIds) expect(expressionIds).toContain(mood);
    for (const style of movementStyles) if (style !== 'auto') expect(gaitIds).toContain(style);
    for (const spec of Object.values(gaitLibrary))
      if (spec.mood) expect(moodIds).toContain(spec.mood.id);
  });

  it('skip and trudge carry their moods and beats', () => {
    expect(gaitLibrary.skip.cycle).toBe('skip');
    expect(gaitLibrary.skip.mood?.id).toBe('excited');
    expect(gaitLibrary.trudge.mood?.id).toBe('sad');
    expect(gaitLibrary.trudge.start?.mood).toBe('annoyed');
    expect(gaitLibrary.trudge.pause).toBeDefined();
  });
});

describe('gait selection rules', () => {
  const base: GaitContext = {
    reason: 'dragged',
    personality: 'cozy',
    attitude: 'cheeky',
    energy: 50,
    distanceBH: 2,
    seed: 1,
    cue: 'a',
  };

  it('is deterministic per cue and avoids repeating the previous choice', () => {
    let previous: GaitContext['previous'];
    for (let i = 0; i < 40; i++) {
      const context = { ...base, personality: 'playful' as const, cue: String(i), previous };
      const choice = selectGait(context);
      expect(selectGait(context)).toEqual(choice);
      expect(choice.gait).not.toBe(previous);
      previous = choice.gait;
    }
  });

  it('follows the reason: home ambles, peeking sneaks, a nap makes it trudge sleepily', () => {
    expect(selectGait({ ...base, reason: 'peek' }).gait).toBe('sneak');
    const home = new Set(
      Array.from(
        { length: 30 },
        (_, i) => selectGait({ ...base, reason: 'home', cue: String(i) }).gait,
      ),
    );
    expect(home.has('amble')).toBe(true);
    const nap = selectGait({ ...base, bodyState: 'nap', cue: 'n' });
    if (nap.gait === 'trudge') expect(nap.mood).toBe('sleepy');
  });

  it('never picks an automatic hop for long distances', () => {
    for (let i = 0; i < 60; i++)
      expect(
        selectGait({ ...base, personality: 'playful', distanceBH: 6, cue: String(i) }).gait,
      ).not.toBe('hop');
  });
});

function travel(gait: string, distance = 0.25, seconds = 20) {
  const loco = new Locomotion(2);
  loco.place(0.3, 0.92);
  loco.moveTo({ x: 0.3 + distance, at: 0, gait });
  const frames: LocomotionFrame[] = [];
  for (let i = 0; i <= 60 * seconds; i++)
    frames.push(loco.update(i ? 1 / 60 : 0, i / 60, profile, stage, { feet: true }));
  return frames;
}

describe('every gait travels on the floor', () => {
  for (const id of gaitIds)
    it(`${id}: arrives, keeps planted feet still and only leaves the floor in flight`, () => {
      const frames = travel(id);
      const end = frames.at(-1);
      expect(end?.state).toBe('idle');
      expect(end?.x).toBeCloseTo(0.55, 2);
      let anchor: number | null = null,
        slip = 0,
        airborne = 0;
      for (const f of frames) {
        if (f.lift > 0) airborne++;
        const planted = f.lift === 0 && (f.pose.footLY ?? 0) < 1e-4;
        if (!planted) {
          anchor = null;
          continue;
        }
        const world =
          (f.x * stage.aspect + f.facing * (f.pose.footLX ?? 0) * stage.bodyHeight) * 720;
        anchor ??= world;
        slip = Math.max(slip, Math.abs(world - anchor));
      }
      expect(slip).toBeLessThanOrEqual(1.5);
      if (gaitLibrary[id].cycle === 'step') expect(airborne).toBe(0);
      else expect(airborne).toBeGreaterThan(5);
      // A mood rides along while travelling.
      if (gaitLibrary[id].mood) expect(frames.some((f) => f.mood?.id)).toBe(true);
    });

  it('settles and reports arrival within 0.6 s of reaching the target (any gait)', () => {
    for (const id of gaitIds) {
      const frames = travel(id, 0.35, 30);
      const reached = frames.findIndex((f) => Math.abs(f.x - 0.65) < 1e-3);
      const stopped = frames.findIndex((f, i) => i > reached && !f.moving);
      expect(reached).toBeGreaterThan(0);
      expect((stopped - reached) / 60).toBeLessThan(0.6);
    }
  });

  it('trudge stops to sigh on long trips with both feet planted', () => {
    const frames = travel('trudge', 0.7);
    const pausing = frames.filter((f) => f.state === 'pausing');
    expect(pausing.length).toBeGreaterThan(30);
    for (const f of pausing) {
      expect(f.pose.footLY).toBe(0);
      expect(f.pose.footRY).toBe(0);
    }
  });

  it('skip ends with a twirl beat and trudge with a slump', () => {
    const skip = travel('skip');
    // Cheat turn style (default): the twirl never mirrors the body; it is a bounce with flourish.
    expect(skip.some((f) => f.beat === 'twirl and bounce')).toBe(true);
    expect(skip.every((f) => f.facing === 1)).toBe(true);
    expect(travel('trudge').some((f) => f.beat === 'slump, hmph')).toBe(true);
  });
});
