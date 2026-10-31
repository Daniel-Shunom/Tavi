import { useEffect, useState } from 'react';
import { ArrowUpRight, Square } from 'lucide-react';
import type { useConnection } from '../useConnection';
import { catalog } from '../renderer/characters/registry';
import { isScriptActive } from '../../shared/cue';
import { expressions } from '../../shared/expressions';
import { Segmented, SwitchRow, natures, quickCues, supports, typing } from './parts';
import '../studio.css';

// The OBS dock (/dock): Studio's live controls in a narrow panel, for OBS's Custom Browser Docks,
// so a streamer can make Tavi react without leaving OBS. Same keys as Studio: 1–8 and Esc.

function readTheme() {
  try {
    const stored = localStorage.getItem('tavi.studio.theme');
    return stored === 'daydream' || stored === 'afterhours' ? stored : 'moonlight';
  } catch {
    return 'moonlight';
  }
}

export function Dock({ state, connected, send, serverNow }: ReturnType<typeof useConnection>) {
  const c = state.config;
  const character = catalog[c.character];
  const [theme] = useState(readTheme);
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!connected || event.metaKey || event.ctrlKey || event.altKey) return;
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
  }, [connected, send, character, state.retracted]);

  const script = state.performance.script;
  const performing = isScriptActive(script, serverNow()) ? script : null;
  // What she is doing, in the words of the reaction's first beat ("Reacting: wave").
  const first = performing?.beats[0];
  const doing = first
    ? `Reacting: ${expressions[first.expression].label.toLowerCase()}`
    : undefined;

  return (
    <main className="studio st-dock" data-theme={theme}>
      <header className="st-dock-top">
        <span className="st-brand">tavi</span>
        <span className="st-conn" role="status" data-online={connected || undefined}>
          {connected ? 'Connected' : 'Reconnecting'}
        </span>
      </header>
      <div className="st-now st-card">
        <span className="st-now-dot" data-state={state.retracted ? 'away' : 'here'} />
        <div>
          <b>
            {!connected
              ? 'Waiting for the service'
              : state.retracted
                ? 'Tucked away'
                : (doing ??
                  (performing ? 'Reacting' : state.quiet ? 'Enjoying the quiet' : 'Hanging out'))}
          </b>
          <span>{c.name}</span>
        </div>
      </div>
      <div className="st-pad st-dock-pad" role="group" aria-label="Reactions">
        {quickCues.map((entry, i) => (
          <button
            key={entry.label}
            type="button"
            className="st-pad-key"
            disabled={!connected || state.retracted || !supports(character, entry.cue)}
            onClick={() => {
              send({
                type: 'perform',
                ...entry.cue,
                ...(entry.target ? { target: entry.target } : {}),
              });
            }}
          >
            <kbd aria-hidden="true">{i + 1}</kbd>
            {entry.icon}
            <span>{entry.label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="st-button st-wide"
        disabled={!connected || !performing}
        onClick={() => {
          send({ type: 'cancel' });
        }}
      >
        <Square size={15} /> Stop and settle down
      </button>
      <div className="st-card">
        <SwitchRow
          title="Quiet mode"
          checked={state.quiet}
          disabled={!connected}
          onChange={(value) => {
            send({ type: 'quiet', value });
          }}
        />
        <SwitchRow
          title="Tuck her away"
          checked={state.retracted}
          disabled={!connected}
          onChange={(value) => {
            send({ type: 'retract', value });
          }}
        />
      </div>
      <Segmented
        label="Mood"
        options={(['cozy', 'playful', 'shy'] as const).map((id) => ({
          id,
          label: natures[id].label,
        }))}
        value={c.personality}
        disabled={!connected}
        onPick={(personality) => {
          send({ type: 'configure', patch: { personality } });
        }}
      />
      <a className="st-link st-dock-open" href="/studio" target="_blank" rel="noreferrer">
        Open Tavi Studio <ArrowUpRight size={14} />
      </a>
    </main>
  );
}
