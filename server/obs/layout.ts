import { z } from 'zod';
import type { ObsSource } from '../../shared/obs.js';
import type { SceneRect } from '../../shared/states.js';

const number = z.number();
export const transformSchema = z.object({
  positionX: number,
  positionY: number,
  sourceWidth: number,
  sourceHeight: number,
  scaleX: number,
  scaleY: number,
  alignment: z.number().int(),
  rotation: number.default(0),
  cropLeft: number.default(0),
  cropRight: number.default(0),
  cropTop: number.default(0),
  cropBottom: number.default(0),
  boundsType: z.string().default('OBS_BOUNDS_NONE'),
});
export const sceneItemSchema = z.object({
  sceneItemId: z.number().int(),
  sourceName: z.string(),
  inputKind: z.string().nullable().optional(),
  sourceType: z.string().optional(),
  isGroup: z.boolean().default(false),
  sceneItemEnabled: z.boolean(),
  sceneItemTransform: transformSchema,
});
export const sceneItemsSchema = z.object({ sceneItems: z.array(sceneItemSchema) });
export type Transform = z.infer<typeof transformSchema>;
export interface Frame {
  x: number;
  y: number;
  sx: number;
  sy: number;
  clip: PixelRect | null;
}
interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const identity: Frame = { x: 0, y: 0, sx: 1, sy: 1, clip: null };
const alignment = (bits: number, low: number, high: number) =>
  bits & low ? 0 : bits & high ? 1 : 0.5;
function intersection(a: PixelRect, b: PixelRect): PixelRect {
  const x = Math.max(a.x, b.x),
    y = Math.max(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x),
    h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y),
  };
}

/** Exact for axis-aligned scaling/cropping. Unsupported transforms never produce a fake perch. */
export function sourceFrame(t: Transform, parent: Frame) {
  if (Math.abs(t.rotation % 360) > 0.01)
    return {
      reason: 'Rotated sources have no horizontal perch. Place this webcam region manually.',
    };
  if (t.boundsType !== 'OBS_BOUNDS_NONE')
    return {
      reason:
        'This source uses a bounding-box fit. Place its visible webcam region manually for now.',
    };
  const w = Math.max(0, t.sourceWidth - t.cropLeft - t.cropRight) * t.scaleX;
  const h = Math.max(0, t.sourceHeight - t.cropTop - t.cropBottom) * t.scaleY;
  const ox = t.positionX - alignment(t.alignment, 1, 2) * w;
  const oy = t.positionY - alignment(t.alignment, 4, 8) * h;
  const x1 = parent.x + parent.sx * ox,
    x2 = x1 + parent.sx * w;
  const y1 = parent.y + parent.sy * oy,
    y2 = y1 + parent.sy * h;
  let rect: PixelRect = {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
  if (parent.clip) rect = intersection(rect, parent.clip);
  return {
    rect,
    frame: {
      x: parent.x + parent.sx * (ox - t.cropLeft * t.scaleX),
      y: parent.y + parent.sy * (oy - t.cropTop * t.scaleY),
      sx: parent.sx * t.scaleX,
      sy: parent.sy * t.scaleY,
      clip: rect,
    } satisfies Frame,
    reason: null,
  };
}

export function normalized(rect: PixelRect, width: number, height: number): SceneRect | null {
  const clipped = intersection(rect, { x: 0, y: 0, w: width, h: height });
  if (clipped.w / width < 0.02 || clipped.h / height < 0.02) return null;
  const round = (v: number) => Math.round(v * 10000) / 10000;
  return {
    enabled: true,
    x: round(clipped.x / width),
    y: round(clipped.y / height),
    w: round(clipped.w / width),
    h: round(clipped.h / height),
  };
}

export function likelyCamera(name: string) {
  // A capture-device input could be a game capture card. Its type alone cannot establish its role.
  return /web\s*cam|face\s*cam|camera|(^|[\s_-])cam($|[\s_-])/i.test(name);
}

export function chooseWebcam(sources: ObsSource[], selection: string | null) {
  if (selection !== null) return sources.find((source) => source.id === selection) ?? null;
  const candidates = sources.filter((source) => source.camera);
  return candidates.length === 1 ? (candidates[0] ?? null) : null;
}
