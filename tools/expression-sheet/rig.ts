// The expression sheet's contact with the motion layer: loads the mascot with the motion layer's
// in-memory rig patch and draws an abstract pose (motion/types.ts channel units) through the
// mascot's own motion binding, so the sheet shows exactly what the overlay renders.
import type { RiveCanvas } from '@rive-app/webgl2/rive_advanced.mjs';
import { bindLyla } from '../../src/renderer/characters/mascot/motionBinding';
import { lylaPatch, lylaRig } from '../../src/renderer/characters/mascot/motionRig';
import { createMotionRig } from '../../src/renderer/motion/rive/motionRig';
import { neutralPose, type Channel, type MotionFrame } from '../../src/renderer/motion/types';

export type SheetPose = Partial<Record<string, number>>;

/** Discrete selections are held from frame 10k of the 60-frame (1 s) control tracks. */
const step = (index: number) => Math.min(0.99, (10 * Math.max(0, Math.round(index)) + 5) / 60);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * `v2`: the remixed file (art/mascot-remix), which carries the names and control tracks itself
 * (no patch) and adds elbows, hands, arms-in-front, brow tilt and the open mouth.
 */
export async function createSheetRig(
  runtime: RiveCanvas,
  canvas: HTMLCanvasElement,
  bytes: Uint8Array,
  width: number,
  height: number,
  v2 = false,
) {
  const manifest = v2
    ? {
        ...lylaRig,
        nodes: {
          ...lylaRig.nodes,
          elbowL: { name: 'tavi/armL.fore', kind: 'bone' as const },
          elbowR: { name: 'tavi/armR.fore', kind: 'bone' as const },
          eyes: { name: 'tavi/eyes', kind: 'node' as const },
        },
      }
    : lylaRig;
  const rig = await createMotionRig(
    runtime,
    canvas,
    bytes,
    v2 ? { artboard: lylaRig.artboard } : lylaPatch,
    manifest,
  );
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
      // Same rest as the app's renderer (the wave clip at 0 resets the forearm bones, which
      // otherwise keep the last clip's pose between cards).
      const rest = { role: 'wave', time: 0, mix: 1 };
      const input = bindLyla({ ...frame, clips: [rest, ...frame.clips] });
      if (v2) {
        const p = frame.pose;
        input.clips.push(
          { name: 'tavi/browTiltL', time: clamp01((p.browTiltL + 1) / 2), mix: 1 },
          { name: 'tavi/browTiltR', time: clamp01((p.browTiltR + 1) / 2), mix: 1 },
          { name: 'tavi/mouthOpen', time: clamp01(p.mouthOpen), mix: 1 },
          { name: 'tavi/viseme', time: step(p.viseme), mix: 1 },
          { name: 'tavi/handL', time: step(p.handL), mix: 1 },
          { name: 'tavi/handR', time: step(p.handR), mix: 1 },
          { name: 'tavi/armsFront', time: p.armsFront >= 0.5 ? 0.99 : 0.01, mix: 1 },
        );
        input.offsets = {
          ...input.offsets,
          elbowL: { rotation: p.elbowL },
          elbowR: { rotation: -p.elbowR },
          eyes: { x: (0.5 * p.gazeX + p.pupilX) * 14, y: (0.5 * p.gazeY + p.pupilY) * 10 },
        };
      }
      rig.frame(dt, input, {
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
