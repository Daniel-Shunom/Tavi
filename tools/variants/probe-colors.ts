// Lists every solid fill and gradient stop of a character artboard with its parent chain, plus the
// colour keys of appearance animations. Used to find which fills are skin, hair and outfit.
// Usage: npx tsx tools/variants/probe-colors.ts [file.riv] [artboard]
import { readFileSync } from 'node:fs';
import { artboardSection, colorKeys } from '../../src/renderer/attachments/riv/rivPatch';

const file = process.argv[2] ?? 'src/renderer/characters/mascot/mascot.riv';
const artboard = process.argv[3] ?? 'lyla animation';
const bytes = new Uint8Array(readFileSync(file));
const { components, animations } = artboardSection(bytes, artboard);
const PARENT = 5;
const hex = (v: unknown) => '#' + (Number(v) >>> 0).toString(16).padStart(8, '0');
const chain = (index: number) => {
  const out: string[] = [];
  let i: number | undefined = index;
  while (i !== undefined && out.length < 6) {
    const c = components[i];
    if (!c) break;
    const name = c.props.get(4);
    out.push(`${String(i)}:${String(c.typeKey)}${name ? '"' + String(name) + '"' : ''}`);
    const parent = c.props.get(PARENT);
    i = i === 0 ? undefined : typeof parent === 'number' ? parent : 0;
  }
  return out.join(' < ');
};
components.forEach((c, i) => {
  if (c.typeKey === 18) console.log('solid', i, hex(c.props.get(37)), chain(i));
  if (c.typeKey === 19) console.log('stop ', i, hex(c.props.get(38)), chain(i));
});
for (const a of animations) {
  const keys = colorKeys(bytes, artboard, a.name);
  if (keys.length) console.log('anim', JSON.stringify(a.name), keys.join(' '));
}
