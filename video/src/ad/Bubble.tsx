// A chat message as a floating card: chat is the only "dialogue" in the film.
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ink, sans } from './look';

export interface Message {
  /** Local seconds it pops in. */
  at: number;
  name: string;
  color: string;
  text: string;
  x: number;
  y: number;
  /** Local seconds it leaves (optional). */
  out?: number;
  size?: number;
}

export function Bubble({ at, name, color, text, x, y, out, size = 30 }: Message) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - at * fps;
  if (local < 0) return null;
  const pop = spring({ frame: local, fps, config: { damping: 13, stiffness: 210, mass: 0.8 } });
  const leave =
    out === undefined
      ? 0
      : interpolate(frame, [out * fps, out * fps + 8], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
  const float = -local * 0.35;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + float,
        transform: `translate(-50%, -50%) scale(${(0.7 + 0.3 * pop - 0.15 * leave).toFixed(4)})`,
        opacity: Math.min(1, pop * 1.4) * (1 - leave),
        padding: `${size * 0.5}px ${size * 0.75}px`,
        borderRadius: size * 0.9,
        background: '#ffffff',
        boxShadow: '0 18px 48px rgba(46,36,53,0.13), 0 2px 6px rgba(46,36,53,0.06)',
        fontFamily: sans,
        fontSize: size,
        color: ink.text,
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: size * 0.4,
      }}
    >
      <span
        style={{
          width: size * 0.32,
          height: size * 0.32,
          borderRadius: 99,
          background: color,
          flex: 'none',
        }}
      />
      <span style={{ color, fontWeight: 600, filter: 'saturate(1.4) brightness(0.8)' }}>
        {name}
      </span>
      <span>{text}</span>
    </div>
  );
}
