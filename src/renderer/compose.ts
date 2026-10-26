// Turns active expression layers into a base pose using the character manifest's bindings.
// Pure: no renderer, no DOM. Motion layers add on top of this (see motionHook.ts).
import { expressions, type Target } from '../../shared/expressions';
import type { TrackApplication } from './adapter';
import type { BindingCore, CharacterManifest } from './characters/manifest';
import type { ActiveLayer, PhaseLookup } from './timeline';
import { defaultPhases } from '../../shared/cue';

export interface Offset {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}
export interface Pose {
  tracks: TrackApplication[];
  offset: Offset;
  /** 0..1 how far the character has slid to the screen edge to peek. */
  peek: number;
  /** 0..1 how far the character is tucked away. */
  tuck: number;
  caption: string;
  /** Strongest attention layer, if any. */
  attention: { target: Target; weight: number } | null;
  /** Bindings that hand off to motion-layer performances, with their cue layer. */
  performances: { id: string; layer: ActiveLayer }[];
}
export interface ComposeOptions {
  reducedMotion?: boolean;
  /** 0..100 */
  energy?: number;
  attitude?: 'gentle' | 'cheeky' | 'spicy';
  /** -1 when the target is to the character's left, 1 to the right. */
  side?: (target: Target) => -1 | 1;
  /** Motion performances a registered motion layer will perform itself. */
  delegated?: ReadonlySet<string>;
}
export function phaseLookup(manifest: CharacterManifest): PhaseLookup {
  return (id) => {
    const binding = manifest.expressions[id];
    return {
      anticipation: binding?.anticipation ?? defaultPhases.anticipation,
      recovery: binding?.recovery ?? defaultPhases.recovery,
    };
  };
}
export function variantFor(
  binding: CharacterManifest['expressions'][keyof CharacterManifest['expressions']],
  intensity: number,
): BindingCore | undefined {
  if (!binding) return undefined;
  if (intensity < 0.35 && binding.variants?.subtle)
    return { ...binding, ...binding.variants.subtle };
  if (intensity > 0.75 && binding.variants?.strong)
    return { ...binding, ...binding.variants.strong };
  return binding;
}
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export function strength(energy = 40, attitude: ComposeOptions['attitude'] = 'cheeky') {
  return (0.6 + energy / 250) * { gentle: 0.8, cheeky: 1, spicy: 1.15 }[attitude];
}

export function composePose(
  layers: ActiveLayer[],
  manifest: CharacterManifest,
  options: ComposeOptions = {},
): Pose {
  const reduced = options.reducedMotion ?? false;
  const level = strength(options.energy, options.attitude);
  const pose: Pose = {
    tracks: [],
    offset: { x: 0, y: 0, rotation: 0, scale: 1 },
    peek: 0,
    tuck: 0,
    caption: '',
    attention: null,
    performances: [],
  };
  let captionWeight = 0;
  for (const layer of layers) {
    const binding = variantFor(manifest.expressions[layer.expression], layer.intensity);
    if (!binding) continue;
    if (binding.motion) pose.performances.push({ id: binding.motion, layer });
    const delegated = !!binding.motion && !!options.delegated?.has(binding.motion);
    // Intensity shapes how far the pose goes; weight is the phase envelope.
    const amount = layer.weight * (0.45 + 0.55 * layer.intensity);
    // Held poses are never perfectly still: fixed frames drift slightly around their sample.
    const drift = reduced ? 0 : Math.sin((layer.elapsed * Math.PI * 2) / 2.6);
    for (const sample of delegated ? [] : binding.tracks) {
      let time = Math.min(0.999, Math.max(0, (sample.at ?? 0) + 0.035 * drift));
      if (sample.play && sample.pingpong && !reduced) {
        const span = Number.isFinite(layer.span)
          ? layer.span
          : (binding.anticipation ?? defaultPhases.anticipation) +
            expressions[layer.expression].duration;
        const rise = Math.min(1, layer.elapsed / Math.max(0.2, Math.min(span, 1.2)));
        const swing =
          layer.elapsed < 1.2
            ? rise
            : 0.5 + 0.5 * Math.cos(((layer.elapsed - 1.2) * Math.PI * 2) / sample.pingpong);
        time = sample.play.from + (sample.play.to - sample.play.from) * swing;
      } else if (sample.play) {
        // Play across anticipation + hold; open-ended beats use the expression's typical span.
        const span = Number.isFinite(layer.span)
          ? layer.span
          : (binding.anticipation ?? defaultPhases.anticipation) +
            expressions[layer.expression].duration;
        const progress = reduced ? 0.5 : clamp01(layer.elapsed / Math.max(0.2, span));
        time = sample.play.from + (sample.play.to - sample.play.from) * progress;
      }
      if (sample.loop && !reduced) time = (layer.elapsed % sample.loop) / sample.loop;
      else if (sample.loop) time = 0.5;
      pose.tracks.push({
        track: sample.track,
        time,
        mix: clamp01(sample.mix * amount * Math.min(1, level) * (reduced ? 0.8 : 1)),
      });
    }
    if (binding.presence?.peek)
      pose.peek = Math.max(pose.peek, binding.presence.peek * layer.weight);
    if (binding.presence?.tuck)
      pose.tuck = Math.max(pose.tuck, binding.presence.tuck * layer.weight);
    if (layer.caption && layer.phase !== 'recovery' && layer.weight > captionWeight) {
      pose.caption = layer.caption;
      captionWeight = layer.weight;
    }
    if (layer.channel === 'attention' && layer.target !== 'neutral') {
      if (!pose.attention || layer.weight > pose.attention.weight)
        pose.attention = { target: layer.target, weight: layer.weight };
    }
    if (reduced || delegated) continue;
    const motion = amount * level;
    // Subtle life on every held pose (on top of idle breathing and blinks).
    pose.offset.rotation += 0.35 * drift * motion;
    pose.offset.y += 0.6 * Math.sin((layer.elapsed * Math.PI * 2) / 1.9) * motion;
    const side = layer.target !== 'neutral' && options.side ? options.side(layer.target) : 1;
    if (binding.transform) {
      pose.offset.x += (binding.transform.x ?? 0) * motion * side;
      pose.offset.y += (binding.transform.y ?? 0) * motion;
      pose.offset.rotation += (binding.transform.rotation ?? 0) * motion * side;
      pose.offset.scale += ((binding.transform.scale ?? 1) - 1) * motion;
    }
    if (layer.channel === 'attention' && layer.target !== 'neutral') {
      const lean = manifest.attention[layer.target];
      if (lean) {
        pose.offset.x += (lean.x ?? 0) * motion * side;
        pose.offset.rotation += (lean.rotation ?? 0) * motion * side;
      }
    }
    if (binding.oscillate) {
      const wave =
        Math.sin(layer.elapsed * Math.PI * 2 * binding.oscillate.hz) *
        binding.oscillate.amplitude *
        motion;
      if (binding.oscillate.property === 'scale') pose.offset.scale += wave / 100;
      else pose.offset[binding.oscillate.property] += wave;
    }
  }
  return pose;
}
