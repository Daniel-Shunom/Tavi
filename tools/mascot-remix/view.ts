// Renders a .riv (default: the CLI-built mascot remix) with the app's Rive runtime, applying
// named clips and bone/node offsets, so tools/mascot-remix/shoot.mjs can screenshot rig tests.
// The file is fetched from ?file=<url> (Vite serves the repo, e.g. /art/mascot-remix/build/...).
import { RuntimeLoader } from '@rive-app/webgl2';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import { createMotionRig, type NodeOffset } from '../../src/renderer/motion/rive/motionRig';

RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);

const params = new URLSearchParams(location.search);
const file = params.get('file') ?? '/art/mascot-remix/build/mascot-remix.riv';
const artboard = params.get('artboard') ?? 'lyla animation';
const size = 600;

interface ViewState {
  clips?: { name: string; time: number; mix?: number }[];
  offsets?: Record<string, NodeOffset>;
}

async function main() {
  const canvas = document.querySelector<HTMLCanvasElement>('#view');
  if (!canvas) throw new Error('missing canvas');
  canvas.style.width = `${String(size)}px`;
  canvas.style.height = `${String(size)}px`;
  const [runtime, bytes] = await Promise.all([
    RuntimeLoader.awaitInstance(),
    fetch(file).then(async (response) => new Uint8Array(await response.arrayBuffer())),
  ]);
  const roles = (params.get('bones') ?? '').split(',').filter(Boolean);
  const rig = await createMotionRig(
    runtime,
    canvas,
    bytes,
    { artboard },
    {
      artboard,
      channels: {},
      nodes: Object.fromEntries(
        roles.map((entry) => {
          const [name = '', kind = 'bone'] = entry.split(':');
          return [name, { name, kind: kind as 'node' | 'bone' | 'rootBone' }];
        }),
      ),
    },
  );
  rig.resize(size, size, 1);
  let state: ViewState = {};
  const render = () => {
    rig.frame(
      1 / 60,
      {
        clips: (state.clips ?? []).map((clip) => ({ ...clip, mix: clip.mix ?? 1 })),
        channels: {},
        offsets: state.offsets ?? {},
      },
      { x: size / 2, y: size, height: size, rotation: 0, facing: 1, scaleX: 1, scaleY: 1 },
    );
  };
  Object.assign(window, {
    view: {
      clips: rig.clipNames,
      roles: rig.nodeRoles,
      set(next: ViewState) {
        state = next;
        render();
        render();
      },
    },
  });
  render();
  document.body.dataset['ready'] = 'true';
}
main().catch((error: unknown) => {
  console.error(error);
  document.body.dataset['error'] = String(error);
});
