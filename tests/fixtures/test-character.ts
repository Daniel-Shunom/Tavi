// Test-only character proving the manifest contract with a deliberately small, different rig:
// another artboard, a state machine with inputs, a node, an authored walk cycle and only a few
// expressions. Behaviours and personality must work unchanged against it.
import type { ManifestInput } from '../../src/renderer/characters/manifest';

export const testCharacter: ManifestInput = {
  id: 'test-bot',
  name: 'Test bot',
  credit: 'Test fixture',
  creditUrl: '#',
  license: 'test-only',
  renderer: 'rive',
  asset: 'test-bot.riv',
  artboard: 'Bot Board',
  stateMachine: 'Bot Machine',
  tracks: {
    idle: 'Bot Idle',
    happy: 'Bot Happy',
    hello: 'Bot Hello',
    walk: 'Bot Walk',
    'skin.silver': 'Skin Silver',
    'skin.gold': 'Skin Gold',
  },
  inputs: { speed: 'walkSpeed', direction: 'walkDirection' },
  nodes: { head: 'HeadNode' },
  motionTracks: ['idle'],
  idleLoop: { track: 'idle', seconds: 3 },
  locomotion: {
    mode: 'clip',
    walk: 'walk',
    stride: 60,
    speedInput: 'speed',
    directionInput: 'direction',
  },
  expressions: {
    content: { tracks: [{ track: 'happy', at: 0.5, mix: 0.6 }] },
    wave: { tracks: [{ track: 'hello', play: { from: 0, to: 1 }, mix: 1 }] },
    listening: { tracks: [], transform: { rotation: 2 } },
  },
  fallbacks: { celebrate: 'wave', sassy: null },
  attention: { streamer: { rotation: 2 } },
  controls: { tuck: { tracks: [], presence: { tuck: 1 } } },
  appearance: {
    skin: {
      label: 'Finish',
      default: 'silver',
      options: [
        { id: 'silver', label: 'Silver', track: 'skin.silver' },
        { id: 'gold', label: 'Gold', track: 'skin.gold' },
      ],
    },
  },
};
