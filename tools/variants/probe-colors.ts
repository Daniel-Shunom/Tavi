// Lists every solid fill and gradient stop of a character artboard with its owning shape's name
// and ancestor chain, plus the colour keys of appearance animations. Used to decide which fills
// are skin, hair, eyes and lines when writing a variant rig.
// Usage: npx tsx tools/variants/probe-colors.ts [file.riv] [artboard]
import { readFileSync } from 'node:fs';
import { artboardSection, colorKeys } from '../../src/renderer/attachments/riv/rivPatch';

const file = process.argv[2] ?? 'src/renderer/characters/mascot-v2/mascot-v2.riv';
const artboard = process.argv[3] ?? 'lyla animation';
const bytes = new Uint8Array(readFileSync(file));
const { components, animations } = artboardSection(bytes, artboard);
const hex = (v: unknown) => '#' + (Number(v) >>> 0).toString(16).padStart(8, '0');
const name = (i: number) => {
  const value = components[i]?.props.get(4);
  return typeof value === 'string' ? value : '';
};
const parent = (i: number) => {
  const value = components[i]?.props.get(5);
  return typeof value === 'number' ? value : 0;
};
const chain = (index: number) => {
  const out: string[] = [];
  for (let i = parent(index), n = 0; i > 0 && n < 6; i = parent(i), n++)
    out.push(`${String(i)}:${name(i)}`);
  return out.join(' < ');
};
components.forEach((c, i) => {
  if (c.typeKey === 18) console.log('solid', i, hex(c.props.get(37)), chain(i));
  if (c.typeKey === 19) console.log('stop ', i, hex(c.props.get(38)), chain(i));
});
for (const a of animations) {
  const keys = colorKeys(bytes, artboard, a.name);
  if (keys.length) console.log('anim', JSON.stringify(a.name), keys.length, 'colour keys');
}
