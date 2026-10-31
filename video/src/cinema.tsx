// Cinematic dressing: 2.39:1 bars and a warm light leak.
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { colors } from './theme';

/** Cinema bars that can slide away; `amount` 0..1. */
export function Letterbox({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  const bar = 138 * amount;
  const style = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: bar,
    background: '#000',
  };
  return (
    <>
      <div style={{ ...style, top: 0 }} />
      <div style={{ ...style, bottom: 0 }} />
    </>
  );
}

/** A light leak that blooms from one side and fades out; `at` is the frame it starts on. */
export function LightLeak({
  at,
  from = 'right',
  life = 40,
}: {
  at: number;
  from?: 'left' | 'right';
  life?: number;
}) {
  const frame = useCurrentFrame();
  const age = frame - at;
  if (age < 0 || age > life) return null;
  const t = age / life;
  const opacity = Math.sin(Math.PI * Math.min(1, t)) * 0.75;
  const x = from === 'right' ? 110 - t * 50 : -10 + t * 50;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        opacity,
        background: `radial-gradient(60% 90% at ${x.toFixed(1)}% 40%, ${colors.pink}aa 0%, ${colors.lavender}66 35%, transparent 70%)`,
      }}
    />
  );
}
