// Act two: no captions. She greets the viewer, answers chat with her face and body, then runs
// through her range on the beat. Every reaction follows the message that motivates it.
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { Bubble, type Message } from './Bubble';
import { Dissolve, ease, ink, sans, Stage } from './look';
import { SPOT } from './Tease';
import { Tavi, type Shot } from './Tavi';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 11.4–15.0 s: match cut from her landing to the greeting, same spot, then a slow push. */
export function Reveal() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const push = interpolate(frame, [0, 3.6 * fps], [1, 1.12], { ...clamp, easing: ease });
  return (
    <AbsoluteFill>
      <Stage tint={ink.lavender} strength={0.35} glow={[50, 50]} />
      <AbsoluteFill style={{ transform: `scale(${push.toFixed(4)})`, transformOrigin: `${SPOT.x}px 560px` }}>
        <Tavi shot="reveal" from={0.85} height={0.6} at={[SPOT.x / 1920, (SPOT.y + 4) / 1080]} focus="feet" window={4} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// Each message lands just before the reaction it causes (chatread capture cues, from 0.4 s).
const chat: Message[] = [
  { at: 0.05, name: 'pixelmoth', color: '#3a9be0', text: 'we hit 100 followers!!', x: 1330, y: 330 },
  { at: 1.3, name: 'saltyfern', color: '#e0567f', text: 'LMAO the jump scare', x: 1400, y: 500 },
  { at: 3.05, name: 'okkoro', color: '#3fa36b', text: 'BOO', x: 1230, y: 660 },
];

/** 15.0–19.8 s: chat speaks, she answers. The label keeps the demo honest. */
export function Reads() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = interpolate(frame, [0, 4.8 * fps], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Stage tint={ink.teal} strength={0.12} glow={[36, 52]} />
      <AbsoluteFill style={{ transform: `translateX(${(-16 * drift).toFixed(2)}px)` }}>
        <Tavi shot="chatread" from={0.4} height={0.66} at={[0.36, 0.87]} focus="feet" window={4} />
      </AbsoluteFill>
      {chat.map((m, i) => (
        <Bubble key={i} {...m} size={34} />
      ))}
      <div style={{ position: 'absolute', right: 56, bottom: 44, fontFamily: sans, fontSize: 16, color: ink.faint, letterSpacing: '0.04em' }}>
        Scripted demo
      </div>
    </AbsoluteFill>
  );
}

const moods: { shot: Shot; from: number; tint: string; x: number }[] = [
  { shot: 'alive-a', from: 0.75, tint: ink.pink, x: 0.5 },
  { shot: 'alive-b', from: 6.3, tint: ink.amber, x: 0.44 },
  { shot: 'alive-a', from: 3.75, tint: ink.lavender, x: 0.56 },
  { shot: 'alive-b', from: 2.1, tint: ink.teal, x: 0.5 },
];
export const MOOD_SECONDS = 1.2;

/** 19.8–24.6 s: one feeling every two beats; the colour behind her follows it. */
export function Feels() {
  const { fps } = useVideoConfig();
  const len = Math.round(MOOD_SECONDS * fps);
  return (
    <AbsoluteFill>
      {moods.map((m, i) => (
        <Sequence key={i} from={i === 0 ? 0 : i * len - 8} durationInFrames={i === moods.length - 1 ? undefined : len + 8}>
          <Dissolve frames={i === 0 ? 1 : 8}>
            <MoodShot {...m} />
          </Dissolve>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

function MoodShot({ shot, from, tint, x }: (typeof moods)[number]) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const push = interpolate(frame, [0, 1.6 * fps], [1, 1.05], { ...clamp, easing: ease });
  const bloom = interpolate(frame, [0, 12], [0.18, 0.28], clamp);
  return (
    <AbsoluteFill>
      <Stage tint={tint} strength={bloom} glow={[x * 100, 42]} />
      <AbsoluteFill style={{ transform: `scale(${push.toFixed(4)})`, transformOrigin: `${x * 100}% 42%` }}>
        <Tavi shot={shot} from={from} height={1.3} at={[x, 0.4]} focus="head" window={0.6} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
