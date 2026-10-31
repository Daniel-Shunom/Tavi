import type { CharacterMotionRig } from '../../motion/hook';
import { refinedMotion, bindRefined } from '../tavi-refined/motion';
import { createRefinedPostprocessor } from '../tavi-refined/postprocess';
import { boundedBody } from '../../rig/body';
import { createFoundationBody } from './body';
export const foundationMotion: CharacterMotionRig = {
  ...refinedMotion,
  bind(frame, state) {
    const result = bindRefined(frame, state, true);
    return frame.bodyControls ? { ...result, bodyControls: frame.bodyControls } : result;
  },
  createPostprocessor(board) {
    const contacts = createRefinedPostprocessor(board, true);
    const body = createFoundationBody(board);
    const mode = board.node('tavi/runtime/mode') as ReturnType<typeof board.node> | null;
    if (!mode) throw new Error('Foundation body is missing mode.');
    let applied = boundedBody();
    return {
      prepare: () => {
        body.prepare();
      },
      diagnostics: () => ({ ...contacts.diagnostics(), body: applied }),
      update(dt, placement, travel, controls) {
        // Authored lower-body clips own their pelvis, so the additive layer yields.
        applied = body.apply({
          ...controls,
          pelvisTilt: mode.x < 1.5 ? (controls?.pelvisTilt ?? 0) : 0,
        });
        if (applied.chestTilt || applied.pelvisTilt || applied.neckTilt || applied.headTilt)
          board.advance(0);
        contacts.update(dt, placement, travel);
      },
    };
  },
};
