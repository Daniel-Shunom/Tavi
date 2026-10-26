// Lyla v2 mouth library (Duolingo-style; authored by tools/mascot-remix/author.mjs step 3).
// Ids are the order of the shapes in the file's `tavi/mouthShape` track; 0 is the closed line.
// Every open shape is its own filled silhouette (dark interior, teeth and tongue fills, no
// outline); the continuous axes mouthOpen / mouthWide / mouthTilt vary it, and shape changes swap
// at the bottom of a quick squash (face layer). Exactly one mouth is ever visible.
export const mouthShapes = {
  line: 0,
  smileOpen: 1,
  grinTeeth: 2,
  laugh: 3,
  dGrin: 4,
  oSmall: 5,
  oBig: 6,
  gasp: 7,
  shout: 8,
  worry: 9,
  smirk: 10,
  grimace: 11,
  pout: 12,
  blep: 13,
  squiggle: 14,
  flat: 15,
  yawn: 16,
  wail: 17,
  frownLine: 18,
  fv: 19,
  l: 20,
} as const;
export type MouthShape = keyof typeof mouthShapes;
export const MOUTH_SHAPE_COUNT = Object.keys(mouthShapes).length;

/**
 * Speech visemes as mouth shape plus axes, for lip sync (e.g. from TTS viseme events). The face
 * layer's springs and swap pop blend between them.
 */
export const mouthVisemes = {
  rest: { mouthShape: mouthShapes.line, mouthOpen: 0, mouthWide: 0 },
  A: { mouthShape: mouthShapes.laugh, mouthOpen: 0.7, mouthWide: 0.1 },
  E: { mouthShape: mouthShapes.grinTeeth, mouthOpen: 0.4, mouthWide: 0.8 },
  I: { mouthShape: mouthShapes.grinTeeth, mouthOpen: 0.25, mouthWide: 0.35 },
  O: { mouthShape: mouthShapes.oBig, mouthOpen: 0.55, mouthWide: -0.2 },
  U: { mouthShape: mouthShapes.oSmall, mouthOpen: 0.5, mouthWide: -0.5 },
  MBP: { mouthShape: mouthShapes.line, mouthOpen: 0, mouthWide: -0.2 },
  FV: { mouthShape: mouthShapes.fv, mouthOpen: 0.5, mouthWide: 0 },
  L: { mouthShape: mouthShapes.l, mouthOpen: 0.5, mouthWide: 0 },
} as const;

/** Normalized time of the selection track for a shape id (held from frame 10k). */
export function mouthShapeTime(id: number) {
  const index = Math.max(0, Math.min(MOUTH_SHAPE_COUNT - 1, Math.round(id)));
  return (10 * index + 5) / (10 * MOUTH_SHAPE_COUNT);
}
