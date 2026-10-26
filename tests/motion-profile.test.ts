import { describe, expect, it } from 'vitest';
import { motionProfile } from '../src/renderer/motion/profile';
import type { MotionSettings } from '../src/renderer/motion/types';

const base: MotionSettings = {
  personality: 'cozy',
  attitude: 'cheeky',
  energy: 50,
  reducedMotion: false,
  quiet: false,
};

describe('personality to motion profile', () => {
  it('playful moves faster and bigger than cozy, with bouncier springs', () => {
    const cozy = motionProfile(base);
    const playful = motionProfile({ ...base, personality: 'playful' });
    expect(playful.tempo).toBeGreaterThan(cozy.tempo);
    expect(playful.amplitude).toBeGreaterThan(cozy.amplitude);
    expect(playful.head.zeta).toBeLessThan(cozy.head.zeta);
    expect(playful.breathPeriod).toBeLessThan(cozy.breathPeriod);
  });

  it('shy reacts later, looks away more and makes smaller gestures', () => {
    const shy = motionProfile({ ...base, personality: 'shy' });
    const playful = motionProfile({ ...base, personality: 'playful' });
    expect(shy.reactionLatency).toBeGreaterThan(playful.reactionLatency);
    expect(shy.gazeAwayBias).toBeGreaterThan(playful.gazeAwayBias);
    expect(shy.amplitude).toBeLessThan(playful.amplitude);
  });

  it('energy scales tempo, amplitude and fidget rate monotonically', () => {
    const low = motionProfile({ ...base, energy: 0 });
    const high = motionProfile({ ...base, energy: 100 });
    expect(high.tempo).toBeGreaterThan(low.tempo);
    expect(high.amplitude).toBeGreaterThan(low.amplitude);
    expect(high.fidgetMean).toBeLessThan(low.fidgetMean);
  });

  it('cheeky anticipates and spicy is snappier than gentle', () => {
    const gentle = motionProfile({ ...base, attitude: 'gentle' });
    const cheeky = motionProfile(base);
    const spicy = motionProfile({ ...base, attitude: 'spicy' });
    expect(cheeky.head.r).toBeLessThan(gentle.head.r);
    expect(spicy.head.f).toBeGreaterThan(gentle.head.f);
    expect(spicy.overshoot).toBeGreaterThan(gentle.overshoot);
  });

  it('quiet keeps calm life but drops initiative', () => {
    const quiet = motionProfile({ ...base, quiet: true });
    expect(quiet.fidgetMean).toBe(Infinity);
    expect(quiet.blinkMean).toBeGreaterThan(0);
    expect(quiet.breathAmount).toBeGreaterThan(0);
  });

  it('reduced motion stays alive but removes travel, bounce and large scale', () => {
    const reduced = motionProfile({ ...base, personality: 'playful', reducedMotion: true });
    expect(reduced.travel).toBe(false);
    expect(reduced.maxSquash).toBeLessThanOrEqual(0.1);
    expect(reduced.blinkMean).toBeGreaterThan(0);
    expect(reduced.amplitude).toBeLessThanOrEqual(0.5);
  });
});
