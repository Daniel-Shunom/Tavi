// Motion binding for Lyla v2: the mascot binding plus the authored extended controls. The file
// already carries the runtime names and control tracks, so the load-time patch is a no-op.
import type { CharacterMotionRig } from '../../motion/hook';
import type { MotionFrame } from '../../motion/types';
import { bindMascotBody, mascotMotion } from '../mascot/motion';
import { mouthShapeTime } from './mouth';

/** Discrete selections are held from frame 10k of a 60-frame track; sample mid-step. */
const step = (index: number) => Math.min(0.99, (10 * Math.max(0, Math.round(index)) + 5) / 60);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const mascotV2Motion: CharacterMotionRig = {
  patch: { artboard: 'lyla animation' },
  // Same skeleton and art as the mascot, so the body-state key poses and contacts carry over.
  ...(mascotMotion.states ? { states: mascotMotion.states } : {}),
  bind(frame: MotionFrame) {
    // The unfolded body binding: this file bends the elbows itself.
    const base = bindMascotBody(frame);
    const p = frame.pose;
    return {
      tracks: [
        ...base.tracks,
        { track: 'ctl.brow-tilt-l', time: clamp01((p.browTiltL + 1) / 2), mix: 1 },
        { track: 'ctl.brow-tilt-r', time: clamp01((p.browTiltR + 1) / 2), mix: 1 },
        { track: 'ctl.mouth-open', time: clamp01(p.mouthOpen), mix: 1 },
        { track: 'ctl.mouth-wide', time: clamp01((p.mouthWide + 1) / 2), mix: 1 },
        { track: 'ctl.mouth-tilt', time: clamp01((p.mouthTilt + 1) / 2), mix: 1 },
        { track: 'ctl.mouth-pop', time: clamp01(p.mouthPop), mix: 1 },
        { track: 'ctl.mouth-shape', time: mouthShapeTime(p.mouthShape), mix: 1 },
        { track: 'ctl.hand-l', time: step(p.handL), mix: 1 },
        { track: 'ctl.hand-r', time: step(p.handR), mix: 1 },
        { track: 'ctl.arms-front', time: p.armsFront >= 0.5 ? 0.99 : 0.01, mix: 1 },
      ],
      nodes: {
        ...base.nodes,
        // Same sign convention as the shoulders: positive bends outward on both sides.
        'arm-l-fore': { rotation: p.elbowL },
        'arm-r-fore': { rotation: -p.elbowR },
        // Pupils: follow part of the gaze (the face plane turns too) plus their own channel. The
        // rig's distance constraint keeps them inside the eyes.
        eyes: { x: (0.5 * p.gazeX + p.pupilX) * 14, y: (0.5 * p.gazeY + p.pupilY) * 10 },
      },
    };
  },
};
