// Samples ExpressionScripts on the shared service clock into active, weighted layers.
// Pure and model-independent: no manifests, no renderer, no wall clock.
import { defaultPhases, type ExpressionScript } from '../../shared/cue';
import {
  expressions,
  type Channel,
  type ExpressionId,
  type Target,
} from '../../shared/expressions';

export type Phase = 'anticipation' | 'hold' | 'recovery';
export interface ActiveLayer {
  expression: ExpressionId;
  channel: Channel;
  intensity: number;
  target: Target;
  phase: Phase;
  /** 0..1 progress through the current phase. */
  progress: number;
  /** Envelope weight 0..1 after cross-fades. */
  weight: number;
  /** Seconds since this beat started. */
  elapsed: number;
  /** Anticipation + hold in seconds (Infinity while an open-ended beat holds). */
  span: number;
  caption?: string;
  /** Key used for interruption: explicit group or the channel. */
  group: string;
}
export interface PhaseTiming {
  anticipation: number;
  recovery: number;
}
export type PhaseLookup = (expression: ExpressionId) => PhaseTiming;
export const defaultLookup: PhaseLookup = () => defaultPhases;

export function smooth(value: number) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}
function envelope(elapsed: number, hold: number, timing: PhaseTiming, holdsOpen: boolean) {
  const { anticipation, recovery } = timing;
  if (elapsed < 0) return null;
  if (elapsed < anticipation)
    return {
      phase: 'anticipation' as const,
      progress: elapsed / Math.max(anticipation, 1e-3),
      weight: smooth(elapsed / Math.max(anticipation, 1e-3)),
    };
  if (holdsOpen || elapsed < anticipation + hold)
    return {
      phase: 'hold' as const,
      progress: holdsOpen ? 0 : (elapsed - anticipation) / hold,
      weight: 1,
    };
  const into = elapsed - anticipation - hold;
  if (into < recovery)
    return {
      phase: 'recovery' as const,
      progress: into / Math.max(recovery, 1e-3),
      weight: 1 - smooth(into / Math.max(recovery, 1e-3)),
    };
  return null;
}

/** Active layers of one script at service time `now` (ms). */
export function sampleScript(
  script: ExpressionScript,
  now: number,
  lookup: PhaseLookup = defaultLookup,
): ActiveLayer[] {
  const seconds = (now - script.startAt) / 1000;
  const lastInGroup = new Map<string, number>();
  script.beats.forEach((beat, index) => {
    lastInGroup.set(beat.group ?? expressions[beat.expression].channel, index);
  });
  const candidates: (ActiveLayer & { offset: number })[] = [];
  script.beats.forEach((beat, index) => {
    const group = beat.group ?? expressions[beat.expression].channel;
    const holdsOpen = !script.settle && lastInGroup.get(group) === index;
    const shape = envelope(seconds - beat.offset, beat.hold, lookup(beat.expression), holdsOpen);
    if (!shape) return;
    const layer: ActiveLayer & { offset: number } = {
      expression: beat.expression,
      channel: expressions[beat.expression].channel,
      intensity: beat.intensity,
      target: beat.target,
      ...shape,
      elapsed: seconds - beat.offset,
      span: holdsOpen ? Infinity : lookup(beat.expression).anticipation + beat.hold,
      group,
      offset: beat.offset,
    };
    if (beat.caption) layer.caption = beat.caption;
    candidates.push(layer);
  });
  // Within a group, a newer beat cross-fades the older one out during its anticipation.
  const result: ActiveLayer[] = [];
  for (const layer of candidates) {
    let weight = layer.weight;
    for (const other of candidates)
      if (other !== layer && other.group === layer.group && other.offset > layer.offset)
        weight *= 1 - other.weight;
    if (weight > 0.001) {
      result.push({
        expression: layer.expression,
        channel: layer.channel,
        intensity: layer.intensity,
        target: layer.target,
        phase: layer.phase,
        progress: layer.progress,
        weight,
        elapsed: layer.elapsed,
        span: layer.span,
        group: layer.group,
        ...(layer.caption ? { caption: layer.caption } : {}),
      });
    }
  }
  return result;
}

/**
 * Tracks the current script and fades out whatever it replaced, so interruptions never snap.
 * A reconnecting client simply samples the current script at the current time: finished
 * scripts produce nothing, so nothing is replayed.
 */
export class Performer {
  private current: ExpressionScript | null = null;
  private previous: { script: ExpressionScript; replacedAt: number } | null = null;
  constructor(
    private readonly lookup: PhaseLookup = defaultLookup,
    private readonly fade = 0.35,
  ) {}
  set(script: ExpressionScript | null, now: number) {
    if (script?.id === this.current?.id) return;
    if (this.current) this.previous = { script: this.current, replacedAt: now };
    this.current = script;
  }
  get script() {
    return this.current;
  }
  sample(now: number, reducedMotion = false): ActiveLayer[] {
    const layers = this.current ? sampleScript(this.current, now, this.lookup) : [];
    if (this.previous) {
      const fadeSeconds = reducedMotion ? 0.001 : this.fade;
      const amount = 1 - smooth((now - this.previous.replacedAt) / 1000 / fadeSeconds);
      if (amount <= 0) this.previous = null;
      else
        for (const layer of sampleScript(this.previous.script, now, this.lookup))
          layers.push({ ...layer, weight: layer.weight * amount });
    }
    return layers;
  }
}
