// Screen footage (capture/screens.mjs) or one of your own clips, inside a soft window with a slow
// push-in. Missing files show a labelled placeholder so the render never breaks.
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { useExists } from './audio';
import { colors } from './theme';
import { Label, sans } from './type';

export function Screen({
  src,
  from = 0,
  zoom = [1, 1.1],
  focus = [0.5, 0.5],
  label,
}: {
  src: string;
  from?: number;
  zoom?: [number, number];
  focus?: [number, number];
  label?: string;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const exists = useExists(src);
  const scale = interpolate(frame, [0, durationInFrames], zoom, { extrapolateRight: 'clamp' });
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
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: colors.panel }}>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={Math.round(from * 30)}
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale.toFixed(4)})`,
          transformOrigin: `${(focus[0] * 100).toFixed(1)}% ${(focus[1] * 100).toFixed(1)}%`,
        }}
      />
    </AbsoluteFill>
  );
}
