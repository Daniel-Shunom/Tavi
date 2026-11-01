// Act two, continued: where she lives (the overlay), who is in charge (Studio), restraint (quiet
// mode), and the big moment that wakes her back up. No captions: the scenery carries it.
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import measured from './shots.json';
import { Bubble } from './Bubble';
import { ease, easeInOut, ink, sans, Stage } from './look';
import { Tavi } from './Tavi';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** A dusk landscape standing in for gameplay: quiet enough that she stays the subject. */
function Game({ t }: { t: number }) {
  const stars = Array.from({ length: 46 }, (_, i) => {
    const x = (i * 137.5) % 100;
    const y = (i * 61.8) % 46;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + i));
    return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={i % 5 ? 1.3 : 2} fill="#fff" opacity={tw * 0.7} />;
  });
  const hill = (offset: number, base: number, amp: number, color: string) => {
    const pts: string[] = [];
    for (let x = 0; x <= 1600; x += 40) {
      const y = base - amp * Math.sin((x + offset) / 230) - amp * 0.5 * Math.sin((x + offset) / 97);
      pts.push(`${x},${y.toFixed(1)}`);
    }
    return <polygon points={`0,900 ${pts.join(' ')} 1600,900`} fill={color} />;
  };
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1530" />
          <stop offset="0.55" stopColor="#4a2f5c" />
          <stop offset="1" stopColor="#c46a7a" />
        </linearGradient>
        <radialGradient id="sun" cx="0.68" cy="0.6" r="0.25">
          <stop offset="0" stopColor="#ffd3a8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffd3a8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#sky)" />
      <rect width="1600" height="900" fill="url(#sun)" />
      {stars}
      {hill(t * 8, 600, 40, '#3a2649')}
      {hill(300 + t * 16, 680, 34, '#2a1c38')}
      {hill(700 + t * 28, 760, 26, '#1b1326')}
    </svg>
  );
}

const romp = (measured as unknown as Record<string, { frames: number; box: ([number, number, number, number] | null)[] }>).romp;
function rompCentre(index: number) {
  let n = 0;
  let x = 0;
  let y = 0;
  for (let i = index - 12; i <= index + 12; i++) {
    const b = romp.box[Math.min(romp.frames - 1, Math.max(0, i))];
    if (!b) continue;
    n++;
    x += (b[0] + b[2]) / 2;
    y += (b[1] + b[3]) / 2;
  }
  return n ? [x / n, y / n] : [0.3, 0.6];
}

/** 24.6–29.4 s: the stream floats on white; the camera drifts in until she fills it. */
export function Lives() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const from = 1.2;
  const screen = { x: 150, y: 150, w: 1230, h: 692 };
  const index = Math.round(from * 30 + frame);
  const [cx, cy] = rompCentre(index);
  const push = interpolate(frame, [0.4 * fps, 4.4 * fps], [0, 1], { ...clamp, easing: easeInOut });
  const zoom = 1 + 0.65 * push;
  const sx = screen.x + cx * screen.w;
  const sy = screen.y + cy * screen.h;
  const tx = (1920 * 0.45 - sx) * push;
  const ty = (1080 * 0.55 - sy) * push;
  return (
    <AbsoluteFill>
      <Stage />
      <AbsoluteFill style={{ transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${zoom.toFixed(4)})`, transformOrigin: `${sx}px ${sy}px` }}>
        <div
          style={{
            position: 'absolute',
            left: screen.x,
            top: screen.y,
            width: screen.w,
            height: screen.h,
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 50px 110px rgba(46,36,53,0.22), 0 6px 18px rgba(46,36,53,0.10)',
          }}
        >
          <Game t={frame / fps} />
          <div style={{ position: 'absolute', left: 22, top: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ background: '#e5484d', color: 'white', fontFamily: sans, fontWeight: 600, fontSize: 14, padding: '4px 9px', borderRadius: 6, letterSpacing: '0.08em' }}>LIVE</span>
            <span style={{ fontFamily: sans, color: 'rgba(255,255,255,0.75)', fontSize: 15 }}>1,284 watching</span>
          </div>
          <Img
            src={staticFile(`footage/tavi/romp/${String(Math.min(romp.frames - 1, index)).padStart(5, '0')}.png`)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            left: screen.x + screen.w + 24,
            top: screen.y,
            width: 380,
            height: screen.h,
            borderRadius: 20,
            background: '#ffffff',
            boxShadow: '0 50px 110px rgba(46,36,53,0.16), 0 6px 18px rgba(46,36,53,0.08)',
            padding: 26,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: 16,
            fontFamily: sans,
            fontSize: 21,
            color: ink.text,
          }}
        >
          {chatLines.map(([c, n, m], i) => (
            <div key={n} style={{ opacity: interpolate(frame, [chatAt(i) * fps, chatAt(i) * fps + 10], [0, 1], clamp) }}>
              <span style={{ color: c, fontWeight: 600 }}>{n}</span>
              <span style={{ color: ink.faint }}>: </span>
              {m}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

const chatLines = [
  ['#3a9be0', 'pixelmoth', 'she RUNS'],
  ['#e0567f', 'saltyfern', 'tavi come back lol'],
  ['#3fa36b', 'okkoro', 'the little hop 😭'],
];
/** Local seconds each line arrives in the stream's chat (the SFX cue sheet reads this too). */
export const chatAt = (i: number) => 0.4 + i * 1.2;

/** Studio tour: Look, Live, Setup. Start frames in the captured sequence. */
export const studioCuts = [372, 196, 590];

/** 29.4–34.2 s: Studio as a product window on white; three slow dissolves. */
export function Studio() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const len = Math.round(1.6 * fps);
  const settle = interpolate(frame, [0, 1.6 * fps], [0, 1], { ...clamp, easing: ease });
  const tilt = 8 * (1 - settle);
  const scale = 0.94 + 0.04 * settle + 0.02 * interpolate(frame, [0, 4.8 * fps], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Stage />
      <AbsoluteFill style={{ perspective: 2400, alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            position: 'relative',
            width: 1600,
            height: 900,
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 60px 140px rgba(46,36,53,0.28), 0 8px 24px rgba(46,36,53,0.12)',
            transform: `rotateX(${tilt.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
            background: ink.canvas,
          }}
        >
          {studioCuts.map((start, i) => {
            const local = frame - i * len;
            if (local < -8 || (i < studioCuts.length - 1 && local > len)) return null;
            const opacity = i === 0 ? 1 : interpolate(local, [-8, 0], [0, 1], clamp);
            return (
              <Img
                key={start}
                src={staticFile(`footage/screens/studio/${String(start + Math.max(0, local + 8)).padStart(5, '0')}.jpg`)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity }}
              />
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** 34.2–36.6 s: one switch, and the room goes still. */
export function Quiet() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const on = spring({ frame: frame - 14, fps, config: { damping: 22, stiffness: 200 } });
  const calm = interpolate(frame, [14, 44], [0, 1], { ...clamp, easing: easeInOut });
  return (
    <AbsoluteFill>
      <Stage tint="#9fb7e6" strength={0.06 + 0.12 * calm} glow={[42, 52]} />
      <AbsoluteFill style={{ filter: `saturate(${(1 - 0.25 * calm).toFixed(3)})` }}>
        <Tavi shot="hero" from={0.3} height={0.62} at={[0.42, 0.88]} focus="feet" window={2} />
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 1180,
          top: 470,
          width: 430,
          padding: '24px 26px',
          borderRadius: 18,
          background: ink.inspector,
          boxShadow: '0 30px 70px rgba(46,36,53,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: sans,
          opacity: interpolate(frame, [0, 10], [0, 1], clamp),
          transform: `translateY(${interpolate(frame, [0, 14], [14, 0], { ...clamp, easing: ease }).toFixed(2)}px)`,
        }}
      >
        <div>
          <div style={{ fontSize: 24, color: ink.white, fontWeight: 600 }}>Quiet mode</div>
          <div style={{ fontSize: 18, color: '#b7aebb', marginTop: 6 }}>Fewer reactions, no big moves</div>
        </div>
        <div style={{ width: 64, height: 36, borderRadius: 99, background: on > 0.5 ? ink.lavender : '#3a3140', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 4, left: 4 + 28 * on, width: 28, height: 28, borderRadius: 99, background: on > 0.5 ? '#33203e' : '#f0e9ed' }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

export const cheerBubbles = [
  { at: 0.0, name: 'duskrider', color: '#d08a2c', text: 'WE WON 🎉', x: 470, y: 360 },
  { at: 0.3, name: 'mintlatte', color: '#8a5cc7', text: 'LETS GOOO', x: 1450, y: 300 },
  { at: 0.6, name: 'okkoro', color: '#3fa36b', text: 'gg gg gg', x: 1400, y: 640 },
];

/** 36.6–39.0 s: the big moment still gets through. She lights up; chat lights up with her. */
export function Cheer() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const push = interpolate(frame, [0, 2.4 * fps], [1, 1.05], { ...clamp, easing: ease });
  return (
    <AbsoluteFill>
      <Stage tint={ink.pink} strength={0.16} glow={[50, 48]} />
      <AbsoluteFill style={{ transform: `scale(${push.toFixed(4)})`, transformOrigin: '50% 60%' }}>
        <Tavi shot="chatread" from={8.95} height={0.66} at={[0.5, 0.88]} focus="feet" window={1.5} />
      </AbsoluteFill>
      {cheerBubbles.map((b) => (
        <Bubble key={b.name} {...b} size={32} />
      ))}
    </AbsoluteFill>
  );
}
