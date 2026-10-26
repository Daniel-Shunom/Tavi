// Lists artboards, linear animations, state machines and inputs in a .riv file using the
// pinned @rive-app/webgl2 runtime (no WebGL needed for metadata).
// Usage: node tools/rive-inventory.mjs <file.riv> [--json]
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export async function inventory(path) {
  const wasm = await readFile(require.resolve('@rive-app/webgl2/rive.wasm'));
  globalThis.window ??= globalThis;
  const { RuntimeLoader } = require('@rive-app/webgl2');
  RuntimeLoader.setWasmUrl('data:application/wasm;base64,' + wasm.toString('base64'));
  RuntimeLoader.setWasmFallbackUrl(null);
  const runtime = await RuntimeLoader.awaitInstance();
  const read = (object, key) => (typeof object[key] === 'function' ? object[key]() : object[key]);
  const riv = await runtime.load(new Uint8Array(await readFile(path)), undefined, false);
  const report = { file: path, artboards: [] };
  for (let a = 0; a < riv.artboardCount(); a++) {
    const board = riv.artboardByIndex(a);
    const entry = { name: read(board, 'name'), animations: [], stateMachines: [] };
    for (let i = 0; i < board.animationCount(); i++) {
      const animation = board.animationByIndex(i);
      entry.animations.push({
        name: read(animation, 'name'),
        seconds: Number((read(animation, 'duration') / read(animation, 'fps')).toFixed(3)),
        loop: read(animation, 'loopValue'),
      });
    }
    for (let i = 0; i < board.stateMachineCount(); i++) {
      const definition = board.stateMachineByIndex(i);
      const machine = new runtime.StateMachineInstance(definition, board);
      const inputs = [];
      for (let j = 0; j < machine.inputCount(); j++) {
        const input = machine.input(j);
        inputs.push({ name: read(input, 'name'), type: read(input, 'type') });
      }
      entry.stateMachines.push({ name: read(definition, 'name'), inputs });
      machine.delete();
    }
    report.artboards.push(entry);
    board.delete();
  }
  return report;
}
const file = process.argv[2];
if (!file) throw new Error('Usage: node tools/rive-inventory.mjs <file.riv> [--json]');
// The runtime prints a harmless "Blank Script" warning for some files; keep JSON output clean.
const log = console.log;
console.log = (...args) => {
  if (!String(args[0]).startsWith('Blank Script')) log(...args);
};
const report = await inventory(file);
if (process.argv.includes('--json')) log(JSON.stringify(report, null, 2));
else
  for (const board of report.artboards) {
    log(`Artboard "${board.name}"`);
    for (const clip of board.animations)
      log(`  animation "${clip.name}" ${String(clip.seconds)}s loop=${String(clip.loop)}`);
    for (const machine of board.stateMachines)
      log(
        `  state machine "${machine.name}" inputs: ${machine.inputs.map((input) => `${input.name}(${String(input.type)})`).join(', ') || 'none'}`,
      );
  }
