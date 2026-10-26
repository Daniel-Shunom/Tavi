// Rig probe for the motion lab: renders the patched rig with externally set channels/offsets so
// tools/motion-lab/probe.mjs can screenshot what each joystick channel and named node does.
import { RuntimeLoader } from '@rive-app/webgl2';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import avatarURL from '../../assets/mascot.riv?url';
import { createMotionRig, type FrameInput } from '../rive/motionRig';
import { lylaPatch, lylaRig } from '../rigs/lyla';

RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);

const canvas = document.querySelector('canvas');
if (!canvas) throw new Error('probe canvas missing');
const size = 600;
const raw = new URLSearchParams(location.search).has('raw');
canvas.style.width = String(size) + 'px';
canvas.style.height = String(size) + 'px';

const input: FrameInput & { clips: { name: string; time: number; mix: number }[] } = {
  clips: [],
  channels: {},
  offsets: {},
};

async function main() {
  const [runtime, bytes] = await Promise.all([
    RuntimeLoader.awaitInstance(),
    fetch(avatarURL).then(async (r) => new Uint8Array(await r.arrayBuffer())),
  ]);
  const rig = await createMotionRig(
    runtime,
    canvas as HTMLCanvasElement,
    bytes,
    raw ? { artboard: lylaRig.artboard } : lylaPatch,
    raw ? { artboard: lylaRig.artboard, channels: {}, nodes: {} } : lylaRig,
  );
  rig.resize(size, size, 1);
  const render = () => {
    rig.frame(1 / 60, input, {
      x: size / 2,
      y: size,
      height: size,
      rotation: 0,
      facing: 1,
      scaleX: 1,
      scaleY: 1,
    });
  };
  Object.assign(window, {
    probe: {
      roles: rig.nodeRoles,
      durations: Object.fromEntries(rig.clipNames.map((n) => [n, rig.clipDuration(n)])),
      clips: rig.clipNames,
      set(next: Partial<FrameInput>) {
        Object.assign(input, next);
        render();
        render();
      },
      read: (role: string) => rig.read(role),
    },
  });
  render();
  document.body.dataset['ready'] = 'true';
}
main().catch((error: unknown) => {
  console.error(error);
  document.body.dataset['error'] = String(error);
});
