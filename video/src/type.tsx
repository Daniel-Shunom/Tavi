// Typography: Georgia for the big hits (the brand's headline face), DM Sans for labels.
import { loadFont } from '@remotion/google-fonts/DMSans';
import type { CSSProperties, ReactNode } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, serif } from './theme';

const { fontFamily: sans } = loadFont('normal', {
  weights: ['400', '600', '700'],
  subsets: ['latin'],
});
export { sans };

/** A headline that slams in: oversized, then snaps to size with a short overshoot. */
export function Slam({
  children,
  at = 0,
  from = 1.9,
  size = 150,
  italic = false,
  color = colors.white,
  style,
}: {
  children: ReactNode;
  at?: number;
  /** Starting scale before it snaps to 1. */
  from?: number;
  size?: number;
  italic?: boolean;
  color?: string;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - at;
  if (t < 0) return null;
  const pop = spring({ frame: t, fps, config: { damping: 14, stiffness: 320, mass: 0.7 } });
  const scale = interpolate(pop, [0, 1], [from, 1]);
  const opacity = interpolate(t, [0, 2], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        fontFamily: serif,
        fontStyle: italic ? 'italic' : 'normal',
        fontWeight: 400,
        fontSize: size,
        lineHeight: 0.95,
        letterSpacing: '-0.03em',
        color,
        transform: `scale(${scale.toFixed(4)})`,
        opacity,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Small uppercase label in DM Sans. */
export function Label({
  children,
  color = colors.lavender,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: sans,
        fontWeight: 600,
        fontSize: 26,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Body line in DM Sans. */
export function Body({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: sans,
        fontWeight: 400,
        fontSize: 34,
        lineHeight: 1.3,
        color: colors.muted,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Rises a few pixels and fades in from `at`. */
export function rise(frame: number, at: number, fps: number, distance = 30): CSSProperties {
  const t = frame - at;
  const s = spring({ frame: Math.max(0, t), fps, config: { damping: 18, stiffness: 160 } });
  return {
    opacity: t < 0 ? 0 : interpolate(t, [0, 6], [0, 1], { extrapolateRight: 'clamp' }),
    transform: `translateY(${((1 - s) * distance).toFixed(2)}px)`,
  };
}
