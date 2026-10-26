// Measures a character's rig in rest space (body heights from the soles, +y up) by posing it
// through the real binding and reading bone world transforms, plus silhouette scans of the
// rendered pixels. Used to calibrate src/renderer/motion/pose/proxy.ts. Dev tool only.
import { RuntimeLoader } from '@rive-app/webgl2';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import type { Pose } from '../../src/renderer/motion/types';
import { createPuppet } from './puppet';

RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);

const params = new URLSearchParams(location.search);
const id = params.get('character') ?? 'mascot-v2';
const SIZE = 600;

async function main() {
  const runtime = await RuntimeLoader.awaitInstance();
  const canvas = document.querySelector('canvas');
  if (!canvas) throw new Error('canvas');
  const puppet = await createPuppet(runtime, canvas, id);
  puppet.resize(SIZE, SIZE);
  const ctx2 = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!ctx2) throw new Error('2d');
  ctx2.canvas.width = SIZE;
  ctx2.canvas.height = SIZE;
  const at = { x: SIZE / 2, y: SIZE * 0.95, bodyPx: SIZE * 0.85, rotation: 0, facing: 1 as const };
  function joints(values: Partial<Pose>) {
    puppet.pose(values);
    puppet.draw(at);
    const out: Record<string, unknown> = {};
    for (const role of puppet.roles) {
      const w = puppet.world(role);
      if (!w) continue;
      out[role] = {
        origin: puppet.toRest(w.origin),
        tip: w.length ? puppet.toRest(w.tip) : undefined,
        length: w.length / (puppet.bounds.maxY - puppet.bounds.minY),
      };
    }
    return out;
  }
  /** Silhouette of the current draw in rest space: per-row extents and the lowest/highest rows. */
  function silhouette(values: Partial<Pose>, rotation = 0) {
    puppet.pose(values);
    puppet.draw({ ...at, rotation });
    ctx2!.clearRect(0, 0, SIZE, SIZE);
    ctx2!.drawImage(canvas!, 0, 0, SIZE, SIZE);
    const data = ctx2!.getImageData(0, 0, SIZE, SIZE).data;
    const rows: { y: number; x0: number; x1: number; n: number }[] = [];
    let cx = 0,
      cy = 0,
      count = 0;
    for (let y = 0; y < SIZE; y++) {
      let x0 = -1,
        x1 = -1,
        n = 0;
      for (let x = 0; x < SIZE; x++) {
        if ((data[(y * SIZE + x) * 4 + 3] ?? 0) > 40) {
          if (x0 < 0) x0 = x;
          x1 = x;
          n++;
          cx += x;
          cy += y;
          count++;
        }
      }
      if (n) rows.push({ y, x0, x1, n });
    }
    const toRest = (x: number, y: number) => ({
      x: (x - at.x) / at.bodyPx,
      y: (at.y - y) / at.bodyPx,
    });
    const first = rows[0],
      last = rows[rows.length - 1];
    return {
      top: first ? toRest(0, first.y).y : null,
      bottom: last ? toRest(0, last.y).y : null,
      centroid: count ? toRest(cx / count, cy / count) : null,
      area: count / (at.bodyPx * at.bodyPx),
      rows: rows
        .filter((_, i) => i % 6 === 0)
        .map((r) => ({ y: toRest(0, r.y).y, x0: toRest(r.x0, 0).x, x1: toRest(r.x1, 0).x })),
    };
  }
  Object.assign(window, { measure: { joints, silhouette, roles: puppet.roles } });
  document.body.dataset['ready'] = 'true';
}
main().catch((error: unknown) => {
  console.error(error);
  document.body.dataset['error'] = String(error);
});
