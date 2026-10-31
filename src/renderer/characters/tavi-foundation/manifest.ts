import type { ManifestInput } from '../manifest';
import { taviRefined } from '../tavi-refined/manifest';
/** Opt-in mechanics; the approved refined artwork is shared without re-export. */
export const taviFoundation: ManifestInput = {
  ...taviRefined,
  id: 'tavi-foundation',
  assetSource: 'tavi-refined',
  name: 'Tavi (foundation)',
};
