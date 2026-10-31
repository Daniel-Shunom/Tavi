// The chat beat: simulated chat lines pop into a panel and she reacts to each one in turn.
// The lines are a demo script, labelled as such on screen; nothing here is live or AI.
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Beat } from './config';
import { Backdrop, Flash, Glitch, Grain, shake, Vignette } from './fx';
import { usePulseAt } from './scenes';
import { TaviClip } from './TaviClip';
import { colors } from './theme';
import { Body, Label, rise, Slam, sans } from './type';

const tones = {
  pink: colors.pink,
  teal: colors.teal,
  mint: colors.mint,
  lavender: colors.lavender,
};

export function ChatBeat({
  beat,
  offset,
}: {
  beat: Extract<Beat, { kind: 'chat' }>;
  offset: number;
}) {
  const { frame, punch: hitPunch } = usePulseAt(offset);
  const local = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entry = spring({ frame: local, fps, config: { damping: 16, stiffness: 180 } });
  const visible = beat.messages.filter((message) => message.at * fps <= local);
  const scale = interpolate(entry, [0, 1], [1.1, 1]) * (1 + 0.03 * hitPunch);
  return (
    <Backdrop glow={0.7 + 0.3 * hitPunch}>
      <AbsoluteFill style={shake(frame, 5 * hitPunch)}>
        <Glitch amount={local <= 1 ? 1 : 0}>
          <AbsoluteFill style={{ transform: `scale(${scale.toFixed(4)})` }}>
            <TaviClip {...beat.media} />
          </AbsoluteFill>
        </Glitch>
        <AbsoluteFill
          style={{
            background: `linear-gradient(90deg, ${colors.ink} 20%, rgba(16,15,23,0.7) 38%, transparent 55%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 110,
            top: 0,
            bottom: 0,
            width: 700,
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
            size={112}
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
        {/* The chat column: newest at the bottom, like a real chat panel. */}
        <div
          style={{
            position: 'absolute',
            right: 72,
            bottom: 96,
            width: 470,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: 14,
          }}
        >
          {visible.map((message, index) => {
            const at = Math.round(message.at * fps);
            const pop = spring({
              frame: local - at,
              fps,
              config: { damping: 13, stiffness: 300, mass: 0.6 },
            });
            const latest = index === visible.length - 1;
            return (
              <div
                key={message.at}
                style={{
                  transform: `translateY(${((1 - pop) * 40).toFixed(1)}px) scale(${(0.9 + 0.1 * pop).toFixed(3)})`,
                  transformOrigin: 'left bottom',
                  opacity: latest ? 1 : 0.55,
                  background: latest ? 'rgba(34,31,44,0.92)' : 'rgba(34,31,44,0.7)',
                  border: `1px solid ${latest ? colors.line : 'transparent'}`,
                  borderRadius: 16,
                  padding: '14px 18px',
                  fontFamily: sans,
                  fontSize: 27,
                  lineHeight: 1.3,
                  color: colors.white,
                  boxShadow: latest ? '0 20px 50px rgba(0,0,0,0.45)' : 'none',
                }}
              >
                <span style={{ fontWeight: 700, color: tones[message.tone ?? 'lavender'] }}>
                  {message.user}
                </span>
                <span style={{ color: colors.faint }}>: </span>
                {message.text}
              </div>
            );
          })}
          <div
            style={{
              fontFamily: sans,
              fontSize: 17,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: colors.faint,
              paddingLeft: 6,
            }}
          >
            demo chat
          </div>
        </div>
      </AbsoluteFill>
      <Flash at={0} color={colors.lavender} peak={0.55} decay={4} />
      <Grain amount={0.08} />
      <Vignette strength={0.55} />
    </Backdrop>
  );
}
