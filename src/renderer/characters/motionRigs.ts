// Browser-only registry of motion-rig extensions per character (patch + handle binding).
// Kept out of registry.ts, which the service imports and must stay plain data.
import type { CharacterMotionRig } from '../motion/hook';
import { mascotMotion } from './mascot/motion';
import { mascotV2Motion } from './mascot-v2/motion';
import { foundationMotion } from './tavi-foundation/motion';
import { refinedMotion } from './tavi-refined/motion';

export const motionRigs: Readonly<Record<string, CharacterMotionRig | undefined>> = {
  mascot: mascotMotion,
  'mascot-v2': mascotV2Motion,
  'tavi-refined': refinedMotion,
  'tavi-foundation': foundationMotion,
};
