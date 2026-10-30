// The hero TV's channels: short, calm, licensed loops (credits in public/credits/tv-footage.md)
// that take turns on the screen, with a burst of static between, like flipping channels. The
// still picture and its title card come first; channels start a beat after the signal locks, and
// each clip loads only shortly before it is needed. Muted, off-DOM video elements drawn into the
// screen canvas, so the CRT optics and the TAVI CAM stay on top.

export interface Channel {
  src: string;
  type: string;
}

export const CHANNELS: readonly Channel[] = [
  { src: '/media/tv/rainy-window.mp4', type: 'video/mp4' },
  { src: '/media/tv/aurora-cabins.mp4', type: 'video/mp4' },
  { src: '/media/tv/earth-at-night.webm', type: 'video/webm' },
];
/** How long each channel stays on, after the opening still. */
export const CHANNEL_SECONDS = 18;
/** The static burst between channels. */
export const SWITCH_MS = 320;
/** The opening still (with its title card) holds this long after the signal locks. */
const FIRST_SWITCH_MS = 6000;
/** Start loading the next channel this long before it is due. */
const PRELOAD_MS = 7000;

export class TvChannels {
  private videos: (HTMLVideoElement | null)[] = CHANNELS.map(() => null);
  private current: HTMLVideoElement | null = null;
  private index = -1;
  private nextAt = Infinity;
  private switchingUntil = 0;
  private visible = true;

  /** The signal has locked: the channels take over after the opening still. */
  start(now: number) {
    if (this.nextAt === Infinity && this.index < 0) this.nextAt = now + FIRST_SWITCH_MS;
  }

  private video(i: number) {
    let video = this.videos[i];
    const channel = CHANNELS[i];
    if (!video && channel) {
      video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.src = channel.src;
      this.videos[i] = video;
    }
    return video ?? null;
  }

  /** What the screen shows now: a playing channel (or null for the still), and the static. */
  update(now: number) {
    const next = (this.index + 1) % CHANNELS.length;
    if (now >= this.nextAt - PRELOAD_MS) this.video(next);
    if (now >= this.nextAt) {
      const incoming = this.video(next);
      // Only switch to a clip that can play right away; otherwise try again shortly.
      if (incoming && incoming.readyState >= 3) {
        this.current?.pause();
        this.current = incoming;
        this.index = next;
        incoming.currentTime = 0;
        if (this.visible) void incoming.play().catch(() => undefined);
        this.switchingUntil = now + SWITCH_MS;
        this.nextAt = now + CHANNEL_SECONDS * 1000;
      } else this.nextAt = now + 800;
    }
    const playing = this.current && this.current.readyState >= 2 ? this.current : null;
    return { channel: playing, switching: now < this.switchingUntil };
  }

  /** The channel knob: change channel now (as soon as the next clip can play). */
  skip(now: number) {
    this.nextAt = Math.min(this.nextAt, now);
  }

  /** Off screen, the clip pauses (and resumes when the hero comes back). */
  setVisible(visible: boolean) {
    this.visible = visible;
    if (!this.current) return;
    if (visible) void this.current.play().catch(() => undefined);
    else this.current.pause();
  }

  dispose() {
    for (const video of this.videos) {
      if (!video) continue;
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }
}
