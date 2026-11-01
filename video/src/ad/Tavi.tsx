// Tavi, from the real renderer: a transparent PNG sequence captured off the overlay
// (capture/tavi.mjs). Framing uses her measured bounding box (shots.json, from the alpha channel),
// so "fill 70% of the frame height" or "eyes on the upper third" are exact, whatever the capture.
import type { CSSProperties } from 'react';
import { Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import measured from './shots.json';

type Box = [number, number, number, number];
interface Measured {
  frames: number;
  width: number;
  height: number;
  box: (Box | null)[];
}
const shots = measured as unknown as Record<string, Measured>;
export type Shot = keyof typeof measured;

const pad = (n: number) => String(n).padStart(5, '0');

/** Median box over a window of capture frames: a steady framing reference that ignores gestures. */
function referenceBox(shot: Measured, first: number, last: number): Box {
  const boxes = shot.box
    .slice(Math.max(0, first), Math.min(shot.frames, last + 1))
    .filter(Boolean) as Box[];
  const pool = boxes.length ? boxes : (shot.box.filter(Boolean) as Box[]);
  const median = (k: number) => {
    const v = pool.map((b) => b[k]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  return [median(0), median(1), median(2), median(3)];
}

/** Box averaged over nearby frames, for a camera that follows her without jitter. */
function smoothBox(shot: Measured, index: number, radius: number): Box | null {
  let n = 0;
  const sum: Box = [0, 0, 0, 0];
  for (let i = index - radius; i <= index + radius; i++) {
    const b = shot.box[Math.min(shot.frames - 1, Math.max(0, i))];
    if (!b) continue;
    n++;
    for (let k = 0; k < 4; k++) sum[k] += b[k];
  }
  return n ? (sum.map((v) => v / n) as Box) : null;
}

export function Tavi({
  shot,
  from = 0,
  rate = 1,
  height = 0.7,
  at = [0.5, 0.55],
  focus = 'body',
  follow = 0,
  window = 2,
  frameOn,
  mirror = false,
  area,
  style,
}: {
  shot: Shot;
  /** Seconds into the capture at local frame 0. */
  from?: number;
  rate?: number;
  /** Her (steady) body height as a fraction of the area's height. */
  height?: number;
  /** Where the focus point lands, as a fraction of the area. */
  at?: [number, number];
  /** Which part of her lands on `at`. */
  focus?: 'body' | 'head' | 'eyes' | 'feet';
  /** Follow her movement with this smoothing radius in frames (0 = steady framing). */
  follow?: number;
  /** Seconds of capture the steady framing is measured over. */
  window?: number;
  /** Pin the framing to this capture range (seconds), so two shots of one take frame identically. */
  frameOn?: [number, number];
  mirror?: boolean;
  /** Draw into a box instead of the whole frame. */
  area?: { width: number; height: number };
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const W = area?.width ?? config.width;
  const H = area?.height ?? config.height;
  const shotData = shots[shot];
  const start = Math.round(from * 30);
  const index = Math.max(
    0,
    Math.min(shotData.frames - 1, start + Math.floor((frame / config.fps) * 30 * rate)),
  );
  const ref = frameOn
    ? referenceBox(shotData, Math.round(frameOn[0] * 30), Math.round(frameOn[1] * 30))
    : referenceBox(shotData, start, start + Math.round(window * 30));
  const live = follow ? smoothBox(shotData, index, follow) : null;
  const box = live ?? ref;
  const refH = (ref[3] - ref[1]) * shotData.height;
  const scale = (height * H) / refH;
  const cx = (box[0] + box[2]) / 2;
  const tall = ref[3] - ref[1];
  const top = live ? live[3] - tall : ref[1];
  const fy =
    focus === 'head'
      ? top + 0.22 * tall
      : focus === 'eyes'
        ? top + 0.26 * tall
        : focus === 'feet'
          ? box[3]
          : (top + box[3]) / 2;
  const drawW = shotData.width * scale;
  const drawH = shotData.height * scale;
  const fx = mirror ? 1 - cx : cx;
  return (
    <Img
      src={staticFile(`footage/tavi/${shot}/${pad(index)}.png`)}
      style={{
        position: 'absolute',
        left: at[0] * W - fx * drawW,
        top: at[1] * H - fy * drawH,
        width: drawW,
        height: drawH,
        maxWidth: 'none',
        transform: mirror ? 'scaleX(-1)' : undefined,
        ...style,
      }}
    />
  );
}
