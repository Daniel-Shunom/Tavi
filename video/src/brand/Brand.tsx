// Brand and submission stills, in the ad's look: white paper, a whisper of colour behind her,
// Georgia titles, the Manrope wordmark. Every Tavi is a frame of the real renderer.
// Rendered by capture/render-brand.mjs into ../brand/.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Composition, Img, staticFile } from 'remotion';
import { Bubble } from '../ad/Bubble';
import { ink, sans, serif, Stage, Wordmark } from '../ad/look';
import { openaiPath, twitchPath } from '../ad/marks';
import { Tavi, type Shot } from '../ad/Tavi';

/**
 * A frame of her: one capture instant, framed on her standing box from the start of the same
 * capture, so raised arms never shift the framing and every pose shares one scale.
 */
interface Pose {
  shot: Shot;
  at: number;
}
const still = (p: Pose) => ({ shot: p.shot, from: p.at, frameOn: [0.2, 0.3] as [number, number] });

/** The expression set. Times are moments in the captures where each one peaks. */
export const poses = {
  wave: { shot: 'reveal', at: 1.5 },
  hype: { shot: 'alive-a', at: 1.25 },
  lol: { shot: 'alive-a', at: 2.5 },
  shocked: { shot: 'alive-a', at: 4.25 },
  hmm: { shot: 'alive-b', at: 2.5 },
  ooh: { shot: 'chatread', at: 1.0 },
  smug: { shot: 'alive-a', at: 8.5 },
  cheer: { shot: 'alive-b', at: 10.75 },
  happy: { shot: 'reveal', at: 8.0 },
} satisfies Record<string, Pose>;
type PoseName = keyof typeof poses;

/** Full body, steady framing (her standing height), so gestures can spill past it naturally. */
function Her({ pose, height, at, focus = 'feet' }: { pose: PoseName; height: number; at: [number, number]; focus?: 'feet' | 'head' }) {
  const p = poses[pose] as Pose;
  return <Tavi shot={p.shot} from={p.at} height={height} at={at} focus={focus} frameOn={[0.2, 0.3]} />;
}

function Title({ children, size, italic, color = ink.text, style }: { children: ReactNode; size: number; italic?: boolean; color?: string; style?: CSSProperties }) {
  return (
    <div style={{ fontFamily: serif, fontSize: size, fontStyle: italic ? 'italic' : 'normal', lineHeight: 1.06, letterSpacing: '-0.025em', color, ...style }}>
      {children}
    </div>
  );
}

function Glyph({ d, color, size }: { d: string; color: string; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: 'block' }}>
      <path d={d} fill={color} />
    </svg>
  );
}

function Credit({ size = 22 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.8, fontFamily: sans, fontSize: size, color: ink.text }}>
      <span>Built for the Twitch × Codex hackathon</span>
      <span style={{ width: 1, height: size * 1.25, background: 'rgba(46,36,53,0.18)' }} />
      <Glyph d={twitchPath} color="#9146FF" size={size * 1.35} />
      <span style={{ color: ink.faint, fontSize: size * 0.85 }}>×</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: size * 0.35, fontWeight: 600 }}>
        <Glyph d={openaiPath} color={ink.text} size={size * 1.25} />
        Codex
      </span>
    </div>
  );
}

/** A chat message, settled (no pop-in) for stills. */
function Msg({ name, color, text, x, y, size = 30 }: { name: string; color: string; text: string; x: number; y: number; size?: number }) {
  return <Bubble at={-3} name={name} color={color} text={text} x={x} y={y + 32} size={size} />;
}

// ————— Logo —————

function WordmarkDark() {
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Wordmark size={560} />
    </AbsoluteFill>
  );
}

function WordmarkLight() {
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Wordmark size={560} color="#ffffff" />
    </AbsoluteFill>
  );
}

/** The app icon: her face on a soft lavender squircle. */
function IconTile({ size }: { size: number }) {
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: size * 0.225,
        overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 38%, #ffffff 0%, #f3eafa 45%, #dcc5ee 100%)',
        boxShadow: 'inset 0 0 0 1px rgba(46,36,53,0.06)',
      }}
    >
      <Tavi {...still(poses.happy)} height={1.32} at={[0.5, 0.5]} focus="head" area={{ width: size, height: size }} />
    </div>
  );
}

function Icon() {
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <IconTile size={1024} />
    </AbsoluteFill>
  );
}

function Lockup() {
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 70 }}>
      <IconTile size={560} />
      <Wordmark size={420} />
    </AbsoluteFill>
  );
}

// ————— Hackathon: Devpost thumbnail and gallery (3:2), YouTube, social —————

function DevpostThumbnail() {
  return (
    <AbsoluteFill>
      <Stage tint={ink.lavender} strength={0.4} glow={[70, 52]} />
      <Her pose="wave" height={0.78} at={[0.7, 0.93]} />
      <Msg name="pixelmoth" color="#3a9be0" text="hiii tavi 👋" x={1250} y={170} size={32} />
      <div style={{ position: 'absolute', left: 110, top: 300 }}>
        <Wordmark size={250} />
        <Title size={64} style={{ marginTop: 34 }}>
          Your Twitch
        </Title>
        <Title size={64} italic color={ink.plum}>
          streaming companion.
        </Title>
      </div>
      <div style={{ position: 'absolute', left: 112, bottom: 70 }}>
        <Credit size={24} />
      </div>
    </AbsoluteFill>
  );
}

function GalleryIntro() {
  return (
    <AbsoluteFill>
      <Stage tint={ink.lavender} strength={0.38} glow={[50, 58]} />
      <Title size={96} style={{ position: 'absolute', top: 90, width: '100%', textAlign: 'center' }}>
        Introducing Tavi
      </Title>
      <Title size={44} italic color={ink.plum} style={{ position: 'absolute', top: 210, width: '100%', textAlign: 'center' }}>
        an expressive companion for your stream
      </Title>
      <Her pose="happy" height={0.66} at={[0.5, 0.96]} />
      <Msg name="pixelmoth" color="#3a9be0" text="hiii 👋" x={330} y={520} />
      <Msg name="saltyfern" color="#e0567f" text="she's so cute" x={1180} y={470} />
      <Msg name="okkoro" color="#3fa36b" text="tavi!!" x={1220} y={760} />
    </AbsoluteFill>
  );
}

function GalleryReacts() {
  return (
    <AbsoluteFill>
      <Stage tint={ink.teal} strength={0.14} glow={[33, 55]} />
      <Her pose="lol" height={0.7} at={[0.32, 0.94]} />
      <Title size={88} style={{ position: 'absolute', left: 760, top: 150 }}>
        Reacts to chat.
      </Title>
      <Msg name="saltyfern" color="#e0567f" text="LMAO the jump scare" x={1010} y={400} size={34} />
      <Msg name="pixelmoth" color="#3a9be0" text="we hit 100 followers!!" x={1060} y={530} size={34} />
      <Msg name="okkoro" color="#3fa36b" text="BOO" x={890} y={660} size={34} />
      <div style={{ position: 'absolute', right: 50, bottom: 40, fontFamily: sans, fontSize: 18, color: ink.faint }}>
        Reactions follow rules and cooldowns you set.
      </div>
    </AbsoluteFill>
  );
}

const faceSet: { pose: PoseName; tint: string }[] = [
  { pose: 'hype', tint: ink.pink },
  { pose: 'lol', tint: ink.amber },
  { pose: 'shocked', tint: ink.lavender },
  { pose: 'hmm', tint: ink.teal },
  { pose: 'ooh', tint: ink.mint },
  { pose: 'smug', tint: ink.pink },
];

function Face({ pose, tint, size }: { pose: PoseName; tint: string; size: number }) {
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        background: `radial-gradient(circle at 50% 45%, #ffffff 0%, ${tint}33 70%, ${tint}55 100%)`,
        boxShadow: '0 24px 60px rgba(46,36,53,0.12)',
      }}
    >
      <Tavi {...still(poses[pose] as Pose)} height={1.3} at={[0.5, 0.53]} focus="head" area={{ width: size, height: size }} />
    </div>
  );
}

function GalleryFeels() {
  return (
    <AbsoluteFill>
      <Stage />
      <div style={{ position: 'absolute', top: 90, width: '100%', textAlign: 'center' }}>
        <Title size={92}>
          Feels every <i style={{ color: ink.plum }}>moment.</i>
        </Title>
      </div>
      <div style={{ position: 'absolute', top: 290, left: 0, right: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 46, padding: '0 150px' }}>
        {faceSet.map((f) => (
          <Face key={f.pose} {...f} size={300} />
        ))}
      </div>
    </AbsoluteFill>
  );
}

/** The stream scene from the ad, as a still: her on the overlay over a dusk game. */
function StreamShot({ width, height }: { width: number; height: number }) {
  return (
    <div style={{ position: 'relative', width, height, borderRadius: 22, overflow: 'hidden', boxShadow: '0 50px 110px rgba(46,36,53,0.22), 0 6px 18px rgba(46,36,53,0.10)' }}>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="bsky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b1530" />
            <stop offset="0.55" stopColor="#4a2f5c" />
            <stop offset="1" stopColor="#c46a7a" />
          </linearGradient>
          <radialGradient id="bsun" cx="0.68" cy="0.6" r="0.25">
            <stop offset="0" stopColor="#ffd3a8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffd3a8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#bsky)" />
        <rect width="1600" height="900" fill="url(#bsun)" />
        {Array.from({ length: 46 }, (_, i) => (
          <circle key={i} cx={`${(i * 137.5) % 100}%`} cy={`${(i * 61.8) % 46}%`} r={i % 5 ? 1.3 : 2} fill="#fff" opacity={0.5} />
        ))}
        {[
          [0, 600, 40, '#3a2649'],
          [300, 680, 34, '#2a1c38'],
          [700, 760, 26, '#1b1326'],
        ].map(([o, b, a, c]) => {
          const pts: string[] = [];
          for (let x = 0; x <= 1600; x += 40) pts.push(`${x},${(Number(b) - Number(a) * Math.sin((x + Number(o)) / 230) - Number(a) * 0.5 * Math.sin((x + Number(o)) / 97)).toFixed(1)}`);
          return <polygon key={String(c)} points={`0,900 ${pts.join(' ')} 1600,900`} fill={String(c)} />;
        })}
      </svg>
      <div style={{ position: 'absolute', left: 22, top: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ background: '#e5484d', color: 'white', fontFamily: sans, fontWeight: 600, fontSize: 15, padding: '4px 9px', borderRadius: 6, letterSpacing: '0.08em' }}>LIVE</span>
        <span style={{ fontFamily: sans, color: 'rgba(255,255,255,0.75)', fontSize: 16 }}>1,284 watching</span>
      </div>
      <Tavi shot="chatread" from={9.75} height={0.42} at={[0.3, 0.86]} focus="feet" frameOn={[0.2, 0.3]} area={{ width, height }} />
    </div>
  );
}

function GalleryLives() {
  return (
    <AbsoluteFill>
      <Stage />
      <Title size={88} style={{ position: 'absolute', top: 70, width: '100%', textAlign: 'center' }}>
        Lives on your stream.
      </Title>
      <div style={{ position: 'absolute', left: 150, top: 230 }}>
        <StreamShot width={1200} height={675} />
      </div>
      <Msg name="okkoro" color="#3fa36b" text="the little hop 😭" x={1240} y={300} />
      <div style={{ position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: sans, fontSize: 22, color: ink.soft }}>
        A transparent OBS browser source. She moves, perches, naps and tucks away.
      </div>
    </AbsoluteFill>
  );
}

/** A real Studio screenshot (capture/screenshots.mjs, 3840x2160) as a floating window. */
function StudioWindow({ screen, width }: { screen: string; width: number }) {
  return (
    <div style={{ width, height: (width * 9) / 16, borderRadius: 20, overflow: 'hidden', boxShadow: '0 60px 140px rgba(46,36,53,0.28), 0 8px 24px rgba(46,36,53,0.12)' }}>
      <Img src={staticFile(`screens-hq/${screen}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}

function GalleryStudio({ screen, title, accent, caption }: { screen: string; title: string; accent: string; caption: string }) {
  return (
    <AbsoluteFill>
      <Stage />
      <Title size={88} style={{ position: 'absolute', top: 70, width: '100%', textAlign: 'center' }}>
        {title} <i style={{ color: ink.plum }}>{accent}</i>
      </Title>
      <div style={{ position: 'absolute', left: 170, top: 230 }}>
        <StudioWindow screen={screen} width={1160} />
      </div>
      <div style={{ position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: sans, fontSize: 22, color: ink.soft }}>
        {caption}
      </div>
    </AbsoluteFill>
  );
}

function YouTube() {
  return (
    <AbsoluteFill>
      <Stage tint={ink.pink} strength={0.22} glow={[68, 48]} />
      <Tavi {...still(poses.shocked)} height={1.35} at={[0.7, 0.47]} focus="head" />
      <div style={{ position: 'absolute', left: 80, top: 190 }}>
        <Title size={124} style={{ fontWeight: 700 }}>
          Meet
        </Title>
        <Wordmark size={190} style={{ marginTop: -4 }} />
        <div style={{ marginTop: 30, fontFamily: sans, fontWeight: 600, fontSize: 38, color: ink.plum }}>She reacts to your chat.</div>
      </div>
    </AbsoluteFill>
  );
}

function Social() {
  return (
    <AbsoluteFill>
      <Stage tint={ink.lavender} strength={0.38} glow={[72, 55]} />
      <Her pose="wave" height={0.84} at={[0.73, 0.95]} />
      <div style={{ position: 'absolute', left: 90, top: 170 }}>
        <Wordmark size={170} />
        <Title size={48} style={{ marginTop: 22 }}>
          Make your stream
        </Title>
        <Title size={48} italic color={ink.plum}>
          feel more alive.
        </Title>
      </div>
    </AbsoluteFill>
  );
}

// ————— App headshot: a waving close-up, tilted right, beside the wordmark —————

function Headshot({ wordmark, x }: { wordmark: number; x: number }) {
  return (
    <AbsoluteFill>
      <Stage tint={ink.lavender} strength={0.42} glow={[x * 100, 46]} />
      <AbsoluteFill style={{ transform: 'rotate(12deg)', transformOrigin: `${x * 100}% 50%` }}>
        <Tavi {...still(poses.wave)} height={1.04} at={[x, 0.5]} focus="head" />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: '8%' }}>
        <Wordmark size={wordmark} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ————— Microsoft Store art (Store guidance: no text on hero art) —————

function StoreHero() {
  return (
    <AbsoluteFill>
      <Stage tint={ink.lavender} strength={0.4} glow={[66, 52]} />
      <Her pose="cheer" height={0.66} at={[0.66, 0.9]} />
      <Msg name="duskrider" color="#d08a2c" text="WE WON 🎉" x={1000} y={300} size={32} />
      <Msg name="mintlatte" color="#8a5cc7" text="LETS GOOO" x={1580} y={250} size={32} />
      <Msg name="okkoro" color="#3fa36b" text="gg gg gg" x={1600} y={620} size={32} />
    </AbsoluteFill>
  );
}

function StoreBox() {
  return (
    <AbsoluteFill>
      <Stage tint={ink.lavender} strength={0.4} glow={[50, 46]} />
      <Her pose="happy" height={0.66} at={[0.5, 0.8]} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 56 }}>
        <Wordmark size={130} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function StorePoster() {
  return (
    <AbsoluteFill>
      <Stage tint={ink.lavender} strength={0.4} glow={[50, 60]} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 110 }}>
        <Wordmark size={170} />
        <Title size={44} italic color={ink.plum} style={{ marginTop: 18, textAlign: 'center' }}>
          your Twitch streaming companion
        </Title>
      </AbsoluteFill>
      <Her pose="wave" height={0.56} at={[0.5, 0.93]} />
    </AbsoluteFill>
  );
}

// ————— Expression cutouts and Twitch emotes (transparent) —————

function Cutout({ pose }: { pose: PoseName }) {
  return <Her pose={pose} height={0.8} at={[0.5, 0.92]} />;
}

function Emote({ pose }: { pose: PoseName }) {
  const p = poses[pose] as Pose;
  return <Tavi {...still(p)} height={1.22} at={[0.5, 0.56]} focus="head" />;
}

export const brandStills: { id: string; out: string; width: number; height: number; scale?: number; transparent?: boolean; render: () => ReactNode }[] = [
  { id: 'logo-wordmark', out: 'logo/tavi-wordmark.png', width: 2000, height: 760, transparent: true, render: () => <WordmarkDark /> },
  { id: 'logo-wordmark-light', out: 'logo/tavi-wordmark-light.png', width: 2000, height: 760, transparent: true, render: () => <WordmarkLight /> },
  { id: 'logo-icon', out: 'logo/tavi-icon-1024.png', width: 1024, height: 1024, transparent: true, render: () => <Icon /> },
  { id: 'logo-lockup', out: 'logo/tavi-lockup.png', width: 2000, height: 760, transparent: true, render: () => <Lockup /> },
  { id: 'devpost-thumbnail', out: 'hackathon/devpost-thumbnail-1500x1000.png', width: 1500, height: 1000, render: () => <DevpostThumbnail /> },
  { id: 'gallery-1', out: 'hackathon/gallery-1-introducing-tavi.png', width: 1500, height: 1000, render: () => <GalleryIntro /> },
  { id: 'gallery-2', out: 'hackathon/gallery-2-reacts-to-chat.png', width: 1500, height: 1000, render: () => <GalleryReacts /> },
  { id: 'gallery-3', out: 'hackathon/gallery-3-feels-every-moment.png', width: 1500, height: 1000, render: () => <GalleryFeels /> },
  { id: 'gallery-4', out: 'hackathon/gallery-4-lives-on-your-stream.png', width: 1500, height: 1000, render: () => <GalleryLives /> },
  { id: 'gallery-5', out: 'hackathon/gallery-5-make-her-yours.png', width: 1500, height: 1000, scale: 2, render: () => <GalleryStudio screen="03-studio-look" title="Make her" accent="yours." caption="Tavi Studio: hair, skin, outfit and accessories, live on stream as you change them." /> },
  { id: 'gallery-6', out: 'hackathon/gallery-6-you-call-the-moments.png', width: 1500, height: 1000, scale: 2, render: () => <GalleryStudio screen="02-studio-live" title="You call the" accent="moments." caption="Cue a wave or a celebration with one key, move her around, or tuck her away." /> },
  { id: 'gallery-7', out: 'hackathon/gallery-7-on-stream-in-minutes.png', width: 1500, height: 1000, scale: 2, render: () => <GalleryStudio screen="05-studio-setup" title="On stream in" accent="minutes." caption="Copy one link into an OBS browser source, then connect Twitch chat." /> },
  { id: 'youtube-thumbnail', out: 'hackathon/youtube-thumbnail-1280x720.png', width: 1280, height: 720, render: () => <YouTube /> },
  { id: 'app-headshot', out: 'hackathon/app-headshot-1920x1080.png', width: 1920, height: 1080, scale: 2, render: () => <Headshot wordmark={300} x={0.68} /> },
  { id: 'app-headshot-3x2', out: 'hackathon/app-headshot-1500x1000.png', width: 1500, height: 1000, scale: 2, render: () => <Headshot wordmark={250} x={0.68} /> },
  { id: 'social-card', out: 'social/og-image-1200x630.png', width: 1200, height: 630, render: () => <Social /> },
  { id: 'store-hero', out: 'store/hero-art-16x9-3840x2160.png', width: 1920, height: 1080, scale: 2, render: () => <StoreHero /> },
  { id: 'store-box', out: 'store/box-art-1x1-2160x2160.png', width: 1080, height: 1080, scale: 2, render: () => <StoreBox /> },
  { id: 'store-poster', out: 'store/poster-art-2x3-1440x2160.png', width: 720, height: 1080, scale: 2, render: () => <StorePoster /> },
  ...(Object.keys(poses) as PoseName[]).flatMap((pose) => [
    { id: `expression-${pose}`, out: `expressions/tavi-${pose}.png`, width: 1024, height: 1024, transparent: true, render: () => <Cutout pose={pose} /> },
    { id: `emote-${pose}`, out: `emotes/tavi-${pose}-448.png`, width: 448, height: 448, transparent: true, render: () => <Emote pose={pose} /> },
  ]),
];

export function BrandStills() {
  return (
    <>
      {brandStills.map((s) => (
        <Composition
          key={s.id}
          id={s.id}
          component={() => <AbsoluteFill style={{ background: s.transparent ? 'transparent' : ink.paper }}>{s.render()}</AbsoluteFill>}
          durationInFrames={1}
          fps={30}
          width={s.width}
          height={s.height}
          defaultProps={{ out: s.out, scale: s.scale ?? 1 }}
        />
      ))}
    </>
  );
}
