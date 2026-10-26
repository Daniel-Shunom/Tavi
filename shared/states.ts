// Body states: persistent poses (sit, nap, peek at chat, perch, lean) with enter/hold/exit, as
// distinct from momentary expressions, which layer over them. Shared by the service (triggers,
// validation, the AI capability description), the studio (buttons, scene editor) and the
// renderer (src/renderer/motion/states/). Research and numbers: docs/motion/BODY-STATES-RESEARCH.md.
//
// A BodyCue is sampled on the service clock like every other cue: it carries the state it came
// from, so every client chooses the same transition, and a reconnect long after `startAt` shows
// the held state without replaying the transition.
import { z } from 'zod';
import { decidedBySchema } from './cue.js';
import { bounds, clampPoint, type Point } from './locomotion.js';

// Scene geometry ---------------------------------------------------------------------------

/** Named rectangles of the streamer's layout, normalized to the overlay canvas (0..1). */
export const sceneRects = {
  webcam: { label: 'Webcam', meaning: 'The camera frame. Its top edge is a seat and a perch.' },
  game: { label: 'Game / VOD', meaning: 'The gameplay or video frame. Its edges are seats.' },
  chat: { label: 'Chat', meaning: 'The chat panel. Tavi walks over and peeks at it.' },
} as const;
export type SceneRectId = keyof typeof sceneRects;
export const sceneRectIds = Object.keys(sceneRects) as [SceneRectId, ...SceneRectId[]];

const unit = z.number().min(0).max(1);
export const rectSchema = z
  .object({
    enabled: z.boolean(),
    x: unit,
    y: unit,
    w: z.number().min(0.02).max(1),
    h: z.number().min(0.02).max(1),
  })
  .strict();
export type SceneRect = z.infer<typeof rectSchema>;
export const sceneSchema = z
  .object({
    webcam: rectSchema,
    game: rectSchema,
    chat: rectSchema,
    /** Floor line (normalized y). null: the floor is wherever home is (the feet line). */
    floor: z.number().min(bounds.minY).max(bounds.maxY).nullable(),
  })
  .strict();
export type Scene = z.infer<typeof sceneSchema>;
/**
 * Defaults match the existing anchors on a typical 1280 x 720 layout: the webcam bottom-left
 * (home stands in front of its lower part, top edge about 0.9 body heights above the floor),
 * chat on the right. The game frame is off until the streamer places it.
 */
export const defaultScene: Scene = {
  webcam: { enabled: true, x: 0.03, y: 0.5, w: 0.27, h: 0.27 },
  game: { enabled: false, x: 0.2, y: 0.05, w: 0.6, h: 0.6 },
  chat: { enabled: true, x: 0.76, y: 0.08, w: 0.22, h: 0.5 },
  floor: null,
};
/** Keeps a rectangle inside the canvas. */
export function clampRect(rect: SceneRect): SceneRect {
  const w = Math.min(1, Math.max(0.02, rect.w)),
    h = Math.min(1, Math.max(0.02, rect.h));
  return {
    enabled: rect.enabled,
    x: Math.min(1 - w, Math.max(0, rect.x)),
    y: Math.min(1 - h, Math.max(0, rect.y)),
    w,
    h,
  };
}

/**
 * Nominal stage used to resolve spots on the service: a 1280 x 720 overlay where the body
 * height (artboard height, see the renderer) is 176 px. Renderers use their real stage.
 */
export const nominalStage = { aspect: 16 / 9, bodyHeight: 176 / 720 } as const;
/** Body heights expressed as a canvas x fraction. */
const bhX = (value: number, stage = nominalStage) => (value * stage.bodyHeight) / stage.aspect;
const bhY = (value: number, stage = nominalStage) => value * stage.bodyHeight;

// States ------------------------------------------------------------------------------------

export const bodyStates = {
  stand: {
    label: 'Stand',
    meaning: 'Default: standing at home, ready to react.',
    useWhen: 'Getting back up, or when something needs full-body acting.',
    avoidWhen: 'Already standing.',
    initiative: false,
  },
  sit: {
    label: 'Sit',
    meaning:
      'Sits down: on the top edge of the webcam or game frame with legs dangling if it can reach, otherwise on the floor.',
    useWhen: 'Settling in for a while, relaxed downtime, watching the stream.',
    avoidWhen: 'Hype moments or when a big full-body reaction is needed.',
    initiative: true,
  },
  doze: {
    label: 'Doze',
    meaning: 'Nods off where it sits: slumped, eyes closed, slow breathing.',
    useWhen: 'Long quiet stretches.',
    avoidWhen: 'Anyone is talking to Tavi or chat is lively.',
    initiative: true,
  },
  nap: {
    label: 'Nap',
    meaning: 'Lies down on the floor and sleeps (z z z). Wakes with a stretch.',
    useWhen: 'Very long quiet stretches, or the streamer says to take a nap.',
    avoidWhen: 'Anything is happening.',
    initiative: true,
  },
  peek: {
    label: 'Peek at chat',
    meaning: 'Walks over to the chat panel, leans in and reads along, then comes back.',
    useWhen: 'Chat suddenly gets very busy, or someone points Tavi at chat.',
    avoidWhen: 'The streamer is talking to Tavi; normal chat pace.',
    initiative: true,
  },
  perch: {
    label: 'Perch',
    meaning: 'Hops up and crouches on top of the webcam frame like a bird.',
    useWhen: 'Playful downtime; getting a better view.',
    avoidWhen: 'The webcam top is out of reach or off screen.',
    initiative: true,
  },
  lean: {
    label: 'Lean',
    meaning: 'Leans casually against the side of a frame.',
    useWhen: 'Relaxed waiting; a cool, low-key pose.',
    avoidWhen: 'No frame edge nearby.',
    initiative: true,
  },
} as const;
export type BodyStateId = keyof typeof bodyStates;
export const bodyStateIds = Object.keys(bodyStates) as [BodyStateId, ...BodyStateId[]];
export const bodyStateSchema = z.enum(bodyStateIds);
/** States a decision provider may request. */
export const requestableStates = [
  'stand',
  'sit',
  'nap',
  'peek',
  'perch',
  'lean',
] as const satisfies readonly BodyStateId[];
/** Asleep: expressions wait for a wake-up first. */
export const sleepingStates: readonly BodyStateId[] = ['doze', 'nap'];

export const surfaces = ['floor', 'ledge', 'top', 'side', 'panel'] as const;
export type Surface = (typeof surfaces)[number];
export const spotSchema = z
  .object({
    /** floor: on the floor; ledge: seated on an edge; top: standing/crouching on a top edge;
     *  side: against a vertical edge; panel: beside a panel (peek). */
    surface: z.enum(surfaces),
    rect: z.enum(sceneRectIds).optional(),
    /** Contact x (normalized canvas). */
    x: unit,
    /** Contact line y: the floor, the ledge or top edge. */
    y: unit,
    /** Floor point Tavi walks to before getting into the state. */
    approach: z.object({ x: unit, y: unit }).strict(),
    /** Direction of the edge or panel from Tavi (lean/peek), or facing. */
    side: z.union([z.literal(-1), z.literal(1)]),
    /** x of the vertical edge (lean) or panel edge (peek). */
    edgeX: unit.optional(),
  })
  .strict();
export type Spot = z.infer<typeof spotSchema>;

export const wakeKinds = ['urgent', 'normal'] as const;
export const bodyCueSchema = z
  .object({
    id: z.string().max(64),
    sourceEventId: z.string().max(64),
    source: z.enum(['manual', 'streamer', 'chat', 'idle']),
    decidedBy: decidedBySchema,
    priority: z.number().int().min(0).max(4),
    state: bodyStateSchema,
    /** Where; null for stand (home). */
    spot: spotSchema.nullable(),
    /** The state and spot this cue leaves, so every client plays the same transition. */
    from: z.object({ state: bodyStateSchema, spot: spotSchema.nullable() }).strict().nullable(),
    startAt: z.number(),
    /** How to wake when leaving doze or nap. */
    wake: z.enum(wakeKinds).optional(),
    /** Service time of the latest stir while asleep (a twitch without waking). */
    stirAt: z.number().optional(),
    /** Planned end (peek); the service issues the follow-up cue. */
    until: z.number().optional(),
    seed: z.number().int().nonnegative(),
  })
  .strict();
export type BodyCue = z.infer<typeof bodyCueSchema>;

// Spot resolution ---------------------------------------------------------------------------

/** Rig-independent reach and fit limits (body heights). */
export const reach = {
  /** Highest ledge Tavi will jump up to from the floor. */
  maxJump: 1.2,
  /** Lowest ledge worth jumping onto (below this it would just stand there). */
  minJump: 0.15,
  /** Headroom above a seat (sitting) or a top edge (standing) so the head stays on screen. */
  seatHeadroom: 0.62,
  standHeadroom: 0.85,
  /** Half the body width, for keeping clear of panels and edges. */
  halfWidth: 0.27,
} as const;

export interface SpotContext {
  scene: Scene;
  home: Point;
  /** Current spot when already in a state (doze stays where it sits). */
  current?: { state: BodyStateId; spot: Spot | null } | undefined;
  /** 0..1 deterministic choice value (seeded by the service). */
  pick?: number;
  /** Prefer a ledge (manual) or follow personality weights (idle). */
  prefer?: 'ledge' | 'floor' | undefined;
}
export function floorOf(scene: Scene, home: Point) {
  return scene.floor ?? home.y;
}
/** Horizontal edges Tavi can sit on: reachable from the floor with headroom above. */
export function ledgeCandidates(scene: Scene, home: Point) {
  const floor = floorOf(scene, home);
  const out: { rect: SceneRectId; edge: 'top' | 'bottom'; y: number; x0: number; x1: number }[] =
    [];
  for (const id of ['webcam', 'game'] as const) {
    const rect = scene[id];
    if (!rect.enabled) continue;
    for (const edge of ['top', 'bottom'] as const) {
      const y = edge === 'top' ? rect.y : rect.y + rect.h;
      const gap = (floor - y) / nominalStage.bodyHeight;
      if (gap < reach.minJump || gap > reach.maxJump) continue;
      if (y < bhY(reach.seatHeadroom)) continue;
      const margin = bhX(reach.halfWidth * 0.8);
      const x0 = Math.max(rect.x + margin, bounds.minX),
        x1 = Math.min(rect.x + rect.w - margin, bounds.maxX);
      if (x1 <= x0) continue;
      out.push({ rect: id, edge, y, x0, x1 });
    }
  }
  return out;
}
function nearest(x: number, x0: number, x1: number) {
  return Math.min(x1, Math.max(x0, x));
}
function floorSpot(scene: Scene, home: Point, x = home.x): Spot {
  const floor = floorOf(scene, home);
  // Lying down needs about one body height of floor beside the hips.
  const p = clampPoint({ x, y: floor });
  return { surface: 'floor', x: p.x, y: floor, approach: p, side: 1 };
}
function ledgeSpot(
  candidate: ReturnType<typeof ledgeCandidates>[number],
  scene: Scene,
  home: Point,
  surface: 'ledge' | 'top',
): Spot {
  const x = nearest(home.x, candidate.x0, candidate.x1);
  const floor = floorOf(scene, home);
  return {
    surface,
    rect: candidate.rect,
    x,
    y: candidate.y,
    approach: clampPoint({ x, y: floor }),
    side: x < 0.5 ? 1 : -1,
  };
}
/** Where a state happens, or null when it cannot happen in this scene. Pure. */
export function resolveSpot(state: BodyStateId, context: SpotContext): Spot | null {
  const { scene, home } = context;
  const floor = floorOf(scene, home);
  const pick = context.pick ?? 0;
  switch (state) {
    case 'stand':
      return null;
    case 'sit': {
      const ledges = ledgeCandidates(scene, home);
      const best = ledges.sort((a, b) => Math.abs(a.y - floor) - Math.abs(b.y - floor))[0];
      const useLedge =
        !!best && (context.prefer === 'ledge' || (context.prefer !== 'floor' && pick < 0.5));
      return useLedge ? ledgeSpot(best, scene, home, 'ledge') : floorSpot(scene, home);
    }
    case 'doze': {
      const current = context.current;
      if (current?.spot && (current.state === 'sit' || current.state === 'doze'))
        return current.spot;
      return resolveSpot('sit', { ...context, prefer: context.prefer ?? 'floor' });
    }
    case 'nap': {
      // Never lies on a ledge: naps on the floor, at home or below the current ledge.
      const x = context.current?.spot?.approach.x ?? home.x;
      return floorSpot(scene, home, Math.min(bounds.maxX - 0.1, Math.max(bounds.minX + 0.1, x)));
    }
    case 'perch': {
      const tops = ledgeCandidates(scene, home).filter(
        (c) => c.edge === 'top' && c.y >= bhY(reach.standHeadroom),
      );
      const best = tops.find((c) => c.rect === 'webcam') ?? tops[0];
      return best ? ledgeSpot(best, scene, home, 'top') : null;
    }
    case 'peek': {
      const chat = scene.chat;
      const panel = chat.enabled ? chat : { x: 0.76, y: 0.08, w: 0.22, h: 0.5 };
      const left = panel.x + panel.w / 2 > home.x;
      const gap = bhX(reach.halfWidth + 0.05);
      const edgeX = left ? panel.x : panel.x + panel.w;
      const x = left ? edgeX - gap : edgeX + gap;
      const approach = clampPoint({ x, y: floor });
      return {
        surface: 'panel',
        rect: 'chat',
        x: approach.x,
        y: floor,
        approach,
        side: left ? 1 : -1,
        edgeX: Math.min(1, Math.max(0, edgeX)),
      };
    }
    case 'lean': {
      // Vertical frame edges that span the body at floor level; stand just outside the frame.
      const options: Spot[] = [];
      for (const id of ['webcam', 'game'] as const) {
        const rect = scene[id];
        if (!rect.enabled) continue;
        if (rect.y > floor - bhY(0.55) || rect.y + rect.h < floor - bhY(0.3)) continue;
        for (const side of [-1, 1] as const) {
          // side: where the edge is relative to Tavi. Edge on Tavi's right = the rect's left edge.
          const edgeX = side === 1 ? rect.x : rect.x + rect.w;
          const x = edgeX - side * bhX(0.3);
          if (x < bounds.minX || x > bounds.maxX) continue;
          const approach = clampPoint({ x, y: floor });
          options.push({ surface: 'side', rect: id, x, y: floor, approach, side, edgeX });
        }
      }
      options.sort((a, b) => Math.abs(a.x - home.x) - Math.abs(b.x - home.x));
      return options[0] ?? null;
    }
  }
}
export function sameSpot(a: Spot | null | undefined, b: Spot | null | undefined) {
  if (!a || !b) return !a && !b;
  return (
    a.surface === b.surface &&
    Math.abs(a.x - b.x) < 1e-3 &&
    Math.abs(a.y - b.y) < 1e-3 &&
    a.rect === b.rect
  );
}

// Timing -------------------------------------------------------------------------------------

/** Nominal seconds for transitions (renderers may add travel time). */
export const transitionSeconds = {
  sitFloor: 1.6,
  standFromFloor: 1.3,
  ledgeEnter: 2.3,
  ledgeExit: 1.0,
  doze: 2.0,
  dozeWake: 0.8,
  lieDown: 2.4,
  wake: 4.4,
  urgentWake: 1.2,
  peekEnter: 0.6,
  peekExit: 0.4,
  perchEnter: 1.5,
  perchExit: 1.0,
  leanEnter: 1.0,
  leanExit: 0.8,
} as const;
/** Rough walk speed used to bound travel (normalized units / second). */
export const nominalWalkSpeed = 0.15;
/** Seconds after which a cue is certainly settled (no transition left to play). */
export function settledAfter(cue: BodyCue, from: Point) {
  const to = cue.spot?.approach;
  const travel = to ? Math.hypot(to.x - from.x, to.y - from.y) / nominalWalkSpeed : 0;
  return travel + 10;
}

// Triggers (service) -------------------------------------------------------------------------

export type Personality = 'cozy' | 'playful' | 'shy';
export type Initiative = 'reserved' | 'occasional' | 'outgoing';

/** Chat-burst thresholds (research doc section 4). */
export const burstRules = {
  windowMs: 30_000,
  /** EWMA time constant of the per-window baseline. */
  baselineTauMs: 600_000,
  multiple: 3,
  minChatters: 3,
  floor: (chatEngagement: number) => Math.round(14 - (8 * chatEngagement) / 100),
  floorScale: { reserved: 2, occasional: 1, outgoing: 0.75 } satisfies Record<Initiative, number>,
  cooldownMs: { reserved: 900_000, occasional: 360_000, outgoing: 180_000 } satisfies Record<
    Initiative,
    number
  >,
  maxPerHour: 6,
  /** Peek length window (seeded) and limits. */
  minPeekMs: 15_000,
  maxPeekMs: 45_000,
  /** End this long after the rate drops below half the threshold. */
  calmEndMs: 8_000,
} as const;

/** Quiet-time thresholds (research doc section 4, confirmed by the user). */
export const quietRules = {
  settleMs: 180_000,
  dozeMs: 360_000,
  lieMs: 180_000,
  /** Self-wake after this much sleep, then settle again. */
  selfWakeMs: [720_000, 1_200_000] as const,
  /** Chat faster than this (messages per 30 s) keeps Tavi awake (no doze/nap). */
  awakeChatPer30s: 1,
  /** Initiative-driven states wait this long after streamer input. */
  streamerGraceMs: 20_000,
  personality: {
    cozy: { settle: 0.7, doze: 0.7, lie: 0.7 },
    playful: { settle: 1.4, doze: 1.5, lie: 1.2 },
    shy: { settle: 1, doze: 1, lie: 1 },
  } satisfies Record<Personality, Record<'settle' | 'doze' | 'lie', number>>,
  initiative: { reserved: 1.25, occasional: 1, outgoing: 0.85 } satisfies Record<
    Initiative,
    number
  >,
  /** Where to settle (weights). Spots that do not exist in the scene are skipped. */
  settleWeights: {
    cozy: { sit: 1, perch: 0, lean: 0 },
    playful: { sit: 0.5, perch: 0.5, lean: 0 },
    shy: { sit: 0.5, perch: 0, lean: 0.5 },
  } satisfies Record<Personality, Record<'sit' | 'perch' | 'lean', number>>,
  /** Probability a settle-sit picks a ledge over the floor. */
  ledgeChance: { cozy: 0.4, playful: 0.8, shy: 0.6 } satisfies Record<Personality, number>,
} as const;
export function energyFactor(energy: number) {
  return 0.75 + (0.5 * Math.max(0, Math.min(100, energy))) / 100;
}
/** Milliseconds of quiet before each stage, for a persona. */
export function quietSchedule(persona: {
  personality: Personality;
  initiative: Initiative;
  energy: number;
}) {
  const p = quietRules.personality[persona.personality];
  const k = energyFactor(persona.energy) * quietRules.initiative[persona.initiative];
  const settle = quietRules.settleMs * p.settle * k;
  const doze = settle + quietRules.dozeMs * p.doze * k;
  const lie = doze + quietRules.lieMs * p.lie * k;
  return { settle, doze, lie };
}

/** Deterministic 0..1 from a string seed. */
export function hash01(seed: string) {
  let h = 2166136261;
  for (const character of seed) h = Math.imul(h ^ character.charCodeAt(0), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}
