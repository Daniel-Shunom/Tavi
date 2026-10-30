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
import type { ExpressionId } from '../shared/expressions';
import { defaults, initialState } from '../shared/protocol';
import type { State } from '../shared/protocol';
import type { TrackApplication } from './renderer/adapter';
import { CrtScene } from './CrtScene';
import {
  VisitorTracker,
  tabletopTracks,
  tabletopNodes,
  type TabletopFrame,
} from './landing/tabletop';
import type { Measures } from './landing/choreography';
import { PageCompanion, type PageStation } from './landing/descent';
import { LookLine } from './landing/lookLine';
import { TWITCH_GLITCH, lockup, paintDither } from './landing/dither';

/**
 * The large Twitch x Codex lockup set into the closing light: centred, high in the light's box
 * above the headline, at the same mild dot density as everything else in the dither.
 */
const CLOSING_LOCKUP = { x: 0.5, y: 0.12, height: 120, level: 0.34 };
import { TaviLife, type LifeCue, type Posture } from './landing/life';
import { AWAY, VisitorReactions } from './landing/reactions';
import { HeroGaze, type GazeFrame } from './landing/heroGaze';
import { sceneLayoutRect } from './landing/sceneLayout';
import './landing.css';

/**
 * The character's box on the page: the artboard is drawn `BODY_FRACTION` of the box tall with
 * its soles line at `SOLES_FRACTION`, leaving room below for hanging legs and above for hops.
 */
const BODY_FRACTION = 0.58;
const SOLES_FRACTION = 0.76;
const BOX_ASPECT = 0.86;
/** Tavi's eye line above her soles, in body heights (a big chibi head sits low). */
const EYE_LINE = 0.45;

/** An element's layout box in page pixels: scroll and CSS transforms do not enter it. */
function pageRect(element: HTMLElement) {
  let left = 0,
    top = 0,
    node: HTMLElement | null = element;
  while (node) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { left, top, width: element.offsetWidth, height: element.offsetHeight };
}

/** The rotation of a gently tilted illustration, in radians. */
function tiltOf(element: HTMLElement) {
  const match = /matrix\(([^,]+),\s*([^,]+)/.exec(getComputedStyle(element).transform);
  return match ? Math.atan2(Number(match[2]), Number(match[1])) : 0;
}

function demoState(
  expression: ExpressionId,
  playing: boolean,
  greeting = 0,
  life: LifeCue | null = null,
): State {
  const base = initialState({
    ...defaults,
    character: 'tavi-refined',
    // The landing shows Tavi at her liveliest; saved studio/overlay configurations are untouched.
    personality: 'playful',
    energy: 75,
    captions: { studio: false, overlay: false },
  });
  const now = Date.now();
  // A greeting beats the demo, which beats her idle life, which beats her resting face.
  const cue = greeting ? 'wave' : playing ? 'excited' : (life?.id ?? expression);
  const hold = !greeting && !playing && life ? life.hold : 2.4;
  return {
    ...base,
    performance: {
      ...base.performance,
      phase: 'reacting',
      movement: null,
      script: {
        id: `landing-${cue}-${String(greeting)}-${String(life?.n ?? 0)}`,
        sourceEventId: `landing-${cue}`,
        source: 'idle',
        decidedBy: { kind: 'local', label: 'Landing page cue (not AI)' },
        priority: 0,
        startAt: now,
        expiresAt: now + Math.max(4500, hold * 1000 + 1500),
        beats: [beat(cue, { target: 'pointer', hold })],
        settle: true,
        dropped: [],
      },
    },
  };
}

export function LandingPage() {
  const deskRef = useRef<HTMLDivElement>(null);
  const webcamRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const closingCopyRef = useRef<HTMLDivElement>(null);
  const closingFloorRef = useRef<HTMLDivElement>(null);
  const closingButtonRef = useRef<HTMLAnchorElement>(null);
  const chatPerchRef = useRef<HTMLDivElement>(null);
  const roomPerchRef = useRef<HTMLDivElement>(null);
  const closingDitherRef = useRef<HTMLCanvasElement>(null);
  const walkerRef = useRef<HTMLDivElement>(null);
  const heroShadowRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);
  const lookRef = useRef<SVGSVGElement>(null);
  const noiseRef = useRef<HTMLCanvasElement>(null);
  const [nativeScreen, setNativeScreen] = useState(false);
  // The opening waits for the TV (shown), then for the picture, Tavi and the fonts (revealed).
  const [sceneShown, setSceneShown] = useState(false);
  const readiness = useRef({ picture: false, tavi: false, fonts: false });
  const companion = useRef(new PageCompanion());
  const visitor = useRef(new VisitorTracker());
  const tableFrame = useRef<TabletopFrame | null>(null);
  const gaze = useRef(new HeroGaze());
  const gazeFrame = useRef<GazeFrame | null>(null);
  const repaint = useRef<() => void>(() => undefined);
  const [greeting, setGreeting] = useState(0);
  const [sceneExpression, setSceneExpression] = useState<ExpressionId | null>(null);
  const [lifeCue, setLifeCue] = useState<LifeCue | null>(null);
  const [reactionCue, setReactionCue] = useState<LifeCue | null>(null);
  const reactions = useRef(new VisitorReactions());
  const life = useRef(new TaviLife());
  const lastSceneExpression = useRef<ExpressionId | null>(null);
  const lastGreeting = useRef(0);
  const [canGreet, setCanGreet] = useState(false);
  const opening = useRef({ streamStarted: false, startedAt: 0 });
  const [streamStarted, setStreamStarted] = useState(false);
  const [streamStarting, setStreamStarting] = useState(false);
  const [introSkipped, setIntroSkipped] = useState(false);
  const [demoRun, setDemoRun] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(false);
  opening.current.streamStarted = streamStarted;
  const characterState = useMemo(
    () =>
      demoState(
        sceneExpression ?? (streamStarted ? 'content' : 'thinking'),
        demoPlaying,
        greeting,
        // Reacting to the visitor comes before her own idle moves.
        sceneExpression ? null : (reactionCue ?? lifeCue),
      ),
    [streamStarted, demoPlaying, greeting, sceneExpression, lifeCue, reactionCue],
  );
  useEffect(() => {
    if (!greeting) return;
    const timer = window.setTimeout(() => {
      setGreeting(0);
    }, 3000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [greeting]);
  const landingTracks = (): TrackApplication[] =>
    tableFrame.current ? tabletopTracks(tableFrame.current, gazeFrame.current) : [];
  const landingNodes = () =>
    tableFrame.current ? tabletopNodes(tableFrame.current, gazeFrame.current) : {};
  const landingTravel = () => tableFrame.current?.travel;
  const sayHello = () => {
    companion.current.greet();
    repaint.current();
  };

  // Her first drawn frame: she fades in, and the opening may reveal the signal.
  const taviDrawn = () => {
    if (readiness.current.tavi) return;
    readiness.current.tavi = true;
    walkerRef.current?.setAttribute('data-tavi-ready', 'true');
  };
  const sceneReady = (ready: boolean) => {
    setNativeScreen(ready);
    setSceneShown(true);
  };

  // The closing light, dithered like the hero's: painted once per size, never per frame.
  useEffect(() => {
    const canvas = closingDitherRef.current;
    if (!canvas) return;
    let painted = '';
    let cancelled = false;
    const glitch = new Image();
    glitch.src = TWITCH_GLITCH;
    const paint = (force = false) => {
      const key = `${String(canvas.clientWidth)}x${String(canvas.clientHeight)}`;
      if (key === painted && !force) return;
      painted = key;
      // Smaller on narrow screens, so the lockup always fits across the light.
      const height = Math.min(CLOSING_LOCKUP.height, canvas.clientWidth * 0.11);
      paintDither(
        canvas,
        'on',
        { center: { x: 0.5, y: 1 }, radius: { x: 0.46, y: 0.95 }, seam: 1 },
        2,
        lockup(glitch, CLOSING_LOCKUP.x, CLOSING_LOCKUP.y, height, canvas.clientWidth),
        // Large, so sparser dots: it stays a mild watermark in the light.
        CLOSING_LOCKUP.level,
      );
    };
    const size = new ResizeObserver(() => {
      paint();
    });
    size.observe(canvas);
    paint();
    void glitch
      .decode()
      .then(() => document.fonts.ready)
      .then(() => {
        if (!cancelled) paint(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      size.disconnect();
    };
  }, []);

  useEffect(() => {
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-visible', 'true');
            reveal.unobserve(entry.target);
          }
      },
      { rootMargin: '0px 0px -18% 0px' },
    );
    document.querySelectorAll('[data-reveal]').forEach((section) => {
      reveal.observe(section);
    });
    return () => {
      reveal.disconnect();
    };
  }, []);

  useEffect(() => {
    void document.fonts.ready.then(() => {
      readiness.current.fonts = true;
    });
    // A slow network never holds the page blank: the scene shows after 4 s regardless.
    const timer = window.setTimeout(() => {
      setSceneShown(true);
    }, 4000);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  // Television static before the stream starts: real noise drawn at a quarter resolution, with a
  // slow vertical roll bar, flicker and the odd horizontal tear; a still frame under reduced motion.
  useEffect(() => {
    const canvas = noiseRef.current;
    if (!canvas || streamStarted || nativeScreen) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const width = 192;
    const height = 120;
    canvas.width = width;
    canvas.height = height;
    const image = context.createImageData(width, height);
    const data = image.data;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let seed = 1;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const draw = (time: number) => {
      const roll = ((time / 2600) % 1) * (height + 24) - 12;
      const flicker = 0.78 + 0.22 * random();
      const tear = random() < 0.08 ? Math.floor(random() * height) : -1;
      for (let y = 0; y < height; y++) {
        const band = Math.max(0, 1 - Math.abs(y - roll) / 12) * 0.35;
        const shift = y === tear || y === tear + 1 ? Math.floor(random() * 12) : 0;
        for (let x = 0; x < width; x++) {
          const grain = random();
          const value = Math.min(255, (34 + grain * grain * 200) * flicker + band * 120);
          const index = (y * width + ((x + shift) % width)) * 4;
          data[index] = value;
          data[index + 1] = value * 0.98;
          data[index + 2] = value * 1.06;
          data[index + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      if (!still) raf = requestAnimationFrame(draw);
    };
    draw(0);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [streamStarted, nativeScreen]);

  useEffect(() => {
    if (!sceneShown) return;
    if (introSkipped && !demoRun) return;
    if (demoRun) setIntroSkipped(false);
    const finish = () => {
      opening.current.startedAt = performance.now();
      setStreamStarting(false);
      setStreamStarted(true);
      setDemoPlaying(false);
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    setStreamStarted(false);
    setStreamStarting(false);
    setDemoPlaying(demoRun > 0);
    let glitchTimer: number | undefined;
    let timer: number | undefined;
    // The static runs its authored length while the camera pushes in, then holds until the
    // picture, Tavi and the fonts are in, so the signal locks onto a complete scene. A slow
    // connection gets at most 4 s more of static.
    const shortest = demoRun ? 2200 : 2800;
    const began = performance.now();
    const check = () => {
      const waited = performance.now() - began;
      const { picture, tavi, fonts } = readiness.current;
      if ((picture && tavi && fonts) || waited >= shortest + 4000) {
        setStreamStarting(true);
        glitchTimer = window.setTimeout(finish, 720);
      } else timer = window.setTimeout(check, 100);
    };
    timer = window.setTimeout(check, shortest);
    const skip = () => {
      if (window.scrollY <= 8 || opening.current.streamStarted) return;
      window.clearTimeout(timer);
      window.clearTimeout(glitchTimer);
      setIntroSkipped(true);
      finish();
    };
    window.addEventListener('scroll', skip, { passive: true });
    skip();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(glitchTimer);
      window.removeEventListener('scroll', skip);
    };
  }, [demoRun, introSkipped, sceneShown]);

  useEffect(() => {
    const walker = walkerRef.current;
    const desk = deskRef.current;
    if (!walker || !desk) return;
    let raf = 0;
    let last = 0;
    let lastAction = '';
    let lastCue = 0;
    let lastReaction = 0;
    // Experiment: now and then, standing beside the TV while it plays, she turns to watch it.
    let watchUntil = 0;
    let nextWatch = performance.now() + 14000;
    let watchReactAt = Infinity;
    let watchCount = 0;
    let scrolledAt = -Infinity;
    // How fast the visitor scrolls (viewport heights per second), fast attack and quick release.
    let scrollPace = 0;
    // The same pace, held about a second: it sets her tempo for the trip that follows a flick.
    let tripPace = 0;
    let scrollFrom = { y: window.scrollY, at: performance.now() };
    const scrolled = () => {
      const at = performance.now();
      const seconds = (at - scrollFrom.at) / 1000;
      if (seconds > 0)
        scrollPace = Math.max(
          scrollPace,
          Math.abs(window.scrollY - scrollFrom.y) /
            Math.max(window.innerHeight, 1) /
            Math.max(seconds, 1 / 60),
        );
      scrollFrom = { y: window.scrollY, at };
      scrolledAt = at;
      queue();
    };
    // Where she was before her latest leap, and how far down the page she has been.
    let lastStation = 0,
      departFrom = 0,
      deepest = 0;
    // A visitor away from the page (another tab, or the pointer off the window) for a while.
    let awaySince: number | null = null;
    let returned = false;
    const comeBack = () => {
      if (awaySince !== null && performance.now() - awaySince > AWAY * 1000) returned = true;
      awaySince = null;
    };
    const noticeVisibility = () => {
      if (document.hidden) awaySince ??= performance.now();
      else comeBack();
      queue();
    };
    const greetTarget = walker.querySelector<HTMLElement>('.tabletop-greeting');
    const cta = closingButtonRef.current;
    const hoverCta = () => {
      companion.current.setCtaHover(true);
    };
    const leaveCta = () => {
      companion.current.setCtaHover(false);
    };
    const look = lookRef.current ? new LookLine(lookRef.current) : null;
    let available: boolean | undefined;
    let visible = true;
    // The visitor's pointer in client pixels, and when it last moved.
    let pointer: { x: number; y: number } | null = null;
    let movedAt = -Infinity;
    const trackPointer = (event: PointerEvent) => {
      if (!pointer) comeBack();
      pointer = { x: event.clientX, y: event.clientY };
      movedAt = performance.now();
    };
    const losePointer = (event: MouseEvent) => {
      if (event.relatedTarget) return;
      pointer = null;
      awaySince ??= performance.now();
    };
    let layout: {
      bodyPx: number;
      stage: ReturnType<typeof pageRect>;
      stations: PageStation[];
      pageHeight: number;
    } | null = null;
    const measureLayout = (bodyPx: number) => {
      // Stations down the page, in the stage's own pixels: the section art to perch on, then the
      // closing floor beside the call to action.
      const stage = pageRect(desk);
      const stations: PageStation[] = [];
      const perch = (element: HTMLElement | null, spot: number, scene: 'chat' | 'room') => {
        if (!element) return;
        const box = pageRect(element);
        const left = box.left - stage.left;
        stations.push({
          kind: 'perch',
          scene,
          left,
          right: left + box.width,
          top: box.top - stage.top,
          tilt: tiltOf(element),
          spot: left + box.width * spot,
        });
      };
      perch(chatPerchRef.current, 0.74, 'chat');
      perch(roomPerchRef.current, 0.26, 'room');
      const floorLine = closingFloorRef.current,
        button = closingButtonRef.current;
      if (floorLine && button) {
        const line = pageRect(floorLine),
          cta = pageRect(button);
        const left = line.left - stage.left,
          right = left + line.width;
        stations.push({
          kind: 'floor',
          scene: 'floor',
          cover: { left: cta.left - stage.left, right: cta.left - stage.left + cta.width },
          left,
          right,
          top: line.top - stage.top,
          tilt: 0,
          spot: Math.min(cta.left - stage.left + cta.width + bodyPx * 0.85, right - bodyPx * 0.4),
        });
      }
      return { bodyPx, stage, stations, pageHeight: document.documentElement.scrollHeight };
    };
    const paint = () => {
      raf = 0;
      const now = performance.now();
      // Read before this frame's style writes; scale covers the intro's CSS zoom on the desk.
      const deskBox = desk.getBoundingClientRect();
      const deskScale = desk.offsetWidth ? deskBox.width / desk.offsetWidth : 1;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      const vw = window.innerWidth,
        vh = window.innerHeight;
      const cam = sceneLayoutRect(webcamRef.current, desk);
      const bodyPx = Math.min(vw < 720 ? 160 : 220, cam ? cam.height * 1.6 : 220);
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const measures: Measures = {
        vw,
        vh,
        scrollY: 0,
        maxScroll: 0,
        cam,
        screen: sceneLayoutRect(streamRef.current, desk),
        copy: null,
        floor: null,
        mobile: vw < 720,
        bodyPx,
      };
      // The pointer in the desk's own layout pixels, for chasing and the idle-visitor episode.
      const local = pointer
        ? { x: (pointer.x - deskBox.left) / deskScale, y: (pointer.y - deskBox.top) / deskScale }
        : null;
      // Page layout changes only with size, fonts and content, never with scroll: measure it
      // once and again only when something resizes, not on every frame.
      if (!layout || layout.bodyPx !== bodyPx) layout = measureLayout(bodyPx);
      const { stage, stations, pageHeight } = layout;
      const step = streamStarted ? dt : 0;
      const frame = companion.current.update(
        step,
        measures,
        stations,
        {
          top: window.scrollY - stage.top,
          height: vh,
          atBottom: window.scrollY >= pageHeight - vh - 4,
          pace: (tripPace = Math.max(tripPace * Math.exp(-dt / 0.9), scrollPace)),
        },
        still,
        visitor.current.update(step, local, measures, (now - movedAt) / 1000),
      );
      if (!frame) return;
      tableFrame.current = frame;
      const current = frame.placement;
      // The stop scenes: what she looks at, the chat she reads, and the section's highlights.
      const scene = frame.scene ?? null;
      const chat = chatPerchRef.current,
        room = roomPerchRef.current,
        cta = closingButtonRef.current;
      if (chat) {
        chat.dataset['revealed'] = String(companion.current.revealed);
        chat.dataset['look'] = scene?.name === 'chat' ? (scene.look ?? '') : '';
      }
      if (room) room.dataset['look'] = scene?.name === 'room' ? (scene.look ?? '') : '';
      if (cta)
        cta.dataset['presented'] = String(scene?.name === 'floor' && scene.look === 'button');
      const lookAt = (name: string | null) => {
        const element =
          name === 'bubble-0' || name === 'bubble-1' || name === 'bubble-2'
            ? chat?.querySelectorAll<HTMLElement>('.chat-pop')[Number(name.slice(-1))]
            : name === 'dot'
              ? room?.querySelector<HTMLElement>('.attention-dot')
              : name === 'line-end'
                ? room?.querySelector<HTMLElement>('.attention-line')
                : name === 'button'
                  ? cta
                  : null;
        if (!element) return null;
        const box = element.getBoundingClientRect();
        // The attention line runs down and to the right; look at its far end.
        return name === 'line-end'
          ? { x: box.right, y: box.bottom }
          : { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      };
      const expression = scene?.expression ?? null;
      if (expression !== lastSceneExpression.current) {
        lastSceneExpression.current = expression;
        setSceneExpression(expression);
      }
      const head = {
        x: deskBox.left + current.x * deskScale,
        y: deskBox.top + (current.y - bodyPx * EYE_LINE) * deskScale,
      };
      // Watching the TV: eyes on the middle of the screen, body turned toward it.
      const watching = now < watchUntil;
      const screenBox = watching ? streamRef.current?.getBoundingClientRect() : undefined;
      const focus = screenBox
        ? { x: screenBox.left + screenBox.width / 2, y: screenBox.top + screenBox.height / 2 }
        : lookAt(scene?.look ?? null);
      look?.update(scene?.look ?? null, focus ? head : null, focus, bodyPx * deskScale * 0.17);
      // Her idle life: what she does with herself, from where she is and what the visitor does.
      const landed = frame.action === 'land' && lastAction !== 'land';
      if (!still && step > 0) {
        const sceneBusy = Boolean(
          scene && (scene.look !== null || scene.expression !== null || scene.present > 0.01),
        );
        const moving =
          frame.weight > 0.001 ||
          frame.jump !== null ||
          ['crouch', 'air', 'land', 'react'].includes(frame.action);
        const posture: Posture =
          moving || sceneBusy || frame.behind || (frame.seated > 0.001 && frame.seated < 0.99)
            ? 'busy'
            : frame.seated >= 0.99
              ? frame.seatPose === 'floor'
                ? 'floor-sit'
                : 'perch'
              : 'stand';
        const sprinting = frame.gaits.some((g) => g.foundation === 'sprint' && g.mix > 0.5);
        const near =
          pointer !== null &&
          Math.hypot(pointer.x - head.x, pointer.y - head.y) < bodyPx * deskScale * 1.4;
        const lived = life.current.update({
          dt: step,
          posture,
          roomy:
            frame.surface === 'desk' || (frame.surface === 'page' && frame.seatPose === 'floor'),
          exertion: frame.jump ? 0.6 : frame.weight * (sprinting ? 1 : 0.45),
          impact: landed ? (frame.jump?.crouch ?? 0) : 0,
          visitorActive: now - movedAt < 2000 || now - scrolledAt < 2000,
          visitorNear: near,
        });
        // Her reactions to the visitor, each with a cause in what they just did.
        const station = frame.station ?? 0;
        const departing = station !== lastStation && !landed;
        if (departing) departFrom = lastStation;
        lastStation = station;
        deepest = Math.max(deepest, station);
        const box = greetTarget?.getBoundingClientRect();
        const onHer =
          pointer !== null &&
          box !== undefined &&
          frame.depth === 'front' &&
          !frame.behind &&
          pointer.x >= box.left &&
          pointer.x <= box.right &&
          pointer.y >= box.top &&
          pointer.y <= box.bottom;
        const homeAgain = landed && frame.surface === 'desk' && deepest >= 2;
        if (homeAgain) deepest = 0;
        const reacted = reactions.current.update({
          dt: step,
          pointerNear: near,
          pointerOn: onHer,
          departing,
          scrollPace,
          longFallLanded: landed && frame.surface === 'page' && station - departFrom >= 2,
          homeAgain,
          returned,
          free: posture !== 'busy' && frame.depth === 'front',
        });
        returned = false;
        if (reacted.greet) companion.current.greet();
        const reactionKey = reacted.cue?.n ?? 0;
        if (reactionKey !== lastReaction) {
          lastReaction = reactionKey;
          setReactionCue(reacted.cue);
        }
        if (lived.pause > 0) companion.current.pause(lived.pause);
        // TV watching (experiment): only while the picture plays and she is free, never over
        // another move or reaction; she faces the TV side-on (the live rig has no back view).
        if (watching && (!companion.current.canWatchTv || lived.cue || reacted.cue)) {
          watchUntil = 0;
          companion.current.watchTv(null);
        } else if (watching && now >= watchReactAt) {
          // Something on the channel amuses her.
          watchReactAt = Infinity;
          setReactionCue({ id: 'amused', n: 9000 + ++watchCount, hold: 1.6 });
        } else if (!watching && watchUntil !== 0) {
          watchUntil = 0;
          companion.current.watchTv(null);
          nextWatch = now + 20000 + Math.random() * 12000;
        } else if (
          !watching &&
          now >= nextWatch &&
          streamStarted &&
          companion.current.canWatchTv &&
          !lived.cue &&
          !reacted.cue
        ) {
          const tvBox = streamRef.current?.getBoundingClientRect();
          if (tvBox) {
            const toward = Math.sign(tvBox.left + tvBox.width / 2 - head.x) || 1;
            companion.current.watchTv(toward);
            companion.current.pause(5.5);
            watchUntil = now + 5000;
            watchReactAt = Math.random() < 0.55 ? now + 2200 : Infinity;
          }
        }
        walker.dataset['watching'] = String(now < watchUntil);
        companion.current.setTired(lived.energy < 0.35);
        companion.current.setMood(lived);
        frame.life = { legSwing: lived.legSwing, moving: lived.cue !== null, clock: now / 1000 };
        // What she is doing with herself, for inspection in devtools and recordings.
        walker.dataset['life'] = lived.dozing ? 'doze' : (lived.cue?.id ?? '');
        walker.dataset['swing'] = lived.legSwing.toFixed(2);
        const cueKey = lived.cue?.n ?? 0;
        if (cueKey !== lastCue) {
          lastCue = cueKey;
          setLifeCue(lived.cue);
        }
      }
      scrollPace *= Math.exp(-dt / 0.35);
      // Landing: a soft bloom of shadow spreads where her feet meet the surface, and fades.
      const bloom = bloomRef.current;
      if (bloom && landed && !still) {
        const impact = frame.jump?.crouch ?? 0.5;
        bloom.style.left = String(current.x) + 'px';
        bloom.style.top = String(frame.ground.y) + 'px';
        bloom.style.width = String(bodyPx * (0.42 + 0.3 * impact)) + 'px';
        bloom.animate(
          [
            { opacity: 0.16 + 0.14 * impact, transform: 'translate(-50%, -50%) scale(0.55)' },
            { opacity: 0, transform: 'translate(-50%, -50%) scale(1.35)' },
          ],
          { duration: 700, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
        );
      }
      lastAction = frame.action;
      gazeFrame.current = still
        ? null
        : gaze.current.update({
            dt,
            pointer,
            head,
            bodyPx: bodyPx * deskScale,
            facing: current.facing,
            walking: frame.weight,
            idleFor: (now - movedAt) / 1000,
            focus,
          });
      const height = bodyPx / BODY_FRACTION,
        width = height * BOX_ASPECT;
      walker.style.setProperty('--walker-x', String(current.x - width / 2) + 'px');
      walker.style.setProperty('--walker-y', String(current.y - height * SOLES_FRACTION) + 'px');
      walker.style.setProperty('--walker-width', String(width) + 'px');
      walker.style.setProperty('--walker-height', String(height) + 'px');
      walker.style.clipPath = '';
      walker.dataset['stage'] = 'tabletop';
      walker.dataset['heroDepth'] = frame.depth;
      walker.dataset['tableAction'] = frame.action;
      walker.dataset['tableSeated'] = String(frame.seated);
      // Off the desk she is somewhere down the page, so keep drawing her.
      const onScreen = visible || companion.current.away;
      walker.style.removeProperty('visibility');
      // Behind the call to action she draws under the closing copy and cannot be clicked.
      const hero = desk.closest<HTMLElement>('.site-hero');
      if (hero) hero.dataset['taviBehind'] = String(frame.behind ?? false);
      const nextAvailable = onScreen && frame.depth === 'front' && !frame.behind && nativeScreen;
      if (nextAvailable !== available) {
        available = nextAvailable;
        setCanGreet(available);
      }
      if (frame.reaction !== lastGreeting.current) {
        lastGreeting.current = frame.reaction;
        setGreeting(frame.reaction);
      }
      const shadow = heroShadowRef.current;
      if (shadow) {
        // The shadow stays on the surface below her and shrinks and fades as she rises.
        const lift = Math.min(1, frame.ground.lift / bodyPx);
        shadow.hidden = !onScreen || frame.depth !== 'front' || frame.seated > 0.5;
        shadow.style.left = String(current.x) + 'px';
        shadow.style.top = String(frame.ground.y) + 'px';
        shadow.style.width = String(bodyPx * 0.22 * (1 - 0.45 * lift)) + 'px';
        shadow.style.opacity = String(0.17 * (1 - 0.7 * lift));
      }
      if (onScreen && !still && !document.hidden) queue();
      else last = 0;
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    repaint.current = queue;
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      queue();
    });
    visibility.observe(desk);
    const size = new ResizeObserver(() => {
      layout = null;
      queue();
    });
    size.observe(desk);
    size.observe(document.body);
    for (const element of [
      chatPerchRef.current,
      roomPerchRef.current,
      closingFloorRef.current,
      closingButtonRef.current,
    ])
      if (element) size.observe(element);
    if (webcamRef.current) size.observe(webcamRef.current);
    paint();
    addEventListener('resize', queue, { passive: true });
    addEventListener('scroll', scrolled, { passive: true });
    addEventListener('pointermove', trackPointer, { passive: true });
    addEventListener('pointerdown', trackPointer, { passive: true });
    document.addEventListener('mouseout', losePointer);
    document.addEventListener('visibilitychange', noticeVisibility);
    cta?.addEventListener('pointerenter', hoverCta);
    cta?.addEventListener('pointerleave', leaveCta);
    return () => {
      removeEventListener('pointermove', trackPointer);
      removeEventListener('pointerdown', trackPointer);
      document.removeEventListener('mouseout', losePointer);
      visibility.disconnect();
      size.disconnect();
      removeEventListener('resize', queue);
      removeEventListener('scroll', scrolled);
      document.removeEventListener('visibilitychange', noticeVisibility);
      cta?.removeEventListener('pointerenter', hoverCta);
      cta?.removeEventListener('pointerleave', leaveCta);
      if (raf) cancelAnimationFrame(raf);
      repaint.current = () => undefined;
    };
  }, [streamStarted, nativeScreen]);

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
          ref={deskRef}
          style={{
            animationDuration: demoRun ? '2920ms' : '3520ms',
            animationName: demoRun % 2 ? 'crt-intro-replay' : 'crt-intro-zoom',
          }}
          className={`stream-stage${sceneShown ? ' is-scene-shown' : ''}${introSkipped ? ' is-intro-skipped' : ''}${nativeScreen ? ' has-native-screen' : ''}${demoPlaying ? ' is-playing' : ''}${streamStarting ? ' is-stream-starting' : ''}${streamStarted ? ' is-stream-started' : ''}`}
          aria-label="Fictional stream preview playing inside a curved cathode-ray television on a desk"
        >
          <div className="stage-light stage-light-a" />
          <div className="stage-light stage-light-b" />
          <CrtScene
            started={streamStarted}
            starting={streamStarting}
            walkerRef={walkerRef}
            streamRef={streamRef}
            webcamRef={webcamRef}
            onReady={sceneReady}
            onPicture={() => {
              readiness.current.picture = true;
            }}
          />
          <div className="stream-window" id="demo" ref={streamRef}>
            <canvas className="screen-noise" ref={noiseRef} aria-hidden="true" />
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
          <div className="hero-contact-shadow" ref={heroShadowRef} aria-hidden="true" hidden />
          <div className="landing-bloom" ref={bloomRef} aria-hidden="true" />
          <div
            className="page-walker"
            ref={walkerRef}
            aria-hidden={!canGreet}
            data-native-screen="false"
          >
            <Avatar
              state={characterState}
              presentation="portrait"
              directTracks={landingTracks}
              directNodes={landingNodes}
              directTravel={landingTravel}
              onDraw={taviDrawn}
              frame={{ height: BODY_FRACTION, bottom: SOLES_FRACTION, fitWidth: false }}
            />
            <button
              className="tabletop-greeting"
              type="button"
              aria-label="Say hello to Tavi"
              disabled={!canGreet}
              onClick={sayHello}
            >
              <span>Say hello</span>
            </button>
          </div>
          <div className="stage-caption">
            <span className="caption-rule" /> A tiny window into Tavi’s world
          </div>
        </div>
        <div className="scroll-cue">
          <span>A little company, right beside your stream.</span>
          <ArrowDown size={14} />
        </div>
      </section>

      <svg className="look-line" ref={lookRef} aria-hidden="true" data-showing="false">
        <defs>
          <linearGradient id="look-fade" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#a98ac4" stopOpacity="0" />
            <stop offset="0.3" stopColor="#a98ac4" stopOpacity="0.85" />
            <stop offset="1" stopColor="#e6b896" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <path pathLength={1} />
        <circle r="5" />
      </svg>

      <section
        className="story-section story-one"
        id="personality"
        data-cue="personality"
        data-reveal
      >
        <div className="story-copy">
          <h2>
            <span className="reveal-line">Not another thing</span>
            <span className="reveal-line">to manage.</span>
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
          <div className="chat-scene-window" ref={chatPerchRef}>
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

      <section className="story-section story-two" data-cue="presence" data-reveal>
        <div className="story-copy">
          <h2>
            <span className="reveal-line">A companion who</span>
            <span className="reveal-line">knows where to look.</span>
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
          <div className="aware-room" ref={roomPerchRef}>
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

      <section className="closing-scene" data-cue="ending" data-reveal>
        <div className="closing-light" />
        <canvas className="closing-dither" ref={closingDitherRef} aria-hidden="true" />
        <div className="closing-copy" ref={closingCopyRef}>
          <h2>
            <span className="reveal-line">Make a little</span>
            <span className="reveal-line">you.</span>
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
        <div className="closing-ground" aria-hidden="true" />
        <div className="closing-floor" ref={closingFloorRef} />
        <div className="footer-signoff">
          <a className="site-mark" href="/">
            tavi
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 1.5 11.8 7l5.4-2.7-2.7 5.4 5.5 1.8-5.5 1.8 2.7 5.4-5.4-2.7-1.8 5.5-1.8-5.5-5.4 2.7 2.7-5.4L0 11.5l5.5-1.8-2.7-5.4L8.2 7 10 1.5Z" />
            </svg>
          </a>
          <span className="footer-credit">
            TV footage: Pexels;{' '}
            <a href="https://commons.wikimedia.org/wiki/File:Flying_Over_the_Earth_at_Night_II.webm">
              Flying Over the Earth at Night II
            </a>{' '}
            by APOD Videos (NASA),{' '}
            <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>
          </span>
          <span>A little life in the corner.</span>
        </div>
      </section>
    </main>
  );
}
