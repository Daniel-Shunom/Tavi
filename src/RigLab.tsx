import { useEffect, useRef, useState } from 'react';
import { createCharacterRenderer, type CharacterRenderer } from './renderer/adapter';
import { getCharacter } from './renderer/characters/registry';
import {
  demoDuration,
  demoFrame,
  demoPlacement,
  rigScenes,
  type RigScene,
} from './renderer/rig/demo';
import { bodyLimits, type BodyControls } from './renderer/rig/body';
import './rig-lab.css';
const bodySliders = [
  { key: 'pelvisTilt', label: 'Pelvis' },
  { key: 'chestTilt', label: 'Chest' },
  { key: 'neckTilt', label: 'Neck' },
  { key: 'headTilt', label: 'Head' },
] as const;

export function RigLab() {
  const [controls, setControls] = useState<BodyControls>({});
  const [scene, setScene] = useState<RigScene>('Weight shift');
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [strength, setStrength] = useState(1);
  const [small, setSmall] = useState(false);
  const [background, setBackground] = useState('dark');
  const [epoch, setEpoch] = useState(0);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const state = useRef({ scene, playing, time, strength, small, controls });
  state.current = { scene, playing, time, strength, small, controls };
  const clock = useRef(0);
  useEffect(() => {
    let cancelled = false,
      raf = 0,
      previous: number | null = null,
      lastUi = 0;
    const views: CharacterRenderer[] = [];
    setReady(false);
    setError('');
    async function start() {
      for (const [i, id] of ['tavi-refined', 'tavi-foundation'].entries()) {
        const canvas = canvases.current[i];
        if (!canvas) throw new Error('Missing comparison canvas.');
        const view = await createCharacterRenderer(canvas, getCharacter(id));
        if (cancelled) {
          view.dispose();
          return;
        }
        views.push(view);
      }
      setReady(true);
      function tick(now: number) {
        if (cancelled) return;
        const current = state.current;
        const elapsed = previous === null ? 0 : Math.min(0.05, (now - previous) / 1000);
        previous = now;
        const dt = current.playing ? elapsed : 0;
        clock.current = current.playing ? (clock.current + dt) % demoDuration : current.time;
        for (const [i, view] of views.entries()) {
          const canvas = canvases.current[i];
          if (!canvas) continue;
          // CSS rotation changes the bounding rect, not the canvas layout dimensions.
          const width = canvas.clientWidth,
            height = canvas.clientHeight;
          const ratio = Math.min(devicePixelRatio || 1, 2);
          if (
            canvas.width !== Math.round(width * ratio) ||
            canvas.height !== Math.round(height * ratio)
          )
            view.resize(width, height);
          const size = current.small ? 220 : Math.min(height - 24, width * 1.15, 580);
          view.applyFrame(
            demoFrame(current.scene, clock.current, current.strength, current.controls, i === 1),
          );
          view.draw(dt, demoPlacement(current.scene, size, width, height));
          canvas.dataset['sampleTime'] = clock.current.toFixed(4);
          canvas.dataset['scene'] = current.scene;
        }
        if (current.playing && now - lastUi >= 100) {
          setTime(clock.current);
          lastUi = now;
        }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }
    void start().catch((cause: unknown) => {
      for (const view of views) view.dispose();
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load rig.');
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      for (const view of views) view.dispose();
    };
  }, [epoch]);
  function reset() {
    clock.current = 0;
    setTime(0);
    setEpoch((e) => e + 1);
  }
  return (
    <main className="rig-lab">
      <header>
        <a href="/studio">Tavi / Studio</a>
        <span>
          Motion atelier <b>01</b>
        </span>
      </header>
      <div className="rig-heading">
        <div>
          <h1>A better way to move.</h1>
        </div>
        <span className="rig-status">
          {error ? 'Load failed' : ready ? 'Comparison ready' : 'Loading artwork'}
        </span>
      </div>
      <div className="rig-toolbar" aria-label="Comparison controls">
        <label>
          Study
          <select
            aria-label="Study"
            value={scene}
            onChange={(e) => {
              setScene(e.target.value as RigScene);
              reset();
            }}
          >
            {rigScenes.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setPlaying((p) => !p);
          }}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={reset}>
          Restart
        </button>
        <label>
          Strength
          <input
            aria-label="Strength"
            type="range"
            min="0"
            max="1.5"
            step="0.01"
            value={strength}
            onChange={(e) => {
              setStrength(Number(e.target.value));
            }}
          />
        </label>
        <label>
          Scale
          <select
            aria-label="Scale"
            value={small ? 'overlay' : 'studio'}
            onChange={(e) => {
              setSmall(e.target.value === 'overlay');
            }}
          >
            <option value="studio">Studio</option>
            <option value="overlay">Overlay / 220 px</option>
          </select>
        </label>
        <label>
          Surface
          <select
            aria-label="Surface"
            value={background}
            onChange={(e) => {
              setBackground(e.target.value);
            }}
          >
            <option value="dark">Ink</option>
            <option value="light">Ivory</option>
            <option value="checker">Alpha check</option>
          </select>
        </label>
      </div>
      <fieldset className="rig-body-controls">
        <legend>Manual offsets / candidate</legend>
        {bodySliders.map(({ key, label }) => (
          <label key={key}>
            {label}
            <input
              aria-label={label + ' angle'}
              type="range"
              min={-bodyLimits[key]}
              max={bodyLimits[key]}
              step="0.001"
              value={controls[key] ?? 0}
              onChange={(e) => {
                setControls((c) => ({ ...c, [key]: Number(e.target.value) }));
              }}
            />
            <output>{(((controls[key] ?? 0) * 180) / Math.PI).toFixed(1)} deg</output>
          </label>
        ))}
        <label className="rig-check">
          <input
            aria-label="Steady head"
            type="checkbox"
            checked={Boolean(
              controls.headStabilize ??
              (scene === 'Head stabilization' || scene === 'Body flow' || scene.startsWith('Sleep')
                ? 1
                : 0),
            )}
            onChange={(e) => {
              setControls((c) => ({ ...c, headStabilize: e.target.checked ? 1 : 0 }));
            }}
          />
          Steady head
        </label>
        <button
          type="button"
          onClick={() => {
            setControls({});
          }}
        >
          Clear
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <div
        className={`rig-comparison rig-surface-${background}${scene.startsWith('Sleep') ? ' rig-sleep' : ''}`}
      >
        {['Refined / baseline', 'Foundation / candidate'].map((label, i) => (
          <section className="rig-stage" key={label} aria-label={label}>
            <div className="rig-caption">
              <h2>{label}</h2>
            </div>
            <canvas
              ref={(node) => {
                canvases.current[i] = node;
              }}
              aria-label={label + ' character preview'}
            />
            <span className="rig-ground" />
          </section>
        ))}
      </div>
      <div className="rig-timeline">
        <output>{time.toFixed(2)} s</output>
        <input
          aria-label="Pose time"
          type="range"
          min="0"
          max={demoDuration}
          step="0.01"
          value={time}
          onChange={(e) => {
            const t = Number(e.target.value);
            setPlaying(false);
            setTime(t);
            clock.current = t;
            setEpoch((v) => v + 1);
          }}
        />
        <span>{demoDuration.toFixed(2)} s</span>
      </div>
      <footer>
        <p>Same art. Same clock. New contact and settling mechanics.</p>
        <p>
          Authored walking and sitting remain the baseline. Seam correctives remain the next
          milestone.
        </p>
      </footer>
    </main>
  );
}
