import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Gauge, House, Palette, SlidersHorizontal } from 'lucide-react';
import { ArtLight } from './ArtLight';

// The Studio beat, staged like a product shot: Studio on a desktop display (our own monitor, not
// a branded device), the blurb beside it, and Tavi perched on top of the monitor. The
// steps advance on their own while the section is in view (until the visitor picks one; never
// under reduced motion), and the screen follows. The screen is a styled mock, clearly labelled,
// until the Studio UI pass supplies real screenshots or a recording.

const STEPS = [
  {
    id: 'shape',
    label: 'Shape her',
    detail: 'Face, hair, outfit and colours.',
    Icon: Palette,
  },
  {
    id: 'energy',
    label: 'Set her energy',
    detail: 'Calm and cosy, or loud and playful.',
    Icon: Gauge,
  },
  {
    id: 'home',
    label: 'Give her a home',
    detail: 'Pick her spot, then add the overlay link to OBS.',
    Icon: House,
  },
] as const;

/** Seconds each step stays on while the steps advance by themselves. */
const STEP_SECONDS = 3.6;

export function StudioBeat({ perchRef }: { perchRef: RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState(false);
  const [inView, setInView] = useState(false);
  const section = useRef<HTMLElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const watch = new IntersectionObserver(
      ([entry]) => {
        setInView(entry?.isIntersecting ?? false);
      },
      { threshold: 0.35 },
    );
    watch.observe(element);
    return () => {
      watch.disconnect();
    };
  }, []);

  useEffect(() => {
    if (chosen || !inView || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => {
      setActive((step) => (step + 1) % STEPS.length);
    }, STEP_SECONDS * 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [active, chosen, inView]);

  const pick = (step: number, focus = false) => {
    setChosen(true);
    setActive(step);
    if (focus) tabs.current[step]?.focus();
  };
  // Arrow keys move between the steps, as in any tab list.
  const keys = (event: KeyboardEvent) => {
    const last = STEPS.length - 1;
    const next =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? active === last
          ? 0
          : active + 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? active === 0
            ? last
            : active - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    pick(next, true);
  };
  const step = STEPS[active] ?? STEPS[0];

  return (
    <section
      className="story-section story-studio story-flip"
      id="studio"
      data-cue="studio"
      ref={section}
    >
      <div className="story-copy">
        <h2>
          <span className="reveal-line">Yours in</span>
          <span className="reveal-line">a few minutes.</span>
        </h2>
        <p className="section-knot">
          <SlidersHorizontal size={14} /> Tavi Studio
        </p>
        <p>Make her look like you (or not), set her energy, and give her a spot in your stream.</p>
        <div
          className="studio-steps"
          role="tablist"
          aria-label="What you do in Studio"
          aria-orientation="vertical"
        >
          {STEPS.map(({ id, label, detail, Icon }, i) => (
            <button
              key={id}
              ref={(button) => {
                tabs.current[i] = button;
              }}
              className="studio-step"
              type="button"
              role="tab"
              id={`studio-step-${id}`}
              aria-selected={i === active}
              aria-controls="studio-preview"
              tabIndex={i === active ? 0 : -1}
              onClick={() => {
                pick(i);
              }}
              onKeyDown={keys}
            >
              <span className="studio-step-icon" aria-hidden="true">
                <Icon size={15} />
              </span>
              <span className="studio-step-text">
                <b>{label}</b>
                <span>{detail}</span>
              </span>
            </button>
          ))}
        </div>
        <span className="story-note">Works with OBS and Twitch chat.</span>
      </div>
      <div className="story-art story-art-studio">
        <ArtLight />
        <div className="studio-display" data-art-object>
          {/* Tavi sits on the monitor's top edge. */}
          <div className="studio-bezel" ref={perchRef}>
            <div
              className="studio-screen"
              id="studio-preview"
              role="tabpanel"
              aria-labelledby={`studio-step-${step.id}`}
              data-step={step.id}
            >
              {/* A styled mock of the studio until the Studio UI pass: the sidebar follows the step. */}
              <div className="studio-mock" aria-hidden="true">
                <div className="studio-mock-bar">
                  <i />
                  <i />
                  <i />
                  <span>Tavi Studio</span>
                </div>
                <div className="studio-mock-body">
                  <div className="studio-mock-nav">
                    {STEPS.map(({ id, label, Icon }, i) => (
                      <span key={id} data-on={String(i === active)}>
                        <Icon size={11} /> {label}
                      </span>
                    ))}
                  </div>
                  <div className="studio-mock-stage">
                    <div className="studio-mock-figure" />
                    <span>Studio preview coming soon</span>
                  </div>
                  <div className="studio-mock-panel">
                    <b>{step.label}</b>
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="studio-stand" aria-hidden="true" />
          <div className="studio-foot" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
