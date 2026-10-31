// Beat detection from the actual track, so cuts and punches land on the music rather than on a
// guessed tempo. Falls back to a fixed grid when no track is present.
import { useAudioData, visualizeAudio, type AudioData } from '@remotion/media-utils';
import { useEffect, useMemo, useState } from 'react';
import { continueRender, delayRender, staticFile, useVideoConfig } from 'remotion';
import { fallbackBpm, musicStart } from './config';

export interface Pulse {
  /** 0..1 low-end energy for each frame of the composition. */
  energy: number[];
  /** Frames where a hit lands (local maxima of energy above the running average). */
  hits: number[];
  /** True when the numbers came from a real track. */
  live: boolean;
}

/** Whether a file exists under public/; render waits for the answer. */
export function useExists(path: string | null): boolean | null {
  const [exists, setExists] = useState<boolean | null>(null);
  useEffect(() => {
    if (!path) return;
    const handle = delayRender(`exists ${path}`);
    let active = true;
    fetch(staticFile(path), { method: 'HEAD' })
      .then((response) => {
        if (active) setExists(response.ok);
      })
      .catch(() => {
        if (active) setExists(false);
      })
      .finally(() => {
        continueRender(handle);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return path ? exists : false;
}

function analyse(audio: AudioData, fps: number, frames: number): Pulse {
  const raw: number[] = [];
  const skip = Math.round(musicStart * fps);
  for (let frame = 0; frame < frames; frame++) {
    const bins = visualizeAudio({
      fps,
      frame: frame + skip,
      audioData: audio,
      numberOfSamples: 64,
    });
    // Kick and bass live in the lowest bins; ignore the DC bin.
    raw.push((bins[1] + bins[2] + bins[3]) / 3);
  }
  const peak = Math.max(...raw, 1e-6);
  const energy = raw.map((value) => value / peak);
  const hits: number[] = [];
  const window = Math.round(fps * 0.6);
  let last = -Infinity;
  for (let frame = 1; frame < frames - 1; frame++) {
    const slice = energy.slice(Math.max(0, frame - window), frame + window);
    const average = slice.reduce((sum, value) => sum + value, 0) / slice.length;
    const value = energy[frame];
    if (
      value > average * 1.35 &&
      value >= energy[frame - 1] &&
      value > energy[frame + 1] &&
      value > 0.25 &&
      frame - last >= Math.round(fps * 0.18)
    ) {
      hits.push(frame);
      last = frame;
    }
  }
  return { energy, hits, live: true };
}

function grid(fps: number, frames: number): Pulse {
  const step = (60 / fallbackBpm) * fps;
  const hits: number[] = [];
  for (let frame = 0; frame < frames; frame += step) hits.push(Math.round(frame));
  const energy = Array.from({ length: frames }, (_, frame) => {
    const phase = (frame % step) / step;
    return Math.max(0, 1 - phase * 3);
  });
  return { energy, hits, live: false };
}

/** The track's pulse for the whole composition. Only call when the track exists. */
export function useLivePulse(music: string): Pulse | null {
  const { fps, durationInFrames } = useVideoConfig();
  const audio = useAudioData(staticFile(music));
  return useMemo(
    () => (audio ? analyse(audio, fps, durationInFrames) : null),
    [audio, fps, durationInFrames],
  );
}

/** A metronome at fallbackBpm for when no track is present. */
export function useGridPulse(): Pulse {
  const { fps, durationInFrames } = useVideoConfig();
  return useMemo(() => grid(fps, durationInFrames), [fps, durationInFrames]);
}

/** Energy at a frame, with a quick decay so punches feel like impacts rather than swells. */
export function punch(pulse: Pulse, frame: number, decayFrames = 6): number {
  let best = 0;
  for (const hit of pulse.hits) {
    if (hit > frame) break;
    const age = frame - hit;
    if (age <= decayFrames * 3) best = Math.max(best, Math.exp(-age / decayFrames));
  }
  return best;
}

/** Index of the hit at or before this frame, for cutting between shots on the beat. */
export function hitIndex(pulse: Pulse, frame: number): number {
  let index = -1;
  for (const hit of pulse.hits) {
    if (hit > frame) break;
    index++;
  }
  return index;
}
