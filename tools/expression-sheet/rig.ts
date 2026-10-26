// The expression sheet's contact with the motion layer: loads the mascot with the motion layer's
// in-memory rig patch and draws an abstract pose (motion/types.ts channel units) through the
// mascot's own motion binding, so the sheet shows exactly what the overlay renders.
import type { RiveCanvas } from '@rive-app/webgl2/rive_advanced.mjs';
import { bindLyla } from '../../src/renderer/characters/mascot/motionBinding';
import { lylaPatch, lylaRig } from '../../src/renderer/characters/mascot/motionRig';
import { createMotionRig } from '../../src/renderer/motion/rive/motionRig';
import { neutralPose, type Channel, type MotionFrame } from '../../src/renderer/motion/types';

export type SheetPose = Partial<Record<string, number>>;

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
      {
        zoom = 1,
        focus = 0.3,
        dt = 1 / 60,
        clips = [],
      }: { zoom?: number; focus?: number; dt?: number; clips?: MotionFrame['clips'] } = {},
    ) {
      const full = neutralPose();
      for (const [name, value] of Object.entries(pose))
        if (value !== undefined && name in full) full[name as Channel] = value;
      this.drawFrame({ time: 0, pose: full, clips } as unknown as MotionFrame, {
        zoom,
        focus,
        dt,
      });
    },
    /** Draws a full motion frame (pose + authored clips), ignoring its stage placement. */
    drawFrame(
      frame: MotionFrame,
      { zoom = 1, focus = 0.3, dt = 1 / 60 }: { zoom?: number; focus?: number; dt?: number } = {},
    ) {
      const bodyHeight = zoom === 1 ? height * 0.96 : height * zoom;
      rig.frame(dt, bindLyla(frame), {
        x: width / 2,
        y: zoom === 1 ? height * 0.98 : height / 2 + (1 - focus) * bodyHeight,
        height: bodyHeight,
        rotation: 0,
        facing: 1,
        scaleX: 1,
        scaleY: 1,
      });
    },
    dispose: rig.dispose,
  };
}
