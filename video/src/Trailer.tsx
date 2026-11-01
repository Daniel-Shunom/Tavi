// Assembles the timeline from config.ts, scores it with your track (ducked under the voiceover)
// and hands every scene the track's pulse so cuts and punches land on the music.
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion';
import type { ReactNode } from 'react';
import { useExists, useGridPulse, useLivePulse, type Pulse } from './audio';
import { files, musicStart, timeline, totalSeconds } from './config';
import { ChatBeat } from './ChatBeat';
import { Montage } from './Montage';
import { Feature, Outro, PulseContext, Reveal, Slot } from './scenes';
import { Tease } from './Tease';
import { colors } from './theme';

/** `audio: false` keeps the music-driven cuts but leaves the soundtrack out (for editing in Resolve). */
export function Trailer({ audio = true }: { audio?: boolean }) {
  const music = useExists(files.music);
  const voice = useExists(files.voiceover);
  if (music === null || voice === null) return <AbsoluteFill style={{ background: colors.ink }} />;
  return (
    <Scored music={music ? files.music : null} voice={voice ? files.voiceover : null} audio={audio}>
      <Scenes />
    </Scored>
  );
}

function Scored(props: {
  music: string | null;
  voice: string | null;
  audio: boolean;
  children: ReactNode;
}) {
  return props.music ? <LiveScore {...props} music={props.music} /> : <GridScore {...props} />;
}

function LiveScore(props: {
  music: string;
  voice: string | null;
  audio: boolean;
  children: ReactNode;
}) {
  const pulse = useLivePulse(props.music);
  if (!pulse) return null;
  return <Score {...props} pulse={pulse} />;
}

function GridScore(props: {
  music: string | null;
  voice: string | null;
  audio: boolean;
  children: ReactNode;
}) {
  const pulse = useGridPulse();
  return <Score {...props} pulse={pulse} />;
}

function Score({
  music,
  voice,
  pulse,
  audio,
  children,
}: {
  music: string | null;
  voice: string | null;
  audio: boolean;
  pulse: Pulse;
  children: ReactNode;
}) {
  const { fps } = useVideoConfig();
  const firstFeature = timeline.find((beat) => beat.kind === 'feature')?.at ?? 16;
  const outro = timeline.find((beat) => beat.kind === 'outro')?.at ?? totalSeconds;
  return (
    <PulseContext.Provider value={pulse}>
      {music && audio ? (
        <Audio
          src={staticFile(music)}
          startFrom={Math.round(musicStart * fps)}
          volume={(frame) => {
            // Full for the tease and reveal; under the voiceover (if any) through the features;
            // back up for the outro, then out.
            const seconds = frame / fps;
            const duck = voice ? 0.32 : 0.85;
            const level = interpolate(
              seconds,
              [
                0,
                firstFeature - 0.5,
                firstFeature + 0.5,
                outro - 0.5,
                outro + 0.5,
                totalSeconds - 1.5,
                totalSeconds,
              ],
              [1, 1, duck, duck, 0.9, 0.9, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );
            return level;
          }}
        />
      ) : null}
      {voice && audio ? <Audio src={staticFile(voice)} startFrom={0} /> : null}
      {children}
    </PulseContext.Provider>
  );
}

function Scenes() {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: colors.ink }}>
      {timeline.map((beat, index) => {
        const next = timeline[index + 1]?.at ?? totalSeconds;
        const from = Math.round(beat.at * fps);
        const duration = Math.round(next * fps) - from;
        const scene =
          beat.kind === 'tease' ? (
            <Tease offset={from} />
          ) : beat.kind === 'reveal' ? (
            <Reveal offset={from} />
          ) : beat.kind === 'feature' ? (
            <Feature beat={beat} offset={from} />
          ) : beat.kind === 'chat' ? (
            <ChatBeat beat={beat} offset={from} />
          ) : beat.kind === 'montage' ? (
            <Montage beat={beat} offset={from} />
          ) : beat.kind === 'slot' ? (
            <Slot beat={beat} />
          ) : (
            <Outro offset={from} />
          );
        return (
          <Sequence
            key={index}
            from={from}
            durationInFrames={duration}
            name={`${beat.kind} ${String(beat.at)}s`}
          >
            {scene}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
