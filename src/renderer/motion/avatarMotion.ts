// Bridge between the app's shared State and the motion layer, used by Avatar.tsx's marked hook.
// It owns the MotionRig (patched lyla .riv) and a MotionLayer, translates State changes into
// motion commands (expressions, moveTo instead of gliding, entrance/exit on retract), and
// renders. When the expression agent's per-frame motion hook lands, this file is the place to
// swap the State diffing for their ExpressionScript cues (docs/motion/INTEGRATION.md).
import { RuntimeLoader } from '@rive-app/webgl2';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import avatarURL from '../assets/mascot.riv?url';
import type { Gesture, State } from '../../../shared/protocol';
import { MotionLayer } from './motion';
import { createMotionRig } from './rive/motionRig';
import { lylaPatch, lylaRig } from './rigs/lyla';
import { bindLyla } from './rigs/lylaBinding';
import type { MotionSettings, Stage } from './types';

RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);

/** Shared seed: studio and overlay make the same idle choices. */
const SEED = 20261025;

const gestureExpression: Partial<Record<Gesture, string>> = {
  wave: 'wave',
  smile: 'happy',
  surprise: 'surprise',
  point: 'think',
  peek: 'caught',
  listening: 'listening',
  skeptical: 'skeptical',
  caught: 'caught',
  nod: 'approve',
  celebrate: 'celebrate',
};

function settingsFrom(state: State, reducedMotion: boolean): MotionSettings {
  return {
    personality: state.config.personality,
    attitude: state.config.attitude,
    energy: state.config.energy,
    reducedMotion,
    quiet: state.quiet,
  };
}

export async function createAvatarMotion(
  canvas: HTMLCanvasElement,
  initial: State,
  presentation: 'overlay' | 'portrait',
  clockAtStart: number,
) {
  const [runtime, bytes] = await Promise.all([
    RuntimeLoader.awaitInstance(),
    fetch(avatarURL).then(async (response) => {
      if (!response.ok) throw new Error('Could not load character artwork.');
      return new Uint8Array(await response.arrayBuffer());
    }),
  ]);
  const rig = await createMotionRig(runtime, canvas, bytes, lylaPatch, lylaRig);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const stage: Stage = { aspect: 16 / 9, bodyHeight: 0.3, margin: 0.02 };
  const caps = { feet: true };
  const layer = new MotionLayer(SEED, settingsFrom(initial, reduced.matches), stage, caps);
  const portrait = presentation === 'portrait';
  layer.place(portrait ? 0.5 : initial.config.x, portrait ? 0.96 : initial.config.y);
  // Reconnect/mount while tucked: start already hidden (a late exit jumps to its end state).
  if (initial.retracted) layer.exit({ at: clockAtStart - 60, cue: 'mount', id: 'duck' });
  let last = initial;
  let width = 1,
    height = 1;

  function observe(state: State, clock: number) {
    layer.setSettings(settingsFrom(state, reduced.matches));
    if (state.retracted !== last.retracted) {
      const cue = String(state.action.id) + ':' + String(clock);
      if (state.retracted) layer.exit({ at: clock, cue });
      else
        layer.enter({
          at: clock,
          cue,
          anchor: portrait ? { x: 0.5, y: 0.96 } : { x: state.config.x, y: state.config.y },
        });
    }
    if (!portrait && (state.config.x !== last.config.x || state.config.y !== last.config.y))
      layer.moveTo({ x: state.config.x, y: state.config.y, at: clock });
    if (
      state.action.id !== last.action.id &&
      !state.retracted &&
      (!state.quiet || state.action.source === 'manual')
    ) {
      const gesture = state.action.gesture;
      if (gesture === 'idle') layer.expressions.clear(clock);
      else if (gesture === 'scene') {
        layer.express('listening', { at: clock + 0.6, hold: 2.6 });
        layer.express('skeptical', { at: clock + 3.6 });
      } else {
        const id = gestureExpression[gesture];
        if (id) layer.express(id, { at: clock });
      }
    }
    if (state.quiet && !last.quiet) layer.expressions.clear(clock);
    last = state;
  }

  return {
    runtime,
    resize(w: number, h: number) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      rig.resize(width, height);
    },
    frame(dt: number, clock: number, state: State) {
      observe(state, clock);
      const scale = Math.min(width / 1280, height / 720);
      const size = portrait ? Math.min(height * 0.9, width / 0.7) : 220 * scale;
      // The 600x600 artboard was previously contained in 0.8*size; keep the same visual size.
      const artboardHeight = size * 0.8;
      layer.setStage({ aspect: width / height, bodyHeight: artboardHeight / height, margin: 0.02 });
      const motion = layer.update(clock);
      const palette = [
        'hair ' + state.config.riveHair,
        'clothing ' + state.config.riveOutfit,
        'glasses ' + state.config.riveGlasses,
      ];
      const p = motion.placement;
      rig.frame(dt, bindLyla(motion, palette), {
        x: p.x * width,
        y: p.y * height,
        height: artboardHeight,
        rotation: p.lean,
        facing: p.facing,
        scaleX: p.scaleX,
        scaleY: p.scaleY,
      });
      canvas.style.opacity = String(p.opacity);
      canvas.style.clipPath =
        p.clipBelow === null ? '' : `inset(0 0 ${String((1 - p.clipBelow) * 100)}% 0)`;
      return motion;
    },
    dispose() {
      rig.dispose();
    },
  };
}

export type AvatarMotion = Awaited<ReturnType<typeof createAvatarMotion>>;
