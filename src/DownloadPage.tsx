import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Avatar } from './renderer/Avatar';
import { beat } from '../shared/cue';
import { defaults, initialState, type State } from '../shared/protocol';
import { DownloadOptions } from './landing/DownloadOptions';
import { hostedPreview, studioEntryHref } from './landing/links';
import { TaviLife, type LifeCue } from './landing/life';
import { TWITCH_GLITCH, lockup, paintDither } from './landing/dither';
import './landing.css';
import './download.css';

function DitherScene() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let active = true;
    const glitch = new Image();
    glitch.src = TWITCH_GLITCH;
    const paint = () => {
      if (!active) return;
      paintDither(
        element,
        'on',
        {
          center: { x: 0.5, y: 0.9 },
          radius: { x: 0.59, y: 0.86 },
          seam: 0.94,
        },
        2,
        lockup(glitch, 0.5, 0.17, Math.min(82, element.clientWidth * 0.14), element.clientWidth),
        0.6,
      );
    };
    const observer = new ResizeObserver(paint);
    observer.observe(element);
    void Promise.all([glitch.decode(), document.fonts.ready]).then(paint).catch(paint);
    paint();
    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);
  return (
    <canvas
      className="download-dither"
      ref={canvas}
      role="img"
      aria-label="Twitch × Codex, set into the dithered light"
    />
  );
}

// This is the actual character renderer and the landing's bounded idle behavior. No Studio
// connection or saved character configuration is changed by visiting the download page.
export function DownloadPage() {
  const stage = useRef<HTMLDivElement>(null);
  const drawn = useRef(false);
  const button = useRef<HTMLAnchorElement>(null);
  const life = useRef(new TaviLife());
  const activity = useRef({ at: 0, near: false, manualUntil: 0 });
  const [cue, setCue] = useState<LifeCue | null>(null);
  const character = useMemo<State>(() => {
    const base = initialState({ ...defaults, personality: 'playful', energy: 75 });
    if (!cue) return base;
    const now = Date.now();
    return {
      ...base,
      performance: {
        ...base.performance,
        phase: 'reacting',
        script: {
          id: `download-${String(cue.n)}-${cue.id}`,
          sourceEventId: 'download-visitor',
          source: 'idle',
          decidedBy: { kind: 'local', label: 'Download page character cue' },
          priority: 0,
          startAt: now,
          expiresAt: now + cue.hold * 1000 + 1500,
          beats: [beat(cue.id, { target: 'pointer', hold: cue.hold })],
          settle: true,
          dropped: [],
        },
      },
    };
  }, [cue]);

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previous = performance.now();
    let lastCue = -1;
    const move = (event: PointerEvent) => {
      const bounds = stage.current?.getBoundingClientRect();
      activity.current.at = performance.now();
      activity.current.near = Boolean(
        bounds &&
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom,
      );
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      if (!document.hidden && !reduced.matches && now >= activity.current.manualUntil) {
        const next = life.current.update({
          dt,
          posture: 'stand',
          roomy: true,
          exertion: 0,
          impact: 0,
          visitorActive: now - activity.current.at < 2000,
          visitorNear: activity.current.near,
        }).cue;
        if ((next?.n ?? 0) !== lastCue) {
          lastCue = next?.n ?? 0;
          setCue(next);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    window.addEventListener('pointermove', move, { passive: true });
    const oldTitle = document.title;
    document.title = 'Download Tavi — Take her with you';
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      document.title = oldTitle;
    };
  }, []);

  return (
    <main className="tavi-site download-page">
      <header className="site-nav download-nav">
        <a className="site-mark" href="/" aria-label="Tavi home">
          tavi
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 1.5 11.8 7l5.4-2.7-2.7 5.4 5.5 1.8-5.5 1.8 2.7 5.4-5.4-2.7-1.8 5.5-1.8-5.5-5.4 2.7 2.7-5.4L0 11.5l5.5-1.8-2.7-5.4L8.2 7 10 1.5Z" />
          </svg>
        </a>
        <nav aria-label="Download navigation">
          <a href="/">
            <ArrowLeft size={14} /> Back to Tavi
          </a>
          <a className="nav-cta" href={studioEntryHref}>
            {hostedPreview ? 'Try preview' : 'Open Studio'} <ArrowUpRight size={15} />
          </a>
        </nav>
      </header>
      <section className="download-layout" aria-labelledby="download-heading">
        <div className="download-copy">
          <h1 id="download-heading">
            Take Tavi
            <br />
            <em>with you.</em>
          </h1>
          <p className="download-lede">A little company for your next stream.</p>
          <div className="download-actions">
            <DownloadOptions buttonRef={button} />
          </div>
        </div>
        <div className="download-stage" ref={stage}>
          <DitherScene />
          <div className="download-stage-floor" aria-hidden="true" />
          <div className="download-character">
            <Avatar
              onDraw={() => {
                if (drawn.current) return;
                drawn.current = true;
                stage.current?.setAttribute('data-tavi-ready', 'true');
              }}
              state={character}
              presentation="portrait"
              captions={false}
              frame={{ height: 0.92, bottom: 0.96, fitWidth: true }}
            />
            <button
              className="download-greet"
              type="button"
              aria-label="Wave to Tavi"
              onClick={() => {
                const now = performance.now();
                activity.current = { at: now, near: true, manualUntil: now + 3500 };
                setCue({ id: 'wave', n: Date.now(), hold: 3 });
              }}
            />
          </div>
          <span className="download-greet-hint">Say hello.</span>
        </div>
      </section>
      <footer className="download-footer">
        <span>Connect Twitch. Add her to OBS. Go live.</span>
        <a href="https://github.com/Daniel-Shunom/Tavi/releases" target="_blank" rel="noreferrer">
          Release notes <ArrowUpRight size={13} />
        </a>
      </footer>
    </main>
  );
}
