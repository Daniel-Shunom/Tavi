// Act one, before the drop. Reaction before reveal: chat is loud, the space where someone
// should be is empty (just a shadow on the floor), we catch glimpses of her, chat asks for her,
// and on the drop she pops up out of her own shadow.
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { Bubble, type Message } from './Bubble';
import { Dissolve, Stage } from './look';
import { Tavi, type Shot } from './Tavi';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Where she will stand: shared by the empty shot and the pop-up, so the shadow is the same spot. */
export const SPOT = { x: 960, y: 900 };

function FloorShadow({ opacity = 1 }: { opacity?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: SPOT.x - 190,
        top: SPOT.y - 26,
        width: 380,
        height: 52,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(46,36,53,0.22) 0%, rgba(46,36,53,0.08) 45%, transparent 72%)',
        opacity,
      }}
    />
  );
}

const chatter: Message[] = [
  { at: 0.6, name: 'pixelmoth', color: '#3a9be0', text: 'hiii 👋', x: 470, y: 330 },
  { at: 1.8, name: 'saltyfern', color: '#e0567f', text: 'LMAO', x: 1430, y: 270 },
  { at: 3.0, name: 'okkoro', color: '#3fa36b', text: 'that jump 😭', x: 1330, y: 640 },
  { at: 3.6, name: 'duskrider', color: '#d08a2c', text: 'gg', x: 560, y: 700 },
  { at: 4.2, name: 'mintlatte', color: '#8a5cc7', text: 'clip it!!', x: 930, y: 200 },
  { at: 4.8, name: 'pixelmoth', color: '#3a9be0', text: 'chat is SO loud', x: 1540, y: 470 },
];

/** 0–5.4 s: white, a shadow with nobody in it, and chat filling the room on the beat. */
export function Corner() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const push = interpolate(frame, [0, 5.4 * fps], [1, 1.07], { ...clamp, easing: Easing.bezier(0.33, 0, 0.2, 1) });
  const fadeIn = interpolate(frame, [0, 0.4 * fps], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <Stage />
      <AbsoluteFill style={{ transform: `scale(${push.toFixed(4)})`, transformOrigin: `${SPOT.x}px ${SPOT.y - 200}px` }}>
        <FloorShadow />
        {chatter.map((m, i) => (
          <Bubble key={i} {...m} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

const glimpses: { shot: Shot; from: number; height: number; at: [number, number]; focus: 'eyes' | 'head' | 'body' }[] = [
  { shot: 'hero', from: 0.4, height: 3.4, at: [0.5, 0.5], focus: 'eyes' },
  { shot: 'alive-b', from: 0.7, height: 1.8, at: [0.6, 0.42], focus: 'head' },
];

/** 5.4–7.8 s: two slow fragments of her, too close to see whole, dissolving into each other. */
export function Glimpse() {
  const { fps } = useVideoConfig();
  const len = Math.round(1.2 * fps);
  return (
    <AbsoluteFill>
      {glimpses.map((g, i) => (
        <Sequence key={i} from={i === 0 ? 0 : i * len - 8} durationInFrames={i === 0 ? len : len + 8}>
          <Dissolve frames={i === 0 ? 10 : 8}>
            <GlimpseShot {...g} index={i} />
          </Dissolve>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

function GlimpseShot({ shot, from, height, at, focus, index }: (typeof glimpses)[number] & { index: number }) {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 44], [0, 1], { ...clamp, easing: Easing.bezier(0.33, 0, 0.3, 1) });
  const push = 1 + 0.06 * drift;
  const pan = (index % 2 ? -1 : 1) * 30 * drift;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Stage />
      <AbsoluteFill style={{ transform: `translateX(${pan.toFixed(2)}px) scale(${push.toFixed(4)})` }}>
        <Tavi shot={shot} from={from} height={height} at={at} focus={focus} window={0.6} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/**
 * 7.8–11.4 s: the room empties, chat asks for her, and on the drop (local 2.4 s) she rises
 * out of the floor where her shadow has been waiting.
 */
export function Arrival() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = 2.4 * fps;
  const fadeIn = interpolate(frame, [0, 10], [0, 1], clamp);
  const shadow = interpolate(frame, [drop - 6, drop + 6], [1, 0], clamp);
  // Everything below the floor line is hidden, so she comes up through it.
  const floorClip = SPOT.y + 6;
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <Stage />
      <FloorShadow opacity={shadow} />
      <Bubble at={0.6} out={2.25} name="saltyfern" color="#e0567f" text="wait… where's tavi? 👀" x={SPOT.x} y={380} size={34} />
      <AbsoluteFill style={{ clipPath: `inset(0 0 ${1080 - floorClip}px 0)` }}>
        <Tavi shot="drop" from={-0.95} height={0.6} at={[SPOT.x / 1920, (SPOT.y + 4) / 1080]} focus="feet" window={5} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
