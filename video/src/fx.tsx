// Treatments shared by every scene: the dark lavender stage, grain, scanlines, hit flashes,
// chromatic aberration, glitch slices and a vignette. All deterministic in the frame number.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { colors } from './theme';

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Night-ink stage with a lavender glow and the landing's dot grid. */
export function Backdrop({ glow = 0.5, children }: { glow?: number; children?: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: colors.ink }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 90% at 50% 115%, rgba(199,179,234,${(0.45 * glow).toFixed(3)}), transparent 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at center, rgba(199,179,234,0.16) 1.4px, transparent 2px)`,
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(80% 70% at 50% 60%, black 20%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(80% 70% at 50% 60%, black 20%, transparent 100%)',
        }}
      />
      {children}
    </AbsoluteFill>
  );
}

export function Grain({ amount = 0.12 }: { amount?: number }) {
  const frame = useCurrentFrame();
  const seed = (frame % 24) + 1;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity: amount }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${String(seed)}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed={seed}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${String(seed)})`} />
      </svg>
    </AbsoluteFill>
  );
}

export function Scanlines({ opacity = 0.18 }: { opacity?: number }) {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        opacity,
        backgroundImage:
          'repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0 2px, rgba(0,0,0,0.55) 2px 4px)',
      }}
    />
  );
}

export function Vignette({ strength = 0.7 }: { strength?: number }) {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `radial-gradient(75% 65% at 50% 50%, transparent 55%, rgba(0,0,0,${strength.toFixed(2)}) 100%)`,
      }}
    />
  );
}

/** A white (or tinted) flash that decays over a few frames; `at` is the frame it fires on. */
export function Flash({
  at,
  color = colors.white,
  peak = 0.9,
  decay = 5,
}: {
  at: number;
  color?: string;
  peak?: number;
  decay?: number;
}) {
  const frame = useCurrentFrame();
  const age = frame - at;
  if (age < 0 || age > decay * 4) return null;
  return (
    <AbsoluteFill
      style={{ background: color, opacity: peak * Math.exp(-age / decay), mixBlendMode: 'screen' }}
    />
  );
}

/** Red/blue channel split proportional to `amount` (pixels). Wrap any content. */
export function Aberration({ amount, children }: { amount: number; children: ReactNode }) {
  if (amount < 0.5) return <AbsoluteFill>{children}</AbsoluteFill>;
  const layer = (dx: number, filter: string): CSSProperties => ({
    transform: `translateX(${dx.toFixed(2)}px)`,
    filter,
    mixBlendMode: 'screen',
  });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={layer(-amount, 'url(#red)')}>{children}</AbsoluteFill>
      <AbsoluteFill style={layer(amount, 'url(#blue)')}>{children}</AbsoluteFill>
      <AbsoluteFill style={layer(0, 'url(#green)')}>{children}</AbsoluteFill>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="red">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
        </filter>
        <filter id="green">
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" />
        </filter>
        <filter id="blue">
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" />
        </filter>
      </svg>
    </AbsoluteFill>
  );
}

/** Horizontal slices shoved sideways for a frame or two around a hit. */
export function Glitch({ amount, children }: { amount: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  if (amount < 0.2) return <AbsoluteFill>{children}</AbsoluteFill>;
  const slices = 7;
  return (
    <AbsoluteFill>
      {Array.from({ length: slices }, (_, index) => {
        const top = (index / slices) * 100;
        const height = 100 / slices;
        const shift = (hash(frame * 13 + index) - 0.5) * 90 * amount;
        return (
          <AbsoluteFill
            key={index}
            style={{
              clipPath: `inset(${top.toFixed(2)}% 0 ${(100 - top - height).toFixed(2)}% 0)`,
              transform: `translateX(${shift.toFixed(1)}px)`,
            }}
          >
            {children}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
}

/** Camera shake offset for a frame, scaled by `amount` (pixels). */
export function shake(frame: number, amount: number): CSSProperties {
  if (amount < 0.5) return {};
  const x = (hash(frame * 7.1) - 0.5) * 2 * amount;
  const y = (hash(frame * 3.7 + 99) - 0.5) * 2 * amount;
  const r = (hash(frame * 5.3 + 7) - 0.5) * 0.4 * (amount / 10);
  return {
    transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg)`,
  };
}
