// Measured from Television_01's original curved glass, in model coordinates.
export const GLASS = { left: -0.2571352, right: 0.1263319, bottom: 0.1141471, top: 0.4042329 };
export const SCREEN_WIDTH = 1024;
export const SCREEN_HEIGHT = 768;
/** The fictional stream on the TV (a compressed copy of the original artwork). */
export const SCREEN_PICTURE = '/media/tavi-stream-forest.webp';

export interface ScreenFrame {
  started: boolean;
  starting: boolean;
  avatar: HTMLCanvasElement | null;
  walker: HTMLElement | null;
  screen: HTMLElement | null;
  webcam: HTMLElement | null;
  /** Milliseconds since the signal locked, for the title card's entrance (Infinity: settled). */
  since?: number;
  /** A playing channel to show instead of the still picture. */
  channel?: HTMLVideoElement | null;
  /** Between channels: static and tearing. */
  switching?: boolean;
}

/** CSS cubic-bezier timing, solved for x by Newton's method then bisection. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const curve = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const slope = (a: number, b: number, t: number) =>
    3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const d = slope(x1, x2, t);
      if (Math.abs(d) < 1e-6) break;
      t -= (curve(x1, x2, t) - x) / d;
    }
    if (!(t >= 0 && t <= 1) || Math.abs(curve(x1, x2, t) - x) > 1e-5) {
      let low = 0,
        high = 1;
      t = x;
      for (let i = 0; i < 30; i++) {
        if (curve(x1, x2, t) < x) low = t;
        else high = t;
        t = (low + high) / 2;
      }
    }
    return curve(y1, y2, t);
  };
}
/** --ease-out in landing.css. */
const easeOut = cubicBezier(0.23, 1, 0.32, 1);
/** Progress of one title beat: `delay` and `length` in ms after the lock. */
const beat = (since: number, delay: number, length = 600) =>
  easeOut(Math.min(1, Math.max(0, (since - delay) / length)));

function context2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  return context;
}

/** One video signal: scene, captions, Rive character, static and optics share the same glass. */
export function createScreenPainter(target?: HTMLCanvasElement) {
  const canvas = target ?? document.createElement('canvas');
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  const ctx = context2D(canvas);
  const scene = new Image();
  scene.decoding = 'async';
  scene.src = SCREEN_PICTURE;
  const noise = document.createElement('canvas');
  noise.width = 160;
  noise.height = 120;
  const nctx = context2D(noise);
  const pixels = nctx.createImageData(noise.width, noise.height);
  let seed = 43;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

  function paint(time: number, frame: ScreenFrame, still: boolean) {
    const w = canvas.width,
      h = canvas.height;
    const signal =
      !frame.switching && (frame.started || (frame.starting && Math.floor(time / 55) % 5 !== 0));
    ctx.fillStyle = '#13121a';
    ctx.fillRect(0, 0, w, h);
    // The picture: a channel if one is playing, otherwise the still.
    const channel = frame.channel ?? null;
    const picture = channel ?? scene;
    const pw = channel ? channel.videoWidth : scene.naturalWidth,
      ph = channel ? channel.videoHeight : scene.naturalHeight;
    if (signal && pw && ph && (channel || scene.complete)) {
      const scale = Math.max(w / pw, h / ph) * 1.04;
      const drift = still ? 0 : Math.sin(time / 14000) * 9;
      ctx.drawImage(
        picture,
        (w - pw * scale) / 2 + drift,
        (h - ph * scale) / 2,
        pw * scale,
        ph * scale,
      );
      ctx.fillStyle = 'rgba(13, 10, 22, 0.2)';
      ctx.fillRect(0, 0, w, h);
      // The title card arrives like a broadcast ident once the signal locks: the name wipes in
      // behind a drawing hairline, then the line under it, the corner tag and the chat card.
      const since = still || frame.since === undefined ? Infinity : frame.since;
      const name = beat(since, 80, 700),
        rule = beat(since, 160, 760),
        sub = beat(since, 300),
        tag = beat(since, 380),
        card = beat(since, 460);
      ctx.save();
      ctx.font = '700 67px Georgia, serif';
      const nameWidth = ctx.measureText('TAVI').width;
      ctx.beginPath();
      ctx.rect(0, 0, 55 + (nameWidth + 12) * name, 120);
      ctx.clip();
      ctx.fillStyle = '#fff8ff';
      ctx.globalAlpha = 0.35 + 0.65 * name;
      ctx.fillText('TAVI', 55, 102);
      ctx.restore();
      ctx.fillStyle = `rgba(255, 248, 255, ${String(0.55 * rule)})`;
      ctx.fillRect(57, 116, 300 * rule, 1.5);
      ctx.globalAlpha = sub;
      ctx.fillStyle = '#fff8ff';
      ctx.font = '23px Georgia, serif';
      ctx.fillText('Your stream companion', 58, 146 + 8 * (1 - sub));
      ctx.globalAlpha = tag;
      ctx.font = '17px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('FICTIONAL STREAM', w - 55, 64);
      ctx.textAlign = 'left';
      ctx.globalAlpha = card;
      const lift = 14 * (1 - card);
      ctx.fillStyle = 'rgba(17, 13, 26, 0.65)';
      ctx.beginPath();
      ctx.roundRect(55, h - 146 + lift, 510, 92, 12);
      ctx.fill();
      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#dcc4f2';
      ctx.fillText('tavi', 74, h - 108 + lift);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Your stream companion', 131, h - 108 + lift);
      ctx.font = '19px sans-serif';
      ctx.fillStyle = '#ddd1e8';
      ctx.fillText('luma  that little bridge', 74, h - 76 + lift);
      ctx.globalAlpha = 1;
    } else {
      for (let i = 0; i < pixels.data.length; i += 4) {
        const value = 28 + random() ** 2 * 185;
        pixels.data[i] = value;
        pixels.data[i + 1] = value;
        pixels.data[i + 2] = value;
        pixels.data[i + 3] = 255;
      }
      nctx.putImageData(pixels, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(noise, 0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
    }

    const screenBox = frame.screen?.getBoundingClientRect();
    const camBox = frame.webcam?.getBoundingClientRect();
    if (screenBox?.width && camBox) {
      const sx = w / screenBox.width,
        sy = h / screenBox.height;
      const x = (camBox.left - screenBox.left) * sx,
        y = (camBox.top - screenBox.top) * sy;
      if (signal) {
        ctx.fillStyle = 'rgba(35, 25, 48, 0.35)';
        ctx.beginPath();
        ctx.roundRect(x, y, camBox.width * sx, camBox.height * sy, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(241, 222, 249, 0.28)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#f3e7fa';
        ctx.font = '17px sans-serif';
        ctx.fillText('TAVI CAM', x + 17, y + 30);
      }
      if (
        frame.avatar &&
        frame.walker &&
        ['idle', 'notice', 'crouch', 'brace'].includes(frame.walker.dataset['stage'] ?? 'idle')
      ) {
        const box = frame.walker.getBoundingClientRect();
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, camBox.width * sx, camBox.height * sy);
        ctx.clip();
        ctx.drawImage(
          frame.avatar,
          (box.left - screenBox.left) * sx,
          (box.top - screenBox.top) * sy,
          box.width * sx,
          box.height * sy,
        );
        ctx.restore();
      }
    }
    if ((frame.starting || frame.switching) && !still) {
      const y = Math.floor(random() * (h - 100));
      ctx.drawImage(canvas, 0, y, w, 70, (random() - 0.5) * 65, y, w, 70);
      ctx.fillStyle = 'rgba(164, 195, 255, 0.12)';
      ctx.fillRect(0, y, w, 3);
    }
    // Soft phosphor scanlines and edge falloff are part of the signal, including Tavi.
    ctx.fillStyle = 'rgba(5, 4, 10, 0.12)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    const edge = ctx.createRadialGradient(w / 2, h / 2, h * 0.29, w / 2, h / 2, w * 0.61);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(0.7, 'rgba(0,0,0,0.16)');
    edge.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, h);
    const reflection = ctx.createLinearGradient(0, 0, w * 0.55, h);
    reflection.addColorStop(0, 'rgba(230,241,255,0.13)');
    reflection.addColorStop(0.34, 'rgba(230,241,255,0.025)');
    reflection.addColorStop(0.65, 'rgba(230,241,255,0)');
    ctx.fillStyle = reflection;
    ctx.fillRect(0, 0, w, h);
  }
  return {
    canvas,
    paint,
    /** Resolves once the stream picture can be drawn (or failed to load). */
    ready: scene
      .decode()
      .then(() => true)
      .catch(() => false),
    dispose: () => {
      scene.src = '';
    },
  };
}
