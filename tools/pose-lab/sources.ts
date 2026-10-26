// What the pose lab can play: authored beats (editable), and the runtime's current choreographies
// and body-state plans sampled as they run (for before/after comparisons).
import {
  beatDuration,
  type Beat,
  type Contact,
  type Surface,
} from '../../src/renderer/motion/pose/schema';
import { sampleBeat } from '../../src/renderer/motion/pose/sample';
import { beats } from '../../src/renderer/motion/pose/library';
import {
  restPlacement,
  type Placement,
  type ProxyRig,
  type Vec,
} from '../../src/renderer/motion/pose/proxy';
import { choreographies, type Step } from '../../src/renderer/motion/systems/choreography';
import { motionProfile } from '../../src/renderer/motion/profile';
import {
  enterPlan,
  exitPlan,
  sampleTimeline,
  type PlanContext,
} from '../../src/renderer/motion/states/plan';
import { mascotStates } from '../../src/renderer/characters/mascot/states';
import type { Pose } from '../../src/renderer/motion/types';
import type { BodyStateId, Spot } from '../../shared/states';

export interface Sampled {
  pose: Partial<Pose>;
  place: Placement;
  clipBelow: number | null;
  contacts: readonly Contact[];
  reach: { L?: Vec; R?: Vec };
}
export interface Source {
  id: string;
  label: string;
  frame: 'floor' | 'ledge' | 'edge';
  /** Ledge height above the floor for ledge-framed sources (BH). */
  gap: number;
  surfaces: readonly Surface[];
  duration: number;
  keys: { name: string; at: number }[];
  beat?: Beat;
  sample(t: number, rig: ProxyRig): Sampled;
}

export function beatSource(beat: Beat): Source {
  return {
    id: beat.id,
    label: beat.label,
    frame: beat.frame,
    gap: 0.9,
    surfaces: beat.surfaces,
    duration: Math.max(beatDuration(beat), beat.life.length ? 6 : 0),
    keys: beat.keys.map((k) => ({ name: k.name, at: k.at })),
    beat,
    sample: (t, rig) => sampleBeat(beat, t, rig),
  };
}

const profile = motionProfile({
  personality: 'cozy',
  attitude: 'cheeky',
  energy: 50,
  reducedMotion: false,
  quiet: false,
});

/** Current runtime choreography (act beats only; travel and gravity steps approximated). */
function choreographySource(id: string): Source {
  const steps = choreographies[id]?.steps ?? [];
  const parts: { step: Step; at: number; dur: number }[] = [];
  let at = 0;
  for (const step of steps) {
    const dur =
      step.kind === 'act'
        ? typeof step.duration === 'function'
          ? step.duration(profile)
          : step.duration
        : step.kind === 'fall' || step.kind === 'pause'
          ? step.duration
          : 0;
    parts.push({ step, at, dur });
    at += dur;
  }
  return {
    id: 'legacy-' + id,
    label: `Current: ${id}`,
    frame: id === 'climb' || id === 'slideUp' ? 'edge' : 'floor',
    gap: 0,
    surfaces: [{ id: 'edge', kind: 'floor', at: 0 }],
    duration: at,
    keys: parts
      .filter((p) => p.step.kind === 'act')
      .map((p) => ({ name: p.step.kind === 'act' ? p.step.name : '', at: p.at })),
    sample(t) {
      let lift = 0;
      let out: Sampled = {
        pose: {},
        place: restPlacement,
        clipBelow: null,
        contacts: [],
        reach: {},
      };
      for (const part of parts) {
        if (part.step.kind === 'spawnBelow') lift = -1.25;
        if (part.step.kind === 'spawnAbove') lift = 1.5;
        if (part.step.kind === 'fall') {
          const k = Math.min(1, Math.max(0, (t - part.at) / part.dur));
          lift = 1.5 * (1 - k * k);
        }
        if (part.step.kind !== 'act') continue;
        if (t < part.at) break;
        const local = Math.min(t - part.at, part.dur);
        const r = part.step.fn(local, part.dur ? local / part.dur : 1, {
          profile,
          from: lift,
          top: 3,
        });
        if (r.lift !== undefined) lift = r.lift;
        out = {
          pose: r.pose ?? {},
          place: { ...restPlacement, lift, scaleX: r.scaleX ?? 1, scaleY: r.scaleY ?? 1 },
          clipBelow: r.clip ? 0 : null,
          contacts: [],
          reach: {},
        };
      }
      out.place = { ...out.place, lift };
      return out;
    },
  };
}

/** Current runtime body-state transition (enter or exit plan) at a spot. */
function stateSource(state: BodyStateId, ledge: boolean, phase: 'enter' | 'exit'): Source {
  const gap = 0.9;
  const spot: Spot | null = ledge
    ? { surface: 'ledge', rect: 'webcam', x: 0.23, y: 0.5, approach: { x: 0.23, y: 0.72 }, side: 1 }
    : state === 'lean'
      ? {
          surface: 'side',
          rect: 'webcam',
          x: 0.2,
          y: 0.72,
          approach: { x: 0.2, y: 0.72 },
          side: 1,
          edgeX: 0.3,
        }
      : { surface: 'floor', x: 0.23, y: 0.72, approach: { x: 0.23, y: 0.72 }, side: 1 };
  const context: PlanContext = {
    rig: mascotStates,
    gap: ledge || state === 'perch' ? gap : 0,
    edgeDistance: 0.36,
    reducedMotion: false,
  };
  const timeline =
    phase === 'enter' ? enterPlan(state, spot, context) : exitPlan(state, spot, context, 'normal');
  return {
    id: `legacy-${state}-${ledge ? 'ledge' : 'floor'}-${phase}`,
    label: `Current: ${state} ${ledge ? 'on the ledge' : ''} (${phase})`,
    frame: 'floor',
    gap,
    surfaces: [
      { id: 'floor', kind: 'floor', at: 0 },
      ...(ledge || state === 'perch' ? [{ id: 'ledge', kind: 'ledge' as const, at: gap }] : []),
    ],
    duration: timeline.duration + 1,
    keys: timeline.segments.map((s, i) => ({ name: `segment ${String(i + 1)}`, at: s.at + s.dur })),
    sample(t) {
      const key = sampleTimeline(timeline, t);
      return {
        pose: key.pose,
        place: { lift: key.lift, dx: key.dx, dy: key.dy, rot: key.rot, scaleX: 1, scaleY: 1 },
        clipBelow: null,
        contacts: [],
        reach: {},
      };
    },
  };
}

export function allSources(): Source[] {
  return [
    ...Object.values(beats).map(beatSource),
    ...['climb', 'drop', 'hopOff', 'slideUp'].map(choreographySource),
    stateSource('sit', false, 'enter'),
    stateSource('sit', true, 'enter'),
    stateSource('nap', false, 'enter'),
    stateSource('perch', false, 'enter'),
    stateSource('peek', false, 'enter'),
    stateSource('lean', false, 'enter'),
    stateSource('doze', false, 'enter'),
  ];
}
