// Prints face-layer output over a cue (debugging aid): npx tsx tools/expression-sheet/debug-face.ts a b
import { beat } from '../../shared/cue';
import type { ExpressionId } from '../../shared/expressions';
import { characters } from '../../src/renderer/characters/registry';
import { phaseLookup } from '../../src/renderer/compose';
import { FaceLayer } from '../../src/renderer/face/faceLayer';
import { MotionLayer } from '../../src/renderer/motion/motion';
import { sampleScript } from '../../src/renderer/timeline';

const manifest = characters.get('mascot');
if (!manifest?.face) throw new Error('no face');
const [a = 'content', b = 'innocent'] = process.argv.slice(2) as ExpressionId[];
const lookup = phaseLookup(manifest);
const cue = {
  id: 'x',
  sourceEventId: 'x',
  source: 'manual' as const,
  decidedBy: { kind: 'manual' as const, label: 'x' },
  priority: 3 as const,
  startAt: 0,
  expiresAt: 1e6,
  beats: [
    { ...beat(a, { hold: 1.6, intensity: 0.6, target: 'chat' }), offset: 0 },
    { ...beat(b, { hold: 2.4, intensity: 0.6, target: 'chat' }), offset: 1.7 },
  ],
  settle: true,
  dropped: [],
};
const motion = new MotionLayer(
  1,
  { personality: 'playful', attitude: 'cheeky', energy: 60, reducedMotion: false, quiet: false },
  { aspect: 1, bodyHeight: 0.3, margin: 0.02 },
  { feet: true },
);
motion.place(0.5, 0.9);
const layer = new FaceLayer(manifest.face, { ownBlinks: false });
for (let frame = 0; frame <= 240; frame++) {
  const time = frame / 60;
  const layers = sampleScript(cue, time * 1000, lookup);
  const out = layer.update({ dt: 1 / 60, time, cues: layers });
  const pose = motion.update(time, {
    values: out.values,
    owned: new Map(),
    blinkScale: 1,
    clips: out.clips,
  }).pose;
  if (frame % 15 === 0)
    console.log(
      '  motion',
      `browL=${pose.browL.toFixed(2)} smile=${pose.smile.toFixed(2)} gazeX=${pose.gazeX.toFixed(2)}`,
    );
  if (frame % 15 === 0)
    console.log(
      time.toFixed(2),
      layers.map((l) => `${l.expression}:${l.weight.toFixed(2)}`).join(' '),
      Object.entries(out.values)
        .filter(([, v]) => Math.abs(v) > 0.05)
        .map(([k, v]) => `${k}=${v.toFixed(2)}`)
        .join(' '),
    );
}
