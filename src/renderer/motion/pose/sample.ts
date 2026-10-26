// Samples a Beat at a time: eased key-to-key interpolation, discrete channels switched at a set
// point of the segment, planted hands re-solved every sample (the hand stays on the edge while the
// body moves), and the living hold layered after the last key. Pure and deterministic.
import { easeOutBack, smootherstep } from '../core/curves';
import { fbm1 } from '../core/noise';
import { random } from '../core/random';
import type { Channel, Pose } from '../types';
import { channelSpecs } from './contract';
import { solveHand } from './ik';
import { restPlacement, type Placement, type ProxyRig, type Vec } from './proxy';
import {
  beatDuration,
  type Beat,
  type Contact,
  type Ease,
  type Key,
  type PoseValues,
} from './schema';

export interface BeatSample {
  pose: Partial<Pose>;
  place: Placement;
  /** y of the clip line in beat space, or null. */
  clipBelow: number | null;
  /** Index of the key being approached (or held). */
  key: number;
  /** Contacts that hold at this instant: the key's own at a key or in the hold. */
  contacts: Contact[];
  /** Hand targets being held (beat space). */
  reach: { L?: Vec; R?: Vec };
}

export function ease(kind: Ease, x: number) {
  const t = Math.min(1, Math.max(0, x));
  switch (kind) {
    case 'linear':
      return t;
    case 'in':
      return t * t * t;
    case 'out':
      return 1 - (1 - t) ** 3;
    case 'inOut':
      return smootherstep(t);
    case 'hold':
      return t >= 1 ? 1 : 0;
    case 'overshoot':
      return easeOutBack(t, 1.2);
  }
}

const discrete = (channel: Channel) => channelSpecs[channel].discrete === true;

/** Placement of each key, inheriting unset fields from the previous key. */
export function keyPlacements(beat: Beat): Placement[] {
  const out: Placement[] = [];
  let previous = restPlacement;
  for (const key of beat.keys) {
    const placed = { ...previous, ...key.place } as Placement;
    out.push(placed);
    previous = placed;
  }
  return out;
}

/** A key's pose with its hand targets solved. */
export function solvedKey(rig: ProxyRig, key: Key, at: Placement): PoseValues {
  const pose: PoseValues = { ...key.pose };
  for (const side of ['L', 'R'] as const) {
    const reach = key.reach[side];
    if (!reach) continue;
    const s = solveHand(rig, pose, at, side, reach.at, reach.bend ?? 'out');
    pose[side === 'L' ? 'armL' : 'armR'] = s.arm;
    pose[side === 'L' ? 'elbowL' : 'elbowR'] = s.elbow;
  }
  return pose;
}

/** Per-beat cache of solved key poses and placements. */
interface Prepared {
  poses: PoseValues[];
  places: Placement[];
}
const cache = new WeakMap<Beat, Map<string, Prepared>>();
function prepared(beat: Beat, rig: ProxyRig) {
  let byRig = cache.get(beat);
  if (!byRig) {
    byRig = new Map<string, Prepared>();
    cache.set(beat, byRig);
  }
  let entry = byRig.get(rig.id);
  if (!entry) {
    const places = keyPlacements(beat);
    const poses = beat.keys.map((key, i) => solvedKey(rig, key, places[i] ?? restPlacement));
    entry = { poses, places };
    byRig.set(rig.id, entry);
  }
  return entry;
}

function lerpPlace(a: Placement, b: Placement, k: number): Placement {
  const l = (x: number, y: number) => x + (y - x) * k;
  return {
    lift: l(a.lift, b.lift),
    dx: l(a.dx, b.dx),
    dy: l(a.dy, b.dy),
    rot: l(a.rot, b.rot),
    scaleX: l(a.scaleX, b.scaleX),
    scaleY: l(a.scaleY, b.scaleY),
  };
}

/** Life layers (moving hold) at `t` seconds into the hold. */
export function lifeAt(beat: Beat, t: number, seed = 0): PoseValues {
  const out: PoseValues = {};
  beat.life.forEach((layer, index) => {
    let value: number;
    if (layer.shape === 'sine')
      value = Math.sin((2 * Math.PI * t) / layer.period + layer.phase) * layer.amplitude;
    else if (layer.shape === 'noise')
      value = fbm1(seed + 31 * index, t / layer.period) * layer.amplitude;
    else {
      const length = layer.length ?? Math.min(1, layer.period / 3);
      const k = Math.floor(t / layer.period);
      const start = k * layer.period + random(seed + index, 'life', k) * (layer.period - length);
      const u = (t - start) / length;
      value = u >= 0 && u <= 1 ? Math.sin(Math.PI * u) ** 2 * layer.amplitude : 0;
    }
    out[layer.channel] = (out[layer.channel] ?? 0) + value;
  });
  return out;
}

function surfaceY(beat: Beat, id: string | null) {
  if (!id) return null;
  return beat.surfaces.find((s) => s.id === id)?.at ?? null;
}

export function sampleBeat(beat: Beat, t: number, rig: ProxyRig, seed = 0): BeatSample {
  const { poses, places } = prepared(beat, rig);
  const keys = beat.keys;
  const end = beatDuration(beat);
  let i = keys.findIndex((key) => key.at >= t);
  if (i < 0) i = keys.length - 1;
  const k1 = keys[i];
  const k0 = keys[Math.max(0, i - 1)];
  if (!k1 || !k0) throw new Error('empty beat ' + beat.id);
  const p1 = poses[i] ?? {},
    p0 = poses[Math.max(0, i - 1)] ?? {};
  const a1 = places[i] ?? restPlacement,
    a0 = places[Math.max(0, i - 1)] ?? restPlacement;
  const span = k1.at - k0.at;
  const raw = i === 0 || span <= 0 ? 1 : (t - k0.at) / span;
  const u = ease(k1.ease, raw);
  const pose: PoseValues = {};
  for (const channel of new Set([...Object.keys(p0), ...Object.keys(p1)]) as Set<Channel>) {
    const from = p0[channel] ?? 0,
      to = p1[channel] ?? 0;
    pose[channel] = discrete(channel)
      ? raw >= (k1.ease === 'hold' ? 1 : k1.switchAt)
        ? to
        : from
      : from + (to - from) * u;
  }
  const place = lerpPlace(a0, a1, u);
  const holding = t >= end;
  if (holding && beat.life.length) {
    const life = lifeAt(beat, t - end, seed);
    for (const [channel, value] of Object.entries(life) as [Channel, number][]) {
      if (channel === 'bob' && place.lift !== 0) continue;
      pose[channel] = (pose[channel] ?? 0) + value;
    }
  }
  // Planted hands: when both ends hold a target, interpolate it and re-solve so the hand stays.
  const reach: BeatSample['reach'] = {};
  for (const side of ['L', 'R'] as const) {
    const r0 = k0.reach[side],
      r1 = k1.reach[side];
    const target =
      r1 && (r0 || i === 0 || holding)
        ? r0 && !holding && i > 0
          ? {
              x: r0.at.x + (r1.at.x - r0.at.x) * u,
              y: r0.at.y + (r1.at.y - r0.at.y) * u,
            }
          : r1.at
        : null;
    if (!target || !r1) continue;
    const s = solveHand(rig, pose, place, side, target, r1.bend ?? 'out');
    pose[side === 'L' ? 'armL' : 'armR'] = s.arm;
    pose[side === 'L' ? 'elbowL' : 'elbowR'] = s.elbow;
    reach[side] = target;
  }
  if (!rig.capabilities.hands) {
    delete pose.handL;
    delete pose.handR;
  }
  const atKey = holding || Math.abs(t - k1.at) < 1e-6;
  return {
    pose,
    place,
    clipBelow: surfaceY(beat, k1.clipBelow),
    key: i,
    contacts: atKey ? k1.contacts : [],
    reach,
  };
}

/** Times of the keys (for checks and strips). */
export function keyTimes(beat: Beat) {
  return beat.keys.map((key) => key.at);
}
