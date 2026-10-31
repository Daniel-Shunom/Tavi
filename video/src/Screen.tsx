// Screen footage (capture/screens.mjs) as a JPEG sequence, or one of your own clips as a video,
// with a slow push-in. A missing clip shows a labelled placeholder so the render never breaks.
// Captured footage is a sequence rather than a video on purpose: Remotion's video decoder gave up
// on seeks into our screen recordings mid-render, and an image per frame cannot.
import {
  AbsoluteFill,
  Img,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { useExists } from './audio';
import { pad } from './footage';
import { colors } from './theme';
import { Label, sans } from './type';

export interface ScreenSource {
  /** A folder of 00000.jpg… at 30 fps (captured footage), or a single video file (your clip). */
  src: string;
  /** Frame count of a sequence; omit for a video file. */
  frames?: number;
}

export function Screen({
  src,
  frames,
  from = 0,
  zoom = [1, 1.1],
  focus = [0.5, 0.5],
  label,
}: ScreenSource & {
  from?: number;
  zoom?: [number, number];
  focus?: [number, number];
  label?: string;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const sequence = frames !== undefined;
  const exists = useExists(sequence ? `${src}/${pad(0)}.jpg` : src);
  const scale = interpolate(frame, [0, durationInFrames], zoom, { extrapolateRight: 'clamp' });
  const style = {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    transform: `scale(${scale.toFixed(4)})`,
    transformOrigin: `${(focus[0] * 100).toFixed(1)}% ${(focus[1] * 100).toFixed(1)}%`,
  };
  if (exists === false)
    return (
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.panel,
          gap: 18,
        }}
      >
        <Label color={colors.faint}>Your clip goes here</Label>
        <div style={{ fontFamily: sans, color: colors.muted, fontSize: 28 }}>
          video/public/{src}
        </div>
        {label ? (
          <div style={{ fontFamily: sans, color: colors.faint, fontSize: 22 }}>{label}</div>
        ) : null}
      </AbsoluteFill>
    );
  if (exists === null) return null;
  const start = Math.round(from * 30);
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: colors.panel }}>
      {sequence ? (
        <Img
          src={staticFile(`${src}/${pad(Math.min(frames - 1, start + frame))}.jpg`)}
          style={style}
        />
      ) : (
        <OffthreadVideo src={staticFile(src)} startFrom={start} muted style={style} />
      )}
    </AbsoluteFill>
  );
}
