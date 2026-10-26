// Continuous idle life as a pure function of (time, seed): breathing plus layered noise at
// incommensurate slow frequencies, so the loop never visibly repeats (Live2D's default breath
// uses periods 3.2/3.5/5.5/6.5/15.5 s for the same reason). Pure -> studio and overlay agree.
import { fbm1 } from '../core/noise';
import type { MotionProfile } from '../profile';

export interface IdleSample {
  squash: number;
  bob: number;
  lean: number;
  headTilt: number;
  shift: number;
  armL: number;
  armR: number;
  hairSwing: number;
  gazeDriftX: number;
}

/** Breath phase in [0,1): inhale is a little shorter than exhale. */
function breathWave(t: number, period: number) {
  const phase = (t / period) % 1;
  const inhale = 0.42;
  return phase < inhale
    ? Math.sin((phase / inhale) * (Math.PI / 2))
    : Math.cos(((phase - inhale) / (1 - inhale)) * (Math.PI / 2));
}

export function idleLayer(t: number, seed: number, profile: MotionProfile): IdleSample {
  // Period wobbles slowly so breathing is not metronomic.
  const period = profile.breathPeriod * (1 + 0.08 * fbm1(seed + 1, t * 0.05));
  const breath = breathWave(t, period) * profile.breathAmount; // 0..~1
  const amp = profile.idleAmplitude;
  return {
    // Inhale = slight stretch (negative squash) and shoulders rise.
    squash: -0.14 * breath + 0.02 * fbm1(seed + 2, t * 0.31),
    bob: -0.002 * breath,
    lean: amp * (0.018 * fbm1(seed + 3, t * 0.11) + 0.006 * fbm1(seed + 4, t * 0.37)),
    headTilt: amp * (0.035 * fbm1(seed + 5, t * 0.153) + 0.01 * fbm1(seed + 6, t * 0.41)),
    shift: amp * 0.004 * fbm1(seed + 7, t * 0.064),
    armL: 0.035 * breath + amp * 0.02 * fbm1(seed + 8, t * 0.23),
    armR: 0.035 * breath + amp * 0.02 * fbm1(seed + 9, t * 0.27),
    hairSwing: amp * 0.08 * fbm1(seed + 10, t * 0.29),
    gazeDriftX: amp * 0.04 * fbm1(seed + 11, t * 0.21),
  };
}
