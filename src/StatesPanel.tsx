// Studio controls for body states: a dock to pick a state (Stand, Sit, Nap, Peek at chat,
// Perch, Lean) and the scene editor where the streamer drags and resizes the webcam, game/VOD
// and chat rectangles that Tavi sits on, leans against and peeks at.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  Armchair,
  Bird,
  MessageSquareText,
  Moon,
  PersonStanding,
  Sparkles,
  Columns2,
} from 'lucide-react';
import type { Command, Config, State } from '../shared/protocol';
import { ObsWebcamPanel } from './ObsWebcamPanel';
import {
  bodyStates,
  atSpotApproach,
  clampRect,
  resolveSpot,
  sameSpot,
  sceneRectIds,
  sceneRects,
  type BodyStateId,
  type Scene,
  type SceneRect,
  type SceneRectId,
} from '../shared/states';

const dock = [
  { state: 'stand', label: 'stand', icon: <PersonStanding /> },
  { state: 'sit', label: 'sit', icon: <Armchair /> },
  { state: 'nap', label: 'nap', icon: <Moon /> },
  { state: 'peek', label: 'chat', icon: <MessageSquareText /> },
  { state: 'perch', label: 'perch', icon: <Bird /> },
  { state: 'lean', label: 'lean', icon: <Columns2 /> },
] as const;

export function BodyStateDock({
  state,
  send,
  connected,
  position,
}: {
  state: State;
  send: (command: Command) => void;
  connected: boolean;
  position: { x: number; y: number };
}) {
  const current = state.performance.body?.state ?? 'stand';
  const scene = { scene: state.config.scene, home: { x: state.config.x, y: state.config.y } };
  return (
    <div className="state-dock" role="group" aria-label="Body state">
      {dock.map((entry) => {
        const possible = entry.state === 'stand' || resolveSpot(entry.state, scene) !== null;
        const destination = resolveSpot(entry.state, scene);
        const definition = bodyStates[entry.state];
        const pressed = current === entry.state || (entry.state === 'sit' && current === 'doze');
        const alreadyThere =
          !!destination &&
          (sameSpot(state.performance.body?.spot, destination) ||
            (entry.state === 'peek' && atSpotApproach(position, destination)));
        return (
          <button
            key={entry.state}
            aria-pressed={pressed}
            disabled={
              !connected ||
              state.retracted ||
              (!possible && entry.state !== 'perch') ||
              pressed ||
              alreadyThere
            }
            title={
              possible
                ? `${definition.label}: ${definition.meaning}`
                : entry.state === 'perch'
                  ? 'No webcam perch is available. Tavi will prepare, then stop.'
                  : `${definition.label}: no place for this in the scene layout.`
            }
            onClick={() => {
              send({ type: 'state', state: entry.state });
            }}
          >
            {entry.icon}
            <span>{entry.label}</span>
          </button>
        );
      })}
    </div>
  );
}

type Drag = {
  id: SceneRectId;
  mode: 'move' | 'resize';
  x: number;
  y: number;
  start: SceneRect;
  moved: boolean;
};

const frameDestination = {
  webcam: 'perch',
  game: 'sit',
  chat: 'peek',
} as const satisfies Record<SceneRectId, BodyStateId>;

export function SceneEditor({
  config,
  send,
  connected,
  body,
  position,
}: {
  config: Config;
  send: (command: Command) => void;
  connected: boolean;
  body: State['performance']['body'];
  position: { x: number; y: number };
}) {
  const [draft, setDraft] = useState<Scene>(config.scene);
  const [followingObs, setFollowingObs] = useState(false);
  const drag = useRef<Drag | null>(null);
  const suppressFrameClick = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  // Follow saved changes (other studio tabs, migrations) unless the streamer is dragging.
  useEffect(() => {
    if (!drag.current) setDraft(config.scene);
  }, [config.scene]);
  const commit = (scene: Scene) => {
    const unchanged =
      scene.webcamSource === config.scene.webcamSource &&
      scene.floor === config.scene.floor &&
      sceneRectIds.every((id) => {
        const before = config.scene[id];
        const after = scene[id];
        return (
          before.x === after.x &&
          before.y === after.y &&
          before.w === after.w &&
          before.h === after.h &&
          before.enabled === after.enabled
        );
      });
    if (unchanged) return;
    setDraft(scene);
    send({ type: 'configure', patch: { scene } });
  };
  const update = (id: SceneRectId, rect: SceneRect, save: boolean) => {
    const next = {
      ...draft,
      [id]: clampRect(rect),
      ...(id === 'webcam' ? { webcamSource: 'manual' as const } : {}),
    };
    if (save) commit(next);
    else setDraft(next);
  };
  function down(event: PointerEvent<HTMLElement>, id: SceneRectId, mode: Drag['mode']) {
    if (!connected || (id === 'webcam' && followingObs)) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id, mode, x: event.clientX, y: event.clientY, start: draft[id], moved: false };
  }
  function move(event: PointerEvent<HTMLElement>) {
    const active = drag.current;
    const area = box.current?.getBoundingClientRect();
    if (!active || !area) return;
    if (Math.hypot(event.clientX - active.x, event.clientY - active.y) <= 4) return;
    active.moved = true;
    const dx = (event.clientX - active.x) / area.width,
      dy = (event.clientY - active.y) / area.height;
    const start = active.start;
    update(
      active.id,
      active.mode === 'move'
        ? { ...start, x: start.x + dx, y: start.y + dy }
        : { ...start, w: start.w + dx, h: start.h + dy },
      false,
    );
  }
  function up() {
    if (!drag.current) return;
    suppressFrameClick.current = drag.current.moved;
    const moved = drag.current.moved;
    drag.current = null;
    if (moved) commit(draft);
  }
  function visitFrame(id: SceneRectId) {
    if (suppressFrameClick.current) {
      suppressFrameClick.current = false;
      return;
    }
    const target = frameDestination[id];
    const spot = resolveSpot(target, { scene: draft, home: { x: config.x, y: config.y } });
    if (!spot && target === 'perch') {
      send({ type: 'state', state: 'perch' });
      return;
    }
    if (
      !spot ||
      (body !== null && sameSpot(body.spot, spot)) ||
      (target === 'peek' && atSpotApproach(position, spot))
    )
      return;
    send({ type: 'state', state: target });
  }
  function key(event: KeyboardEvent<HTMLElement>, id: SceneRectId) {
    if (id === 'webcam' && followingObs) return;
    const step = 0.01;
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const rect = draft[id];
    update(
      id,
      event.shiftKey
        ? { ...rect, w: rect.w + delta[0], h: rect.h + delta[1] }
        : { ...rect, x: rect.x + delta[0], y: rect.y + delta[1] },
      true,
    );
  }
  const floor = draft.floor ?? config.y;
  const spot = body?.spot;
  return (
    <div className="scene-editor">
      <ObsWebcamPanel
        config={config}
        serviceConnected={connected}
        onFollowingChange={setFollowingObs}
      />
      <div
        className="scene-canvas"
        ref={box}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label="Scene layout: drag frames to match your stream, drag the corner to resize"
      >
        <span className="scene-label">OBS canvas</span>
        <div className="scene-floor" style={{ top: `${String(floor * 100)}%` }} />
        {sceneRectIds.map((id) => {
          const rect = draft[id];
          if (!rect.enabled) return null;
          return (
            <div
              key={id}
              className={`scene-rect scene-${id}`}
              role="button"
              tabIndex={connected ? 0 : -1}
              aria-label={`${sceneRects[id].label} frame. Click to visit; drag to move it, or use arrow keys to reposition. Shift with arrows resizes it.`}
              title={`Click to visit. ${sceneRects[id].meaning}`}
              style={{
                left: `${String(rect.x * 100)}%`,
                top: `${String(rect.y * 100)}%`,
                width: `${String(rect.w * 100)}%`,
                height: `${String(rect.h * 100)}%`,
              }}
              onPointerDown={(event) => {
                down(event, id, 'move');
              }}
              onKeyDown={(event) => {
                key(event, id);
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  visitFrame(id);
                }
              }}
              onClick={() => {
                visitFrame(id);
              }}
            >
              <span>{sceneRects[id].label}</span>
              <i
                className="scene-handle"
                aria-hidden="true"
                onPointerDown={(event) => {
                  down(event, id, 'resize');
                }}
              />
            </div>
          );
        })}
        <span
          className="mini-avatar"
          style={{
            left: `${String((spot?.x ?? config.x) * 100)}%`,
            top: `${String((spot?.surface === 'ledge' || spot?.surface === 'top' ? spot.y : config.y) * 100)}%`,
          }}
        >
          <Sparkles size={18} />
        </span>
      </div>
      <div className="scene-fields">
        {sceneRectIds.map((id) => {
          const rect = draft[id];
          return (
            <fieldset key={id} className="scene-field">
              <legend>
                <label>
                  <input
                    type="checkbox"
                    checked={rect.enabled}
                    disabled={!connected || (id === 'webcam' && followingObs)}
                    onChange={(event) => {
                      update(id, { ...rect, enabled: event.target.checked }, true);
                    }}
                  />
                  {sceneRects[id].label}
                </label>
              </legend>
              {(['x', 'y', 'w', 'h'] as const).map((field) => (
                <label key={field}>
                  {field}
                  <input
                    type="number"
                    min={field === 'w' || field === 'h' ? 2 : 0}
                    max={100}
                    step={1}
                    value={Math.round(rect[field] * 100)}
                    disabled={!connected || !rect.enabled || (id === 'webcam' && followingObs)}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value))
                        update(id, { ...rect, [field]: value / 100 }, true);
                    }}
                  />
                </label>
              ))}
            </fieldset>
          );
        })}
        <label className="field scene-floor-field">
          <span>
            <input
              type="checkbox"
              checked={draft.floor === null}
              disabled={!connected}
              onChange={(event) => {
                commit({ ...draft, floor: event.target.checked ? null : config.y });
              }}
            />{' '}
            Floor follows Tavi&apos;s position
          </span>
          {draft.floor !== null ? (
            <input
              aria-label="Floor line"
              type="range"
              min="35"
              max="95"
              value={Math.round(draft.floor * 100)}
              disabled={!connected}
              onChange={(event) => {
                commit({ ...draft, floor: Number(event.target.value) / 100 });
              }}
            />
          ) : null}
        </label>
      </div>
    </div>
  );
}
