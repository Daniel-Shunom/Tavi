// Runs the real motion hook with a synthetic cue and prints the face control tracks it outputs
// (debugging aid): npx tsx tools/expression-sheet/debug-hook.ts innocent
import { beat } from '../../shared/cue';
import type { ExpressionId } from '../../shared/expressions';
import { mascotMotion } from '../../src/renderer/characters/mascot/motion';
import { characters } from '../../src/renderer/characters/registry';
import { composePose, phaseLookup } from '../../src/renderer/compose';
import { createHookLayer } from '../../src/renderer/motion/hook';
import { sampleScript } from '../../src/renderer/timeline';

const manifest = characters.get('mascot');
if (!manifest) throw new Error('no mascot');
const id = (process.argv[2] ?? 'innocent') as ExpressionId;
const lookup = phaseLookup(manifest);
const script = {
  id: 'x',
  sourceEventId: 'x',
  source: 'manual' as const,
  decidedBy: { kind: 'manual' as const, label: 'x' },
  priority: 3 as const,
  startAt: 0,
  expiresAt: 1e6,
  beats: [{ ...beat(id, { hold: 3, intensity: 0.7, target: 'chat' }), offset: 0.5 }],
  settle: true,
  dropped: [],
};
const hook = createHookLayer(manifest, mascotMotion);
for (let frame = 0; frame <= 180; frame++) {
  const time = frame / 60;
  const layers = sampleScript(script, time * 1000, lookup);
  const pose = composePose(layers, manifest, { delegated: new Set(hook.performances ?? []) });
  const out = hook.update({
    dt: 1 / 60,
    time,
    layers,
    attention: null,
    persona: { attitude: 'cheeky', initiative: 'occasional', personality: 'playful', energy: 60 },
    reducedMotion: false,
    quiet: false,
    retracted: false,
    presence: { transition: null, hidden: 0, elapsed: Infinity },
    performances: pose.performances,
    base: { offset: pose.offset },
    locomotion: {
      home: { x: 0.5, y: 0.9 },
      target: { x: 0.5, y: 0.9 },
      position: { x: 0.5, y: 0.9 },
      movement: null,
      viewport: { width: 1280, height: 720 },
    },
    character: {
      id: manifest.id,
      motionTracks: manifest.motionTracks,
      nodes: Object.keys(manifest.nodes),
      inputs: Object.keys(manifest.inputs),
      locomotion: manifest.locomotion,
    },
  });
  if (frame % 30 === 0)
    console.log(
      time.toFixed(1),
      layers.map((l) => `${l.expression}:${l.weight.toFixed(2)}`).join(' '),
      'perf=' + pose.performances.map((p) => p.id).join(','),
      (out.tracks ?? [])
        .filter((t) => /brow|mouth-curve|face-x/.test(t.track))
        .map((t) => `${t.track}=${t.time.toFixed(2)}`)
        .join(' '),
    );
}
