// Loads the Rive CLI proof face through the normal manifest + CharacterRenderer adapter, so
// tools/rive-cli-proof/shoot.mjs can screenshot its range timelines and the "oops" clip.
import { RuntimeLoader } from '@rive-app/webgl2';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import { createCharacterRenderer, type TrackApplication } from '../../src/renderer/adapter';
import { cliFace } from '../../src/renderer/characters/cli-face/manifest';
import { manifestSchema } from '../../src/renderer/characters/manifest';

RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);

async function main() {
  const canvas = document.querySelector<HTMLCanvasElement>('#proof');
  if (!canvas) throw new Error('missing canvas');
  const manifest = manifestSchema.parse(cliFace);
  const renderer = await createCharacterRenderer(canvas, manifest);
  renderer.resize(300, 300);
  const rest = manifest.rest.map((sample) => ({
    track: sample.track,
    time: sample.at ?? 0,
    mix: 1,
  }));
  const show = (tracks: TrackApplication[]) => {
    renderer.applyFrame({ tracks: [...rest, ...tracks], inputs: {}, nodes: {} });
    renderer.draw(1 / 60, { x: 150, y: 300, width: 300, height: 300, rotation: 0 });
  };
  Object.assign(window, { proof: { show } });
  show([]);
  document.body.dataset['ready'] = 'true';
}
main().catch((error: unknown) => {
  console.error(error);
  document.body.dataset['error'] = String(error);
});
