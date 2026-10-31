// The mood montage: one expression per cut, named, with a colour field that changes each cut.
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { moodGap, moodPeak } from '../capture/shots.mjs';
import type { Beat } from './config';
import { Aberration, Backdrop, Flash, Grain, shake, Vignette } from './fx';
import { usePulseAt } from './scenes';
import { TaviClip } from './TaviClip';
import { colors } from './theme';
import { Label, Slam, sans } from './type';

const tints = [colors.pink, colors.teal, colors.lavender, colors.mint];

export function Montage({
  beat,
  offset,
}: {
  beat: Extract<Beat, { kind: 'montage' }>;
  offset: number;
}) {
  const { frame, punch: hitPunch } = usePulseAt(offset);
  const local = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cutFrames = Math.round(beat.cutSeconds * fps);
  const index = Math.min(beat.cuts.length - 1, Math.floor(local / cutFrames));
  const cut = beat.cuts[index];
  const age = local - index * cutFrames;
  const snap = interpolate(age, [0, cutFrames], [1.1, 1.02], { extrapolateRight: 'clamp' });
  const tint = tints[index % tints.length];
  // Each reel plays its expressions `moodGap` apart; land on the peak of the chosen one.
  const peak = 0.4 + cut.index * moodGap + moodPeak;
  const side = index % 2 ? 0.6 : 0.4;
  return (
    <Backdrop glow={0.4}>
      <AbsoluteFill style={shake(frame, 4 * hitPunch)}>
        <AbsoluteFill
          style={{
            background: `radial-gradient(45% 60% at ${(side * 100).toFixed(0)}% 55%, ${tint}55, transparent 70%)`,
          }}
        />
        <Aberration amount={age === 0 ? 10 : 0}>
          <AbsoluteFill
            style={{ transform: `scale(${snap.toFixed(4)})`, transformOrigin: '50% 60%' }}
          >
            <TaviClip
              shot={cut.shot}
              from={peak - age / fps}
              zoom={1.75}
              focus={[0.5, 0.6]}
              anchor={[side, 0.52]}
            />
          </AbsoluteFill>
        </Aberration>
        <AbsoluteFill
          style={{
            background: `linear-gradient(0deg, ${colors.ink} 0%, rgba(16,15,23,0.5) 22%, transparent 45%)`,
          }}
        />
        <div style={{ position: 'absolute', left: 110, top: 86 }}>
          <Label>{beat.eyebrow}</Label>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 110,
            top: 84,
            fontFamily: sans,
            fontSize: 26,
            letterSpacing: '0.22em',
            color: colors.faint,
          }}
        >
          {String(index + 1).padStart(2, '0')} / {String(beat.cuts.length).padStart(2, '0')}
        </div>
        <div style={{ position: 'absolute', left: 110, bottom: 90 }}>
          <Slam
            key={index}
            at={0}
            from={1.35}
            size={168}
            italic
            color={colors.white}
            style={{ textAlign: 'left', transformOrigin: 'left bottom' }}
          >
            {cut.label}.
          </Slam>
        </div>
      </AbsoluteFill>
      {age === 0 ? <Flash at={0} color={tint} peak={0.35} decay={2} /> : null}
      <Grain amount={0.1} />
      <Vignette strength={0.5} />
    </Backdrop>
  );
}
