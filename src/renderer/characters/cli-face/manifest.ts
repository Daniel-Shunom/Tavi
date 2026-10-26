// Rive CLI proof face (not registered as a character). Authored as text with the official Rive
// CLI from tools/rive-cli-proof/gen-face.mjs (see docs/character/RIVE-CLI.md); original art,
// no third-party assets. Range timelines follow the joystick convention: normalized 0 = the -1
// pose, 0.5 = rest, 1 = the +1 pose.
import type { ManifestInput } from '../manifest';

export const cliFace: ManifestInput = {
  id: 'cli-face',
  name: 'Rive CLI proof face',
  credit: 'Authored for Tavi with the Rive CLI',
  creditUrl: '#',
  license: 'project-original',
  renderer: 'rive',
  asset: 'cli-face.riv',
  artboard: 'Face',
  tracks: {
    brows: 'brows',
    'mouth-curve': 'mouth-curve',
    blink: 'blink',
    oops: 'oops',
  },
  rest: [
    { track: 'brows', at: 0.5 },
    { track: 'mouth-curve', at: 0.5 },
    { track: 'blink', at: 0 },
  ],
  expressions: {
    content: { tracks: [{ track: 'mouth-curve', at: 0.85, mix: 1 }] },
    innocent: { tracks: [{ track: 'oops', play: { from: 0, to: 1 }, mix: 1 }] },
    sympathetic: {
      tracks: [
        { track: 'brows', at: 0.1, mix: 1 },
        { track: 'mouth-curve', at: 0.25, mix: 1 },
      ],
    },
  },
  controls: { tuck: { tracks: [] } },
  appearance: {},
};
