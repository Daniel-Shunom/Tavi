// Automated posing rubric (docs/motion/POSING-AND-STAGING.md, section 5): the measurable items,
// run against the proxy rig in tests and live in the pose lab. Each finding names its rubric item.
import type { Channel, Pose } from '../types';
import { channelSpecs } from './contract';
import {
  headExtreme,
  insideHead,
  insideQuad,
  joints,
  type Joints,
  type ProxyRig,
  type Vec,
} from './proxy';
import { beatDuration, type Beat, type Contact, type PartId, type Surface } from './schema';
import { keyPlacements, sampleBeat } from './sample';

export type Rule =
  | 'range'
  | 'line-of-action'
  | 'balance'
  | 'contacts'
  | 'grounding'
  | 'silhouette'
  | 'occlusion'
  | 'living-hold'
  | 'transitions';

export interface Finding {
  level: 'error' | 'warn';
  rule: Rule;
  /** Key name or a time. */
  where: string;
  message: string;
}

/** Overlay pixels per body height at 1280 x 720. */
export const PX_PER_BH = 176;
export const CONTACT_TOLERANCE = 0.012;
const BALANCE_MARGIN = 0.05;
/** Faster than this (px per 60 fps frame at 720p) is a pop unless the key is marked fast. */
const POP_PX = 22;

export function partPosition(j: Joints, part: PartId, surface?: Surface, rig?: ProxyRig): Vec {
  // A hand rests on a horizontal surface with its underside, not its knuckles.
  const under = (p: Vec) =>
    surface && surface.kind !== 'wall' ? { x: p.x, y: p.y - (rig?.handRadius ?? 0.045) } : p;
  switch (part) {
    case 'soleL':
      return j.soleL;
    case 'soleR':
      return j.soleR;
    case 'seat':
      return j.seat;
    case 'handL':
      return under(j.handL);
    case 'handR':
      return under(j.handR);
    case 'kneeL':
      return j.kneeL;
    case 'kneeR':
      return j.kneeR;
    case 'head': {
      // The side of the head toward a wall, or its lowest point toward a floor.
      if (surface?.kind === 'wall')
        return headExtreme(j.head, { x: surface.at < j.head.centre.x ? -1 : 1, y: 0 });
      return headExtreme(j.head, { x: 0, y: -1 });
    }
  }
}

/** Signed distance of a part from its surface line (BH). */
export function contactGap(
  j: Joints,
  contact: Contact,
  surfaces: readonly Surface[],
  rig?: ProxyRig,
) {
  const surface = surfaces.find((s) => s.id === contact.surface);
  if (!surface) return Infinity;
  const p = partPosition(j, contact.part, surface, rig);
  return surface.kind === 'wall' ? Math.abs(p.x - surface.at) : p.y - surface.at;
}

/** Spine polyline soles -> hips -> torso -> neck -> head centre, for the line of action. */
export function spine(j: Joints): Vec[] {
  const base = { x: (j.soleL.x + j.soleR.x) / 2, y: (j.soleL.y + j.soleR.y) / 2 };
  return [base, j.hips, j.neck, j.head.centre];
}
function bends(points: readonly Vec[]) {
  const out: number[] = [];
  for (let i = 1; i + 1 < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      c = points[i + 1];
    if (!a || !b || !c) continue;
    const t1 = Math.atan2(b.y - a.y, b.x - a.x),
      t2 = Math.atan2(c.y - b.y, c.x - b.x);
    let d = t2 - t1;
    d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    out.push(d);
  }
  return out;
}

/** Checks one posed instant (a key or a hold sample). */
export function checkPose(
  rig: ProxyRig,
  pose: Partial<Pose>,
  j: Joints,
  contacts: readonly Contact[],
  surfaces: readonly Surface[],
  where: string,
  options: { symmetric?: boolean; clipBelow?: number | null } = {},
): Finding[] {
  const out: Finding[] = [];
  for (const [channel, value] of Object.entries(pose) as [Channel, number][]) {
    const spec = channelSpecs[channel];
    if (value < spec.min - 1e-6 || value > spec.max + 1e-6)
      out.push({
        level: 'error',
        rule: 'range',
        where,
        message: `${channel} ${value.toFixed(3)} outside ${String(spec.min)}..${String(spec.max)}`,
      });
    if (spec.discrete && Math.abs(value - Math.round(value)) > 1e-6)
      out.push({ level: 'error', rule: 'range', where, message: `${channel} must be whole` });
  }
  // Contacts.
  for (const contact of contacts) {
    const gap = contactGap(j, contact, surfaces, rig);
    const tolerance = contact.tolerance ?? CONTACT_TOLERANCE;
    if (Math.abs(gap) > tolerance)
      out.push({
        level: 'error',
        rule: 'contacts',
        where,
        message: `${contact.part} is ${(gap * PX_PER_BH).toFixed(1)} px from ${contact.surface} (tolerance ${(tolerance * PX_PER_BH).toFixed(1)} px)`,
      });
  }
  // Balance: centre of mass over the base of support (horizontal surfaces under the body).
  const supports = contacts
    .map((contact) => ({ contact, surface: surfaces.find((s) => s.id === contact.surface) }))
    .filter(({ surface }) => surface && surface.kind !== 'wall');
  const below = supports.filter(({ contact, surface }) => {
    const p = partPosition(j, contact.part, surface, rig);
    return p.y <= j.com.y;
  });
  const walls = contacts.some((c) => surfaces.find((s) => s.id === c.surface)?.kind === 'wall');
  if (supports.length && !walls) {
    const xs = supports.map(
      ({ contact, surface }) => partPosition(j, contact.part, surface, rig).x,
    );
    const lo = Math.min(...xs) - BALANCE_MARGIN,
      hi = Math.max(...xs) + BALANCE_MARGIN;
    // Hanging by the hands (no sole or seat contact) swings under the grip: momentary, a warning.
    const hanging =
      below.length === 0 || supports.every(({ contact }) => contact.part.startsWith('hand'));
    if (j.com.x < lo || j.com.x > hi)
      out.push({
        level: hanging ? 'warn' : 'error',
        rule: 'balance',
        where,
        message: `centre of mass ${(j.com.x * PX_PER_BH).toFixed(1)} px is outside the ${hanging ? 'grip' : 'support'} ${(lo * PX_PER_BH).toFixed(1)}..${(hi * PX_PER_BH).toFixed(1)} px`,
      });
  }
  // Line of action: no zigzag (a single C or S).
  const turns = bends(spine(j));
  const sharp = turns.find((d) => Math.abs(d) > (70 * Math.PI) / 180);
  if (sharp !== undefined)
    out.push({
      level: 'warn',
      rule: 'line-of-action',
      where,
      message: `spine bends ${((sharp * 180) / Math.PI).toFixed(0)} deg in one joint`,
    });
  // Occlusion and draw order: a hand that should read must not hide behind the hair, nor cover
  // the face when drawn in front.
  const front = (pose.armsFront ?? 0) >= 0.5;
  for (const side of ['L', 'R'] as const) {
    const handPos = side === 'L' ? j.handL : j.handR;
    const handPose = pose[side === 'L' ? 'handL' : 'handR'] ?? 0;
    const touching = contacts.some((c) => c.part === `hand${side}`);
    const inHead = insideHead(j.head, handPos, -0.02);
    if ((touching || handPose > 0) && inHead && !front && rig.capabilities.armsFront)
      out.push({
        level: 'error',
        rule: 'occlusion',
        where,
        message: `hand ${side} is behind the hair (set armsFront or move it clear of the head)`,
      });
    const face = { x: j.head.centre.x, y: j.head.centre.y - 0.03 };
    if (front && Math.hypot(handPos.x - face.x, (handPos.y - face.y) * 1.3) < 0.1)
      out.push({
        level: 'warn',
        rule: 'occlusion',
        where,
        message: `hand ${side} covers the face`,
      });
    if (options.clipBelow !== null && options.clipBelow !== undefined && touching) {
      if (handPos.y < options.clipBelow - CONTACT_TOLERANCE)
        out.push({
          level: 'error',
          rule: 'occlusion',
          where,
          message: `hand ${side} is a contact but hidden below the clip line`,
        });
    }
  }
  // Silhouette: hands with a pose should stand clear of the body mass.
  for (const side of ['L', 'R'] as const) {
    const handPose = pose[side === 'L' ? 'handL' : 'handR'] ?? 0;
    const handPos = side === 'L' ? j.handL : j.handR;
    if (handPose > 0 && !front && insideQuad(j.torsoQuad, handPos))
      out.push({
        level: 'warn',
        rule: 'silhouette',
        where,
        message: `hand ${side} pose is lost against the torso`,
      });
  }
  // Twins: both arms mirrored exactly, with a straight body.
  const armsTwin =
    Math.abs((pose.armL ?? 0) - (pose.armR ?? 0)) < 0.02 &&
    Math.abs((pose.elbowL ?? 0) + (pose.elbowR ?? 0)) < 0.02 &&
    Math.abs(pose.armL ?? 0) > 0.3;
  if (armsTwin && !options.symmetric)
    out.push({ level: 'warn', rule: 'silhouette', where, message: 'twinned arms (mirror-equal)' });
  return out;
}

/** Whether both soles stand on a floor surface (grounded). */
function grounded(contacts: readonly Contact[], surfaces: readonly Surface[]) {
  const on = (part: PartId) =>
    contacts.some(
      (c) => c.part === part && surfaces.find((s) => s.id === c.surface)?.kind === 'floor',
    );
  return on('soleL') && on('soleR');
}

export interface BeatReport {
  findings: Finding[];
  /** Peak joint speed (px per frame at 720p), for diagnostics. */
  peakSpeed: number;
}

/** Full rubric for a beat: every key, the segments between them (60 fps) and the hold. */
export function checkBeat(beat: Beat, rig: ProxyRig, seed = 0): BeatReport {
  const findings: Finding[] = [];
  const places = keyPlacements(beat);
  beat.keys.forEach((key, i) => {
    const s = sampleBeat(beat, key.at, rig, seed);
    const j = joints(rig, s.pose, s.place);
    findings.push(
      ...checkPose(rig, s.pose, j, key.contacts, beat.surfaces, key.name, {
        symmetric: key.symmetric,
        clipBelow: s.clipBelow,
      }),
    );
    // Grounding: a grounded key must not lift the root, and hips stay below standing.
    const place = places[i];
    if (grounded(key.contacts, beat.surfaces) && place) {
      const floor = beat.surfaces.find((s2) => s2.kind === 'floor');
      if (
        floor &&
        Math.abs(place.lift - floor.at) > 1e-6 &&
        !key.contacts.some((c) => c.part === 'seat')
      )
        findings.push({
          level: 'error',
          rule: 'grounding',
          where: key.name,
          message: `root lifted ${place.lift.toFixed(3)} BH while the soles are on the floor`,
        });
      if ((s.pose.bob ?? 0) < -0.0045)
        findings.push({
          level: 'error',
          rule: 'grounding',
          where: key.name,
          message: 'hips above standing height while grounded',
        });
    }
  });
  // Segments: continuity (no pops), grounded segments keep the root and the soles still.
  const dt = 1 / 60;
  const end = beatDuration(beat);
  let previous: Joints | null = null;
  let peak = 0;
  for (let t = 0; t <= end + 1e-9; t += dt) {
    const s = sampleBeat(beat, t, rig, seed);
    const j = joints(rig, s.pose, s.place);
    const k1 = beat.keys[s.key];
    const k0 = beat.keys[Math.max(0, s.key - 1)];
    const last = previous;
    if (last && k1) {
      const speed = Math.max(
        ...(['head', 'handL', 'handR', 'hips'] as const).map((part) => {
          const a = part === 'head' ? last.head.centre : last[part];
          const b = part === 'head' ? j.head.centre : j[part];
          return Math.hypot(a.x - b.x, a.y - b.y) * PX_PER_BH;
        }),
      );
      peak = Math.max(peak, speed);
      if (speed > POP_PX && !k1.fast)
        findings.push({
          level: 'warn',
          rule: 'transitions',
          where: `${k1.name} @${t.toFixed(2)}s`,
          message: `joint moves ${speed.toFixed(1)} px in one frame (pop)`,
        });
      if (k0 && grounded(k0.contacts, beat.surfaces) && grounded(k1.contacts, beat.surfaces)) {
        const shared = k1.contacts.filter(
          (c) =>
            (c.part === 'soleL' || c.part === 'soleR') &&
            k0.contacts.some((d) => d.part === c.part && d.surface === c.surface),
        );
        for (const c of shared) {
          const gap = contactGap(j, c, beat.surfaces, rig);
          if (Math.abs(gap) > CONTACT_TOLERANCE)
            findings.push({
              level: 'error',
              rule: 'grounding',
              where: `${k1.name} @${t.toFixed(2)}s`,
              message: `${c.part} leaves the floor mid-segment (${(gap * PX_PER_BH).toFixed(1)} px)`,
            });
        }
      }
    }
    previous = j;
  }
  // Living hold: the hold moves, and its contacts stay put.
  const last = beat.keys[beat.keys.length - 1];
  if (beat.life.length && last) {
    const heads: Vec[] = [];
    let worst = 0;
    for (let t = 0; t < 12; t += 0.1) {
      const s = sampleBeat(beat, end + t, rig, seed);
      const j = joints(rig, s.pose, s.place);
      heads.push(j.head.centre);
      for (const c of last.contacts)
        worst = Math.max(
          worst,
          Math.abs(contactGap(j, c, beat.surfaces, rig)) - (c.tolerance ?? CONTACT_TOLERANCE),
        );
    }
    const mean = heads.reduce(
      (a, p) => ({ x: a.x + p.x / heads.length, y: a.y + p.y / heads.length }),
      { x: 0, y: 0 },
    );
    const spread = Math.sqrt(
      heads.reduce((a, p) => a + (p.x - mean.x) ** 2 + (p.y - mean.y) ** 2, 0) / heads.length,
    );
    if (spread * PX_PER_BH < 0.15)
      findings.push({
        level: 'warn',
        rule: 'living-hold',
        where: 'hold',
        message: 'the hold barely moves (head spread under 0.15 px)',
      });
    if (worst > 0)
      findings.push({
        level: 'error',
        rule: 'living-hold',
        where: 'hold',
        message: `the hold drifts ${(worst * PX_PER_BH).toFixed(1)} px off its contacts`,
      });
  }
  return { findings, peakSpeed: peak };
}

/** Continuity between two beats played back to back (end of `a` -> start of `b`). */
export function checkChain(a: Beat, b: Beat, rig: ProxyRig): Finding[] {
  const end = sampleBeat(a, beatDuration(a), rig);
  const start = sampleBeat(b, 0, rig);
  const ja = joints(rig, end.pose, end.place),
    jb = joints(rig, start.pose, start.place);
  const jump = Math.max(
    Math.hypot(ja.head.centre.x - jb.head.centre.x, ja.head.centre.y - jb.head.centre.y),
    Math.hypot(ja.handL.x - jb.handL.x, ja.handL.y - jb.handL.y),
    Math.hypot(ja.handR.x - jb.handR.x, ja.handR.y - jb.handR.y),
    Math.hypot(ja.hips.x - jb.hips.x, ja.hips.y - jb.hips.y),
  );
  return jump * PX_PER_BH > 3
    ? [
        {
          level: 'error',
          rule: 'transitions',
          where: `${a.id} -> ${b.id}`,
          message: `pose jumps ${(jump * PX_PER_BH).toFixed(1)} px between the beats`,
        },
      ]
    : [];
}
