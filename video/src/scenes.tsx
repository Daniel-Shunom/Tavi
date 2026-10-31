// The four kinds of beat in config.ts, each a self-contained scene rendered inside a Sequence.
import { createContext, useContext } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { hitIndex, punch, type Pulse } from './audio';
import { copy, type Beat, type TaviMedia } from './config';
import { Aberration, Backdrop, Flash, Glitch, Grain, Scanlines, shake, Vignette } from './fx';
import { Letterbox, LightLeak } from './cinema';
import { Screen } from './Screen';
import { TaviClip } from './TaviClip';
import { colors } from './theme';
import { Body, Label, rise, Slam, sans } from './type';

export const PulseContext = createContext<Pulse>({ energy: [], hits: [], live: false });
/** The pulse is composition-wide; `offset` is the frame this scene starts on. */
export function usePulseAt(offset: number) {
  const pulse = useContext(PulseContext);
  const frame = useCurrentFrame() + offset;
  const hit = hitIndex(pulse, frame);
  const lastHit = hit >= 0 ? pulse.hits[hit] : -999;
  return { pulse, frame, hit, lastHit, age: frame - lastHit, punch: punch(pulse, frame) };
}

// Tease -----------------------------------------------------------------------------------------

/** Extreme close-ups of the hero capture; focus is a point of the capture (0..1). */
const closeups: { zoom: number; focus: [number, number]; from: number }[] = [
  { zoom: 6.5, focus: [0.46, 0.585], from: 0.6 }, // left eye through the glasses
  { zoom: 4.2, focus: [0.5, 0.52], from: 3.0 }, // hair and brow, mid wave
  { zoom: 7, focus: [0.56, 0.585], from: 1.2 }, // right eye
  { zoom: 5, focus: [0.5, 0.65], from: 5.4 }, // the grin
  { zoom: 3.6, focus: [0.62, 0.74], from: 2.9 }, // the waving hand
  { zoom: 4.6, focus: [0.42, 0.5], from: 7.2 }, // hair swing, excited
  { zoom: 2.6, focus: [0.5, 0.6], from: 9.3 }, // shocked, nearly the whole face
  { zoom: 5.5, focus: [0.5, 0.6], from: 11.0 }, // laugh
];

/**
 * Cut points for the tease. The track's own hits when its intro has them; otherwise (a quiet,
 * building intro like the one this trailer is scored to) an accelerating grid: cuts start slow
 * and tighten toward the reveal, which is the oldest trick in the trailer book for a reason.
 */
function teaseCuts(pulse: Pulse, offset: number, duration: number, fps: number): number[] {
  const own = pulse.hits.filter((h) => h >= offset && h < offset + duration).map((h) => h - offset);
  if (own.length >= 8) return own;
  const cuts: number[] = [];
  let t = fps * 1.6;
  let gap = fps * 1.1;
  while (t < duration - fps * 0.25) {
    cuts.push(Math.round(t));
    t += gap;
    gap = Math.max(fps * 0.22, gap * 0.86);
  }
  return cuts;
}

export function Tease({ offset }: { offset: number }) {
  const { frame, pulse } = usePulseAt(offset);
  const { fps, durationInFrames } = useVideoConfig();
  const local = useCurrentFrame();
  const cuts = teaseCuts(pulse, offset, durationInFrames, fps);
  const hit = cuts.filter((c) => c <= local).length - 1;
  const age = hit >= 0 ? local - cuts[hit] : 999;
  const hitPunch = hit >= 0 ? Math.exp(-age / 6) : 0;
  // Early hits are pure silhouette; light creeps in as the tease goes on.
  const progress = local / durationInFrames;
  const brightness = interpolate(progress, [0, 0.35, 0.8, 1], [0, 0.08, 0.45, 0.62]);
  const breathing = 0.5 + 0.5 * Math.sin(local / 11);
  const cue = hit < 0 ? -1 : hit % 6; // 0..5 pattern: clip, clip, text, clip, text, clip
  const textAt = cue === 2 || cue === 4;
  const lineIndex = Math.floor(Math.max(0, hit) / 3) % copy.teaseLines.length;
  const shot = closeups[Math.max(0, hit) % closeups.length];
  const scale = 1 + 0.12 * hitPunch + 0.015 * breathing;
  const dark = hit < 0;
  return (
    <Backdrop glow={0.15 + 0.35 * hitPunch}>
      <AbsoluteFill style={shake(frame, 14 * hitPunch)}>
        <Glitch amount={age <= 1 ? 1 : 0}>
          <Aberration amount={16 * hitPunch}>
            {textAt && !dark ? (
              <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Slam at={0} size={196} italic color={colors.white}>
                  {copy.teaseLines[lineIndex]}
                </Slam>
              </AbsoluteFill>
            ) : (
              <AbsoluteFill
                style={{
                  transform: `scale(${scale.toFixed(4)})`,
                  filter: `brightness(${(dark ? 0.03 + 0.03 * breathing : brightness).toFixed(3)}) contrast(1.25) saturate(1.15)`,
                }}
              >
                <TaviClip
                  shot="hero"
                  zoom={dark ? 1.3 : shot.zoom}
                  focus={dark ? [0.5, 0.6] : shot.focus}
                  from={dark ? 0.2 : shot.from}
                />
              </AbsoluteFill>
            )}
          </Aberration>
        </Glitch>
        {/* A rim of lavender light sweeping over the silhouette so the shape reads in the dark. */}
        <AbsoluteFill
          style={{
            mixBlendMode: 'screen',
            opacity: dark ? 0.35 : 0.22,
            background: `linear-gradient(${(100 + local * 2).toFixed(0)}deg, transparent 40%, ${colors.lavender}55 50%, transparent 60%)`,
          }}
        />
      </AbsoluteFill>
      {cuts.map((c) => (
        <Flash key={c} at={c} color={colors.lavender} peak={0.35} decay={3} />
      ))}
      <Scanlines opacity={0.22} />
      <Grain amount={0.18} />
      <Vignette strength={0.85} />
      <Letterbox amount={1} />
      {/* Count-in strip: a thin lavender bar that fills to the reveal. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 138,
          height: 5,
          width: `${(progress * 100).toFixed(2)}%`,
          background: colors.lavender,
          opacity: 0.8,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 64,
          bottom: 168,
          fontFamily: sans,
          fontSize: 22,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: colors.faint,
          opacity: interpolate(local, [fps, fps * 2], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        A companion for your stream
      </div>
    </Backdrop>
  );
}

// Reveal ----------------------------------------------------------------------------------------

export function Reveal({ offset }: { offset: number }) {
  const { frame, punch: hitPunch } = usePulseAt(offset);
  const local = useCurrentFrame();
  const { fps } = useVideoConfig();
  // She pops in from nothing with an overshoot, already mid-wave.
  const pop = spring({ frame: local, fps, config: { damping: 11, stiffness: 260, mass: 0.9 } });
  const scale = interpolate(pop, [0, 1], [0.2, 1]) * (1 + 0.05 * hitPunch);
  const ring = interpolate(local, [0, 22], [0, 1], { extrapolateRight: 'clamp' });
  const nameAt = 7;
  const taglineAt = 26;
  return (
    <Backdrop glow={1}>
      <AbsoluteFill style={shake(frame, 10 * hitPunch)}>
        {/* Shockwave */}
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: 300 + ring * 2400,
              height: 300 + ring * 2400,
              borderRadius: '50%',
              border: `${(26 * (1 - ring)).toFixed(1)}px solid ${colors.lavender}`,
              opacity: 1 - ring,
            }}
          />
        </AbsoluteFill>
        {/* Name behind her */}
        <AbsoluteFill
          style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: 150 }}
        >
          <Slam
            at={nameAt}
            size={400}
            color={colors.white}
            style={{ letterSpacing: '0.12em', opacity: 0.9 }}
          >
            {copy.name}
          </Slam>
        </AbsoluteFill>
        <Aberration amount={10 * hitPunch}>
          <AbsoluteFill
            style={{ transform: `scale(${scale.toFixed(4)})`, transformOrigin: '50% 86%' }}
          >
            <TaviClip shot="hero" zoom={1.06} focus={[0.5, 0.63]} from={2.55} />
          </AbsoluteFill>
        </Aberration>
        <AbsoluteFill
          style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 56 }}
        >
          <div style={{ ...rise(local, taglineAt, fps, 40), textAlign: 'center' }}>
            <Body
              style={{
                fontSize: 44,
                color: colors.white,
                fontStyle: 'italic',
                fontFamily: 'Georgia, serif',
              }}
            >
              {copy.tagline}
            </Body>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
      <LightLeak at={0} from="right" life={46} />
      <Flash at={0} color={colors.white} peak={1} decay={2.5} />
      <Flash at={nameAt} color={colors.lavender} peak={0.4} decay={2.5} />
      <Grain amount={0.1} />
      <Vignette strength={0.5} />
      {/* The bars let go as she lands and the trailer opens up to full frame. */}
      <Letterbox
        amount={interpolate(local, [4, 26], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}
      />
    </Backdrop>
  );
}

// Feature ---------------------------------------------------------------------------------------

export function Feature({
  beat,
  offset,
}: {
  beat: Extract<Beat, { kind: 'feature' }>;
  offset: number;
}) {
  const { frame, punch: hitPunch } = usePulseAt(offset);
  const local = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const entry = spring({ frame: local, fps, config: { damping: 16, stiffness: 180 } });
  const settle = interpolate(entry, [0, 1], [1.12, 1]);
  const isScreen = beat.media.type === 'screen' || beat.media.type === 'clip';
  const tavi =
    beat.media.type === 'tavi'
      ? beat.media
      : beat.media.type === 'clip'
        ? beat.media.fallback
        : null;
  const media =
    beat.media.type === 'tavi' ? (
      <TaviClip {...beat.media} />
    ) : beat.media.type === 'screen' ? (
      <Screen
        src={beat.media.src}
        from={beat.media.from}
        zoom={beat.media.zoom}
        focus={beat.media.focus}
        label={beat.eyebrow}
      />
    ) : (
      <ClipOrFallback src={beat.media.src} fallback={tavi!} label={beat.eyebrow} />
    );
  const outro = interpolate(local, [durationInFrames - 8, durationInFrames], [1, 0.96], {
    extrapolateLeft: 'clamp',
  });
  return (
    <Backdrop glow={0.6 + 0.3 * hitPunch}>
      <AbsoluteFill style={{ ...shake(frame, 6 * hitPunch) }}>
        <Glitch amount={local <= 1 ? 1 : 0}>
          <AbsoluteFill
            style={{ transform: `scale(${(settle * outro * (1 + 0.03 * hitPunch)).toFixed(4)})` }}
          >
            {isScreen ? (
              <AbsoluteFill
                style={{ alignItems: 'center', justifyContent: 'center', paddingLeft: 560 }}
              >
                <div
                  style={{
                    width: 1240,
                    height: 698,
                    borderRadius: 28,
                    overflow: 'hidden',
                    border: `2px solid ${colors.line}`,
                    boxShadow: `0 60px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(199,179,234,0.15), 0 0 120px rgba(199,179,234,${(0.25 + 0.3 * hitPunch).toFixed(2)})`,
                    position: 'relative',
                    transform: `perspective(2400px) rotateY(-6deg) translateX(${(40 * (1 - entry)).toFixed(1)}px)`,
                    background: colors.panel,
                  }}
                >
                  {media}
                </div>
              </AbsoluteFill>
            ) : (
              media
            )}
          </AbsoluteFill>
        </Glitch>
        {/* Scrim so the headline reads over anything */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(90deg, ${colors.ink} 22%, rgba(16,15,23,0.75) 42%, transparent 62%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 110,
            top: 0,
            bottom: 0,
            width: 760,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 28,
          }}
        >
          <div style={rise(local, 2, fps)}>
            <Label>{beat.eyebrow}</Label>
          </div>
          <Slam
            at={4}
            from={1.22}
            size={118}
            italic
            color={colors.white}
            style={{ textAlign: 'left', whiteSpace: 'normal', transformOrigin: 'left center' }}
          >
            {beat.headline}
          </Slam>
          {beat.sub ? (
            <div style={rise(local, 12, fps)}>
              <Body>{beat.sub}</Body>
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
      <Flash at={0} color={colors.lavender} peak={0.55} decay={4} />
      <Grain amount={0.08} />
      <Vignette strength={0.55} />
    </Backdrop>
  );
}

function ClipOrFallback({
  src,
  fallback,
  label,
}: {
  src: string;
  fallback: TaviMedia;
  label: string;
}) {
  // The Screen component checks the file; while unknown it renders nothing, so show the fallback
  // beneath it and let the clip cover it when present.
  return (
    <AbsoluteFill>
      <TaviClip {...fallback} />
      <Screen src={src} label={label} />
    </AbsoluteFill>
  );
}

// Outro -----------------------------------------------------------------------------------------

export function Outro({ offset }: { offset: number }) {
  const { frame, punch: hitPunch } = usePulseAt(offset);
  const local = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const fade = interpolate(local, [durationInFrames - fps * 1.5, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <Backdrop glow={1}>
      <AbsoluteFill style={shake(frame, 5 * hitPunch)}>
        <AbsoluteFill style={{ left: '22%' }}>
          <TaviClip shot="hero" zoom={1.0} focus={[0.5, 0.6]} from={14.7} />
        </AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: 110,
            top: 0,
            bottom: 0,
            width: 860,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 30,
          }}
        >
          <Slam
            at={2}
            from={1.22}
            size={150}
            color={colors.white}
            style={{ textAlign: 'left', transformOrigin: 'left center' }}
          >
            {copy.outro.headline}
          </Slam>
          <div style={rise(local, 10, fps)}>
            <Body style={{ fontSize: 40, color: colors.lavender }}>{copy.outro.sub}</Body>
          </div>
          <div style={{ ...rise(local, 18, fps), display: 'flex' }}>
            <div
              style={{
                fontFamily: sans,
                fontWeight: 600,
                fontSize: 34,
                color: colors.ink,
                background: colors.lavender,
                padding: '18px 36px',
                borderRadius: 999,
                boxShadow: `0 0 80px rgba(199,179,234,0.5)`,
              }}
            >
              {copy.outro.cta}
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Flash at={0} color={colors.white} peak={0.8} decay={5} />
      <Grain amount={0.08} />
      <Vignette strength={0.5} />
      <AbsoluteFill style={{ background: colors.ink, opacity: fade }} />
    </Backdrop>
  );
}
