import { describe, expect, it } from 'vitest';
import { motionProfile } from '../src/renderer/motion/profile';
import { Locomotion } from '../src/renderer/motion/systems/locomotion';
import type { MotionSettings, Stage } from '../src/renderer/motion/types';

const stage: Stage = { aspect: 16 / 9, bodyHeight: 220 / 720, margin: 0.02 };
const settings: MotionSettings = {
  personality: 'cozy',
  attitude: 'gentle',
  energy: 50,
  reducedMotion: false,
  quiet: false,
};
const profile = motionProfile(settings);

describe('authored gait direction', () => {
  it.each([
    { direction: -1, start: 0.7, target: 0.2 },
    { direction: 1, start: 0.3, target: 0.8 },
  ])(
    'advances the authored walk cycle along the travel heading ($direction)',
    ({ direction, start, target }) => {
      const locomotion = new Locomotion(7);
      locomotion.place(start, 0.9);
      locomotion.moveTo({ x: target, at: 0, gait: 'walk' });

      let lastPhase: number | null = null;
      let signedPhaseTravel = 0;
      for (let i = 0; i <= 60 * 4; i++) {
        const frame = locomotion.update(i === 0 ? 0 : 1 / 60, i / 60, profile, stage, {
          feet: true,
          turnStyle: 'authored',
          authored: ['walk'],
        });
        if (!frame.clip) continue;
        if (lastPhase !== null) {
          let delta = frame.clip.phase - lastPhase;
          if (delta > 0.5) delta -= 1;
          if (delta < -0.5) delta += 1;
          signedPhaseTravel += delta;
        }
        lastPhase = frame.clip.phase;
      }

      expect(direction * signedPhaseTravel).toBeGreaterThan(0.1);
    },
  );
});
