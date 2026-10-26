// Motion-layer binding for the mascot through the official motion hook (src/renderer/motionHook.ts).
// The renderer applies `patch` at load (runtime names + control tracks, see motion/rive/patch.ts);
// the manifest exposes the resulting control tracks as `ctl.*` track handles and the named nodes
// as node handles. This file maps the abstract MotionFrame onto those handles.
import { controlTime } from '../../motion/rive/patch';
import type { CharacterMotionRig } from '../../motion/hook';
import type { MotionFrame } from '../../motion/types';
import { lylaPatch, lylaRig } from './motionRig';

/** Artboard units per body height (the 600-unit artboard is drawn at the body height). */
const UNITS = 600;

type Handle = `ctl.${string}`;
const track = (channel: keyof typeof lylaRig.channels): Handle =>
  `ctl.${channel.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;

export const mascotControlTracks = Object.fromEntries(
  (Object.keys(lylaRig.channels) as (keyof typeof lylaRig.channels)[]).map((channel) => [
    track(channel),
    lylaRig.channels[channel].track,
  ]),
);

export const mascotMotionNodes = {
  'foot-l': lylaRig.nodes.footL.name,
  'foot-r': lylaRig.nodes.footR.name,
  body: lylaRig.nodes.body.name,
  upper: lylaRig.nodes.upper.name,
  head: lylaRig.nodes.head.name,
  'arm-l': lylaRig.nodes.armL.name,
  'arm-r': lylaRig.nodes.armR.name,
};

function sample(channel: keyof typeof lylaRig.channels, value: number) {
  const spec = lylaRig.channels[channel];
  return { track: track(channel), time: controlTime(spec, value), mix: 1 };
}

export const mascotMotion: CharacterMotionRig = {
  patch: lylaPatch,
  bind(frame: MotionFrame) {
    const p = frame.pose;
    const scaleY = frame.placement.scaleY,
      // Narrow through |facing| ~ 0 so the renderer's mirror swap is hidden mid-turn.
      scaleX = frame.placement.scaleX * Math.max(0.2, Math.abs(frame.placement.facing));
    return {
      tracks: [
        sample('faceX', p.gazeX * 0.85),
        sample('faceY', p.gazeY * 0.85),
        sample('blinkLeft', -1 + 2 * p.blinkL),
        sample('blinkRight', -1 + 2 * p.blinkR),
        sample('browLeft', p.browL),
        sample('browRight', p.browR),
        sample('lidLeft', 1 - 2 * p.squintL),
        sample('lidRight', 1 - 2 * p.squintR),
        sample('mouthX', p.mouthX),
        sample('mouthY', p.mouthY),
        sample('mouthCurve', -p.smile),
        sample('squash', Math.max(-1.2, Math.min(1.2, p.squash))),
        sample('hairSwing', p.hairSwing),
        sample('hairSwoop', p.hairSwoop),
        sample('hairSquash', p.hairSquash),
      ],
      nodes: {
        head: { rotation: p.headTilt, y: p.headY * UNITS },
        upper: { rotation: p.lean },
        // Host-level squash (hops, landings) applied at the hips so the feet stay planted.
        body: { x: p.shift * UNITS, y: p.bob * UNITS, scaleX, scaleY },
        'arm-l': { rotation: p.armL },
        'arm-r': { rotation: -p.armR },
        'foot-l': { x: p.footLX * UNITS, y: -p.footLY * UNITS },
        'foot-r': { x: p.footRX * UNITS, y: -p.footRY * UNITS },
      },
    };
  },
};
