// Checks whether a .riv still matches the mascot motion rig's component indices (the in-memory
// patch's expectTypes) and lists the bones/joysticks found:
//   npx tsx tools/mascot-remix/check-patch.ts <file.riv>
import { readFileSync } from 'node:fs';
import { lylaPatch } from '../../src/renderer/characters/mascot/motionRig';
import { artboardComponents, patchRiv } from '../../src/renderer/motion/rive/patch';

const file = process.argv[2] ?? 'src/renderer/characters/mascot/mascot.riv';
const bytes = new Uint8Array(readFileSync(file));
const components = artboardComponents(bytes, lylaPatch.artboard);
console.log('components:', components.length);
const counts = new Map<number, number[]>();
components.forEach(([index, type]) => {
  if ([148, 40, 41, 2].includes(type)) counts.set(type, [...(counts.get(type) ?? []), index]);
});
console.log('joysticks (148):', counts.get(148)?.join(','));
console.log(
  'bones (40):',
  counts.get(40)?.join(','),
  ' root bones (41):',
  counts.get(41)?.join(','),
);
try {
  patchRiv(bytes, lylaPatch);
  console.log('patch: OK (indices match)');
} catch (error) {
  console.log('patch:', (error as Error).message);
}
const named = components.filter(([, , props]) => typeof props.get(4) === 'string');
console.log(
  'named components:',
  named.length,
  named
    .slice(0, 12)
    .map(([i, t, p]) => `${String(i)}:${String(t)}:${String(p.get(4))}`)
    .join(' | '),
);
