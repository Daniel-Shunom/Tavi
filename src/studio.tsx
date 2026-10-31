import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Heart, Plug, Radio, Sparkles, Wifi, WifiOff } from 'lucide-react';
import type { useConnection } from './useConnection';
import { catalog } from './renderer/characters/registry';
import { isScriptActive } from '../shared/cue';
import { LiveView } from './studio/LiveView';
import { LookView } from './studio/LookView';
import { PersonalityView } from './studio/PersonalityView';
import { SetupView, type SetupProgress } from './studio/SetupView';
import { Welcome, readTwitchChoice } from './studio/Welcome';
import { quickCues, supports, typing } from './studio/parts';
import './studio.css';

// Tavi Studio: four places, one character. Live is the control room while streaming; Look,
// Personality and Setup are where she is made, given a character and put on stream. The theme is
// Studio's own (never shown on stream) and, like the setup checklist, remembered in this browser.

const views = {
  live: {
    label: 'Live',
    icon: <Radio />,
    title: 'Live',
    lede: 'What she is doing on your stream, right now.',
  },
  look: {
    label: 'Look',
    icon: <Sparkles />,
    title: 'Look',
    lede: 'Make her look like you, or not. Changes show on stream as you make them.',
  },
  personality: {
    label: 'Personality',
    icon: <Heart />,
    title: 'Personality',
    lede: 'How she shows up, and what makes her react.',
  },
  setup: {
    label: 'Setup',
    icon: <Plug />,
    title: 'Get her on your stream',
    lede: 'A few steps, once. Everything here can change later.',
  },
} as const;
type View = keyof typeof views;
const viewIds = Object.keys(views) as View[];

const themes = [
  { id: 'moonlight', label: 'Moonlight' },
  { id: 'daydream', label: 'Daydream' },
  { id: 'afterhours', label: 'Afterhours' },
] as const;
type Theme = (typeof themes)[number]['id'];

const THEME_KEY = 'tavi.studio.theme';
const SETUP_KEY = 'tavi.studio.setup';

function readView(): View {
  const id = location.hash.slice(1);
  return viewIds.find((view) => view === id) ?? 'live';
}
function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return themes.find((theme) => theme.id === stored)?.id ?? 'moonlight';
  } catch {
    return 'moonlight';
  }
}
function readProgress(): SetupProgress {
  const none = { look: false, obs: false, chat: false, dock: false };
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SETUP_KEY) ?? '{}');
    if (!stored || typeof stored !== 'object') return none;
    const value = stored as Record<string, unknown>;
    return {
      look: value['look'] === true,
      obs: value['obs'] === true,
      chat: value['chat'] === true,
      dock: value['dock'] === true,
    };
  } catch {
    return none;
  }
}
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows may refuse storage; Studio still works, it just forgets.
  }
}

export function Studio(connection: ReturnType<typeof useConnection>) {
  const { state, connected, error, send, serverNow } = connection;
  const c = state.config;
  const character = catalog[c.character];
  const [view, setView] = useState<View>(readView);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [progress, setProgress] = useState<SetupProgress>(readProgress);
  // The Twitch door first, unless they skipped it before (Setup has it later).
  const [welcome, setWelcome] = useState(() => readTwitchChoice() !== 'skipped');
  const enter = useCallback(() => {
    setWelcome(false);
  }, []);
  const [, setTick] = useState(0);

  useEffect(() => {
    const follow = () => {
      setView(readView());
    };
    addEventListener('hashchange', follow);
    return () => {
      removeEventListener('hashchange', follow);
    };
  }, []);
  useEffect(() => {
    // Re-render once a second so "what she is doing" clears when a reaction finishes.
    const timer = setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  const updateProgress = (change: Partial<SetupProgress>) => {
    setProgress((current) => {
      const next = { ...current, ...change };
      remember(SETUP_KEY, JSON.stringify(next));
      return next;
    });
  };
  useEffect(() => {
    if (view === 'look' && !progress.look) updateProgress({ look: true });
  }, [view, progress.look]);

  // Streamer-first keys, anywhere in Studio: 1–8 fire the quick reactions, Esc stops.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (welcome || !connected || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') {
        send({ type: 'cancel' });
        return;
      }
      if (typing(event.target) || state.retracted) return;
      const entry = quickCues[Number(event.key) - 1];
      if (!entry || !supports(character, entry.cue)) return;
      event.preventDefault();
      send({ type: 'perform', ...entry.cue, ...(entry.target ? { target: entry.target } : {}) });
    }
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
    };
  }, [welcome, connected, send, character, state.retracted]);

  const go = (next: View) => {
    setView(next);
    history.replaceState(null, '', '#' + next);
    document.getElementById('studio-main')?.scrollTo({ top: 0 });
  };
  const performing = isScriptActive(state.performance.script, serverNow())
    ? state.performance.script
    : null;
  const statusLine = !connected
    ? 'Waiting for the service'
    : state.retracted
      ? 'Tucked away'
      : performing
        ? 'Reacting'
        : state.quiet
          ? 'Enjoying the quiet'
          : 'Hanging out';
  const props = { ...connection, performing, statusLine };
  if (welcome) return <Welcome connection={connection} theme={theme} onDone={enter} />;
  const stepsDone = [progress.look, progress.obs, progress.chat].filter(Boolean).length;
  const page = views[view];

  return (
    <div className="studio" data-theme={theme}>
      <a className="st-skip" href="#studio-main">
        Skip to content
      </a>
      <aside className="st-rail">
        <a href="/" className="st-brand" aria-label="Tavi home">
          tavi <small>Studio</small>
        </a>
        <nav className="st-nav" aria-label="Studio">
          {viewIds.map((id) => (
            <a
              key={id}
              href={'#' + id}
              aria-current={view === id ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                go(id);
              }}
            >
              {views[id].icon}
              {views[id].label}
              {id === 'setup' && stepsDone < 3 ? (
                <span className="st-badge" aria-label={`${String(stepsDone)} of 3 steps done`}>
                  {stepsDone}/3
                </span>
              ) : null}
            </a>
          ))}
        </nav>
        <div className="st-rail-foot">
          <span className="st-label" id="theme-label">
            Theme
          </span>
          <div className="st-themes" role="radiogroup" aria-labelledby="theme-label">
            {themes.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={theme === entry.id}
                aria-label={entry.label}
                title={entry.label}
                data-swatch={entry.id}
                onClick={() => {
                  setTheme(entry.id);
                  remember(THEME_KEY, entry.id);
                }}
              >
                <i />
              </button>
            ))}
          </div>
          <span className="st-conn" role="status" data-online={connected || undefined}>
            {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
            {connected ? 'Local service connected' : 'Reconnecting to service'}
          </span>
        </div>
      </aside>

      <main className="st-main" id="studio-main" tabIndex={-1}>
        <header className="st-head">
          <div>
            <h1>{page.title}</h1>
            <p>{page.lede}</p>
          </div>
          {view === 'live' ? (
            <a className="st-pill" href="/overlay" target="_blank" rel="noreferrer">
              Open the overlay <ArrowUpRight size={14} />
            </a>
          ) : null}
        </header>
        {error ? (
          <p className="st-error" role="alert">
            {error}
          </p>
        ) : null}
        {view === 'live' ? <LiveView {...props} /> : null}
        {view === 'look' ? <LookView {...props} /> : null}
        {view === 'personality' ? <PersonalityView {...props} /> : null}
        {view === 'setup' ? (
          <SetupView
            {...props}
            progress={progress}
            onProgress={updateProgress}
            onOpenLook={() => {
              go('look');
            }}
          />
        ) : null}
      </main>
    </div>
  );
}
