// Reads what capture/analyze.mjs measured about a shot: where she is in each frame and how much
// she is moving, so cameras can follow her and cuts can land on the action.
import type { TaviShot } from './config';
import { measured } from './generated';

function data(shot: TaviShot) {
  return measured[shot] ?? null;
}

/** Her box (0..1 of the capture) at a frame, averaged over ±`smooth` frames like a camera would. */
export function followBox(shot: TaviShot, index: number, smooth = 8) {
  const d = data(shot);
  if (!d) return null;
  let n = 0;
  const sum = [0, 0, 0, 0];
  for (let i = index - smooth; i <= index + smooth; i++) {
    const box = d.box[Math.max(0, Math.min(d.box.length - 1, i))];
    if (!box) continue;
    for (let k = 0; k < 4; k++) sum[k] += box[k];
    n++;
  }
  return n ? (sum.map((v) => v / n) as [number, number, number, number]) : null;
}

/**
 * The start (seconds) of the liveliest `window` seconds between `from` and `to` in a shot, so a
 * short cut shows the expression mid-action rather than a held pose.
 */
export function liveliest(shot: TaviShot, from: number, to: number, window = 0.5) {
  const d = data(shot);
  if (!d) return from;
  const span = Math.round(window * d.fps);
  const start = Math.round(from * d.fps);
  const end = Math.min(d.energy.length - span, Math.round(to * d.fps) - span);
  let best = start;
  let bestSum = -1;
  for (let i = start; i <= end; i++) {
    let sum = 0;
    for (let k = 0; k < span; k++) sum += d.energy[i + k];
    if (sum > bestSum) {
      bestSum = sum;
      best = i;
    }
  }
  return best / d.fps;
}
