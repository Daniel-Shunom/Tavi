import type { CharacterMotionRig } from '../../motion/hook';
import { mascotV2Motion } from '../mascot-v2/motion';
import { mascotStates } from '../mascot/states';
import { mascotClipTracks } from '../mascot/motion';
import { createRefinedPostprocessor } from './postprocess';
import { foundationFor } from './manifest';
import { gaitIds, authoredGaitClips } from '../../motion/systems/gaits/library';
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const floor = {
  bob: 126.217996 / 600,
  footLX: 31.5 / 600,
  footRX: -30.5 / 600,
  footLY: 0,
  footRY: 0,
  squash: 0,
};
const perch = {
  bob: 12 / 600,
  footLX: 0,
  footRX: 0,
  footLY: 68 / 600,
  footRY: 68 / 600,
  squash: 0,
};
// Runtime gesture exports contain arm rotations only; legacy gaits remain excluded.
const legacyClips = new Set(['walk-cycle', 'trudge-cycle']);
export const refinedMotion: CharacterMotionRig = {
  screenSpaceViews: true,
  authoredCycles: Object.fromEntries(
    gaitIds.map((id) => {
      const foundation = foundationFor(id);
      return [
        id,
        {
          seconds: (foundation === 'walk' ? 56 : foundation === 'sprint' ? 40 : 96) / 60,
          stride: (foundation === 'walk' ? 60 : foundation === 'sprint' ? 104 : 160) / 600,
        },
      ];
    }),
  ),
  patch: { artboard: 'lyla animation' },
  createPostprocessor: createRefinedPostprocessor,
  states: {
    ...mascotStates,
    seatHeight: 114.218 / 600,
    keys: {
      ...mascotStates.keys,
      crouch: { bob: 54 / 600, footLX: 0, footRX: 0, squash: 0.12 },
      sitFloor: { ...floor, armL: 0.7, armR: 0.7, elbowL: 1.2, elbowR: -1.2 },
      sitLedge: { ...perch, armL: 0.1, armR: 0.1, elbowL: 1.2, elbowR: -1.2 },
      dozeFloor: { ...mascotStates.keys.dozeFloor, ...floor },
      dozeLedge: { ...mascotStates.keys.dozeLedge, ...perch },
      perch: { ...perch, armL: 0.1, armR: 0.1 },
    },
    holds: Object.fromEntries(
      Object.entries(mascotStates.holds ?? {}).filter(([id]) => id !== 'sit'),
    ),
  },
  bind(frame, body) {
    const handedness = frame.placement.facing < 0 ? -1 : 1;
    const p = {
      ...frame.pose,
      turnBody: frame.pose.turnBody * handedness,
      turnHead: frame.pose.turnHead * handedness,
    };
    const result = mascotV2Motion.bind({
      ...frame,
      pose: p,
      placement: { ...frame.placement, facing: 1 },
    });
    result.tracks = result.tracks
      .filter(
        (t) =>
          !legacyClips.has(t.track) &&
          !gaitIds.some((id) => authoredGaitClips[id].handle === t.track) &&
          t.track !== 'ctl.arms-front',
      )
      .map((t) => {
        if (t.track === 'ctl.brow-left')
          return { ...t, time: (clamp(p.browL, -1.25, 0.35) + 1.25) / 2.5 };
        if (t.track === 'ctl.brow-right')
          return { ...t, time: (clamp(p.browR, -1.25, 0.35) + 1.25) / 2.5 };
        // The rig's curve control moves down (y +1.25 at the end) for a frown, as on the mascot
        // rig (mouthCurve = -smile), so a smile plays the timeline from its start.
        if (t.track === 'ctl.mouth-curve') return { ...t, time: clamp((1.25 - p.smile) / 2.5) };
        return t;
      });
    result.nodes['eyes'] = {
      x: (0.5 * p.gazeX + p.pupilX) * 14,
      y: (0.5 * p.gazeY + p.pupilY) * 10,
    };
    if (p.armsFront >= 0.5) result.tracks.push({ track: 'runtime.arms-front', time: 0.5, mix: 1 });
    const key = body?.result.key.pose ?? {},
      bob = (key.bob ?? 0) * 600;
    const isFloor =
      !body?.result.ledge && (bob > 45 || ((key.footLX ?? 0) > 0 && (key.footRX ?? 0) < 0));
    const floorWeight = isFloor ? clamp(bob / 126.217996) : 0;
    const perchWeight = !isFloor ? clamp(((key.footLY ?? 0) * 600) / 68) : 0;
    const side = Math.abs(p.turnBody) < 0.2 ? 0 : p.turnBody < 0 ? -1 : 1;
    const view = side < 0 ? 'left' : side > 0 ? 'right' : 'front';
    const gait = frame.clips.find((c) => c.role.startsWith('gait:') && c.mix > 0.001);
    let mode = /run|skip|scurry|hop/.test(frame.status.locomotion) ? 1 : 0;
    const actingWeight =
      frame.status.locomotion.split(':')[0] === 'idle' &&
      (frame.status.expressions.length > 0 ||
        frame.clips.some((c) => c.mix > 0.001 && !c.role.startsWith('gait:'))) &&
      floorWeight < 0.001 &&
      perchWeight < 0.001 &&
      (!body || body.id === 'stand')
        ? Math.max(
            0,
            ...result.tracks.filter((t) => mascotClipTracks.includes(t.track)).map((t) => t.mix),
            clamp(
              Math.max(Math.abs(p.bob), Math.abs(p.shift), Math.abs(p.footLY), Math.abs(p.footRY)) *
                60,
            ),
          )
        : 0;
    if (actingWeight > 0.001) {
      mode = 5;
      result.tracks.push(
        ...result.tracks
          .filter((t) => mascotClipTracks.includes(t.track))
          .map((t) => ({ ...t, track: `runtime.acting.${t.track}` })),
      );
    }
    if (floorWeight > 0.001) {
      mode = 6;
      result.tracks.unshift({ track: `runtime.pose.floor-${view}`, time: floorWeight, mix: 1 });
    } else if (perchWeight > 0.001) {
      mode = side === 0 ? 6 : 8;
      result.tracks.unshift({ track: `runtime.pose.perch-${view}`, time: perchWeight, mix: 1 });
    } else if (gait) {
      mode = 6;
      const foundation = foundationFor(gait.role.slice(5));
      result.tracks = result.tracks.filter(
        (t) => !mascotClipTracks.includes(t.track) && t.track !== 'ctl.squash',
      );
      result.tracks.push({
        track: `runtime.gait.${foundation}-${side < 0 ? 'left' : 'right'}`,
        time: gait.time,
        mix: gait.mix,
      });
      // Authored limbs own locomotion. Facial controls/head acting remain free.
      for (const id of ['arm-l', 'arm-r', 'arm-l-fore', 'arm-r-fore', 'upper'])
        result.nodes[id] = { rotation: 0 };
    } else if (body && /nap|doze/.test(body.id)) mode = 4;
    if (mode === 6 || mode === 8) {
      result.nodes['body'] = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
      result.nodes['foot-l'] = { x: 0, y: 0 };
      result.nodes['foot-r'] = { x: 0, y: 0 };
      if (floorWeight > 0.001 || perchWeight > 0.001) {
        result.nodes['arm-l'] = {
          rotation: (result.nodes['arm-l']?.rotation ?? 0) - (key.armL ?? 0),
        };
        result.nodes['arm-r'] = {
          rotation: (result.nodes['arm-r']?.rotation ?? 0) + (key.armR ?? 0),
        };
        result.nodes['arm-l-fore'] = {
          rotation: (result.nodes['arm-l-fore']?.rotation ?? 0) - (key.elbowL ?? 0),
        };
        result.nodes['arm-r-fore'] = {
          rotation: (result.nodes['arm-r-fore']?.rotation ?? 0) + (key.elbowR ?? 0),
        };
      }
    }
    result.nodes['runtime-mode'] = {
      x: mode,
      y: side,
      rotation: Math.max(floorWeight, perchWeight, actingWeight),
    };
    return result;
  },
};
