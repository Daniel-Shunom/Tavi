// Prints the stored properties of every component with a given name and of its direct children.
// Usage: npx tsx tools/variants/probe-props.ts <name> [file.riv]
import { readFileSync } from 'node:fs';
import { RigIndex } from '../../src/renderer/characters/variants/rig';

const [name = 'blush', file = 'src/renderer/characters/mascot-v2/mascot-v2.riv'] =
  process.argv.slice(2);
const index = new RigIndex(new Uint8Array(readFileSync(file)), 'lyla animation');
for (const i of index.select({ name })) {
  for (const j of [i, ...index.components.keys()].filter((k) => k === i || index.parent(k) === i)) {
    const c = index.components[j];
    if (!c) continue;
    console.log(j, c.typeKey, index.name(j), JSON.stringify([...c.props.entries()]));
  }
}
