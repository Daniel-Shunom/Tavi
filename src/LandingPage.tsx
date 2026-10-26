import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Eye,
  Heart,
  MessageCircle,
  Play,
  Sparkles,
  VolumeX,
} from 'lucide-react';
import { Avatar } from './renderer/Avatar';
import { beat } from '../shared/cue';
import { defaults, initialState } from '../shared/protocol';
import type { State } from '../shared/protocol';
import type { TrackApplication } from './renderer/adapter';
import './landing.css';

const sectionCues = {
  opening: 'content',
  personality: 'amused',
  presence: 'thinking',
  ending: 'excited',
} as const;

function demoState(
  section: keyof typeof sectionCues,
  playing: boolean,
  streamStarted: boolean,
): State {
  const base = initialState({ ...defaults, captions: { studio: false, overlay: false } });
  const now = Date.now();
  const expression = !streamStarted ? 'startled' : playing ? 'excited' : sectionCues[section];
  return {
    ...base,
    performance: {
      ...base.performance,
      phase: 'reacting',
      movement:
        section === 'ending'
          ? {
              id: 'landing-ending-walk',
              sourceEventId: 'landing-ending-walk',
              source: 'idle',
              decidedBy: { kind: 'local', label: 'Landing page choreography (not AI)' },
              priority: 0,
              kind: 'move-to',
              to: { x: 0.76, y: 0.86 },
              gait: 'amble',
              mood: 'content',
              speed: 0.55,
              startAt: now,
              expiresAt: now + 9000,
            }
          : null,
      script: {
        id: `landing-${section}`,
        sourceEventId: `landing-${section}`,
        source: 'idle',
        decidedBy: { kind: 'local', label: 'Landing page cue (not AI)' },
        priority: 0,
        startAt: now,
        expiresAt: now + 4500,
        beats: [beat(expression, { target: 'pointer', hold: 2.4 })],
        settle: true,
        dropped: [],
      },
    },
  };
}

export function LandingPage() {
  const webcamRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const closingButtonRef = useRef<HTMLAnchorElement>(null);
  const walkerRef = useRef<HTMLDivElement>(null);
  const walkerNoteRef = useRef<HTMLDivElement>(null);
  const choreography = useRef({
    scroll: 0,
    footer: 0,
    startedAt: 0,
    footerDirection: 1,
    holdUntil: 0,
    lastFrameAt: 0,
  });
  const [section, setSection] = useState<keyof typeof sectionCues>('opening');
  const [streamStarted, setStreamStarted] = useState(false);
  const [demoRun, setDemoRun] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const characterState = useMemo(
    () => demoState(section, demoPlaying, streamStarted),
    [section, demoPlaying, streamStarted],
  );

  const landingTracks = (): TrackApplication[] => {
    const now = performance.now();
    const { scroll, footer, startedAt, footerDirection } = choreography.current;
    const sample = (track: string, time: number): TrackApplication => ({
      track,
      time: Math.max(0, Math.min(1, time)),
      mix: 1,
    });
    if (!streamStarted) return [sample('landing.panic', ((now - startedAt) % 2000) / 2000)];
    if (scroll < 0.012) {
      const elapsed = now - startedAt - 2800;
      return elapsed < 1150 ? [sample('landing.relief', Math.max(0, elapsed / 1150))] : [];
    }
    if (footer > 0.04)
      return footerDirection < 0
        ? [sample('landing.jump-up', 1 - (footer - 0.04) / 0.89)]
        : [sample('landing.jump-down', (footer - 0.04) / 0.89)];
    if (scroll < 0.13) return [sample('landing.brace', scroll / 0.13)];
    if (scroll < 0.58) return [sample('landing.climb', (scroll - 0.13) / 0.45)];
    if (scroll < 0.68) return [sample('landing.sit', (scroll - 0.58) / 0.1)];
    return [sample('landing.sit-life', (now % 2000) / 2000)];
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStreamStarted(true);
    }, 2800);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!demoRun) return;
    choreography.current.startedAt = performance.now();
    setStreamStarted(false);
    setDemoPlaying(true);
    const start = window.setTimeout(() => {
      setStreamStarted(true);
    }, 2200);
    const timeout = window.setTimeout(() => {
      setDemoPlaying(false);
    }, 5600);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(timeout);
    };
  }, [demoRun]);

  useEffect(() => {
    const observed = [...document.querySelectorAll<HTMLElement>('[data-cue]')];
    const observer = new IntersectionObserver(
      (entries) => {
        const current = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const cue = current?.target.getAttribute('data-cue');
        if (cue && cue in sectionCues) setSection(cue as keyof typeof sectionCues);
      },
      { rootMargin: '-38% 0px -38% 0px', threshold: [0, 0.25, 0.6] },
    );
    observed.forEach((element) => {
      observer.observe(element);
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const walker = walkerRef.current;
    if (!walker) return;
    let raf = 0;
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const paint = () => {
      raf = 0;
      const camera = webcamRef.current?.getBoundingClientRect();
      const stream = streamRef.current;
      const footer = footerRef.current?.getBoundingClientRect();
      const closingButton = closingButtonRef.current?.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scroll = window.scrollY;
      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const requestedProgress = clamp(scroll / Math.min(700, viewportHeight * 0.9), 0, 1);
      const now = performance.now();
      const previousProgress = choreography.current.scroll;
      const dt = choreography.current.lastFrameAt
        ? Math.min((now - choreography.current.lastFrameAt) / 1000, 0.06)
        : 0;
      let holdUntil = choreography.current.holdUntil;
      let pacedTarget = requestedProgress;
      if (requestedProgress > 0.13 && previousProgress < 0.13) {
        if (!holdUntil) holdUntil = now + 640;
        if (now < holdUntil) pacedTarget = 0.13;
        else holdUntil = 0;
      } else if (requestedProgress <= 0.13) {
        holdUntil = 0;
      }
      const pace = requestedProgress < previousProgress ? 0.9 : 0.74;
      const storyProgress = reduceMotion
        ? requestedProgress
        : previousProgress +
          Math.max(-pace * dt, Math.min(pace * dt, pacedTarget - previousProgress));
      const exit = clamp((storyProgress - 0.13) / 0.45, 0, 1);
      const easedExit = exit * exit * (3 - 2 * exit);
      stream?.style.setProperty(
        '--camera-push',
        (1 + (reduceMotion ? 0 : easedExit * 0.055)).toFixed(3),
      );
      const mobile = viewportWidth < 720;
      const sideX = mobile ? viewportWidth - 122 : 28;
      const sideY = mobile ? viewportHeight * 0.68 : viewportHeight * 0.48;
      const startWidth = camera ? clamp(camera.width, 112, 206) : 176;
      const streamX = camera
        ? camera.left + camera.width * 0.5 - startWidth * 0.5
        : viewportWidth * 0.56;
      const streamY = camera ? camera.top : viewportHeight * 0.32;
      let x = streamX + (sideX - streamX) * easedExit;
      let y = streamY + (sideY - streamY) * easedExit;

      const footerProgress = footer
        ? clamp(
            (viewportHeight - footer.top - viewportHeight * 0.12) / (viewportHeight * 0.6),
            0,
            1,
          )
        : 0;
      const easedFooter = footerProgress * footerProgress * (3 - 2 * footerProgress);
      const previousFooter = choreography.current.footer;
      const footerDirection =
        easedFooter > previousFooter + 0.002
          ? 1
          : easedFooter < previousFooter - 0.002
            ? -1
            : choreography.current.footerDirection;
      choreography.current = {
        scroll: storyProgress,
        footer: easedFooter,
        startedAt: choreography.current.startedAt || now,
        footerDirection,
        holdUntil,
        lastFrameAt: now,
      };
      const footerX = closingButton
        ? mobile
          ? clamp(closingButton.left - 126, 8, viewportWidth - 118)
          : closingButton.right + 18 + 180 < viewportWidth
            ? closingButton.right + 18
            : closingButton.left - 198
        : mobile
          ? viewportWidth - 130
          : viewportWidth * 0.76;
      const footerY = closingButton
        ? clamp(closingButton.top - 104, viewportHeight * 0.28, viewportHeight * 0.72)
        : footer
          ? clamp(footer.top + 150, viewportHeight * 0.28, viewportHeight * 0.72)
          : sideY;
      x += (footerX - sideX) * easedFooter;
      y += (footerY - sideY) * easedFooter;

      const width = startWidth + (mobile ? 0 : 16) * easedExit;
      walker.style.setProperty('--walker-x', `${x.toFixed(1)}px`);
      walker.style.setProperty('--walker-y', `${y.toFixed(1)}px`);
      walker.style.setProperty('--walker-width', `${width.toFixed(1)}px`);
      walker.style.setProperty(
        '--walker-height',
        `${String((camera ? clamp(camera.height, 166, 256) : 220) + 34 * easedExit)}px`,
      );
      walker.dataset['escaped'] = String(easedExit > 0.12);
      walker.dataset['wander'] = String(easedFooter > 0.85);
      walker.dataset['mobile'] = String(mobile);
      const note = walkerNoteRef.current;
      if (note) {
        note.style.left = `${(x + width * 0.5).toFixed(1)}px`;
        note.style.top = `${(y - 40).toFixed(1)}px`;
        note.hidden = storyProgress < 0.045 || storyProgress > 0.13 || easedFooter > 0.02;
      }
      if (Math.abs(requestedProgress - storyProgress) > 0.001 || now < holdUntil) queue();
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    paint();
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue, { passive: true });
    return () => {
      removeEventListener('scroll', queue);
      removeEventListener('resize', queue);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <main className="tavi-site">
      <header className="site-nav">
        <a className="site-mark" href="/" aria-label="Tavi home">
          tavi
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 1.5 11.8 7l5.4-2.7-2.7 5.4 5.5 1.8-5.5 1.8 2.7 5.4-5.4-2.7-1.8 5.5-1.8-5.5-5.4 2.7 2.7-5.4L0 11.5l5.5-1.8-2.7-5.4L8.2 7 10 1.5Z" />
          </svg>
        </a>
        <nav aria-label="Main navigation">
          <a href="#the-scene">Meet Tavi</a>
          <a href="#personality">How it feels</a>
          <a className="nav-cta" href="/studio">
            Open Studio <ArrowUpRight size={15} />
          </a>
        </nav>
      </header>

      <section className="site-hero" id="the-scene" data-cue="opening">
        <div className="hero-copy">
          <h1>
            Your stream,
            <br />
            <em>with a little more life.</em>
          </h1>
          <p className="hero-description">
            A familiar face in the corner. Someone to celebrate the wins, notice the quiet, and make
            your stream feel a little more like yours.
          </p>
          <div className="hero-actions">
            <button
              className="button-primary"
              type="button"
              aria-controls="demo"
              aria-pressed={demoPlaying}
              onClick={() => {
                setDemoRun((run) => run + 1);
              }}
            >
              {demoPlaying ? 'Replay the scene' : 'Watch the product demo'}{' '}
              <Play size={15} fill="currentColor" />
            </button>
          </div>
        </div>

        <div
          className={`stream-stage${demoPlaying ? ' is-playing' : ''}${streamStarted ? ' is-stream-started' : ''}`}
          aria-label="Illustrative stream preview"
        >
          <div className="stage-light stage-light-a" />
          <div className="stage-light stage-light-b" />
          <div className="stream-window" id="demo" ref={streamRef}>
            <div className="stream-video">
              <div className="video-image" />
              <div className="video-vignette" />
              <div className="scene-title">
                <span>TAVI</span>
                <b>Your stream companion</b>
              </div>
              <div className="scene-player">
                <span className="player-mark">m</span>
                <span>mira is wandering</span>
                <span className="player-dot" />
              </div>
              <div className="stream-meta">
                <span className="preview-tag">SCENE PREVIEW</span>
                <span>
                  <VolumeX size={12} /> Sound off
                </span>
              </div>
              <div
                className="webcam-window"
                ref={webcamRef}
                aria-label="Tavi in the stream webcam panel"
              >
                <div className="cam-shine" />
                <span className="cam-label">TAVI CAM</span>
                <span className="cam-record">
                  <i /> {streamStarted ? 'LIVE DEMO' : 'STARTING'}
                </span>
              </div>
            </div>
            <div className="stream-rail">
              <div className="rail-header">
                <span>tavi</span>
                <span>CHAT</span>
              </div>
              <div className="chat-line chat-companion-line">
                <b className="user-violet">tavi</b>
                <span>Your stream companion</span>
              </div>
              <div className="chat-line">
                <b className="user-violet">luma</b>
                <span>that little bridge ✨</span>
              </div>
              <div className="chat-line">
                <b className="user-peach">pixelpocket</b>
                <span>the lighting is unreal</span>
              </div>
              <div className="chat-line">
                <b className="user-blue">mossy</b>
                <span>tavi found the good spot</span>
              </div>
              <div className="chat-line">
                <b className="user-gold">fern.exe</b>
                <span>staying here forever</span>
              </div>
              <div className="chat-input">
                <MessageCircle size={13} />
                <span>Say something kind...</span>
              </div>
            </div>
            <div className="stream-controls">
              <span className="stream-live">
                <i /> {streamStarted ? 'FICTIONAL SCENE' : 'SIGNAL SEARCHING'}
              </span>
              <span>{demoPlaying ? 'A little moment' : 'SCENE PREVIEW'}</span>
              <div className="stream-meter">
                <i />
              </div>
              <span>HD</span>
            </div>
          </div>
          <div className="stage-caption">
            <span className="caption-rule" /> A tiny window into Tavi’s world
          </div>
        </div>
        <div className="scroll-cue">
          <span>Keep going. Tavi’s coming with you.</span>
          <ArrowDown size={14} />
        </div>
      </section>

      <section className="story-section story-one" id="personality" data-cue="personality">
        <div className="story-copy">
          <h2>
            Not another thing
            <br />
            to manage.
          </h2>
          <p className="section-knot">
            <Heart size={14} /> A little company
          </p>
          <p>
            Tavi keeps you company in the corner of the stream: a little hello, a glance at chat, a
            quiet celebration when the moment calls for it.
          </p>
          <span className="story-note">Small presence. Real personality.</span>
        </div>
        <div className="story-art story-art-chat" aria-hidden="true">
          <div className="chat-scene-window">
            <div className="scene-slice" />
            <div className="chat-pop chat-pop-a">
              <span className="chat-avatar lilac" /> wait did you see that?
            </div>
            <div className="chat-pop chat-pop-b">
              <span className="chat-avatar peach" /> Tavi did 😂
            </div>
            <div className="chat-pop chat-pop-c">
              <Sparkles size={14} /> little moments matter
            </div>
            <div className="scene-orbit orbit-a" />
            <div className="scene-orbit orbit-b" />
          </div>
          <div className="art-shadow" />
        </div>
      </section>

      <section className="story-section story-two" data-cue="presence">
        <div className="story-copy">
          <h2>
            A companion who
            <br />
            knows where to look.
          </h2>
          <p className="section-knot">
            <Eye size={15} /> In the room with you
          </p>
          <p>
            Tavi can orient toward you, chat, or the scene. It feels less like an overlay and more
            like someone sharing the room.
          </p>
          <span className="story-note">Aware of the scene around it.</span>
        </div>
        <div className="story-art story-art-aware" aria-hidden="true">
          <div className="aware-room">
            <div className="room-window">
              <div className="room-moon" />
              <div className="room-mountain" />
              <div className="room-mountain second" />
            </div>
            <div className="room-desk" />
            <div className="room-lamp" />
            <div className="attention-line" />
            <div className="attention-dot" />
            <span className="room-label">a glance toward the scene</span>
          </div>
        </div>
      </section>

      <section className="closing-scene" ref={footerRef} data-cue="ending">
        <div className="closing-light" />
        <div className="closing-copy">
          <h2>
            Make a little
            <br />
            you.
          </h2>
          <p className="section-knot">
            <Sparkles size={14} /> There’s room for one more
          </p>
          <p>
            Shape a familiar face, choose a favorite perch, and let Tavi find its place in your
            stream.
          </p>
          <a className="button-primary closing-button" href="/studio" ref={closingButtonRef}>
            Make Tavi yours <ArrowUpRight size={16} />
          </a>
          <span className="closing-footnote">
            Start in Studio. Bring Tavi to your stream when you’re ready.
          </span>
        </div>
        <div className="closing-floor" />
        <div className="footer-signoff">
          <a className="site-mark" href="/">
            tavi
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 1.5 11.8 7l5.4-2.7-2.7 5.4 5.5 1.8-5.5 1.8 2.7 5.4-5.4-2.7-1.8 5.5-1.8-5.5-5.4 2.7 2.7-5.4L0 11.5l5.5-1.8-2.7-5.4L8.2 7 10 1.5Z" />
            </svg>
          </a>
          <span>A little life in the corner.</span>
        </div>
      </section>

      <div className="page-walker" ref={walkerRef} aria-hidden="true">
        <div className="walker-aura" />
        <Avatar state={characterState} presentation="portrait" directTracks={landingTracks} />
      </div>
      <div className="page-walker-note" ref={walkerNoteRef} aria-hidden="true">
        Wait for me!
      </div>
    </main>
  );
}
