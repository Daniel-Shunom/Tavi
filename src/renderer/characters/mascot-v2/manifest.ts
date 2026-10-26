// Lyla v2: the mascot remixed with the Rive CLI from alisketch's "Mascot / Avatar Customization"
// (CC BY 4.0; source in art/mascot-remix/, additions authored by tools/mascot-remix/author.mjs).
// Same art, clips and acting as the mascot, plus authored controls the original lacks: elbows
// (forearm bones), hand poses, arms in front of the hair, brow tilt, a mouth that opens from its line
// (mouthOpen) and changes width (mouthWide).
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
  'ctl.mouth-wide': 'tavi/mouthWide',
  'ctl.mouth-tilt': 'tavi/mouthTilt',
  'ctl.mouth-pop': 'tavi/mouthPop',
  // mouth.shape: the selected mouth from the library (ids in ./mouth.ts).
  'ctl.mouth-shape': 'tavi/mouthShape',
  'ctl.hand-l': 'tavi/handL',
  'ctl.hand-r': 'tavi/handR',
  'ctl.arms-front': 'tavi/armsFront',
  // Three-quarter turnaround (tools/mascot-remix/steps/turn.mjs): frame 0 = -1 (screen left),
  // 30 = facing the camera, 60 = +1 (screen right).
  'ctl.turn-head': 'tavi/turnHead',
  'ctl.turn-body': 'tavi/turnBody',
};

/**
 * Authored in-place gait cycles (handles from motion/systems/gaits/library.ts authoredGaitClips):
 * walk 42 frames, trudge 80 frames, each two steps at 60 fps, looping.
 */
export const mascotV2GaitTracks = {
  'walk-cycle': 'tavi/gait/walk',
  'trudge-cycle': 'tavi/gait/trudge',
};

/**
 * Authored body-state poses (names from docs/motion/BODY-STATES-RESEARCH.md; bones only, so
 * acting layers over them): sit_floor (one frame, hips dropped 106 u onto the seat), swing_legs
 * (1 s loop), sleep_breath (5 s loop, torso scale) and zzz (2 s loop of Zs above the head).
 */
export const mascotV2PoseTracks = {
  'pose.sit-floor': 'sit_floor',
  'pose.swing-legs': 'swing_legs',
  'pose.sleep-breath': 'sleep_breath',
  'fx.zzz': 'zzz',
};

export const mascotV2: ManifestInput = {
  ...mascot,
  id: 'mascot-v2',
  name: 'Lyla v2 (remix preview)',
  credit: 'Mascot / Avatar Customization by alisketch (CC BY 4.0), remixed for Tavi',
  asset: 'mascot-v2.riv',
  tracks: {
    ...mascot.tracks,
    ...mascotV2ControlTracks,
    ...mascotV2GaitTracks,
    ...mascotV2PoseTracks,
  },
  nodes: {
    ...mascot.nodes,
    'arm-l-fore': 'tavi/armL.fore',
    'arm-r-fore': 'tavi/armR.fore',
    eyes: 'tavi/eyes',
  },
  motionTracks: [
    ...(mascot.motionTracks ?? []),
    ...Object.keys(mascotV2ControlTracks),
    ...Object.keys(mascotV2GaitTracks),
    ...Object.keys(mascotV2PoseTracks),
  ],
  face: mascotV2Face,
  // Turns use the authored turnaround tracks (head leads body), never a mirror.
  turnStyle: 'authored',
};
