// Offline probe for attachment slot discovery: names every transform component of an artboard
// in memory, loads the patched file in the pinned runtime (no WebGL needed) and prints world
// positions, plus the colour keys of named appearance animations.
// Usage: npx tsx tools/assets/probe.ts <file.riv> <artboard> [animation to apply] [--colors]
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { artboardSection, nameComponents, colorKeys } from '../../src/renderer/attachments/riv/rivPatch';

const require = createRequire(import.meta.url);
const [file, artboardName, animationName] = process.argv.slice(2);
if (!file || !artboardName)
  throw new Error('Usage: tsx tools/assets/probe.ts <file.riv> <artboard> [animation]');
const bytes = new Uint8Array(await readFile(file));
const TRANSFORM_TYPES = new Set([2, 3, 4, 7, 40, 41]);
const section = artboardSection(bytes, artboardName);
const names: Record<number, string> = {};
section.components.forEach((component, index) => {
  if (TRANSFORM_TYPES.has(component.typeKey)) names[index] = 'probe/' + String(index);
});
const patched = nameComponents(bytes, artboardName, names);

const wasm = await readFile(require.resolve('@rive-app/webgl2/rive.wasm'));
(globalThis as Record<string, unknown>)['window'] ??= globalThis;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RuntimeLoader } = require('@rive-app/webgl2') as typeof import('@rive-app/webgl2');
RuntimeLoader.setWasmUrl('data:application/wasm;base64,' + wasm.toString('base64'));
RuntimeLoader.setWasmFallbackUrl(null);
const runtime = await RuntimeLoader.awaitInstance();
const riv = await runtime.load(patched, undefined, false);
const board = riv.artboardByName(artboardName);
if (animationName) {
  for (let i = 0; i < board.animationCount(); i++) {
    const definition = board.animationByIndex(i);
    if (definition.name === animationName) {
      const instance = new runtime.LinearAnimationInstance(definition, board);
      instance.advance(0.5);
      instance.apply(1);
    }
  }
}
board.advance(0);
const lookups = ['node', 'bone', 'rootBone'] as const;
for (const [index, name] of Object.entries(names)) {
  const component = section.components[Number(index)];
  let world: { tx: number; ty: number; xx: number; xy: number } | undefined;
  for (const lookup of lookups) {
    try {
      const found = (board[lookup] as (n: string) => { worldTransform(): typeof world } | null)(
        name,
      );
      if (found) {
        world = found.worldTransform();
        const length = (found as unknown as { length?: number }).length;
        if (typeof length === "number") console.log("   bone length", index, length.toFixed(1));
        break;
      }
    } catch {
      /* typed lookup mismatch */
    }
  }
  const parent = component?.props.get(5);
  const authored = component?.props.get(4);
  console.log(
    index.padStart(4),
    'type',
    String(component?.typeKey).padStart(3),
    'parent',
    String(parent).padStart(4),
    world
      ? `world (${world.tx.toFixed(1)}, ${world.ty.toFixed(1)}) rot ${((Math.atan2(world.xy, world.xx) * 180) / Math.PI).toFixed(1)}`
      : 'no world',
    typeof authored === 'string' && !authored.startsWith('probe/') ? authored : '',
  );
}
if (process.argv.includes('--colors'))
  for (const animation of ['hair Pink', 'clothing green', 'glasses blue'])
    console.log(animation, JSON.stringify(colorKeys(bytes, artboardName, animation)));
