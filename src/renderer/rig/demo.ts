import { handoffKey, keyVelocity } from '../motion/states/handoff';
import { neutralPose, type MotionFrame } from '../motion/types';
import { foundationMotion } from '../characters/tavi-foundation/motion';
import { sleepControls, settleWeight } from './sleep';
export { sleepEnvelope } from './sleep';
import { refinedMotion, bindRefined } from '../characters/tavi-refined/motion';
import type { BodyControls } from './body';
import type { RenderFrame } from '../adapter';
import { heldKey, enterPlan, exitPlan, sampleTimeline } from '../motion/states/plan';
import { applyStateKey } from '../motion/states/apply';
import { type KeyPose } from '../motion/states/types';
import type { PlayerResult } from '../motion/states/player';
import { Transition } from './transition';
export const rigScenes = [
  'Neutral',
  'Chest isolation',
  'Pelvis isolation',
  'Neck isolation',
  'Head stabilization',
  'Body flow',
  'Sleep',
  'Sleep settle',
  'Sleep cycle',
  'Wake interrupt',
  'Weight shift',
  'Support stress',
  'Turn',
  'Walk',
  'Floor sit',
  'Perch sit',
] as const;
export type RigScene = (typeof rigScenes)[number];
export const demoDuration = 8;
export const durationFor = (scene: RigScene) => (scene === 'Sleep cycle' ? 16 : 8);
const smooth = (t: number) => {
  const transition = new Transition();
  transition.to(0, 1, 1);
  return transition.sample(t).value;
};
/** Stateless pose sampling; seeking never depends on previously visited poses. */
export function demoFrame(
  scene: RigScene,
  time: number,
  strength: number,
  manual: BodyControls = {},
  candidate = false,
): RenderFrame {
  const phase = (time / demoDuration) * Math.PI * 2;
  const pose = neutralPose();
  const frame: MotionFrame = {
    time,
    pose,
    clips: [],
    placement: {
      x: 0.5,
      y: 1,
      facing: 1,
      lean: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      clipBelow: null,
    },
    shadow: { x: 0.5, y: 1, scale: 1, opacity: 1 },
    status: {
      airborne: 0,
      expressions: [],
      locomotion: 'idle',
      choreography: null,
      fidget: null,
      hidden: false,
    },
  };
  if (scene === 'Weight shift') {
    pose.shift = Math.sin(phase) * 0.035 * strength;
    pose.bob = -Math.sin(phase * 2) * 0.015 * strength;
    pose.headTilt = -Math.sin(phase) * 0.045 * strength;
  } else if (scene === 'Support stress') {
    pose.bob = -smooth((1 - Math.cos(phase)) / 2) * 0.12 * strength;
    pose.shift = Math.sin(phase) * 0.025 * strength;
  } else if (scene === 'Turn') {
    pose.turnBody = Math.sin(phase) * strength;
    pose.turnHead = Math.sin(phase - 0.2) * strength;
  } else if (scene === 'Walk') {
    pose.turnBody = 1;
    pose.turnHead = 1;
    frame.status.locomotion = 'moving:walk';
    frame.clips = [{ role: 'gait:walk', time: (time / (56 / 60)) % 1, mix: 1 }];
  }
  const wave = Math.sin(phase) * strength;
  const bodyControls: BodyControls = { ...manual };
  if (scene === 'Chest isolation') bodyControls.chestTilt = (manual.chestTilt ?? 0) + wave * 0.08;
  if (scene === 'Pelvis isolation')
    bodyControls.pelvisTilt = (manual.pelvisTilt ?? 0) + wave * 0.05;
  if (scene === 'Neck isolation') bodyControls.neckTilt = (manual.neckTilt ?? 0) + wave * 0.065;
  if (scene === 'Head stabilization') {
    bodyControls.chestTilt = (manual.chestTilt ?? 0) + wave * 0.1;
    bodyControls.neckTilt = (manual.neckTilt ?? 0) + wave * 0.04;
    bodyControls.headStabilize = manual.headStabilize ?? 1;
  }
  if (scene === 'Body flow') {
    bodyControls.pelvisTilt = (manual.pelvisTilt ?? 0) + Math.sin(phase) * 0.025 * strength;
    bodyControls.chestTilt = (manual.chestTilt ?? 0) + Math.sin(phase - 0.45) * 0.055 * strength;
    bodyControls.neckTilt = (manual.neckTilt ?? 0) + Math.sin(phase - 0.75) * 0.025 * strength;
    bodyControls.headStabilize = manual.headStabilize ?? 0.75;
  }
  let sleepState: { id: string; result: PlayerResult } | undefined;
  if (scene.startsWith('Sleep') || scene === 'Wake interrupt') {
    const key =
      scene === 'Sleep cycle' || scene === 'Wake interrupt'
        ? performanceKey(scene, time, candidate)
        : { ...sleepKey(), sleep: scene === 'Sleep settle' ? sleepSettle(time) : 1 };
    applyStateKey(frame.pose, key);
    const support = sleepControls(time, key.sleep);
    Object.assign(bodyControls, support, manual);
    bodyControls.chestTilt = (manual.chestTilt ?? 0) + (support.chestTilt ?? 0) * strength;
    bodyControls.neckTilt = (manual.neckTilt ?? 0) + (support.neckTilt ?? 0) * strength;
    sleepState = {
      id: key.sleep === 0 && key.rot === 0 && !(key.handSupport ?? 0) ? 'stand' : 'nap',
      result: {
        key,
        surfaceY: null,
        height: 0,
        floorShadow: null,
        effects: [],
        ledge: null,
        status: 'sleep study',
        napSupport: key.sleep,
      },
    };
  }
  frame.bodyControls = bodyControls;
  const result: Pick<RenderFrame, 'tracks' | 'nodes' | 'bodyControls'> = candidate
    ? foundationMotion.bind(frame, sleepState)
    : bindRefined(frame, sleepState);
  if (scene === 'Floor sit' || scene === 'Perch sit') {
    const weight = smooth((1 - Math.cos(phase)) / 2);
    result.tracks.unshift({
      track: `runtime.pose.${scene === 'Floor sit' ? 'floor' : 'perch'}-front`,
      time: weight,
      mix: 1,
    });
    result.nodes['body'] = { x: 0, y: 0 };
    result.nodes['foot-l'] = { x: 0, y: 0 };
    result.nodes['foot-r'] = { x: 0, y: 0 };
    result.nodes['runtime-mode'] = { x: 6, y: 0, rotation: weight };
  }
  return {
    ...result,
    bodyControls: result.bodyControls ?? bodyControls,
    inputs: {},
    travel: scene === 'Walk' ? (time * (60 / 600)) / (56 / 60) : 0,
  };
}

export function sleepSettle(time: number) {
  const t = Math.max(0, Math.min(8, time));
  return t < 2 ? settleWeight(t / 2) : t < 6 ? 1 : 1 - settleWeight((t - 6) / 2);
}
function sleepKey() {
  const rig = refinedMotion.states;
  if (!rig) throw new Error('Sleep study needs the refined state rig.');
  return heldKey('nap', null, { rig, gap: 0, edgeDistance: 0, reducedMotion: false });
}
/** Use the same lie geometry as the app, with horizontal room for the rotated silhouette. */
export function demoPlacement(
  scene: RigScene,
  size: number,
  width: number,
  height: number,
  time = 0,
  candidate = false,
) {
  const performance = scene === 'Sleep cycle' || scene === 'Wake interrupt';
  const key = performance
    ? performanceKey(scene, time, candidate)
    : scene.startsWith('Sleep')
      ? sleepKey()
      : null;
  return {
    x: width / 2 + (key ? size * 0.19 : 0),
    y: height - (key ? 100 : 24) + (key?.dy ?? 0) * size,
    width: size,
    height: size,
    rotation: key?.rot ?? 0,
  };
}

export function performanceKey(scene: RigScene, time: number, candidate: boolean): KeyPose {
  const rig = candidate ? foundationMotion.states : refinedMotion.states;
  if (!rig) throw new Error('Performance study needs a body-state rig.');
  const context = { rig, gap: 0, edgeDistance: 0, reducedMotion: false };
  const entry = enterPlan('nap', null, context);
  if (scene === 'Wake interrupt') {
    const interruptAt = Math.min(2.7, entry.duration * 0.65);
    if (time <= interruptAt) return sampleTimeline(entry, time);
    const from = sampleTimeline(entry, interruptAt);
    const elapsed = time - interruptAt;
    const target = sampleTimeline(
      exitPlan('nap', null, context, 'urgent', candidate ? from : undefined),
      elapsed,
    );
    return candidate
      ? handoffKey(
          from,
          target,
          keyVelocity(sampleTimeline(entry, interruptAt - 1 / 240), from, 1 / 240),
          elapsed,
          0.35,
        )
      : target;
  }
  if (time < entry.duration) return sampleTimeline(entry, time);
  if (time < entry.duration + 2) return heldKey('nap', null, context);
  return sampleTimeline(exitPlan('nap', null, context, 'normal'), time - entry.duration - 2);
}
