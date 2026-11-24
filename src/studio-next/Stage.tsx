import { useRef } from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Search, Settings2, Square } from 'lucide-react';
import { catalog } from '../renderer/characters/registry';
import { expressions, sequences } from '../../shared/expressions';
import { quickCues, supports } from '../studio/parts';
import type { StudioProps } from '../studio/types';
import { modes, stepsDone, type Mode, type SetupProgress } from './model';
import type { Holiday } from './holiday/HolidayCard';
import { LivePane, LookPane, PersonalityPane } from './panes';
import { Scene } from './Scene';

// The stage: where a streamer spends their time. She is always in view, the reaction keys never
// move, and the three modes only change the panel beside her.

const modeLabels: Record<Mode, string> = { live: 'Live', look: 'Look', personality: 'Personality' };
// Motion tokens (seconds), matching --sn-t-pop and --sn-t-exit in studio-next.css.
const ENTER = { duration: 0.2, ease: [0.32, 0.72, 0, 1] } as const;
const EXIT = { duration: 0.15, ease: [0.55, 0, 1, 0.45] } as const;

export function Stage(
  props: StudioProps & {
    mode: Mode;
    onMode: (mode: Mode) => void;
    progress: SetupProgress;
    onSettings: () => void;
    /** The holiday theme that is on, if one is. */
    holiday?: Holiday;
    onWelcome: () => void;
    onPalette: () => void;
    onRehearse: () => void;
  },
) {
  const { state, connected, error, send, performing, mode, onMode, progress, holiday } = props;
  const reduced = useReducedMotion();
  const character = catalog[state.config.character];
  const livePosition = useRef<{ x: number; y: number } | null>(null);
  const count = stepsDone(progress);

  return (
    <div className="sn-stage">
      <header className="sn-top">
        <div className="sn-top-brand">
          <a href="/" className="st-brand" aria-label="Tavi home">
            tavi <small>Studio</small>
          </a>
          {/* Always there, so the tabs never shift when a holiday theme comes or goes. */}
          <span
            className="sn-motif"
            role={holiday ? 'img' : undefined}
            aria-label={holiday ? `${holiday.label} theme` : undefined}
            title={holiday ? `${holiday.label} theme` : undefined}
          >
            {holiday?.icon}
          </span>
        </div>
        <Tabs.Root
          className="sn-modes"
          value={mode}
          onValueChange={(next) => {
            onMode(next as Mode);
          }}
        >
          <Tabs.List className="sn-tabs" aria-label="What you are working on">
            {modes.map((id) => (
              <Tabs.Tab key={id} value={id} className="sn-tab">
                {modeLabels[id]}
              </Tabs.Tab>
            ))}
            <Tabs.Indicator className="sn-tabs-pill" />
          </Tabs.List>
        </Tabs.Root>
        <div className="sn-top-side">
          <button type="button" className="sn-btn sn-btn-quiet" onClick={props.onPalette}>
            <Search size={16} aria-hidden="true" />
            <span className="sn-top-wide">Jump to anything</span>
            <kbd aria-hidden="true">Ctrl K</kbd>
          </button>
          {connected && count < 3 ? (
            <button type="button" className="sn-chip-link sn-chip-fill" onClick={props.onWelcome}>
              Finish setup · {count} of 3
            </button>
          ) : null}
          <button type="button" className="sn-chip-link" onClick={props.onSettings}>
            <i className="sn-dot" data-state={connected ? 'here' : 'warn'} />
            {connected ? 'Settings' : 'Reconnecting'}
            <Settings2 size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="sn-body" id="studio-main" tabIndex={-1}>
        {error ? (
          <p className="st-error sn-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="sn-main-col">
          <Scene
            {...props}
            livePosition={livePosition}
            reacting={performing !== null}
            {...(holiday?.roomOn ? { room: holiday.room } : {})}
          />
          <section className="sn-deck-wrap" aria-labelledby="deck-title">
            <div className="sn-deck-head">
              <h2 id="deck-title">Cue a reaction</h2>
              <span className="sn-hint">Keys 1–8 · Esc stops</span>
            </div>
            <div className="sn-deck" role="group" aria-label="Reactions">
              {quickCues.map((entry, i) => (
                <button
                  key={entry.label}
                  type="button"
                  className="sn-key"
                  disabled={!connected || state.retracted || !supports(character, entry.cue)}
                  title={
                    'sequence' in entry.cue
                      ? sequences[entry.cue.sequence].meaning
                      : expressions[entry.cue.expression].meaning
                  }
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
              {holiday ? (
                <button
                  type="button"
                  className="sn-key sn-key-holiday"
                  disabled={!connected || state.retracted || !holiday.cue}
                  title={
                    holiday.cue
                      ? `${holiday.label}: cues “${holiday.cue.label}”`
                      : `${holiday.label}: this character has no reaction for it yet`
                  }
                  onClick={holiday.onCue}
                >
                  <kbd aria-hidden="true">9</kbd>
                  {holiday.icon}
                  <span>{holiday.room.key.label}</span>
                </button>
              ) : null}
              <button
                type="button"
                className="sn-key sn-key-stop"
                disabled={!connected || !performing}
                title="Stop the current reaction (Esc)"
                onClick={() => {
                  send({ type: 'cancel' });
                }}
              >
                <kbd aria-hidden="true">Esc</kbd>
                <Square />
                <span>Stop</span>
              </button>
            </div>
          </section>
        </div>

        <aside className="sn-inspector" aria-label={`${modeLabels[mode]} controls`}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0, transition: reduced ? { duration: 0 } : ENTER }}
              exit={{ opacity: 0, transition: reduced ? { duration: 0 } : EXIT }}
            >
              {mode === 'live' ? (
                <LivePane
                  {...props}
                  livePosition={livePosition}
                  onRehearse={props.onRehearse}
                  {...(holiday ? { holiday } : {})}
                />
              ) : null}
              {mode === 'look' ? <LookPane {...props} /> : null}
              {mode === 'personality' ? <PersonalityPane {...props} /> : null}
            </motion.div>
          </AnimatePresence>
        </aside>
      </main>
    </div>
  );
}
