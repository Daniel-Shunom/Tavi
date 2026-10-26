import { useEffect, useRef, useState } from 'react';
import type { State, Gesture } from '../../shared/protocol';
import { Director, performancePose, smooth, type PerformanceAction } from './performance';
import type { RiveRig } from './riveRig';
// MOTION LAYER HOOK (motion agent): procedural idle life, walking and entrances/exits.
// Set to false to restore the previous clip-scrub renderer. See docs/motion/INTEGRATION.md.
import type { AvatarMotion } from './motion/avatarMotion';
const MOTION_LAYER: boolean = true;
const actions: Partial<Record<Gesture, PerformanceAction>> = {
  wave: 'wave',
  smile: 'nod',
  surprise: 'celebrate',
  point: 'listening',
  peek: 'caught',
  listening: 'listening',
  skeptical: 'skeptical',
  caught: 'caught',
  nod: 'nod',
  celebrate: 'celebrate',
};
export function Avatar({
  state,
  presentation = 'overlay',
}: {
  state: State;
  presentation?: 'overlay' | 'portrait';
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(state);
  latest.current = state;
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false,
      motion: AvatarMotion | undefined, // MOTION LAYER HOOK
      rig: RiveRig | undefined,
      frame: number | null = null;
    let clock = 0,
      last: number | null = null,
      width = 1,
      height = 1;
    let lastAction = latest.current.action.id;
    let retracted = latest.current.retracted,
      quiet = latest.current.quiet;
    let restoreAt = 0,
      restoreFrom = retracted ? 1 : 0,
      hiddenAmount = retracted ? 1 : 0;
    let peek = false,
      x = latest.current.config.x,
      y = latest.current.config.y;
    const director = new Director();
    if (retracted) director.play('tuck', -2);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    function resize() {
      const element = host.current;
      if (!element || (!rig && !motion)) return;
      width = element.clientWidth;
      height = element.clientHeight;
      rig?.resize(width, height);
      motion?.resize(width, height); // MOTION LAYER HOOK
    }
    const observer = new ResizeObserver(resize);
    function stop() {
      const runtime = motion?.runtime ?? rig?.runtime; // MOTION LAYER HOOK
      if (frame !== null && runtime) runtime.cancelAnimationFrame(frame);
      frame = null;
      last = null;
    }
    function fail(reason: unknown) {
      console.error('Tavi character renderer:', reason);
      stop();
      rig?.dispose();
      motion?.dispose(); // MOTION LAYER HOOK
      if (!cancelled)
        setError('The character could not load. Check graphics acceleration and refresh.');
    }
    function draw(now: number) {
      frame = null;
      if (cancelled || (!rig && !motion) || document.hidden) return;
      try {
        const dt = last === null ? 0 : Math.min(0.1, Math.max(0, (now - last) / 1000));
        last = now;
        clock += dt;
        // MOTION LAYER HOOK: the motion layer drives everything; the legacy path below is unused.
        if (motion) {
          const result = motion.frame(dt, clock, latest.current);
          const element = host.current;
          if (element) {
            element.dataset['performance'] = result.status.expressions[0] ?? 'idle';
            element.dataset['retracted'] = String(latest.current.retracted);
            element.dataset['locomotion'] = result.status.locomotion;
            element.dataset['ready'] = 'true';
          }
          frame = motion.runtime.requestAnimationFrame(draw);
          return;
        }
        if (!rig) return;
        const current = latest.current,
          config = current.config;
        if (current.quiet !== quiet) {
          quiet = current.quiet;
          if (quiet && !retracted) director.idle();
        }
        if (current.retracted !== retracted) {
          retracted = current.retracted;
          peek = false;
          if (retracted) director.play('tuck', clock);
          else {
            restoreFrom = hiddenAmount;
            restoreAt = clock;
            director.idle();
          }
        }
        if (current.action.id !== lastAction) {
          lastAction = current.action.id;
          if (!retracted && (!quiet || current.action.source === 'manual')) {
            peek = current.action.gesture === 'peek';
            if (current.action.gesture === 'scene') director.runScene(clock);
            else if (current.action.gesture === 'idle') director.idle();
            else {
              const action = actions[current.action.gesture];
              if (action) director.play(action, clock);
            }
          }
        }
        const performance = director.snapshot(clock);
        const pose = performancePose(performance, {
          strength: 0.5 + config.energy / 200,
          attitude: config.attitude,
          reducedMotion: reduced.matches,
        });
        hiddenAmount = retracted
          ? reduced.matches
            ? 1
            : pose.tuck
          : restoreFrom * (1 - smooth((clock - restoreAt) / 0.55));
        const follow = reduced.matches ? 1 : 1 - Math.exp(-dt * 9);
        x += (config.x - x) * follow;
        y += (config.y - y) * follow;
        rig.apply('wave Non Looping', 0);
        rig.apply('blink_IDLE', reduced.matches ? 0.2 : (clock % 2) / 2);
        for (const clip of pose.clips) if (clip.mix > 0) rig.apply(clip.name, clip.time, clip.mix);
        rig.apply('hair ' + config.riveHair, 0);
        rig.apply('clothing ' + config.riveOutfit, 0);
        rig.apply('glasses ' + config.riveGlasses, 0);
        const scale = Math.min(width / 1280, height / 720);
        const size =
          presentation === 'portrait' ? Math.min(height * 0.9, width / 0.7) : 220 * scale;
        const peekWeight = peek ? performance.weight : 0;
        const centerX = presentation === 'portrait' ? width * 0.5 : x * width;
        const bottomY = presentation === 'portrait' ? height * 0.96 : y * height;
        const idleBreath = reduced.matches || quiet ? 0 : Math.sin(clock * 1.7) * 0.003;
        const placement = {
          x: centerX + pose.x * scale + (width - size * 0.35 - centerX) * peekWeight,
          y:
            bottomY +
            pose.y * scale +
            (height + size * 0.42 - bottomY) * peekWeight +
            (height + size - bottomY) * hiddenAmount,
          width: size * 0.8,
          height: size * (pose.scale + idleBreath),
          rotation: pose.rotation,
        };
        const element = host.current;
        if (element) {
          element.dataset['performance'] = performance.action;
          element.dataset['retracted'] = String(retracted);
          element.dataset['ready'] = 'true';
        }
        if (canvas.current) canvas.current.style.opacity = String(1 - hiddenAmount);
        rig.draw(dt, placement);
        frame = rig.runtime.requestAnimationFrame(draw);
      } catch (reason) {
        fail(reason);
      }
    }
    function visibility() {
      if (document.hidden) stop();
      else if ((rig || motion) && !cancelled && frame === null)
        frame = (motion?.runtime ?? rig?.runtime)?.requestAnimationFrame(draw) ?? null;
    }
    const isCancelled = () => cancelled;
    async function mount() {
      try {
        const element = host.current,
          target = canvas.current;
        if (!element || !target) return;
        // MOTION LAYER HOOK: load the motion-driven renderer instead of the clip-scrub rig.
        if (MOTION_LAYER) {
          const motionModule = await import('./motion/avatarMotion');
          if (isCancelled()) return;
          const loadedMotion = await motionModule.createAvatarMotion(
            target,
            latest.current,
            presentation,
            clock,
          );
          if (isCancelled()) {
            loadedMotion.dispose();
            return;
          }
          motion = loadedMotion;
          resize();
          observer.observe(element);
          document.addEventListener('visibilitychange', visibility);
          frame = motion.runtime.requestAnimationFrame(draw);
          return;
        }
        const module = await import('./riveRig');
        if (isCancelled()) return;
        const loaded = await module.createRiveRig(target);
        if (isCancelled()) {
          loaded.dispose();
          return;
        }
        rig = loaded;
        resize();
        observer.observe(element);
        document.addEventListener('visibilitychange', visibility);
        frame = rig.runtime.requestAnimationFrame(draw);
      } catch (reason) {
        fail(reason);
      }
    }
    void mount();
    return () => {
      cancelled = true;
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      rig?.dispose();
      motion?.dispose(); // MOTION LAYER HOOK
    };
  }, [presentation]);
  return (
    <div className="avatar-renderer" ref={host} data-renderer="rive">
      <canvas ref={canvas} aria-label={`${state.config.name}, animated companion`} />
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
