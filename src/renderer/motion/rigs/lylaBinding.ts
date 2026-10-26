// Maps the abstract MotionFrame onto the lyla rig (joystick channels + named nodes).
// Channel semantics were verified visually (docs/motion/ASSET-AUDIT.md).
import type { FrameInput, NodeOffset } from '../rive/motionRig';
import type { MotionFrame } from '../types';

/** Artboard units per body height (artboard is 600 tall and placement height = artboard). */
const UNITS = 600;

export const lylaClipRoles: Readonly<Record<string, string>> = {
  wave: 'wave Non Looping',
  celebrate: 'celebration',
  think: 'thoughtful',
  hips: 'hands on hips',
};

/** Neutral authored pose applied first every frame (eyes open, brows and lids at rest). */
export const lylaRestClip = { name: 'rig testing', time: 0, mix: 1 };

export function bindLyla(frame: MotionFrame, palette: readonly string[] = []): FrameInput {
  const p = frame.pose;
  const full = (value: number) => ({ value, weight: 1 });
  const clips = [lylaRestClip];
  for (const clip of frame.clips) {
    const name = lylaClipRoles[clip.role];
    if (name && clip.mix > 0.001) clips.push({ name, time: clip.time, mix: clip.mix });
  }
  for (const name of palette) clips.push({ name, time: 0, mix: 1 });
  const offsets: Record<string, NodeOffset> = {
    head: { rotation: p.headTilt },
    upper: { rotation: p.lean },
    body: { x: p.shift * UNITS, y: p.bob * UNITS },
    armL: { rotation: p.armL },
    armR: { rotation: -p.armR },
    footL: { x: p.footLX * UNITS, y: -p.footLY * UNITS },
    footR: { x: p.footRX * UNITS, y: -p.footRY * UNITS },
  };
  return {
    clips,
    channels: {
      faceX: full(p.gazeX * 0.85),
      faceY: full(p.gazeY * 0.85),
      blinkLeft: full(-1 + 2 * p.blinkL),
      blinkRight: full(-1 + 2 * p.blinkR),
      browLeft: full(p.browL),
      browRight: full(p.browR),
      lidLeft: full(1 - 2 * p.squintL),
      lidRight: full(1 - 2 * p.squintR),
      mouthX: full(p.mouthX),
      mouthY: full(p.mouthY),
      mouthCurve: full(-p.smile),
      squash: full(Math.max(-1.2, Math.min(1.2, p.squash))),
      hairSwing: full(p.hairSwing),
      hairSwoop: full(p.hairSwoop),
      hairSquash: full(p.hairSquash),
    },
    offsets,
  };
}
