// Layers a body-state key pose over the motion frame. Awake states add (expressions keep acting
// on top: laughing while sitting); sleeping states damp everything else by `sleep` so the face
// and body rest until a wake-up, while blinks close.
import type { Channel, Pose } from '../types';
import type { KeyPose } from './types';

/** Channels a sleeping state owns (expressions and idle life are damped by `sleep`). */
export const sleepOwned: ReadonlySet<Channel> = new Set<Channel>([
  'gazeX',
  'gazeY',
  'browL',
  'browR',
  'squintL',
  'squintR',
  'smile',
  'mouthX',
  'mouthY',
  'headTilt',
  'headY',
  'lean',
  'bob',
  'shift',
  'armL',
  'armR',
  'squash',
]);

export function applyStateKey(pose: Pose, key: KeyPose, facing = 1) {
  const w = Math.min(1, Math.max(0, key.sleep));
  if (w > 0) {
    for (const channel of sleepOwned) pose[channel] *= 1 - w;
    pose.blinkL = pose.blinkL * (1 - w) + w;
    pose.blinkR = pose.blinkR * (1 - w) + w;
  }
  for (const [channel, value] of Object.entries(key.pose) as [Channel, number][]) {
    // State poses are facing-relative; the shared gaze/pupil channels target screen directions.
    // Convert only those X channels here, before the rig maps screen gaze into its local axes.
    const direction = (channel === 'gazeX' || channel === 'pupilX') && facing < 0 ? -1 : 1;
    pose[channel] += value * direction;
  }
}
