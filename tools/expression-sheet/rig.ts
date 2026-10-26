// The expression sheet's only contact with the motion layer: loads the mascot with the motion
// layer's in-memory rig patch and draws an abstract pose (motion/types.ts channel units) on a
// canvas. The channel-to-joystick mapping mirrors the mascot's motion binding.
import type { RiveCanvas } from '@rive-app/webgl2/rive_advanced.mjs';
import { createMotionRig, type NodeOffset } from '../../src/renderer/motion/rive/motionRig';
import { lylaPatch, lylaRig } from '../../src/renderer/characters/mascot/motionRig';

export type SheetPose = Partial<Record<string, number>>;

/** Artboard units per body height. */
const UNITS = 600;

export async function createSheetRig(
  runtime: RiveCanvas,
  canvas: HTMLCanvasElement,
  bytes: Uint8Array,
  width: number,
  height: number,
) {
  const rig = await createMotionRig(runtime, canvas, bytes, lylaPatch, lylaRig);
  rig.resize(width, height, Math.min(devicePixelRatio || 1, 2));
  canvas.style.width = `${String(width)}px`;
  canvas.style.height = `${String(height)}px`;
  return {
    /**
     * zoom 1 draws the whole body to the canvas height; larger values magnify around `focus`
     * (fraction of body height from the top placed at the canvas centre).
     */
    draw(
      pose: SheetPose,
      { zoom = 1, focus = 0.3, dt = 1 / 60 }: { zoom?: number; focus?: number; dt?: number } = {},
    ) {
      const p = (name: string) => pose[name] ?? 0;
      const full = (value: number) => ({ value, weight: 1 });
      const offsets: Record<string, NodeOffset> = {
        head: { rotation: p('headTilt'), y: p('headY') * UNITS },
        upper: { rotation: p('lean') },
        body: { x: p('shift') * UNITS, y: p('bob') * UNITS },
        armL: { rotation: p('armL') },
        armR: { rotation: -p('armR') },
      };
      const bodyHeight = zoom === 1 ? height * 0.96 : height * zoom;
      rig.frame(
        dt,
        {
          clips: [],
          channels: {
            faceX: full(p('gazeX') * 0.85),
            faceY: full(p('gazeY') * 0.85),
            blinkLeft: full(-1 + 2 * p('blinkL')),
            blinkRight: full(-1 + 2 * p('blinkR')),
            browLeft: full(p('browL')),
            browRight: full(p('browR')),
            lidLeft: full(1 - 2 * p('squintL')),
            lidRight: full(1 - 2 * p('squintR')),
            mouthX: full(p('mouthX')),
            mouthY: full(p('mouthY')),
            mouthCurve: full(-p('smile')),
            squash: full(Math.max(-1.2, Math.min(1.2, p('squash')))),
          },
          offsets,
        },
        {
          x: width / 2,
          y: zoom === 1 ? height * 0.98 : height / 2 + (1 - focus) * bodyHeight,
          height: bodyHeight,
          rotation: 0,
          facing: 1,
          scaleX: 1,
          scaleY: 1,
        },
      );
    },
    dispose: rig.dispose,
  };
}
