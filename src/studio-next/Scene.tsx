import { useRef, useState, type PointerEvent, type RefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Move } from 'lucide-react';
import { Avatar } from '../renderer/Avatar';
import type { Config } from '../../shared/protocol';
import type { StudioProps } from '../studio/types';
import type { HolidayId } from './holiday/calendar';
import { RoomBack, RoomFront } from './holiday/HolidayRoom';
import { useRoom3d } from './holiday/room3d/useRoom3d';
import { roomMood, type Room } from './holiday/rooms';
import type { Mode } from './model';

// The stage: the overlay itself over outlines of the streamer's layout, always in view. Clicking
// or dragging sets her home spot. In Look mode the stream view steps back and a close-up of her
// fades in over it; the stream view keeps running underneath, so coming back is instant.

const frameLabels = { game: 'Game', webcam: 'Webcam', chat: 'Chat' };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
// Motion tokens (seconds), matching --sn-t-move and --sn-t-exit in studio-next.css.
const ENTER = { duration: 0.34, ease: [0.32, 0.72, 0, 1] } as const;
const EXIT = { duration: 0.2, ease: [0.55, 0, 1, 0.45] } as const;

export function Scene({
  state,
  connected,
  send,
  serverNow,
  statusLine,
  mode,
  livePosition,
  room,
  room3d = null,
  reacting,
}: StudioProps & {
  mode: Mode;
  /** Her holiday room, when a holiday theme is on and the room is switched on. */
  room?: Room;
  /** The holiday whose room is drawn in 3D instead of with pictures, when it has one. */
  room3d?: HolidayId | null;
  /** True while a reaction plays, so the room can join in. */
  reacting: boolean;
  /** Where her feet are right now, kept for "stand here". */
  livePosition: RefObject<{ x: number; y: number } | null>;
}) {
  const c = state.config;
  const reduced = useReducedMotion();
  const ring = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [drop, setDrop] = useState<{ x: number; y: number } | null>(null);
  const closeUp = mode === 'look';
  const mood = roomMood({ connected, retracted: state.retracted, quiet: state.quiet });
  const space = useRoom3d(room ? room3d : null, mood, reacting);
  const [overProp, setOverProp] = useState(false);
  const canMove = connected && !state.retracted && !closeUp;
  const patch = (value: Partial<Config>) => {
    send({ type: 'configure', patch: value });
  };
  // Where on the stream a pointer is, in the overlay's terms (feet position, kept in bounds).
  const spot = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - box.left) / box.width, 0.08, 0.92),
      y: clamp((event.clientY - box.top) / box.height, 0.35, 0.95),
    };
  };

  return (
    <section className="sn-scene-wrap" aria-label="Stream preview">
      <div
        className="sn-scene"
        data-close-up={closeUp || undefined}
        data-dragging={drop ? 'true' : undefined}
        data-movable={canMove || undefined}
        data-room={room ? mood : undefined}
        data-room3d={space.on || undefined}
        data-over-prop={overProp || undefined}
        data-reacting={(room && reacting) || undefined}
        onPointerDown={(event) => {
          // A press on something in the 3D room belongs to the room, not to placing her.
          if (event.button === 0 && space.press(event)) return;
          if (!canMove || event.button !== 0) return;
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrop(spot(event));
        }}
        onPointerMove={(event) => {
          if (space.on && !dragging.current) setOverProp(space.hover(event));
          if (dragging.current) setDrop(spot(event));
        }}
        onPointerUp={(event) => {
          if (!dragging.current) return;
          dragging.current = false;
          const to = spot(event);
          setDrop(null);
          patch({ x: to.x, y: to.y });
        }}
        onPointerCancel={() => {
          dragging.current = false;
          setDrop(null);
        }}
      >
        <div className="sn-scene-stream" inert={closeUp}>
          {space.on ? (
            <canvas ref={space.back} className="sn-room3d sn-room-back" aria-hidden="true" />
          ) : room ? (
            <RoomBack room={room} />
          ) : null}
          <div className="sn-scene-backdrop" aria-hidden="true">
            {(['game', 'webcam', 'chat'] as const).map((frame) => {
              const rect = c.scene[frame];
              return rect.enabled ? (
                <span
                  key={frame}
                  className="sn-scene-frame"
                  style={{
                    left: `${String(rect.x * 100)}%`,
                    top: `${String(rect.y * 100)}%`,
                    width: `${String(rect.w * 100)}%`,
                    height: `${String(rect.h * 100)}%`,
                  }}
                >
                  {frameLabels[frame]}
                </span>
              ) : null;
            })}
          </div>
          <Avatar
            state={state}
            serverNow={serverNow}
            captions={c.captions.overlay}
            onPosition={(point) => {
              livePosition.current = point;
              const element = ring.current;
              if (element) {
                element.style.left = `${String(point.x * 100)}%`;
                element.style.top = `${String(point.y * 100)}%`;
              }
            }}
          />
          <div className="sn-scene-ring" ref={ring} aria-hidden="true" />
          {drop ? (
            <div
              className="sn-scene-drop"
              style={{ left: `${String(drop.x * 100)}%`, top: `${String(drop.y * 100)}%` }}
              aria-hidden="true"
            />
          ) : null}
          {space.on ? (
            <canvas ref={space.front} className="sn-room3d sn-room-front" aria-hidden="true" />
          ) : room ? (
            <RoomFront room={room} />
          ) : null}
        </div>

        <AnimatePresence initial={false}>
          {closeUp ? (
            <motion.div
              key="close-up"
              className="sn-scene-portrait portrait-space"
              initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1, transition: reduced ? { duration: 0 } : ENTER }}
              exit={{ opacity: 0, transition: reduced ? { duration: 0 } : EXIT }}
            >
              <div className="sn-scene-floor" aria-hidden="true" />
              <Avatar
                state={state}
                serverNow={serverNow}
                presentation="portrait"
                captions={c.captions.studio}
              />
              <button
                type="button"
                className="sn-scene-touch"
                aria-label={`Wave to ${c.name}`}
                title="Say hello"
                disabled={!connected || state.retracted}
                onClick={() => {
                  send({ type: 'perform', sequence: 'greeting' });
                }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <span className="sn-scene-tag">
          {closeUp
            ? 'Close-up · only you see this'
            : room
              ? 'Her room · decorations show only in Studio'
              : 'What viewers see'}
        </span>
        <span className="sn-scene-now" role="status">
          <i className="sn-dot" data-state={!connected || state.retracted ? 'away' : 'here'} />
          {statusLine}
        </span>
        {canMove ? (
          <span className="sn-scene-hint">
            <Move size={14} aria-hidden="true" /> Click or drag to move her spot
          </span>
        ) : null}
        {state.retracted && connected ? (
          <button
            type="button"
            className="sn-btn sn-scene-back"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={() => {
              send({ type: 'retract', value: false });
            }}
          >
            Call her back
          </button>
        ) : null}
      </div>
    </section>
  );
}
