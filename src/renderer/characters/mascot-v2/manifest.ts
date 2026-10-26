// Lyla v2: the mascot remixed with the Rive CLI from alisketch's "Mascot / Avatar Customization"
// (CC BY 4.0; source in art/mascot-remix/, additions authored by tools/mascot-remix/author.mjs).
// Same art, clips and acting as the mascot, plus authored controls the original lacks: elbows
// (forearm bones), hand poses, arms in front of the hair, brow tilt, an open mouth with visemes.
// The file keeps its component names and authors the `tavi/*` control tracks itself, so it needs
// no in-memory index patch.
import type { ManifestInput } from '../manifest';
import { mascot } from '../mascot/manifest';
import { mascotV2Face } from './acting';

/** Track handle -> authored control animation (see motion.ts for value mapping). */
export const mascotV2ControlTracks = {
  'ctl.brow-tilt-l': 'tavi/browTiltL',
  'ctl.brow-tilt-r': 'tavi/browTiltR',
  'ctl.mouth-open': 'tavi/mouthOpen',
  'ctl.viseme': 'tavi/viseme',
  'ctl.hand-l': 'tavi/handL',
  'ctl.hand-r': 'tavi/handR',
  'ctl.arms-front': 'tavi/armsFront',
};

export const mascotV2: ManifestInput = {
  ...mascot,
  id: 'mascot-v2',
  name: 'Lyla v2 (remix preview)',
  credit: 'Mascot / Avatar Customization by alisketch (CC BY 4.0), remixed for Tavi',
  asset: 'mascot-v2.riv',
  tracks: { ...mascot.tracks, ...mascotV2ControlTracks },
  nodes: {
    ...mascot.nodes,
    'arm-l-fore': 'tavi/armL.fore',
    'arm-r-fore': 'tavi/armR.fore',
    eyes: 'tavi/eyes',
  },
  motionTracks: [...(mascot.motionTracks ?? []), ...Object.keys(mascotV2ControlTracks)],
  face: mascotV2Face,
};
