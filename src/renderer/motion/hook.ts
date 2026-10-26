// Registers the motion layer with the expression system's official per-frame hook
// (src/renderer/motionHook.ts). The expression system decides WHAT/WHEN (layers, attention,
// movement and presence cues); this adapter turns those into MotionLayer commands and returns
// control-track samples, additive node transforms, a position and, for choreographies it
// performs, the presence amount.
import type { CharacterManifest } from '../characters/manifest';
import {
  registerMotionLayer,
  type MotionInput,
  type MotionLayer as HookMotionLayer,
  type MotionOutput,
} from '../motionHook';
import { FaceLayer } from '../face/faceLayer';
import { poseChannels } from '../face/pose';
import { MotionLayer } from './motion';
import type { MoveReason } from './systems/gaits/select';
import type { RigPatch } from './rive/patch';
import type { MotionFrame } from './types';
// Body states (sit, nap, peek...): src/renderer/motion/states/.
import { applyStateKey } from './states/apply';
import { BodyStatePlayer, type PlayerFrame, type PlayerResult } from './states/player';
import type { StateRig } from './states/types';

export interface CharacterMotionRig {
  /** In-memory patch the renderer applies at load (runtime names + control tracks). */
  patch: RigPatch;
  /** Abstract frame -> manifest handles (ctl.* tracks and node handles). */
  bind(frame: MotionFrame): Required<Pick<MotionOutput, 'tracks' | 'nodes'>>;
  /** Body-state key poses and contact geometry (optional; without it states are ignored). */
  states?: StateRig;
}

/** Hook performance ids this layer performs, mapped to motion-layer expressions. */
export const performances: Readonly<Record<string, string>> = {
  nod: 'approve',
  skeptical: 'skeptical',
  caught: 'caught',
};

/** Presence style ids (shared/presence.ts) -> motion choreographies. */
const entranceFor: Readonly<Record<string, string>> = {
  slide: 'slideUp',
  drop: 'drop',
  walk: 'tiredWalk',
  climb: 'climb',
};
const exitFor: Readonly<Record<string, string>> = {
  slide: 'duck',
  drop: 'jumpOut',
  walk: 'walkOff',
  climb: 'hopOff',
};

/**
 * Gait, mood and the reason for moving from the movement cue (shared/locomotion.ts). Explicit
 * `gait`/`mood` win; otherwise the motion layer's selection rules use the reason.
 */
function gaitCue(input: MotionInput) {
  const movement = input.locomotion.movement;
  if (!movement) return {};
  const reason: MoveReason =
    movement.kind === 'return'
      ? 'home'
      : movement.kind === 'wander'
        ? 'wander'
        : movement.anchor === 'chat' || movement.source === 'chat'
          ? 'chat'
          : movement.source === 'config'
            ? 'dragged'
            : 'cue';
  return {
    reason,
    cue: movement.id,
    ...(movement.gait ? { gait: movement.gait } : {}),
    ...(movement.mood ? { mood: movement.mood } : {}),
  };
}

/** Shared seed: studio and overlay make the same idle choices. */
const SEED = 20261025;

export function createHookLayer(
  manifest: CharacterManifest,
  rig: CharacterMotionRig,
): HookMotionLayer {
  let layer: MotionLayer | null = null;
  let active = new Set<string>();
  let lastTarget: { x: number; y: number } | null = null;
  let presenceId: string | null = null;
  let handlingPresence = false;
  const feet = Object.keys(manifest.nodes).some((handle) => handle.startsWith('foot-'));
  // Facial poses from the manifest: the face layer drives brows, lids, mouth and gaze for every
  // expression that has a face pose, including the face of performances (nod/skeptical/Oops).
  const faceLayer = manifest.face
    ? new FaceLayer(manifest.face, { seed: SEED, ownBlinks: false })
    : null;
  const restBlinkRate = manifest.face?.blink.rate ?? 17;
  let lastTime: number | null = null;
  const bodyStates = rig.states ? new BodyStatePlayer(rig.states, SEED) : null;
  let facing = 1;

  return {
    // Motion-library performances plus every expression the manifest acts out with a face pose
    // (bindings name them via `motion: <id>`); the face layer performs the latter.
    performances: [...Object.keys(performances), ...Object.keys(manifest.face?.poses ?? {})],
    update(input: MotionInput): MotionOutput {
      const { width, height } = input.locomotion.viewport;
      const scale = Math.min(width / 1280, height / 720);
      const settings = {
        personality: input.persona.personality,
        attitude: input.persona.attitude,
        energy: input.persona.energy,
        reducedMotion: input.reducedMotion,
        quiet: input.quiet,
      };
      const stage = {
        aspect: width / Math.max(1, height),
        bodyHeight: (220 * scale * manifest.aspect) / Math.max(1, height),
        margin: 0.02,
      };
      const now = input.time;
      if (!layer) {
        layer = new MotionLayer(SEED, settings, stage, { feet });
        const start = input.locomotion.position;
        layer.place(start.x, start.y);
        if (input.retracted && !input.presence.transition)
          layer.exit({ at: now - 60, cue: 'mount', id: 'duck' });
      }
      layer.setSettings(settings);
      layer.setStage(stage);

      // Performances handed to us by the manifest (nod / skeptical / caught).
      const current = new Set<string>();
      for (const { id, layer: cue } of input.performances) {
        const expression = performances[id];
        if (!expression) continue;
        current.add(id);
        if (!active.has(id))
          layer.express(expression, { at: now - cue.elapsed, intensity: cue.intensity });
      }
      for (const id of active) {
        const expression = performances[id];
        if (!current.has(id) && expression) layer.release(expression, now);
      }
      active = current;

      // Attention: look toward the target's side.
      layer.attend(
        input.attention
          ? { x: 0.55 * input.attention.side * input.attention.weight, y: 0.05 }
          : null,
      );

      // Body state: sync the cue; a settled cue on mount/reconnect places us at its spot.
      const motion = layer;
      const playerFrame = (): PlayerFrame => ({
        now,
        stage,
        reducedMotion: input.reducedMotion,
        position: motion.locomotion.position,
        travelling: motion.locomotion.busy,
        facing,
        target: input.locomotion.target,
        breathPeriod: motion.currentProfile.breathPeriod,
        personality: input.persona.personality,
      });
      if (bodyStates) {
        const { place } = bodyStates.sync(
          input.body?.cue ?? null,
          input.body?.elapsed ?? 0,
          playerFrame(),
        );
        if (place) {
          layer.place(place.x, place.y);
          lastTarget = { ...input.locomotion.target };
        }
      }

      // Locomotion: walk/hop to the cue target instead of gliding (after leaving a body state).
      const target = input.locomotion.target;
      if (!lastTarget || Math.hypot(target.x - lastTarget.x, target.y - lastTarget.y) > 1e-3) {
        if (lastTarget && !bodyStates?.holdsTravel(now)) {
          const face = bodyStates?.facingOnArrival();
          layer.moveTo({
            x: target.x,
            y: target.y,
            at: now,
            ...gaitCue(input),
            ...(face ? { faceOnArrival: face } : {}),
          });
          lastTarget = { ...target };
        } else if (!lastTarget) lastTarget = { ...target };
      }

      // Presence: perform drop entrances and exits ourselves; others use the renderer fallback.
      const transition = input.presence.transition;
      if (transition && transition.id !== presenceId) {
        presenceId = transition.id;
        const at = now - Math.max(0, input.presence.elapsed);
        const style = transition.choreography;
        if (transition.kind === 'enter')
          layer.enter({
            at,
            cue: transition.id,
            anchor: input.locomotion.home,
            id: entranceFor[style] ?? 'drop',
          });
        else layer.exit({ at, cue: transition.id, id: exitFor[style] ?? 'duck' });
        handlingPresence = true;
      }

      let face: Parameters<MotionLayer['update']>[1];
      if (faceLayer) {
        const dt = lastTime === null ? 0 : Math.max(0, now - lastTime);
        const performed = new Map(
          input.performances.map(({ id, layer: cue }) => [cue.expression, id]),
        );
        const owned = new Map<string, ReadonlySet<string>>();
        const result = faceLayer.update({
          dt,
          time: now,
          reducedMotion: input.reducedMotion,
          amplitude: layer.currentProfile.amplitude,
          tempo: layer.currentProfile.tempo,
          cues: [
            // Travel mood (gait library): face features only, the gait owns the body.
            ...layer.moodCues().map((mood) => ({
              expression: mood.expression,
              intensity: 1,
              weight: mood.weight,
              elapsed: mood.elapsed,
              featuresOnly: true,
              side: input.attention?.side ?? 1,
            })),
            ...input.layers.map((cue) => {
              const performance = performed.get(cue.expression);
              const motionId = performance ? performances[performance] : undefined;
              const pose = manifest.face?.poses[cue.expression];
              if (motionId && pose) owned.set(motionId, poseChannels(pose));
              return {
                expression: cue.expression,
                intensity: cue.intensity,
                weight: cue.weight,
                elapsed: cue.elapsed,
                featuresOnly: Boolean(motionId),
                side: input.attention?.side ?? 1,
              };
            }),
          ],
        });
        face = {
          values: result.values,
          owned,
          blinkScale: result.blink.rate / restBlinkRate,
          clips: result.clips,
        };
      }
      lastTime = now;
      const frame = layer.update(now, face);
      facing = frame.placement.facing < 0 ? -1 : 1;
      const state: PlayerResult | null = bodyStates ? bodyStates.evaluate(playerFrame()) : null;
      if (state) applyStateKey(frame.pose, state.key);
      const bound = rig.bind(frame);
      const p = frame.placement;
      const output: MotionOutput = {
        tracks: bound.tracks,
        nodes: bound.nodes,
        position: { x: p.x, y: p.y },
        facing: p.facing < 0 ? -1 : 1,
        shadow: frame.shadow,
      };
      if (state) {
        const { key } = state;
        // Root lift (ledges, jumps) moves the placement; rotation and pose-local offsets pivot
        // about the soles (reference pixels: 1 BH = 220 x aspect).
        const unit = 220 * manifest.aspect;
        output.position = { x: p.x, y: p.y - key.lift * stage.bodyHeight };
        if (key.rot || key.dx || key.dy)
          output.offset = {
            x: key.dx * facing * unit,
            y: key.dy * unit,
            rotation: key.rot * facing,
          };
        const shadow = frame.shadow;
        if (state.floorShadow) output.shadow = { ...shadow, opacity: 0 };
        else if (state.surfaceY !== null || key.lift > 1e-4)
          output.shadow = {
            x: p.x,
            y: state.surfaceY ?? shadow.y,
            scale: shadow.scale / (1 + 1.6 * state.height),
            opacity: shadow.opacity / (1 + 2.5 * state.height),
          };
        output.states = {
          state: bodyStates?.state ?? 'stand',
          status: state.status,
          effects: state.effects,
          floorShadow: state.floorShadow,
          ledge: state.ledge,
        };
      }
      // The renderer masks everything below the ground line while climbing or sinking.
      output.clipBelow = p.clipBelow;
      if (handlingPresence) {
        // Fully gone once the body is entirely below the edge.
        const below =
          p.clipBelow === null
            ? 0
            : Math.max(0, p.y - p.clipBelow) / Math.max(1e-3, stage.bodyHeight);
        output.presence = { hidden: Math.min(1, Math.max(1 - p.opacity, below >= 1 ? 1 : 0)) };
      }
      return output;
    },
  };
}

let installed = false;
/** Installs the motion layer for characters that ship a motion rig. Idempotent. */
export function installMotionLayer(rigs: Readonly<Record<string, CharacterMotionRig | undefined>>) {
  if (installed) return;
  installed = true;
  registerMotionLayer((manifest) => {
    const rig = rigs[manifest.id];
    if (!rig) return { update: () => ({}) };
    return createHookLayer(manifest, rig);
  });
}
