import { fps as captureFps, shots } from '../capture/shots.mjs';
import type { TaviShot } from './config';

export interface Footage {
  frames: number;
  fps: number;
  width: number;
  height: number;
  presentation: 'overlay' | 'portrait';
}

/** What capture/tavi.mjs produced for each shot (mirrors shots.mjs, so no file read is needed). */
export function footage(shot: TaviShot): Footage {
  const spec = shots[shot];
  if (!spec) throw new Error(`unknown shot ${shot}`);
  return {
    frames: Math.round(spec.seconds * captureFps),
    fps: captureFps,
    width: spec.width * spec.scale,
    height: spec.height * spec.scale,
    presentation: spec.presentation as Footage['presentation'],
  };
}

export const pad = (frame: number) => String(frame).padStart(5, '0');
