// The tease: silhouettes of her running, skipping and hopping, one camera per cut, accelerating
// into a beat of black and the reveal on the track's drop.
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Pulse } from './audio';
import { Letterbox } from './cinema';
import { copy } from './config';
import { Aberration, Flash, Grain, Scanlines, shake, Vignette } from './fx';
import { usePulseAt } from './scenes';
import { TaviClip } from './TaviClip';
import { colors } from './theme';
import { Slam, sans } from './type';

/**
 * One camera per cut, all on the `romp` capture (she runs right, skips back left, hops to the
 * middle). The camera follows her body; `from` is seconds into the capture. Angles vary every cut:
 * perspective swings (rotY), low and high angles (rotX), dutch tilts, reverse angles (mirror),
 * extreme close-ups on feet and hair, and a split screen of her crossing both ways.
 */
type Cam = {
  from: number;
  zoom: number;
  part: 'body' | 'head' | 'feet';
  anchor: [number, number];
  mirror?: boolean;
  rotX?: number;
  rotY?: number;
  tilt?: number;
  /** Horizontal camera drift across the cut, px per second. */
  drift?: number;
  split?: true;
};
type TeaseCut = Cam | { text: number };

const opening: Cam = { from: 0.4, zoom: 1.5, part: 'body', anchor: [0.5, 0.62], drift: 40 };
const reel: TeaseCut[] = [
  { from: 1.0, zoom: 3.4, part: 'body', anchor: [0.4, 0.56], rotY: 24, drift: 90 },
  { from: 1.7, zoom: 7.5, part: 'feet', anchor: [0.5, 0.66], tilt: -8, drift: 140 },
  { text: 0 },
  { from: 5.0, zoom: 3.1, part: 'body', anchor: [0.6, 0.54], rotX: 16, mirror: true, drift: -80 },
  { text: 1 },
  { from: 2.0, zoom: 2.7, part: 'body', anchor: [0.5, 0.56], split: true },
  { text: 2 },
  { from: 9.1, zoom: 7, part: 'head', anchor: [0.5, 0.46], tilt: 10 },
  { from: 2.7, zoom: 2.3, part: 'body', anchor: [0.32, 0.6], rotY: -30, drift: 60 },
  { from: 6.0, zoom: 5.5, part: 'head', anchor: [0.56, 0.5], mirror: true, tilt: -6 },
  { from: 9.6, zoom: 3.3, part: 'body', anchor: [0.5, 0.52], rotX: -14 },
  { from: 3.2, zoom: 8, part: 'feet', anchor: [0.46, 0.6], drift: 160 },
  { from: 6.8, zoom: 4.2, part: 'body', anchor: [0.62, 0.5], rotY: 34, mirror: true },
  { from: 10.0, zoom: 6.5, part: 'head', anchor: [0.48, 0.5], tilt: 12 },
  { from: 3.6, zoom: 3, part: 'body', anchor: [0.4, 0.55], rotX: 20, drift: 120 },
  { from: 7.4, zoom: 7, part: 'head', anchor: [0.52, 0.48], mirror: true },
  { from: 10.4, zoom: 3.6, part: 'body', anchor: [0.5, 0.54], tilt: -12 },
];

/**
 * Cut points. The track's own hits when its intro has them; otherwise (a quiet, building intro
 * like the one this trailer is scored to) an accelerating grid: slow at first, tightening toward
 * the reveal.
 */
function teaseCuts(pulse: Pulse, offset: number, duration: number, fps: number): number[] {
  const own = pulse.hits.filter((h) => h >= offset && h < offset + duration).map((h) => h - offset);
  if (own.length >= 8) return own;
  const cuts: number[] = [];
  let t = fps * 1.2;
  let gap = fps * 1.05;
  while (t < duration - fps * 0.45) {
    cuts.push(Math.round(t));
    t += gap;
    gap = Math.max(fps * 0.2, gap * 0.85);
  }
  return cuts;
}

/** Her silhouette against a backlight with a coloured rim; `light` 0..1 lets her colours in. */
function Silhouette({
  cam,
  age,
  light,
  rim,
}: {
  cam: Cam;
  age: number;
  light: number;
  rim: string;
}) {
  const { fps } = useVideoConfig();
  const seconds = age / fps;
  // A whip into each cut: a fast slide with motion blur over the first frames.
  const whip = Math.exp(-age / 2.2);
  const drift = (cam.drift ?? 0) * (seconds - 0.4);
  const transform = [
    'perspective(1400px)',
    `rotateY(${(cam.rotY ?? 0).toFixed(1)}deg)`,
    `rotateX(${(cam.rotX ?? 0).toFixed(1)}deg)`,
    `rotate(${(cam.tilt ?? 0).toFixed(1)}deg)`,
    `translateX(${(drift + 220 * whip * (cam.mirror ? -1 : 1)).toFixed(1)}px)`,
    `scale(${(1.04 + 0.03 * seconds).toFixed(4)})`,
  ].join(' ');
  const filter = [
    `brightness(${light.toFixed(3)})`,
    `saturate(${(0.6 + light).toFixed(2)})`,
    `drop-shadow(0 0 3px ${rim})`,
    `drop-shadow(0 0 22px ${rim}aa)`,
    `blur(${(5 * whip).toFixed(2)}px)`,
  ].join(' ');
  const clip = (mirror: boolean | undefined, box?: { width: number; height: number }) => (
    <TaviClip
      shot="romp"
      at={cam.from + seconds}
      zoom={cam.zoom}
      anchor={cam.anchor}
      follow={{ part: cam.part, smooth: 6 }}
      mirror={mirror}
      box={box}
    />
  );
  if (cam.split)
    return (
      <AbsoluteFill style={{ flexDirection: 'row', gap: 6, filter }}>
        {[false, true].map((mirror, side) => (
          <div
            key={side}
            style={{
              position: 'relative',
              width: 957,
              height: 1080,
              overflow: 'hidden',
              transform: `translateY(${((side ? 1 : -1) * 80 * whip).toFixed(1)}px)`,
            }}
          >
            {clip(mirror, { width: 957, height: 1080 })}
          </div>
        ))}
      </AbsoluteFill>
    );
  return <AbsoluteFill style={{ transform, filter }}>{clip(cam.mirror)}</AbsoluteFill>;
}

export function Tease({ offset }: { offset: number }) {
  const { frame, pulse } = usePulseAt(offset);
  const { fps, durationInFrames } = useVideoConfig();
  const local = useCurrentFrame();
  const cuts = teaseCuts(pulse, offset, durationInFrames, fps);
  const hit = cuts.filter((c) => c <= local).length - 1;
  const age = hit >= 0 ? local - cuts[hit] : local;
  const hitPunch = hit >= 0 ? Math.exp(-age / 6) : 0;
  const progress = local / durationInFrames;
  // Pure silhouette at first; her colours creep in over the last cuts, then a beat of black.
  const light = interpolate(progress, [0, 0.55, 0.85, 0.95], [0, 0.02, 0.3, 0.55], {
    extrapolateRight: 'clamp',
  });
  const blackout = local >= durationInFrames - Math.round(fps * 0.3);
  const cut: TeaseCut = hit < 0 ? opening : reel[hit % reel.length];
  const rims = [colors.lavender, colors.pink, colors.teal];
  const rim = rims[Math.max(0, hit) % rims.length];
  const lightAt = 'text' in cut || cut.split ? [0.5, 0.55] : cut.anchor;
  const spread = hit < 0 ? [26, 40] : [38, 58];
  return (
    <AbsoluteFill style={{ background: '#05040a' }}>
      {blackout ? null : (
        <AbsoluteFill style={shake(frame, 12 * hitPunch)}>
          {/* The backlight: a hot source behind her so the silhouette reads. */}
          <AbsoluteFill
            style={{
              background: `radial-gradient(${spread[0]}% ${spread[1]}% at ${(lightAt[0] * 100).toFixed(1)}% ${(lightAt[1] * 100).toFixed(1)}%, ${rim}${hit < 0 ? '55' : 'cc'}, transparent 72%)`,
              opacity: 0.55 + 0.45 * hitPunch,
            }}
          />
          <Aberration amount={14 * hitPunch}>
            {'text' in cut ? (
              <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Slam at={0} size={196} italic color={colors.white}>
                  {copy.teaseLines[cut.text]}
                </Slam>
              </AbsoluteFill>
            ) : (
              <Silhouette cam={cut} age={age} light={light} rim={rim} />
            )}
          </Aberration>
        </AbsoluteFill>
      )}
      {cuts.map((c) => (
        <Flash key={c} at={c} color={colors.white} peak={0.22} decay={2.5} />
      ))}
      <Scanlines opacity={0.18} />
      <Grain amount={0.2} />
      <Vignette strength={0.9} />
      <Letterbox amount={1} />
      {/* Count-in strip: a thin lavender bar that fills to the reveal. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 138,
          height: 4,
          width: `${(progress * 100).toFixed(2)}%`,
          background: colors.lavender,
          opacity: blackout ? 0 : 0.8,
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
          opacity: blackout
            ? 0
            : interpolate(local, [fps * 0.6, fps * 1.6], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
        }}
      >
        A companion for your stream
      </div>
    </AbsoluteFill>
  );
}
