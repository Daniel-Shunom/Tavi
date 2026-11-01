// The four kinds of beat in config.ts, each a self-contained scene rendered inside a Sequence.
import { createContext, useContext } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { hitIndex, punch, type Pulse } from './audio';
import { copy, type Beat, type TaviMedia } from './config';
import { Aberration, Backdrop, Flash, Glitch, Grain, shake, Vignette } from './fx';
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
            <TaviClip shot="reveal" zoom={1.06} focus={[0.5, 0.63]} from={0.1} />
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

/** A facecam-style bubble of her reacting to what is on screen, bottom right. */
function Cameo({ media, at }: { media: TaviMedia; at: number }) {
  const local = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    frame: local - at,
    fps,
    config: { damping: 12, stiffness: 240, mass: 0.8 },
  });
  const size = 420;
  return (
    <div
      style={{
        position: 'absolute',
        right: 96,
        bottom: 72,
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        background: `radial-gradient(circle at 50% 40%, ${colors.raised}, ${colors.ink})`,
        border: `3px solid ${colors.lavender}`,
        boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(199,179,234,0.35)`,
        transform: `scale(${(local < at ? 0 : pop).toFixed(4)})`,
        transformOrigin: '50% 100%',
      }}
    >
      <TaviClip {...media} box={{ width: size, height: size }} />
    </div>
  );
}

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
        frames={beat.media.frames}
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
        {beat.cameo ? <Cameo media={beat.cameo} at={10} /> : null}
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

// Slot ------------------------------------------------------------------------------------------

/** Your own footage full frame (the stream-setup walkthrough), labelled top left. */
export function Slot({ beat }: { beat: Extract<Beat, { kind: 'slot' }> }) {
  const local = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: colors.ink }}>
      <Screen src={beat.src} zoom={[1, 1]} label={beat.eyebrow} />
      <div style={{ position: 'absolute', left: 64, top: 52, ...rise(local, 4, fps) }}>
        <Label>{beat.eyebrow}</Label>
      </div>
      <Flash at={0} color={colors.lavender} peak={0.45} decay={4} />
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
          <TaviClip shot="outro" zoom={1.0} focus={[0.5, 0.6]} from={0.1} />
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
