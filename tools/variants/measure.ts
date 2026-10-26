// Prints runtime world positions of named components relative to the head anchor, in the rest
// pose, so overlay geometry (hair, features) can be authored in head space.
// Open /tools/variants/measure.html; results are in document.body.dataset.result (JSON).
import { RuntimeLoader } from '@rive-app/webgl2';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import avatarURL from '../../src/renderer/characters/mascot-v2/mascot-v2.riv?url';
import { createMotionRig } from '../../src/renderer/motion/rive/motionRig';

RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);

const names = (
  new URLSearchParams(location.search).get('names') ??
  'head,face,mouth,nose,eyes,eyes_2,blush,brow_left,brow_right,ear,ear_2,face features move,hair squash,neck,shirt'
).split(',');
const bones = ['hair left swing', 'hair right swing', 'tavi/armL.fore', 'tavi/armR.fore'];

async function main() {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const [runtime, bytes] = await Promise.all([
    RuntimeLoader.awaitInstance(),
    fetch(avatarURL).then(async (r) => new Uint8Array(await r.arrayBuffer())),
  ]);
  const artboard = 'lyla animation';
  const rig = await createMotionRig(
    runtime,
    canvas,
    bytes,
    { artboard },
    { artboard, channels: {}, nodes: {} },
  );
  rig.resize(300, 300, 1);
  const place = { x: 150, y: 300, height: 300, rotation: 0, facing: 1, scaleX: 1, scaleY: 1 };
  for (let i = 0; i < 3; i++)
    rig.frame(
      1 / 60,
      { clips: [{ name: 'wave Non Looping', time: 0, mix: 1 }], channels: {}, offsets: {} },
      place,
    );
  const board = rig.artboard;
  const at = (m: { xx: number; xy: number; yx: number; yy: number; tx: number; ty: number }) => {
    const value = [m.xx, m.xy, m.yx, m.yy, m.tx, m.ty];
    m.delete?.();
    return value;
  };
  const head = at(board.node('head').worldTransform());
  const rel = (w: number[]) => ({
    x: +((w[4] ?? 0) - (head[4] ?? 0)).toFixed(1),
    y: +((w[5] ?? 0) - (head[5] ?? 0)).toFixed(1),
    rot: +((Math.atan2(w[1] ?? 0, w[0] ?? 1) * 180) / Math.PI).toFixed(1),
  });
  const result: Record<string, unknown> = { head: { x: head[4], y: head[5] } };
  for (const name of names)
    try {
      result[name] = rel(at(board.node(name).worldTransform()));
    } catch {
      result[name] = null;
    }
  for (const name of bones)
    try {
      const bone = board.bone(name);
      result[name] = { ...rel(at(bone.worldTransform())), length: bone.length };
    } catch {
      result[name] = null;
    }
  document.body.dataset.result = JSON.stringify(result);
  document.body.dataset.ready = '1';
}
main().catch((error: unknown) => {
  document.body.dataset.error = String(error);
});
