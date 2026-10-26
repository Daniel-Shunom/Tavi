// Entrances and exits as data: each choreography is a list of story beats interpreted below.
// Most beats are `act` steps: a duration plus a pure function of time returning pose, host
// squash/stretch, lift above the ground line and whether the body is clipped at the edge. Other
// steps place the character, drive the locomotion controller (walk, turn) or fire expressions.
// Rules: hide is immediate (starting an exit mid-entrance continues from the current pose);
// timing is a function of the cue's start time, so a late joiner (reconnect) jumps to the end
// state instead of replaying; selection is seeded by cue id and never repeats the previous choice.
// Quiet mode and reduced motion use the short `calm` lists.
import { clamp01, easeOutCubic, lerp, smootherstep } from '../core/curves';
import { G_BH, airtime, fallTime, hopHeight } from '../core/physics';
import { pick, rngFor } from '../core/random';
import type { MotionProfile } from '../profile';
import type { Pose, Stage } from '../types';
import { resolveGait } from './gaits/library';
import type { Gait, Locomotion, LocomotionFrame } from './locomotion';

export interface ActOutput {
  pose?: Partial<Pose>;
  scaleX?: number;
  scaleY?: number;
  /** Absolute lift in body heights (omit to keep the previous beat's lift). */
  lift?: number;
  /** Hide everything below the ground line during this beat. */
  clip?: boolean;
}

export interface ActContext {
  profile: MotionProfile;
  /** Lift at the start of this beat (continuity). */
  from: number;
  /** Height of the canvas top above the ground line, in body heights. */
  top: number;
}

export type Step =
  | { kind: 'spawnAbove' }
  | { kind: 'spawnSide' }
  | { kind: 'spawnBelow' }
  | { kind: 'fall'; duration: number }
  | {
      kind: 'act';
      name: string;
      duration: number | ((profile: MotionProfile) => number);
      fn: (t: number, k: number, ctx: ActContext) => ActOutput;
      /** Airborne beat: duration is physics (gravity), never scaled by personality tempo. */
      physical?: boolean;
    }
  | { kind: 'expression'; id: string; hold?: number }
  | { kind: 'release'; id: string }
  | { kind: 'pause'; duration: number }
  | {
      kind: 'walk';
      to: 'anchor' | 'side';
      gait: Gait | 'personality';
      speed: number;
      /** Gait beats to keep (the choreography adds its own arrival). */
      beats?: 'all' | 'start' | 'none';
    }
  | { kind: 'turn'; to: 'camera' | 'side' }
  /** Ballistic drop from the current lift to below the ground line (clipped). */
  | { kind: 'sink' }
  /** Ballistic jump from the current lift up and out of the top of the canvas. */
  | { kind: 'leap' }
  | { kind: 'fade'; to: 0 | 1; duration: number; rise?: number };

export interface Choreography {
  type: 'entrance' | 'exit';
  steps: readonly Step[];
  /** Short calm variant for quiet mode and reduced motion. */
  calm: readonly Step[];
}

/** 0..1..0 window: in over `a`, hold `h`, out over `r`, starting at `s`. */
function win(t: number, s: number, a: number, h: number, r: number) {
  const x = t - s;
  if (x <= 0) return 0;
  if (x < a) return smootherstep(x / a);
  if (x < a + h) return 1;
  return 1 - smootherstep((x - a - h) / r);
}
const pulse = (t: number, at: number, length = 0.16) =>
  win(t, at, length * 0.4, 0.02, length * 0.6);
const personality = (p: MotionProfile) =>
  p.gait === 'hop' ? 'playful' : p.gait === 'scoot' ? 'shy' : 'cozy';

// ---------------------------------------------------------------------------------------------
// Beats shared by several choreographies.

const brushHands: Step = {
  kind: 'act',
  name: 'brush hands',
  duration: 0.5,
  fn: (t, k) => {
    const brush = Math.sin(t * Math.PI * 16) * win(t, 0, 0.08, 0.3, 0.1);
    return {
      lift: 0,
      pose: {
        armL: -0.3 * win(t, 0, 0.1, 0.3, 0.1) + 0.12 * brush,
        armR: -0.3 * win(t, 0, 0.1, 0.3, 0.1) - 0.12 * brush,
        gazeY: 0.45 * (1 - k),
        smile: 0.3,
      },
    };
  },
};

const settle = (duration: number): Step => ({
  kind: 'act',
  name: 'settle',
  duration,
  fn: (_t, k) => ({ lift: 0, pose: { squash: 0.15 * Math.sin(k * Math.PI) } }),
});

// ---------------------------------------------------------------------------------------------
// Drop: fall, splat, get up, dust off the knees, straighten into idle.

const splat: Step = {
  kind: 'act',
  name: 'splat',
  duration: 0.5,
  fn: (t) => {
    const slam = smootherstep(t / 0.07);
    const daze = t > 0.2 ? Math.sin((t - 0.2) * 14) * Math.exp(-(t - 0.2) * 3) : 0;
    const hair =
      t < 0.1
        ? t / 0.1
        : t < 0.25
          ? 1 - ((t - 0.1) / 0.15) * 1.7
          : -0.7 * (1 - clamp01((t - 0.25) / 0.2));
    const flat = 0.34 * slam;
    return {
      lift: 0,
      scaleY: 1 - flat,
      scaleX: 1 + flat * 0.7,
      pose: {
        squash: 1.2 * slam,
        bob: 0.03 * slam,
        blinkL: 0.95 * slam,
        blinkR: 0.95 * slam,
        squintL: slam,
        squintR: slam,
        browL: 0.7 * slam,
        browR: 0.7 * slam,
        smile: -0.3 * slam,
        armL: -0.25 * slam,
        armR: -0.25 * slam,
        hairSquash: 0.06 * hair,
        headTilt: 0.05 * daze,
      },
    };
  },
};

const getUp: Step = {
  kind: 'act',
  name: 'get up',
  duration: 0.7,
  fn: (t, k) => {
    const rise = smootherstep(k);
    const scaleY = lerp(0.66, 1, easeOutCubic(k));
    const eyes = 0.95 * (1 - smootherstep(k / 0.35)) + 0.9 * pulse(t, 0.45);
    return {
      lift: 0,
      scaleY,
      scaleX: lerp(1.24, 1, easeOutCubic(k)),
      pose: {
        bob: lerp(0.03, 0.012, rise),
        lean: 0.06 * Math.sin(Math.min(1, k * 1.4) * Math.PI),
        shift: 0.009 * Math.sin(k * Math.PI * 3) * (1 - k),
        headTilt: 0.06 * Math.sin(k * Math.PI * 2) * (1 - k),
        squash: lerp(1.2, 0.3, rise),
        blinkL: eyes,
        blinkR: eyes,
        squintL: 1 - rise,
        squintR: 1 - rise,
        browL: 0.5,
        browR: 0.5,
        armL: lerp(-0.25, -0.2, rise),
        armR: lerp(-0.25, -0.2, rise),
      },
    };
  },
};

// Knee pats (front view): a deep knee bend with the head down, arms swinging in and down to the
// thighs with alternating pats and a small body bob per pat (inward arm swings hide behind the
// body on this rig, so each arm swings out and pats back against the side of the thigh), brows down ("hmph") then relaxing.
// No torso lean: on a front-facing 2D character a lean reads as a sideways tilt.
const dustKnees: Step = {
  kind: 'act',
  name: 'dust off knees',
  duration: 1.25,
  fn: (t) => {
    const bend = win(t, 0, 0.22, 0.85, 0.18);
    const pats = (phase: number) => {
      const p = (t - 0.25) * 4.5 + phase;
      return t > 0.25 && t < 0.95 ? Math.max(0, Math.sin(p * Math.PI * 2)) : 0;
    };
    const left = pats(0),
      right = pats(0.5);
    const hmph = win(t, 0, 0.15, 0.75, 0.3);
    return {
      lift: 0,
      scaleY: 1 - 0.04 * (left + right) * bend,
      pose: {
        bob: (0.04 + 0.008 * (left + right)) * bend,
        gazeY: 0.75 * bend,
        headTilt: 0.04 * (left - right) * bend,
        // Swing out, then slap back against the thigh: the silhouette change is what reads.
        armL: (0.55 * left - 0.08) * bend,
        armR: (0.55 * right - 0.08) * bend,
        browL: 0.55 * hmph,
        browR: 0.55 * hmph,
        smile: -0.25 * hmph,
        squash: 0.3 * bend,
      },
    };
  },
};

const straighten: Step = {
  kind: 'act',
  name: 'straighten',
  duration: 0.55,
  fn: (_t, k) => {
    const shake = Math.sin(k * Math.PI * 6) * (1 - k) * win(k, 0.25, 0.1, 0.4, 0.2);
    return {
      lift: 0,
      pose: {
        squash: -0.45 * Math.sin(Math.min(1, k * 1.6) * Math.PI),
        shift: 0.006 * shake,
        headTilt: 0.05 * shake,
        hairSwoop: 0.15 * shake,
        smile: 0.25 * smootherstep((k - 0.5) / 0.5),
      },
    };
  },
};

// ---------------------------------------------------------------------------------------------
// Tired walk-in: shuffle in slumped, stop, big sigh, yawn and stretch (shy: a small smile
// instead), slow blink, turn to the camera, settle.

const sigh: Step = {
  kind: 'act',
  name: 'sigh',
  duration: 1.4,
  fn: (t) => {
    const inhale = win(t, 0, 0.5, 0.15, 0.35);
    const exhale = win(t, 0.7, 0.3, 0.3, 0.4);
    return {
      lift: 0,
      pose: {
        armL: 0.16 * inhale - 0.08 * exhale,
        armR: 0.16 * inhale - 0.08 * exhale,
        squash: -0.45 * inhale + 0.4 * exhale,
        bob: 0.008 * exhale,
        squintL: 0.55 + 0.2 * exhale,
        squintR: 0.55 + 0.2 * exhale,
        blinkL: 0.35 * exhale,
        blinkR: 0.35 * exhale,
        gazeY: 0.25 + 0.15 * exhale,
        lean: 0.04 * exhale,
      },
    };
  },
};

const yawnStretch: Step = {
  kind: 'act',
  name: 'yawn and stretch',
  duration: (p) => (personality(p) === 'shy' ? 0.9 : 1.7),
  fn: (t, _k, { profile }) => {
    if (personality(profile) === 'shy') {
      const smile = win(t, 0, 0.25, 0.4, 0.25);
      return {
        lift: 0,
        pose: {
          smile: 0.4 * smile,
          squintL: 0.4 * smile,
          squintR: 0.4 * smile,
          gazeY: 0.3 * smile,
        },
      };
    }
    const reach = win(t, 0.1, 0.45, 0.6, 0.45);
    const yawn = win(t, 0.25, 0.35, 0.55, 0.35);
    return {
      lift: 0,
      scaleY: 1 + 0.05 * reach * profile.maxSquash,
      pose: {
        armL: 1.0 * reach,
        armR: 1.0 * reach,
        squash: -0.6 * reach,
        lean: -0.04 * reach,
        smile: -1 * yawn,
        mouthY: 1 * yawn,
        squintL: 0.9 * yawn,
        squintR: 0.9 * yawn,
        blinkL: 0.7 * yawn,
        blinkR: 0.7 * yawn,
        headTilt: -0.06 * yawn,
      },
    };
  },
};

const slowBlink: Step = {
  kind: 'act',
  name: 'slow blink',
  duration: 0.55,
  fn: (t) => {
    const b = win(t, 0.05, 0.15, 0.1, 0.25);
    return { lift: 0, pose: { blinkL: b, blinkR: b, squintL: 0.3, squintR: 0.3 } };
  },
};

// ---------------------------------------------------------------------------------------------
// Climb: hands appear first, a straining pull with a look around, a second pull, a leg swings
// over, hop up, brush the hands, idle.

const climbClip = (
  name: string,
  duration: number,
  fn: (t: number, k: number, ctx: ActContext) => ActOutput,
): Step => ({
  kind: 'act',
  name,
  duration,
  fn: (t, k, ctx) => ({ clip: true, ...fn(t, k, ctx) }),
});

const climbSteps: Step[] = [
  { kind: 'spawnBelow' },
  climbClip('hands appear', 0.45, (_t, k) => ({
    lift: lerp(-1.25, -1.02, easeOutCubic(k)),
    pose: { armL: 2.6, armR: 2.6 },
  })),
  climbClip('first pull', 0.55, (_t, k) => ({
    lift: lerp(-1.02, -0.55, 1 - (1 - k) * (1 - k)),
    pose: {
      armL: lerp(2.6, 1.7, k),
      armR: lerp(2.6, 1.7, k),
      squash: -0.4 * Math.sin(k * Math.PI),
      browL: 0.6,
      browR: 0.6,
      squintL: 0.4,
      squintR: 0.4,
      smile: -0.3,
    },
  })),
  climbClip('look around', 0.75, (t) => ({
    lift: -0.55 + 0.01 * Math.sin(t * 6),
    pose: {
      armL: 1.7,
      armR: 1.7,
      gazeX: 0.75 * Math.sin(Math.min(1, t / 0.65) * Math.PI * 2),
      headTilt: 0.06 * Math.sin(Math.min(1, t / 0.65) * Math.PI * 2),
      browL: -0.4,
      browR: -0.4,
    },
  })),
  climbClip('second pull', 0.45, (_t, k) => ({
    lift: lerp(-0.55, -0.22, 1 - (1 - k) * (1 - k)),
    pose: {
      armL: lerp(1.7, 0.9, k),
      armR: lerp(1.7, 0.9, k),
      squash: -0.4 * Math.sin(k * Math.PI),
      browL: 0.6,
      browR: 0.6,
      smile: -0.3,
    },
  })),
  climbClip('leg over', 0.42, (_t, k) => ({
    lift: lerp(-0.22, -0.08, k),
    pose: {
      shift: 0.02 * Math.sin(k * Math.PI),
      lean: -0.1 * Math.sin(k * Math.PI),
      footRY: 0.06 * Math.sin(k * Math.PI),
      footRX: 0.04 * Math.sin(k * Math.PI),
      armL: 0.9 * (1 - k),
      armR: 0.9 * (1 - k),
    },
  })),
  {
    kind: 'act',
    name: 'hop up',
    duration: airtime(0.12),
    physical: true,
    fn: (t, k) => {
      const air = hopHeight(t, airtime(0.12));
      return {
        lift: lerp(-0.08, 0, k) + air,
        clip: k < 0.4,
        scaleY: k > 0.85 ? 1 - 0.12 * ((k - 0.85) / 0.15) : 1 + 0.08 * Math.sin(k * Math.PI),
        pose: { armL: 0.4 * Math.sin(k * Math.PI), armR: 0.4 * Math.sin(k * Math.PI) },
      };
    },
  },
  {
    kind: 'act',
    name: 'land',
    duration: 0.25,
    fn: (_t, k) => ({
      lift: 0,
      scaleY: 1 - 0.12 * (1 - smootherstep(k)),
      pose: { bob: 0.01 * (1 - k) },
    }),
  },
  brushHands,
  { kind: 'expression', id: 'happy' },
  settle(0.3),
];

// ---------------------------------------------------------------------------------------------
// Slide up: peek up halfway, cautious glance left and right, notice the camera (startle or
// smile; shy: bashful), rise the rest of the way, settle.

const slideSteps: Step[] = [
  { kind: 'spawnBelow' },
  climbClip('peek up', 0.55, (_t, k) => ({
    lift: lerp(-1.1, -0.55, easeOutCubic(k)),
    pose: { browL: -0.3, browR: -0.3 },
  })),
  climbClip('cautious look', 1.1, (t, _k, { profile }) => {
    const slow = personality(profile) === 'shy' ? 0.8 : 1;
    const sweep = Math.sin(Math.min(1, (t * slow) / 1.0) * Math.PI * 2);
    return {
      lift: -0.55 + 0.012 * Math.sin(t * 5),
      pose: {
        gazeX: -0.75 * sweep,
        headTilt: -0.06 * sweep,
        browL: -0.35,
        browR: -0.35,
        squintL: 0.15,
        squintR: 0.15,
      },
    };
  }),
  climbClip('notice camera', 0.45, (t, _k, { profile }) => {
    const pop = win(t, 0, 0.06, 0.08, 0.2);
    const shy = personality(profile) === 'shy';
    return {
      lift: -0.55 + 0.04 * pop,
      pose: {
        browL: -0.9 * pop,
        browR: -0.9 * pop,
        squash: -0.35 * pop,
        smile: shy ? 0.35 : 0.65 * win(t, 0.12, 0.15, 0.4, 0.2),
        squintL: shy ? 0.4 : 0,
        squintR: shy ? 0.4 : 0,
        gazeY: shy ? 0.3 : 0,
      },
    };
  }),
  climbClip('rise', 0.5, (_t, k) => ({
    lift: lerp(-0.55, 0, smootherstep(k)),
    pose: { smile: 0.4 },
  })),
  {
    kind: 'act',
    name: 'land',
    duration: 0.3,
    fn: (_t, k) => ({ lift: 0, scaleY: 1 - 0.08 * Math.sin(k * Math.PI), pose: { smile: 0.3 } }),
  },
];

// ---------------------------------------------------------------------------------------------
// Exits: a flourish of 0.6 s or less, then gone.

const glanceBack: Step = {
  kind: 'act',
  name: 'glance back',
  duration: 0.32,
  fn: (t, _k, { profile, from }) => {
    const look = win(t, 0, 0.08, 0.16, 0.08);
    const wave = personality(profile) === 'playful' ? Math.sin(t * 30) * look : 0;
    return {
      lift: from,
      pose: {
        gazeX: -0.85 * look,
        headTilt: -0.08 * look,
        smile: 0.4 * look,
        armR: (0.9 + 0.2 * wave) * (personality(profile) === 'playful' ? look : 0),
      },
    };
  },
};

const lookUp: Step = {
  kind: 'act',
  name: 'look up',
  duration: 0.2,
  fn: (_t, k, { from }) => ({
    lift: from,
    pose: { gazeY: -0.85 * smootherstep(k), browL: -0.5, browR: -0.5 },
  }),
};

const deepCrouch: Step = {
  kind: 'act',
  name: 'deep crouch',
  duration: 0.24,
  fn: (_t, k, { from }) => {
    const c = smootherstep(k);
    return {
      lift: from,
      scaleY: 1 - 0.2 * c,
      scaleX: 1 + 0.12 * c,
      pose: { bob: 0.025 * c, armL: -0.3 * c, armR: -0.3 * c, gazeY: -0.6 },
    };
  },
};

// Launch: arms up, stretch, then a ballistic leap (the 'leap' step) out of the top.
const launch: Step = {
  kind: 'act',
  name: 'launch',
  duration: 0.08,
  physical: true,
  fn: (_t, k, { from }) => ({
    lift: from,
    scaleY: 1 + 0.18 * k,
    scaleX: 1 - 0.1 * k,
    pose: { armL: 1.4 * k, armR: 1.4 * k, squash: -0.6 * k },
  }),
};

const lookDownHereGoes: Step = {
  kind: 'act',
  name: 'look down, here goes',
  duration: 0.4,
  fn: (t, _k, { from }) => {
    const nod = win(t, 0.22, 0.06, 0.02, 0.1);
    return {
      lift: from,
      pose: {
        gazeY: 0.75 - 0.4 * nod,
        headTilt: 0.05,
        browL: -0.7 * win(t, 0.15, 0.06, 0.2, 0.05),
        browR: -0.7 * win(t, 0.15, 0.06, 0.2, 0.05),
      },
    };
  },
};

// Small hop up (to the apex) before dropping down over the edge with the 'sink' step.
const hopOver: Step = {
  kind: 'act',
  name: 'hop',
  duration: airtime(0.12) / 2,
  physical: true,
  fn: (t, _k, { from }) => ({
    lift: from + hopHeight(t, airtime(0.12)),
    scaleY: 1.06,
    pose: { armL: 0.6, armR: 0.6 },
  }),
};

const startle: Step = {
  kind: 'act',
  name: 'startle',
  duration: 0.14,
  fn: (_t, k, { from }) => ({
    lift: from,
    scaleY: 1 + 0.06 * Math.sin(k * Math.PI),
    pose: { browL: -1, browR: -1, squash: -0.4 },
  }),
};

const crouch = (duration: number, amount: number): Step => ({
  kind: 'act',
  name: 'crouch',
  duration,
  fn: (_t, k, { from }) => {
    const c = smootherstep(k);
    return {
      lift: from,
      scaleY: 1 - amount * c,
      scaleX: 1 + amount * 0.6 * c,
      pose: { bob: 0.012 * c },
    };
  },
});

const shyPeek: Step = {
  kind: 'act',
  name: 'peek back',
  duration: (p) => (personality(p) === 'shy' ? 0.6 : 0),
  fn: (t) => ({
    clip: true,
    lift: -1.1 + 0.55 * win(t, 0, 0.18, 0.2, 0.2),
    pose: { gazeX: 0.2, browL: -0.4, browR: -0.4 },
  }),
};

const calmIn: Step[] = [{ kind: 'fade', to: 1, duration: 0.35, rise: 0.04 }];
const calmOut: Step[] = [{ kind: 'fade', to: 0, duration: 0.25 }];

export const choreographies: Readonly<Record<string, Choreography>> = {
  drop: {
    type: 'entrance',
    steps: [
      { kind: 'spawnAbove' },
      { kind: 'fall', duration: 0.5 },
      splat,
      getUp,
      dustKnees,
      straighten,
    ],
    calm: [...calmIn, { ...brushHands, duration: 0.35 }],
  },
  tiredWalk: {
    type: 'entrance',
    steps: [
      { kind: 'spawnSide' },
      { kind: 'expression', id: 'tired', hold: 60 },
      { kind: 'walk', to: 'anchor', gait: 'trudge', speed: 1.8, beats: 'start' },
      { kind: 'release', id: 'tired' },
      sigh,
      yawnStretch,
      slowBlink,
      { kind: 'turn', to: 'camera' },
      settle(0.3),
    ],
    calm: calmIn,
  },
  climb: { type: 'entrance', steps: climbSteps, calm: calmIn },
  slideUp: { type: 'entrance', steps: slideSteps, calm: calmIn },
  walkOff: {
    type: 'exit',
    steps: [
      { kind: 'turn', to: 'side' },
      glanceBack,
      { kind: 'walk', to: 'side', gait: 'personality', speed: 2.2, beats: 'start' },
    ],
    calm: calmOut,
  },
  jumpOut: {
    type: 'exit',
    steps: [lookUp, deepCrouch, launch, { kind: 'leap' }, { kind: 'pause', duration: 0.25 }],
    calm: calmOut,
  },
  hopOff: {
    type: 'exit',
    steps: [lookDownHereGoes, crouch(0.12, 0.12), hopOver, { kind: 'sink' }],
    calm: calmOut,
  },
  duck: {
    type: 'exit',
    steps: [startle, crouch(0.08, 0.12), { kind: 'sink' }, shyPeek],
    calm: calmOut,
  },
};

const exitWeights: Record<string, Record<string, number>> = {
  playful: { hopOff: 3, jumpOut: 3, walkOff: 1, duck: 1 },
  cozy: { walkOff: 3, hopOff: 2, duck: 2 },
  shy: { duck: 4, hopOff: 1, walkOff: 1 },
};

export function selectChoreography(
  type: 'entrance' | 'exit',
  options: {
    seed: number;
    cue: string;
    previous?: string | undefined;
    profile: MotionProfile;
    personality?: string;
  },
) {
  const rng = rngFor(options.seed, 'choreography:' + options.cue);
  const weights =
    type === 'entrance'
      ? options.profile.entranceWeights
      : (exitWeights[options.personality ?? 'cozy'] ?? exitWeights['cozy'] ?? {});
  const candidates = Object.entries(weights)
    .filter(([id]) => choreographies[id]?.type === type)
    .map(([id, weight]) => ({ id, weight }));
  if (!candidates.length) return type === 'entrance' ? 'drop' : 'duck';
  return pick(rng, candidates, options.previous);
}

export interface ChoreographyFrame {
  choreography: string | null;
  /** Current beat name (diagnostics). */
  beat: string | null;
  /** Height above the ground line, body heights (+ up, - below the edge). */
  liftBH: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  /** Hide everything below this y (fraction of height) while sinking/climbing. */
  clipBelow: number | null;
  pose: Partial<Pose>;
  /** Expressions fired this frame (forward to the expression system). */
  expressions: string[];
  /** Hold overrides (seconds) for fired expressions that last until released. */
  holds: Record<string, number>;
  /** Expressions to release this frame. */
  releases: string[];
  /** Optional overlay impact shake in px (off by default). */
  shake: number;
  done: boolean;
  hidden: boolean;
}

interface Running {
  id: string;
  steps: readonly Step[];
  at: number;
  ground: number;
  fromLift: number;
  fired: Set<number>;
  shake: boolean;
  locomotion: Locomotion;
  anchor: { x: number; y: number };
  /** Durations of locomotion-driven steps, known once they finish. */
  lengths: Map<number, number>;
  issued: Set<number>;
}

const TURN_STEP = 0.34;
/** How far below the ground line a sinking exit goes before it is fully hidden (BH). */
const SINK_DEPTH = 1.25;

function stepLength(step: Step, profile: MotionProfile) {
  // Personality tempo, softened: cozy a little slower, playful a little quicker.
  const k = 1 / Math.sqrt(Math.max(0.6, Math.min(1.4, profile.tempo)));
  switch (step.kind) {
    case 'spawnAbove':
    case 'spawnSide':
    case 'spawnBelow':
    case 'expression':
    case 'release':
      return 0;
    case 'walk':
      return Infinity;
    case 'turn':
      return TURN_STEP;
    case 'act': {
      const base = typeof step.duration === 'function' ? step.duration(profile) : step.duration;
      return step.physical ? base : base * k;
    }
    case 'sink':
    case 'leap':
      return Infinity; // set from the starting height when reached (gravity)
    case 'fall':
    case 'fade':
      return step.duration;
    default:
      return step.duration * k;
  }
}

export class ChoreographyPlayer {
  private running: Running | null = null;
  private hidden = false;
  private lastLift = 0;

  get active() {
    return this.running?.id ?? null;
  }

  /** Visible again without a choreography (another system performed the entrance). */
  reveal() {
    this.hidden = false;
    this.running = null;
    this.lastLift = 0;
  }

  get isHidden() {
    return this.hidden;
  }

  /** Start a choreography at the cue's shared start time. Exits continue from the current pose. */
  start(
    id: string,
    {
      at,
      anchor,
      impactShake = false,
    }: { at: number; anchor: { x: number; y: number }; seed?: number; impactShake?: boolean },
    locomotion: Locomotion,
    _stage: Stage,
    calm = false,
  ) {
    const def = choreographies[id];
    if (!def) throw new Error('Unknown choreography: ' + id);
    if (def.type === 'entrance') {
      locomotion.place(anchor.x, anchor.y);
      this.hidden = false;
    } else locomotion.stop(at);
    this.running = {
      id,
      steps: calm ? def.calm : def.steps,
      at,
      ground: locomotion.position.y,
      fromLift: def.type === 'exit' ? this.lastLift : 0,
      fired: new Set(),
      shake: impactShake,
      locomotion,
      anchor: { ...anchor },
      lengths: new Map(),
      issued: new Set(),
    };
  }

  update(
    now: number,
    profile: MotionProfile,
    stage: Stage,
    loco: LocomotionFrame,
  ): ChoreographyFrame {
    const frame: ChoreographyFrame = {
      choreography: this.running?.id ?? null,
      beat: null,
      liftBH: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: this.hidden ? 0 : 1,
      clipBelow: null,
      pose: {},
      expressions: [],
      holds: {},
      releases: [],
      shake: 0,
      done: this.running === null,
      hidden: this.hidden,
    };
    const run = this.running;
    if (!run) return frame;
    const def = choreographies[run.id];
    const exit = def?.type === 'exit';
    // A late joiner (reconnect) or a stalled walk jumps to the end state instead of replaying.
    if (now - run.at > 30) {
      this.running = null;
      this.lastLift = 0;
      if (exit) this.hidden = true;
      else run.locomotion.place(run.anchor.x, run.anchor.y);
      return {
        ...frame,
        choreography: null,
        done: true,
        hidden: this.hidden,
        opacity: exit ? 0 : 1,
      };
    }
    let t = now - run.at;
    let lift = run.fromLift;
    let finished = true;
    const squash = profile.maxSquash;
    const top = run.ground / stage.bodyHeight + 0.05;
    for (let index = 0; index < run.steps.length; index++) {
      const step = run.steps[index];
      if (!step) continue;
      if (!run.lengths.has(index)) {
        // Ballistic steps: duration follows from the height to cover under one gravity.
        if (step.kind === 'fall') run.lengths.set(index, fallTime(top + 1));
        else if (step.kind === 'sink') run.lengths.set(index, fallTime(lift + SINK_DEPTH));
        else if (step.kind === 'leap') {
          const height = top + 1.2 - lift;
          const v0 = Math.sqrt(2 * G_BH * (height + 0.3));
          run.lengths.set(index, (v0 - Math.sqrt(v0 * v0 - 2 * G_BH * height)) / G_BH);
        }
      }
      const length = run.lengths.get(index) ?? stepLength(step, profile);
      const local = t;
      const inside = local < length;
      switch (step.kind) {
        case 'spawnAbove':
          lift = top + 1;
          break;
        case 'spawnSide':
          if (!run.issued.has(index)) {
            run.issued.add(index);
            run.locomotion.place(run.anchor.x < 0.5 ? -0.1 : 1.1, run.anchor.y);
          }
          break;
        case 'spawnBelow':
          lift = -1.25;
          break;
        case 'fall': {
          const k = clamp01(local / length);
          lift = (top + 1) * (1 - k * k); // constant g: length = fallTime(top + 1)
          if (inside) {
            frame.scaleY = 1 + 0.14 * k * squash;
            frame.scaleX = 1 / frame.scaleY;
            frame.pose.armL = 0.9 * k;
            frame.pose.armR = 0.9 * k;
            frame.pose.browL = -0.9;
            frame.pose.browR = -0.9;
            frame.pose.smile = -0.5;
            frame.pose.hairSwoop = 0.15 * k;
            frame.pose.footLY = 0.03 * k;
            frame.pose.footRY = 0.02 * k;
          }
          break;
        }
        case 'act': {
          const at = Math.min(local, length);
          const out = step.fn(at, length > 0 ? clamp01(at / length) : 1, {
            profile,
            from: lift,
            top,
          });
          if (out.lift !== undefined) lift = out.lift;
          if (inside) {
            frame.beat = step.name;
            if (out.pose) frame.pose = out.pose;
            const sy = out.scaleY ?? 1,
              sx = out.scaleX ?? 1;
            frame.scaleY = 1 + (sy - 1) * squash;
            frame.scaleX = 1 + (sx - 1) * squash;
            if (out.clip) frame.clipBelow = run.ground;
          }
          break;
        }
        case 'expression':
          if (!run.fired.has(index)) {
            run.fired.add(index);
            frame.expressions.push(step.id);
            if (step.hold !== undefined) frame.holds[step.id] = step.hold;
          }
          break;
        case 'release':
          if (!run.fired.has(index)) {
            run.fired.add(index);
            frame.releases.push(step.id);
          }
          break;
        case 'pause':
          break;
        case 'turn':
          if (!run.issued.has(index)) {
            run.issued.add(index);
            const direction = step.to === 'camera' ? 1 : run.locomotion.position.x < 0.5 ? -1 : 1;
            run.locomotion.turnTo(direction, now);
          }
          break;
        case 'walk': {
          if (!run.issued.has(index)) {
            run.issued.add(index);
            const side = run.locomotion.position.x < 0.5 ? -1 : 1;
            const x = step.to === 'anchor' ? run.anchor.x : side < 0 ? -0.3 : 1.3;
            // Personality gait from the library; playful skips off rather than bunny-hopping.
            const gait: Gait =
              step.gait === 'personality'
                ? profile.gait === 'hop'
                  ? 'skip'
                  : (resolveGait(profile.gait) ?? 'walk')
                : step.gait;
            run.locomotion.moveTo({
              x,
              at: now,
              gait,
              speed: step.speed,
              unbounded: true,
              beats: step.beats ?? 'none',
            });
          } else if (!run.lengths.has(index)) {
            // Walking off: done as soon as the body is fully off-screen (no arrival slow-down).
            const x = run.locomotion.position.x;
            const offstage = step.to === 'side' && (x < -0.07 || x > 1.07);
            if ((!loco.moving && local > 0.2) || offstage) {
              run.lengths.set(index, local);
              if (offstage) run.locomotion.stop(now);
            }
          }
          lift = 0;
          break;
        }
        case 'sink': {
          // Free fall from the current lift down through the ground line (clipped there).
          const from = lift;
          const tt = Math.min(local, length);
          lift = Math.max(-SINK_DEPTH, from - (G_BH * tt * tt) / 2);
          frame.clipBelow = run.ground;
          if (inside) {
            frame.pose.armL = 0.7 * clamp01(tt / length);
            frame.pose.armR = 0.7 * clamp01(tt / length);
          }
          break;
        }
        case 'leap': {
          // Ballistic jump: v0 chosen so the apex is just above the top of the canvas.
          const from = lift;
          const height = top + 1.2 - from;
          const v0 = Math.sqrt(2 * G_BH * (height + 0.3));
          const tt = Math.min(local, length);
          lift = from + v0 * tt - (G_BH * tt * tt) / 2;
          if (inside) {
            frame.scaleY = 1 + 0.15 * (1 - clamp01(tt / 0.15)) * squash;
            frame.scaleX = 1 / frame.scaleY;
            frame.pose.armL = 1.4;
            frame.pose.armR = 1.4;
            frame.pose.hairSwoop = -0.18;
          }
          break;
        }
        case 'fade': {
          const k = smootherstep(local / length);
          frame.opacity = step.to === 1 ? k : 1 - k;
          if (step.rise) lift = step.to === 1 ? -step.rise * (1 - k) : 0;
          break;
        }
      }
      if (inside) {
        finished = false;
        break;
      }
      t -= length;
    }
    frame.liftBH = lift;
    this.lastLift = lift;
    if (finished) {
      frame.done = true;
      frame.scaleX = 1;
      frame.scaleY = 1;
      this.running = null;
      this.lastLift = 0;
      if (exit) {
        this.hidden = true;
        frame.hidden = true;
        frame.opacity = 0;
      } else {
        frame.liftBH = 0;
        frame.opacity = 1;
      }
    }
    return frame;
  }
}
