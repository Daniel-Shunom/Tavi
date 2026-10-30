import { useEffect, useRef, type RefObject } from 'react';
import { createScreenPainter, GLASS } from './landing/crtScreen';
import { TvChannels } from './landing/tvChannels';
import {
  TWITCH_GLITCH,
  lockup,
  paintDither,
  type DitherLayer,
  type DitherMark,
} from './landing/dither';

/**
 * The dithered light in its own box (see .crt-dither: 2.1 stages wide, 2.1 tall, from 0.55 left
 * and 0.5 above the stage): the glass centre, the glow's reach and the foot of the desk.
 */
const LIGHT = {
  center: { x: 0.463, y: 0.45 },
  radius: { x: 0.45, y: 0.44 },
  seam: 0.696,
};
const DITHER_LAYERS: DitherLayer[] = ['off', 'on', 'seam'];
/**
 * A footnote set into the light on the wall just above the TV, centred over it: the Twitch glitch
 * (official asset, Twitch brand pack), a times sign, and Codex. In the dither box the set's centre
 * is at x 0.5 and its top at about y 0.28; the lockup sits a little above that.
 */
const FOOTNOTE = { x: 0.5, y: 0.253, height: 30 };

// The CC0 Poly Haven CRT and table, pre-rendered from the 3D scene by tools/crt-layers in the
// same lighting and camera, then stacked in 2D: table, Tavi when she is behind the TV, the live
// screen, the TV housing with its glass cut out. No WebGL here; the layers are tiny WebP files.

/** The orthographic camera the layers were rendered with: 0.56 model units tall, at y 0.228. */
const VIEW_HEIGHT = 0.56;
const VIEW_CENTER_Y = 0.228;

/** Where the glass sits in a stage of the given aspect, as percentages of the stage box. */
export function glassBox(aspect: number) {
  const viewWidth = VIEW_HEIGHT * aspect;
  return {
    left: ((GLASS.left + viewWidth / 2) / viewWidth) * 100,
    top: ((VIEW_CENTER_Y + VIEW_HEIGHT / 2 - GLASS.top) / VIEW_HEIGHT) * 100,
    width: ((GLASS.right - GLASS.left) / viewWidth) * 100,
    height: ((GLASS.top - GLASS.bottom) / VIEW_HEIGHT) * 100,
  };
}

const layer = (name: 'table' | 'tv') => ({
  src: `/media/crt/${name}-900.webp`,
  srcSet: `/media/crt/${name}-900.webp 900w, /media/crt/${name}-1800.webp 1800w`,
});

export function CrtScene({
  started,
  starting,
  walkerRef,
  streamRef,
  webcamRef,
  onReady,
  onPicture,
}: {
  started: boolean;
  starting: boolean;
  walkerRef: RefObject<HTMLDivElement | null>;
  streamRef: RefObject<HTMLDivElement | null>;
  webcamRef: RefObject<HTMLDivElement | null>;
  /** The TV and table layers are decoded and on screen (false if they failed to load). */
  onReady: (ready: boolean) => void;
  /** The stream picture can be drawn. */
  onPicture: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const channelsRef = useRef<TvChannels | null>(null);
  // The TV's lower dial changes the channel.
  const changeChannel = () => {
    channelsRef.current?.skip(performance.now());
  };
  const screenRef = useRef<HTMLCanvasElement>(null);
  const table = useRef<HTMLImageElement>(null);
  const dither = useRef<(HTMLCanvasElement | null)[]>([]);
  const tv = useRef<HTMLImageElement>(null);
  const latest = useRef({ started, starting, onReady, onPicture });
  latest.current = { started, starting, onReady, onPicture };
  // When the signal locked, for the title card's entrance; the card stays hidden until then
  // (including through the glitch, when the picture flickers in without it).
  const lockedAt = useRef(Infinity);
  useEffect(() => {
    lockedAt.current = started ? performance.now() : Infinity;
  }, [started]);

  useEffect(() => {
    const element = host.current,
      screen = screenRef.current;
    if (!element || !screen) return;
    let cancelled = false;
    const images = [table.current, tv.current].filter((image) => image !== null);
    void Promise.all(images.map((image) => image.decode())).then(
      () => {
        if (cancelled) return;
        element.dataset['ready'] = 'true';
        latest.current.onReady(true);
      },
      () => {
        if (cancelled) return;
        element.dataset['unavailable'] = 'true';
        latest.current.onReady(false);
      },
    );

    // The painter draws the signal straight into the screen canvas.
    const painter = createScreenPainter(screen);
    void painter.ready.then(() => {
      if (!cancelled) latest.current.onPicture();
    });
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // The glass, the canvas and the DOM screen anchor (which the page measures) share one box.
    const place = () => {
      const box = glassBox(Math.max(element.clientWidth, 1) / Math.max(element.clientHeight, 1));
      for (const target of [screen, streamRef.current]) {
        if (!target) continue;
        target.style.left = `${String(box.left)}%`;
        target.style.top = `${String(box.top)}%`;
        target.style.width = `${String(box.width)}%`;
        target.style.height = `${String(box.height)}%`;
      }
    };
    // The dithered light is painted once per size (a few milliseconds), never per frame, and
    // once more when the footnote's logo has loaded.
    let painted = '';
    const glitch = new Image();
    glitch.src = TWITCH_GLITCH;
    const marks = (): DitherMark[] =>
      lockup(glitch, FOOTNOTE.x, FOOTNOTE.y, FOOTNOTE.height, dither.current[0]?.clientWidth ?? 1);
    const light = (force = false) => {
      const key = `${String(element.clientWidth)}x${String(element.clientHeight)}`;
      if (key === painted && !force) return;
      painted = key;
      DITHER_LAYERS.forEach((name, i) => {
        const canvas = dither.current[i];
        if (canvas) paintDither(canvas, name, LIGHT, 2, name === 'seam' ? [] : marks());
      });
    };
    void glitch
      .decode()
      .then(() => document.fonts.ready)
      .then(() => {
        if (!cancelled) light(true);
      })
      .catch(() => undefined);
    const size = new ResizeObserver(() => {
      place();
      light();
    });
    size.observe(element);
    place();
    light();

    let raf = 0;
    let lastPaint = 0;
    let visible = true;
    // Calm licensed loops take over the screen after the opening still (not under reduced motion).
    const channels = still ? null : new TvChannels();
    channelsRef.current = channels;
    const tick = (time: number) => {
      if (cancelled) return;
      raf = requestAnimationFrame(tick);
      // The signal is a 30 fps picture; nothing to draw while it is off screen or hidden.
      if (!visible || document.hidden || time - lastPaint < 1000 / 30) return;
      lastPaint = time;
      if (latest.current.started) channels?.start(time);
      const tv = channels?.update(time);
      painter.paint(
        time,
        {
          ...latest.current,
          avatar: null,
          walker: walkerRef.current,
          screen: streamRef.current,
          webcam: webcamRef.current,
          since: time - lockedAt.current,
          channel: latest.current.started ? (tv?.channel ?? null) : null,
          switching: tv?.switching ?? false,
        },
        still,
      );
    };
    raf = requestAnimationFrame(tick);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      channels?.setVisible(visible);
    });
    observer.observe(element);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      size.disconnect();
      painter.dispose();
      channels?.dispose();
      channelsRef.current = null;
    };
  }, [walkerRef, streamRef, webcamRef]);

  return (
    <>
      <div className="crt-scene" ref={host} aria-hidden="true">
        <div className="crt-room" />
        {DITHER_LAYERS.map((name, i) => (
          <canvas
            key={name}
            className={`crt-dither crt-dither-${name}`}
            ref={(canvas) => {
              dither.current[i] = canvas;
            }}
          />
        ))}
        <img
          className="crt-layer crt-table"
          ref={table}
          {...layer('table')}
          sizes="(max-width: 900px) 100vw, 900px"
          alt=""
          fetchPriority="high"
          draggable={false}
        />
        <canvas className="crt-screen" ref={screenRef} />
        <img
          className="crt-layer crt-tv"
          ref={tv}
          {...layer('tv')}
          sizes="(max-width: 900px) 100vw, 900px"
          alt=""
          fetchPriority="high"
          draggable={false}
        />
      </div>
      {/* The TV's lower dial changes the channel (the dial itself is part of the TV layer). */}
      {started && (
        <button
          className="crt-knob"
          type="button"
          aria-label="Change the TV channel"
          title="Change channel"
          onClick={changeChannel}
        />
      )}
    </>
  );
}
