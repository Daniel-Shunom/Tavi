import type { ManifestInput } from '../manifest';
import { mascotV2 } from '../mascot-v2/manifest';
import { mascotV2Face } from '../mascot-v2/acting';
import { mascotClipTracks } from '../mascot/motion';
import { gaitIds, authoredGaitClips } from '../../motion/systems/gaits/library';

export const foundationFor = (id: string) =>
  id === 'run' || id === 'scurry' ? 'sprint' : id === 'skip' || id === 'hop' ? 'skip' : 'walk';

const tracks = Object.fromEntries(
  Object.entries(mascotV2.tracks).filter(([id]) => !['walk-cycle', 'trudge-cycle'].includes(id)),
);
export const refinedTracks = {
  ...Object.fromEntries(
    gaitIds.map((id) => [
      authoredGaitClips[id].handle,
      `tavi/runtime/gait/${foundationFor(id)}-right`,
    ]),
  ),
  ...Object.fromEntries(
    ['walk', 'sprint', 'skip'].flatMap((id) =>
      ['left', 'right'].map((view) => [
        `runtime.gait.${id}-${view}`,
        `tavi/runtime/gait/${id}-${view}`,
      ]),
    ),
  ),
  ...Object.fromEntries(
    ['perch', 'floor'].flatMap((id) =>
      ['front', 'left', 'right'].map((view) => [
        `runtime.pose.${id}-${view}`,
        `tavi/runtime/pose/${id}-${view}`,
      ]),
    ),
  ),
  'runtime.rest': 'tavi/runtime/rest',
  'runtime.floor-calves': 'tavi/runtime/floor-calves',
  'runtime.arms-front': 'tavi/runtime/arms-front',
  ...Object.fromEntries(
    Object.entries(tracks)
      .filter(([id]) => mascotClipTracks.includes(id))
      .map(([id, name]) => [`runtime.acting.${id}`, `tavi/runtime/acting/${name}`]),
  ),
  ...Object.fromEntries(
    ['perch', 'floor'].flatMap((pose) =>
      ['front', 'left', 'right'].map((view) => [
        `runtime.${pose}-${view}`,
        `tavi/runtime/skirt/${pose}-${view}`,
      ]),
    ),
  ),
};
export const taviRefined: ManifestInput = {
  ...mascotV2,
  id: 'tavi-refined',
  name: 'Tavi (refined)',
  asset: 'tavi-refined.riv',
  tracks: { ...tracks, ...refinedTracks },
  nodes: { ...mascotV2.nodes, eyes: 'tavi/pupil-offset', 'runtime-mode': 'tavi/runtime/mode' },
  motionTracks: [
    ...(mascotV2.motionTracks ?? []).filter((id) => id in tracks),
    ...Object.keys(refinedTracks),
  ],
  rest: [{ track: 'runtime.rest', at: 0 }],
  idleLoop: undefined,
  // Keep the semantic acting range; the binder maps it to this rig's geometry.
  face: mascotV2Face,
};
