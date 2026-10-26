// Browser-only registry of motion-rig extensions per character (patch + handle binding).
// Kept out of registry.ts, which the service imports and must stay plain data.
import type { CharacterMotionRig } from '../motion/hook';
import { mascotMotion } from './mascot/motion';

export const motionRigs: Readonly<Record<string, CharacterMotionRig | undefined>> = {
  mascot: mascotMotion,
};
