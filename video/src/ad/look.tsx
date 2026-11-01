// The ad's look: Tavi's Studio palette (DESIGN.md) lit like a product film. Aubergine dark,
// lavender light, Georgia display type, DM Sans labels, the Manrope wordmark.
import { loadFont as loadDmSans } from '@remotion/google-fonts/DMSans';
import { loadFont as loadManrope } from '@remotion/google-fonts/Manrope';
import type { CSSProperties, ReactNode } from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  random,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const { fontFamily: sans } = loadDmSans('normal', {
  weights: ['400', '500', '600'],
  subsets: ['latin'],
});
export const { fontFamily: wordmarkFont } = loadManrope('normal', {
  weights: ['800'],
  subsets: ['latin'],
});
export const serif = "Georgia, 'Times New Roman', serif";

export const ink = {
  // A white product film: paper, soft grey shadow, aubergine type, plum italic accent.
  paper: '#ffffff',
  mist: '#f6f3f8',
  shadow: 'rgba(46,36,53,0.10)',
  text: '#1d1722',
  soft: '#6f6577',
  faint: '#a39aab',
  plum: '#6c4f86',
  // Studio's own dark tones, for product UI shown inside the film.
  canvas: '#141116',
  inspector: '#231e28',
  white: '#f0e9ed',
  lavender: '#dcc5ee',
  lilac: '#b79bd6',
  pink: '#ec2a63',
  teal: '#5ec8d8',
  mint: '#8fd3b0',
  amber: '#f3b27a',
};

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** White stage: paper, a whisper of colour behind the subject, a soft floor line. */
export function Stage({
  glow = [50, 55],
  tint,
  strength = 0.16,
  children,
}: {
  glow?: [number, number];
  tint?: string;
  strength?: number;
  children?: ReactNode;
}) {
  const alpha = Math.round(strength * 255)
    .toString(16)
    .padStart(2, '0');
  return (
    <AbsoluteFill style={{ background: ink.paper, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 70% at 50% 40%, ${ink.paper} 0%, ${ink.mist} 100%)`,
        }}
      />
      {tint ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 34% 44% at ${glow[0]}% ${glow[1]}%, ${tint}${alpha} 0%, transparent 70%)`,
          }}
        />
      ) : null}
      {children}
    </AbsoluteFill>
  );
}

/** Film finish: the faintest grain, so the white reads as paper rather than a blank screen. */
export function Finish() {
  const frame = useCurrentFrame();
  const seed = Math.floor(random(`grain-${frame}`) * 1000);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', opacity: 0.035, mixBlendMode: 'multiply' }}
      >
        <filter id={`grain-${frame}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            seed={seed}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${frame})`} />
      </svg>
    </AbsoluteFill>
  );
}

/**
 * A line of display type that arrives word by word: each word rises out of a soft blur.
 * `at` is the local frame it starts; `out` the local frame it starts leaving (optional).
 */
export function Line({
  children,
  at = 0,
  out,
  size = 84,
  color = ink.text,
  italic = false,
  font = serif,
  weight = 400,
  stagger = 2.2,
  tracking = '-0.025em',
  align = 'center',
  style,
}: {
  children: string;
  at?: number;
  out?: number;
  size?: number;
  color?: string;
  italic?: boolean;
  font?: string;
  weight?: number;
  stagger?: number;
  tracking?: string;
  align?: CSSProperties['textAlign'];
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = children.split(' ');
  const leave =
    out === undefined
      ? 0
      : interpolate(frame, [out, out + 0.35 * fps], [0, 1], { ...clamp, easing: easeInOut });
  return (
    <div
      style={{
        fontFamily: font,
        fontStyle: italic ? 'italic' : 'normal',
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: tracking,
        color,
        textAlign: align,
        opacity: 1 - leave,
        filter: leave > 0 ? `blur(${(leave * 10).toFixed(2)}px)` : undefined,
        ...style,
      }}
    >
      {words.map((word, i) => {
        const start = at + i * stagger;
        const t = interpolate(frame, [start, start + 0.7 * fps], [0, 1], {
          ...clamp,
          easing: ease,
        });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: t,
              transform: `translateY(${((1 - t) * 0.42).toFixed(3)}em)`,
              filter: t < 1 ? `blur(${((1 - t) * 14).toFixed(2)}px)` : undefined,
              marginRight: i < words.length - 1 ? '0.26em' : 0,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

export function Wordmark({
  size = 120,
  color = ink.text,
  style,
}: {
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: wordmarkFont,
        fontWeight: 800,
        fontSize: size,
        letterSpacing: '-0.045em',
        lineHeight: 1,
        color,
        display: 'flex',
        alignItems: 'flex-start',
        ...style,
      }}
    >
      tavi
      <span
        style={{
          color: ink.plum,
          fontSize: size * 0.32,
          marginLeft: size * 0.05,
          marginTop: size * 0.1,
        }}
      >
        ✳
      </span>
    </div>
  );
}

/** Fades its children in over the first `frames` of its sequence: a soft dissolve between shots. */
export function Dissolve({ frames = 8, children }: { frames?: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: interpolate(frame, [0, frames], [0, 1], clamp) }}>
      {children}
    </AbsoluteFill>
  );
}

/** Fade the whole scene in from / out to black on its edges, in frames. */
export function Fade({
  inFrames = 0,
  outFrames = 0,
  children,
}: {
  inFrames?: number;
  outFrames?: number;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const a = inFrames ? interpolate(frame, [0, inFrames], [0, 1], clamp) : 1;
  const b = outFrames
    ? interpolate(frame, [durationInFrames - outFrames, durationInFrames], [1, 0], clamp)
    : 1;
  return <AbsoluteFill style={{ opacity: Math.min(a, b) }}>{children}</AbsoluteFill>;
}
