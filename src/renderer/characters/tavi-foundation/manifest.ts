import type { ManifestInput } from '../manifest';
import { taviRefined } from '../tavi-refined/manifest';
/** Opt-in mechanics; the approved refined art gains a pressure-only palm layer. */
export const taviFoundation: ManifestInput = {
  ...taviRefined,
  id: 'tavi-foundation',
  asset: 'tavi-foundation.riv',
  tracks: { ...taviRefined.tracks, 'runtime.palm-pressure': 'tavi/runtime/palm-pressure' },
  name: 'Tavi (foundation)',
};
