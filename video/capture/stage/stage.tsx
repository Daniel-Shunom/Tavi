// Trailer stage: the real overlay renderer (src/renderer/Avatar.tsx) fed a locally scripted state
// instead of the service, so video/capture/tavi.mjs can step time frame by frame and screenshot
// Tavi with a transparent background. Nothing here changes the product; it is a capture harness.
// Serve the repo with Vite and open /video/capture/stage/?presentation=overlay|portrait.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Avatar } from '../../../src/renderer/Avatar';
import { catalog } from '../../../src/renderer/characters/registry';
import { resolveBeats } from '../../../shared/capabilities';
import { beat, expandSequence, priorities, type ExpressionScript } from '../../../shared/cue';
import { isExpressionId, isSequenceId } from '../../../shared/expressions';
import type { Target } from '../../../shared/expressions';
import {
  anchors,
  clampPoint,
  type Gait,
  type Movement,
  type Point,
} from '../../../shared/locomotion';
import { pickChoreography, type ChoreographyId } from '../../../shared/presence';
import { defaults, initialState, type Config, type State } from '../../../shared/protocol';
import { resolveSpot, type BodyCue, type BodyStateId, type Scene } from '../../../shared/states';
import '../../../src/style.css';

const params = new URLSearchParams(location.search);
const presentation = params.get('presentation') === 'portrait' ? 'portrait' : 'overlay';
const decidedBy = { kind: 'manual' as const, label: 'Trailer' };
let sequence = 0;
const id = (prefix: string) => `${prefix}-${String(++sequence)}`;

type Listener = (state: State) => void;
let current: State = initialState({
  ...defaults,
  character: 'tavi-refined',
  name: 'Tavi',
  captions: { studio: false, overlay: false },
  // Autonomy lives in the service; the stage only plays what the shot list asks for.
  initiative: 'reserved',
});
const listeners = new Set<Listener>();
function set(next: State) {
  current = next;
  for (const listener of listeners) listener(current);
}
function performance(patch: Partial<State['performance']>) {
  set({
    ...current,
    performance: {
      ...current.performance,
      ...patch,
      revision: current.performance.revision + 1,
    },
  });
}
const home = (): Point => ({ x: current.config.x, y: current.config.y });

const stage = {
  state: () => current,
  config(patch: Partial<Config>) {
    set({ ...current, config: { ...current.config, ...patch } });
  },
  scene(patch: Partial<Scene>) {
    stage.config({ scene: { ...current.config.scene, ...patch } });
  },
  /** Plays one expression or a named sequence, like a Studio cue. */
  perform(options: {
    expression?: string;
    sequence?: string;
    intensity?: number;
    target?: Target;
    hold?: number;
    caption?: string;
  }) {
    const target = options.target ?? 'neutral';
    const beats =
      options.sequence && isSequenceId(options.sequence)
        ? expandSequence(options.sequence, {
            target,
            ...(options.intensity !== undefined ? { intensity: options.intensity } : {}),
            ...(options.caption ? { caption: options.caption } : {}),
          })
        : options.expression && isExpressionId(options.expression)
          ? [
              beat(options.expression, {
                target,
                ...(options.intensity !== undefined ? { intensity: options.intensity } : {}),
                ...(options.hold !== undefined ? { hold: options.hold } : {}),
                ...(options.caption ? { caption: options.caption } : {}),
              }),
            ]
          : [];
    const character = catalog['tavi-refined'];
    if (!character) throw new Error('tavi-refined is not in the catalog');
    const resolution = resolveBeats(beats, character);
    const now = Date.now();
    const script: ExpressionScript = {
      id: id('cue'),
      sourceEventId: id('trailer'),
      source: 'manual',
      decidedBy,
      priority: priorities.manual,
      startAt: now,
      expiresAt: now + 3000,
      beats: resolution.beats,
      settle: true,
      dropped: resolution.dropped.slice(0, 8),
    };
    performance({ script, phase: 'reacting', note: options.sequence ?? options.expression ?? '' });
    return resolution;
  },
  /** Walks (or runs, skips, hops) somewhere and stays. */
  move(options: {
    to?: Point;
    anchor?: keyof typeof anchors;
    kind?: Movement['kind'];
    gait?: Gait;
    stay?: number;
    speed?: number;
  }) {
    const now = Date.now();
    const to = options.to ?? (options.anchor ? anchors[options.anchor] : home());
    const movement: Movement = {
      id: id('move'),
      sourceEventId: id('trailer'),
      source: 'manual',
      decidedBy,
      priority: priorities.manual,
      kind: options.kind ?? 'move-to',
      to: clampPoint(to),
      startAt: now,
      expiresAt: now + 3000,
      ...(options.anchor ? { anchor: options.anchor } : {}),
      ...(options.gait ? { gait: options.gait } : {}),
      ...(options.stay !== undefined ? { stay: options.stay } : {}),
      ...(options.speed !== undefined ? { speed: options.speed } : {}),
    };
    performance({ movement, body: null });
  },
  /** Sit, nap, perch, peek, lean, or stand; the spot comes from the configured scene. */
  body(state: BodyStateId, options: { prefer?: 'ledge' | 'floor'; pick?: number } = {}) {
    const now = Date.now();
    const previous = current.performance.body;
    const from = previous?.state ?? 'stand';
    const spot =
      state === 'stand'
        ? null
        : resolveSpot(state, {
            scene: current.config.scene,
            home: home(),
            ...(previous ? { current: { state: previous.state, spot: previous.spot } } : {}),
            pick: options.pick ?? 0.5,
            prefer: options.prefer ?? 'ledge',
          });
    const asleep = (from === 'doze' || from === 'nap') && state !== 'doze' && state !== 'nap';
    const body: BodyCue = {
      id: id('body'),
      sourceEventId: id('trailer'),
      source: 'manual',
      decidedBy,
      priority: priorities.manual,
      state,
      spot,
      from: { state: from, spot: previous?.spot ?? null },
      startAt: now,
      seed: 4242,
      ...(asleep ? { wake: 'normal' as const } : {}),
    };
    const origin = home();
    const away =
      spot && Math.hypot(spot.approach.x - origin.x, spot.approach.y - origin.y) > 0.004
        ? spot.approach
        : null;
    const movement: Movement | null = away
      ? {
          id: id('move'),
          sourceEventId: body.sourceEventId,
          source: 'manual',
          decidedBy,
          priority: priorities.manual,
          kind: 'move-to',
          to: clampPoint(away),
          startAt: now,
          expiresAt: now + 3000,
          gait: 'walk',
        }
      : null;
    performance({ body, movement });
    return { spot, reachable: state === 'stand' || spot !== null };
  },
  /** Tuck away (exit) or bring back (enter) with a named choreography. */
  presence(kind: 'enter' | 'exit', choreography?: ChoreographyId) {
    const now = Date.now();
    const previous = current.performance.presence;
    const seed = 1234;
    const chosen =
      choreography ??
      pickChoreography(
        current.config.presenceStyle,
        seed,
        previous?.choreography,
        current.config.personality,
      );
    set({
      ...current,
      retracted: kind === 'exit',
      performance: {
        ...current.performance,
        revision: current.performance.revision + 1,
        script: null,
        movement: null,
        body: null,
        presence: {
          id: id(kind),
          kind,
          choreography: chosen,
          seed,
          startAt: now,
          from: kind === 'exit' ? 0 : 1,
        },
      },
    });
  },
  /** Starts hidden so an entrance can play from nothing. */
  hide() {
    set({
      ...current,
      retracted: true,
      performance: {
        ...current.performance,
        revision: current.performance.revision + 1,
        presence: {
          id: id('exit'),
          kind: 'exit',
          choreography: 'slide',
          seed: 1,
          startAt: Date.now() - 60_000,
          from: 0,
        },
      },
    });
  },
  cancel() {
    performance({ script: null, movement: null, phase: 'idle' });
  },
};
declare global {
  interface Window {
    stage: typeof stage;
  }
}
window.stage = stage;

function Stage() {
  const [state, setState] = useState(current);
  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  useEffect(() => {
    const check = () => {
      if (document.querySelector('.avatar-renderer canvas')) document.body.dataset['ready'] = '1';
      else if (document.querySelector('.avatar-renderer > p'))
        document.body.dataset['error'] =
          document.querySelector('.avatar-renderer > p')?.textContent ?? 'failed';
      else requestAnimationFrame(check);
    };
    check();
  }, []);
  return (
    <main className="overlay-surface portrait-space">
      <Avatar
        state={state}
        serverNow={Date.now}
        presentation={presentation}
        captions={false}
        frame={{ height: 0.86, bottom: 0.95, fitWidth: true }}
      />
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('missing root');
createRoot(root).render(
  <StrictMode>
    <Stage />
  </StrictMode>,
);
