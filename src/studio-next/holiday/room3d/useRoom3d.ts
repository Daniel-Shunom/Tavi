import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useReducedMotion } from 'motion/react';
import type { RoomMood } from '../rooms';
import type { HolidayId } from '../calendar';
import type { RoomEngine } from './engine';
import { layouts } from './layouts';

// Runs the 3D room on two canvases the stage places behind and in front of her. The engine (and
// three.js with it) loads only when the room is on. If the browser cannot draw it, `failed` turns
// true and the stage falls back to the picture room.

export function useRoom3d(holiday: HolidayId | null, mood: RoomMood, lively: boolean) {
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const engine = useRef<RoomEngine | null>(null);
  const [failed, setFailed] = useState(false);
  const layout = holiday ? layouts[holiday] : undefined;
  const reducedMotion = useReducedMotion() ?? false;
  const latest = useRef({ mood, lively });
  latest.current = { mood, lively };

  useEffect(() => {
    const backCanvas = back.current;
    const frontCanvas = front.current;
    if (!layout || !backCanvas || !frontCanvas) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void import('./engine')
      .then(({ createRoom }) => {
        if (disposed) return;
        const style = getComputedStyle(backCanvas);
        const colour = (name: string, fallback: string) =>
          style.getPropertyValue(name).trim() || fallback;
        const room = createRoom({
          back: backCanvas,
          front: frontCanvas,
          reducedMotion,
          layout,
          base: `${import.meta.env.BASE_URL}rooms/`,
          colours: {
            wall: colour('--raised', '#2a2037'),
            panel: colour('--panel', '#1e1728'),
            floor: colour('--bg', '#15101c'),
            accent: colour('--accent', '#ff8a1f'),
            second: colour('--second', '#a3e36a'),
            text: colour('--text', '#f6efe6'),
            line: colour('--line', '#3d3050'),
          },
        });
        engine.current = room;
        room.setMood(latest.current.mood);
        room.setLively(latest.current.lively);
        observer = new ResizeObserver(([entry]) => {
          if (entry) room.resize(entry.contentRect.width, entry.contentRect.height);
        });
        observer.observe(backCanvas);
      })
      .catch((error: unknown) => {
        console.warn('Holiday room: 3D is unavailable, using pictures.', error);
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      engine.current?.dispose();
      engine.current = null;
    };
  }, [layout, reducedMotion]);

  useEffect(() => {
    engine.current?.setMood(mood);
  }, [mood]);
  useEffect(() => {
    engine.current?.setLively(lively);
  }, [lively]);

  const at = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return [
      (event.clientX - box.left) / box.width,
      (event.clientY - box.top) / box.height,
    ] as const;
  };
  return {
    back,
    front,
    /** True when the room is being drawn in 3D. */
    on: layout !== undefined && !failed,
    /** Returns true when the pointer is over something in the room. */
    hover: (event: PointerEvent<HTMLElement>) => engine.current?.hover(...at(event)) ?? false,
    /** Returns true when the press landed on something in the room. */
    press: (event: PointerEvent<HTMLElement>) => engine.current?.press(...at(event)) ?? false,
  };
}
