// "Tell each other how we feel": a 45-second ad for Tavi, on white, told without captions.
// Direction notes live in video/AD.md; the music edit and scene cues in ./timing.ts.
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Fade, Finish, ease, ink, Line, sans, Stage, Wordmark } from './look';
import { Arrival, Corner, Glimpse } from './Tease';
import { Feels, MOOD_SECONDS, Reads, Reveal } from './Meet';
import { chatAt, Cheer, cheerBubbles, Lives, Quiet, Studio } from './Live';
import { openaiPath, twitchPath } from './marks';
import { Tavi } from './Tavi';
import { cue, FPS, music, sec } from './timing';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

function Glyph({ d, color, size }: { d: string; color: string; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: 'block' }}>
      <path d={d} fill={color} />
    </svg>
  );
}

/** 39.0–45.0 s: the name, one line, the credit, and Tavi beside it waving goodbye. */
function EndCard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = interpolate(frame, [4, 1.0 * fps], [0, 1], { ...clamp, easing: ease });
  const credit = interpolate(frame, [1.7 * fps, 2.5 * fps], [0, 1], { ...clamp, easing: ease });
  const drift = interpolate(frame, [0, 6 * fps], [1.03, 1], { ...clamp, easing: ease });
  return (
    <Fade inFrames={8} outFrames={Math.round(1.2 * fps)}>
      <AbsoluteFill style={{ transform: `scale(${drift.toFixed(4)})` }}>
        <Stage tint={ink.lavender} strength={0.32} glow={[71, 52]} />
        <Tavi shot="outro" from={0.3} height={0.6} at={[0.71, 0.86]} focus="feet" window={4} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 230, top: 330, width: 900 }}>
        <Wordmark
          size={150}
          style={{ opacity: mark, transform: `translateY(${((1 - mark) * 24).toFixed(2)}px)`, filter: mark < 1 ? `blur(${((1 - mark) * 10).toFixed(2)}px)` : undefined }}
        />
        <div style={{ height: 30 }} />
        <Line size={64} align="left" at={0.7 * fps}>
          Make your stream
        </Line>
        <Line size={64} align="left" italic color={ink.plum} at={0.95 * fps}>
          feel more alive.
        </Line>
        <div
          style={{
            marginTop: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            fontFamily: sans,
            fontSize: 25,
            color: ink.text,
            opacity: credit,
            transform: `translateY(${((1 - credit) * 12).toFixed(2)}px)`,
          }}
        >
          <span>Built for the Twitch × Codex hackathon</span>
          <span style={{ width: 1, height: 30, background: 'rgba(46,36,53,0.18)' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Glyph d={twitchPath} color="#9146FF" size={34} />
            <span style={{ color: ink.faint, fontSize: 20 }}>×</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9, color: ink.text, fontWeight: 600 }}>
              <Glyph d={openaiPath} color={ink.text} size={31} />
              Codex
            </span>
          </span>
        </div>
      </div>
    </Fade>
  );
}

function Music() {
  const { fps } = useVideoConfig();
  const splice = sec(music.b.at);
  const end = sec(cue.out);
  return (
    <>
      <Sequence durationInFrames={splice + 2}>
        <Audio
          src={staticFile(music.src)}
          trimBefore={Math.round(music.a.from * fps)}
          volume={(f) => interpolate(f, [0, 10, splice - 1, splice + 2], [0, 0.8, 0.8, 0], clamp)}
        />
      </Sequence>
      <Sequence from={splice - 1}>
        <Audio
          src={staticFile(music.src)}
          trimBefore={Math.round(music.b.from * fps) - 1}
          volume={(f) => interpolate(f, [0, 3, end - splice - 60, end - splice + 1], [0, 0.8, 0.8, 0], clamp)}
        />
      </Sequence>
    </>
  );
}

type Sfx = 'blip-0' | 'blip-1' | 'blip-2' | 'blip-3' | 'blip-4' | 'whoosh-soft' | 'whoosh-long' | 'arrive' | 'click' | 'shimmer' | 'cheer';
const blips: Sfx[] = ['blip-0', 'blip-2', 'blip-1', 'blip-3', 'blip-4', 'blip-2'];

/**
 * The cue sheet, in ad seconds. Whooshes start early so their peak lands on the move they
 * accompany (whoosh-soft peaks 0.8 s in, whoosh-long 1.7 s in, arrive's chime 0.75 s in).
 */
const sfx: [number, Sfx, number][] = [
  // Chat fills the empty room.
  ...[0.6, 1.8, 3.0, 3.6, 4.2, 4.8].map((t, i) => [t, blips[i], 0.32] as [number, Sfx, number]),
  // Glimpses drift past the lens.
  [cue.glimpse - 0.7, 'whoosh-soft', 0.28],
  [cue.glimpse + 1.2 - 0.75, 'whoosh-soft', 0.22],
  // Chat asks for her; she rises on the drop.
  [cue.arrival + 0.6, 'blip-3', 0.36],
  [cue.drop - 0.75, 'arrive', 0.5],
  // The slow push on the greeting.
  [cue.reveal - 0.4, 'whoosh-long', 0.2],
  // Each message lands just before her reaction.
  ...[0.05, 1.3, 3.05].map((t, i) => [cue.reads + t, blips[i + 1], 0.34] as [number, Sfx, number]),
  // Each feeling dissolves in on a breath of air.
  ...[1, 2, 3].map((i) => [cue.feels + i * MOOD_SECONDS - 0.8, 'whoosh-soft', 0.16] as [number, Sfx, number]),
  // The camera travels into the stream; chat ticks along quietly.
  [cue.lives - 0.2, 'whoosh-long', 0.24],
  ...[0, 1, 2].map((i) => [cue.lives + chatAt(i), blips[i + 2], 0.2] as [number, Sfx, number]),
  // Studio settles into place, then each screen changes with a felt click.
  [cue.studio - 0.7, 'whoosh-soft', 0.24],
  [cue.studio + 1.33, 'click', 0.32],
  [cue.studio + 2.93, 'click', 0.32],
  // Quiet mode on.
  [cue.quiet + 14 / FPS, 'click', 0.4],
  // The big moment.
  [cue.cheer, 'cheer', 0.4],
  ...cheerBubbles.slice(1).map((b, i) => [cue.cheer + b.at, blips[i + 3], 0.28] as [number, Sfx, number]),
  // Sign-off.
  [cue.end - 0.6, 'whoosh-soft', 0.22],
  [cue.end + 0.15, 'shimmer', 0.36],
];

function Effects() {
  return (
    <>
      {sfx.map(([at, name, volume], i) => (
        <Sequence key={i} from={sec(at)} name={`sfx ${name}`}>
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
        </Sequence>
      ))}
    </>
  );
}

const scenes: [number, number, () => React.ReactNode][] = [
  [cue.corner, cue.glimpse, () => <Corner />],
  [cue.glimpse, cue.arrival, () => <Glimpse />],
  [cue.arrival, cue.reveal, () => <Arrival />],
  [cue.reveal, cue.reads, () => <Reveal />],
  [cue.reads, cue.feels, () => <Reads />],
  [cue.feels, cue.lives, () => <Feels />],
  [cue.lives, cue.studio, () => <Lives />],
  [cue.studio, cue.quiet, () => <Studio />],
  [cue.quiet, cue.cheer, () => <Quiet />],
  [cue.cheer, cue.end, () => <Cheer />],
  [cue.end, cue.out, () => <EndCard />],
];

export function Ad({ audio = true }: { audio?: boolean }) {
  return (
    <AbsoluteFill style={{ background: ink.paper, fontFamily: sans }}>
      {scenes.map(([from, to, render]) => (
        <Sequence key={from} from={sec(from)} durationInFrames={sec(to) - sec(from)} name={`${from}s`}>
          {render()}
        </Sequence>
      ))}
      <Finish />
      {audio ? (
        <>
          <Music />
          <Effects />
        </>
      ) : null}
    </AbsoluteFill>
  );
}

export const AD_FRAMES = sec(cue.out);
