import type { CharacterMotionRig } from '../../motion/hook';
import { refinedMotion, bindRefined } from '../tavi-refined/motion';
import { createRefinedPostprocessor } from '../tavi-refined/postprocess';
import { sleepControls, settleWeight } from '../../rig/sleep';
import { createSleepContacts } from './contacts';
import { boundedBody } from '../../rig/body';
import { createFoundationBody } from './body';
const stateRig = refinedMotion.states;
if (!stateRig) throw new Error('Foundation needs the refined body-state rig.');
export const foundationMotion: CharacterMotionRig = {
  ...refinedMotion,
  states: {
    ...stateRig,
    napStyle: 'supported',
    keys: {
      ...stateRig.keys,
      kneelProp: {
        ...stateRig.keys.sitFloor,
        shift: -0.018,
        lean: 0.12,
        armL: 0.6,
        armR: 0.25,
        headTilt: -0.06,
      },
    },
  },
  bind(frame, state) {
    const napWeight =
      state?.result.napSupport ?? (state?.id === 'nap' ? state.result.key.sleep : 0);
    const weight = settleWeight(napWeight);
    const prop = settleWeight(state?.result.key.handSupport ?? 0);
    const pose = { ...frame.pose };
    if (weight > 0 || prop > 0) pose.armsFront = 1;
    if (weight > 0) {
      // Nap breathing belongs to the chest, not the whole body or planted feet.
      pose.armsFront = 1;
      const rest = refinedMotion.states?.keys.lie ?? {};
      for (const channel of ['squash', 'footLX', 'footRX', 'footLY', 'footRY'] as const)
        pose[channel] =
          weight === 1
            ? (rest[channel] ?? 0)
            : pose[channel] + ((rest[channel] ?? 0) - pose[channel]) * weight;
    }
    const bindingState = state && (napWeight > 0 || prop > 0) ? { ...state, id: 'nap' } : state;
    const result = bindRefined({ ...frame, pose }, bindingState, true);
    const controls =
      weight > 0 || prop > 0
        ? {
            ...sleepControls(frame.serviceTime ?? frame.time, napWeight, frame.reducedMotion),
            propSupport: prop,
            ...frame.bodyControls,
          }
        : frame.bodyControls;
    return controls ? { ...result, bodyControls: controls } : result;
  },
  createPostprocessor(board) {
    const contacts = createRefinedPostprocessor(board, true);
    const body = createFoundationBody(board);
    const wrists = createSleepContacts(board);
    const mode = board.node('tavi/runtime/mode') as ReturnType<typeof board.node> | null;
    if (!mode) throw new Error('Foundation body is missing mode.');
    let applied = boundedBody();
    return {
      prepare: () => {
        wrists.prepare();
        body.prepare();
      },
      diagnostics: () => ({
        ...contacts.diagnostics(),
        body: applied,
        sleepContacts: wrists.diagnostics(),
      }),
      update(dt, placement, travel, controls) {
        // Authored lower-body clips own their pelvis, so the additive layer yields.
        applied = body.apply({
          ...controls,
          pelvisTilt: mode.x < 1.5 ? (controls?.pelvisTilt ?? 0) : 0,
        });
        if (applied.chestTilt || applied.pelvisTilt || applied.neckTilt || applied.headTilt)
          board.advance(0);
        contacts.update(dt, placement, travel);
        wrists.apply(applied.sleepSupport, applied.propSupport, placement?.rotation ?? 0);
      },
    };
  },
};
