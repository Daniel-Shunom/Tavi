// Plays a captured PNG sequence of Tavi (capture/tavi.mjs) with a crop and zoom, so one capture
// can serve as a wide shot, a portrait, or an extreme close-up of an eye.
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TaviShot } from './config';
import { footage, pad } from './footage';
import { followBox } from './track';

export function TaviClip({
  shot,
  from = 0,
  at,
  zoom = 1,
  focus = [0.5, 0.5],
  anchor = [0.5, 0.5],
  speed = 1,
  hold = true,
  box,
  follow,
  mirror = false,
  style,
}: {
  shot: TaviShot;
  /** Seconds into the capture to start from. */
  from?: number;
  /** Exact seconds into the capture for this frame (for cuts); overrides from and speed. */
  at?: number;
  /** 1 fits the capture's height to the frame; larger values push in. */
  zoom?: number;
  /** Point of the capture (0..1) placed at `anchor`. */
  focus?: [number, number];
  /** Point of the frame (0..1) where `focus` lands; default is the centre. */
  anchor?: [number, number];
  speed?: number;
  /** Freeze on the last frame rather than wrapping. */
  hold?: boolean;
  /** Fit inside this box instead of the whole frame (a cameo bubble, a card). */
  box?: { width: number; height: number };
  /**
   * Track her like a camera operator: `focus` becomes a point on her body (from
   * capture/analyze.mjs), smoothed over a few frames.
   */
  follow?: { part?: 'body' | 'head' | 'feet'; smooth?: number };
  /** Flip horizontally (a reverse angle). */
  mirror?: boolean;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const { fps } = config;
  const width = box?.width ?? config.width;
  const height = box?.height ?? config.height;
  const clip = footage(shot);
  const elapsed = at ?? (frame / fps) * speed + from;
  let index = Math.floor(elapsed * clip.fps);
  index = hold ? Math.min(index, clip.frames - 1) : index % clip.frames;
  index = Math.max(0, index);
  // Fit the capture's height to the frame, then zoom about the focus point.
  if (follow) {
    const tracked = followBox(shot, index, follow.smooth ?? 8);
    if (tracked) {
      const [x0, y0, x1, y1] = tracked;
      const tall = y1 - y0;
      const y =
        follow.part === 'head'
          ? y0 + 0.24 * tall
          : follow.part === 'feet'
            ? y1 - 0.06 * tall
            : (y0 + y1) / 2;
      focus = [(x0 + x1) / 2, y];
    }
  }
  const base = height / clip.height;
  const scale = base * zoom;
  const drawW = clip.width * scale;
  const drawH = clip.height * scale;
  const left = anchor[0] * width - focus[0] * drawW;
  const top = anchor[1] * height - focus[1] * drawH;
  return (
    <AbsoluteFill style={style}>
      <Img
        src={staticFile(`footage/tavi/${shot}/${pad(index)}.png`)}
        style={{
          position: 'absolute',
          left,
          top,
          width: drawW,
          height: drawH,
          transform: mirror ? 'scaleX(-1)' : undefined,
          transformOrigin: `${(focus[0] * 100).toFixed(2)}% 50%`,
        }}
      />
    </AbsoluteFill>
  );
}
