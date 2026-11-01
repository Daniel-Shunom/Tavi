// The ad's clock. Everything is cut to the music: "Tell Each Other How We Feel" runs at 100 BPM,
// so a beat is 0.6 s, a bar 2.4 s and a phrase (four bars) 9.6 s.
//
// Music edit (track seconds):
//   A  37.765 -> 76.765  a pickup beat, the build, the drop at 47.965, three full phrases
//   B 191.965 -> 197.965 the song's own ending, spliced on a phrase downbeat
// In ad time the drop lands at 10.2 s and the splice at 39.0 s.
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const SECONDS = 45;

export const BEAT = 0.6;
export const BAR = 2.4;

export const music = {
  src: 'audio/tell-each-other.mp3',
  a: { from: 37.765, until: 39.0 },
  b: { from: 191.965, at: 39.0 },
};

/** Scene starts in ad seconds. */
export const cue = {
  corner: 0,
  glimpse: 5.4,
  arrival: 7.8,
  /** The drop: she rises out of her shadow. */
  drop: 10.2,
  reveal: 11.4,
  reads: 15.0,
  feels: 19.8,
  lives: 24.6,
  studio: 29.4,
  quiet: 34.2,
  cheer: 36.6,
  end: 39.0,
  out: SECONDS,
};

export const sec = (s: number) => Math.round(s * FPS);
