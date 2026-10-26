// Raw face probe: renders the patched mascot rig with abstract face channels set directly, so
// tools/expression-sheet/probe.mjs can screenshot what each channel value does to the face.
import { RuntimeLoader } from '@rive-app/webgl2';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import avatarURL from '../../src/renderer/characters/mascot/mascot.riv?url';
import { createSheetRig, type SheetPose } from './rig';

RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);

const canvas = document.querySelector<HTMLCanvasElement>('#probe');
if (!canvas) throw new Error('probe canvas missing');
const size = 600;

async function main(target: HTMLCanvasElement) {
  const [runtime, bytes] = await Promise.all([
    RuntimeLoader.awaitInstance(),
    fetch(avatarURL).then(async (r) => new Uint8Array(await r.arrayBuffer())),
  ]);
  const rig = await createSheetRig(runtime, target, bytes, size, size);
  let pose: SheetPose = {};
  let clips: { role: string; time: number; mix: number }[] = [];
  let zoom = 1.6;
  let focus = 0.3;
  const render = () => {
    rig.draw(pose, { zoom, focus, clips });
  };
  Object.assign(window, {
    probe: {
      set(next: SheetPose & { clip?: string; t?: number }, nextZoom = 1.6, nextFocus = 0.3) {
        const { clip, t, ...rest } = next;
        pose = rest;
        clips = clip ? [{ role: clip, time: t ?? 0, mix: 1 }] : [];
        zoom = nextZoom;
        focus = nextFocus;
        render();
        render();
      },
    },
  });
  render();
  document.body.dataset['ready'] = 'true';
}
main(canvas).catch((error: unknown) => {
  console.error(error);
  document.body.dataset['error'] = String(error);
});
