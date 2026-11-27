import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Check, Cloud, Coffee, Sparkles } from 'lucide-react';
import { Avatar } from '../renderer/Avatar';
import { TwitchPanel } from '../TwitchPanel';
import { YoutubePanel } from '../YoutubePanel';
import { judgingDockUrl, useOverlayUrl } from '../judging/Session';
import type { Config } from '../../shared/protocol';
import { natures } from '../studio/parts';
import type { StudioProps } from '../studio/types';
import { nextStep, type SetupProgress } from './model';
import { CopyField } from './ui';

// The welcome: a guided first meeting, one decision at a time, with her beside every step. Say
// hello, bring her to OBS, introduce her to chat. The service cannot see inside OBS, so the
// streamer says when she is in. Its words treat her as a companion being met, never as a thing
// being configured.

type StepId = 'welcome' | 'hello' | 'obs' | 'chat' | 'done';
const order: StepId[] = ['welcome', 'hello', 'obs', 'chat', 'done'];
const stops: { id: 'hello' | 'obs' | 'chat'; label: string }[] = [
  { id: 'hello', label: 'Say hello' },
  { id: 'obs', label: 'Bring her to OBS' },
  { id: 'chat', label: 'Introduce chat' },
];
const natureIds = ['cozy', 'playful', 'shy'] as const;
const natureIcons = { cozy: <Coffee />, playful: <Sparkles />, shy: <Cloud /> };
// Motion tokens (seconds), matching --sn-t-pop and --sn-t-exit in studio-next.css.
const ENTER = { duration: 0.2, ease: [0.32, 0.72, 0, 1] } as const;
const EXIT = { duration: 0.15, ease: [0.55, 0, 1, 0.45] } as const;

export function Wizard({
  state,
  connected,
  send,
  serverNow,
  progress,
  onProgress,
  onDone,
}: StudioProps & {
  progress: SetupProgress;
  onProgress: (change: Partial<SetupProgress>) => void;
  onDone: () => void;
}) {
  const overlayUrl = useOverlayUrl();
  const reduced = useReducedMotion();
  const c = state.config;
  // A first visit starts at the welcome; a return picks up at the step still to do.
  const [step, setStep] = useState<StepId>(() => {
    const next = nextStep(progress);
    if (next === 'obs' || next === 'chat') return next;
    return progress.look ? 'hello' : 'welcome';
  });
  const [name, setName] = useState(c.name);
  const editingName = useRef(false);
  // While the field is idle it follows the saved name (it may load, or change elsewhere).
  useEffect(() => {
    if (!editingName.current) setName(c.name);
  }, [c.name]);
  const [chatConnected, setChatConnected] = useState(false);
  const index = order.indexOf(step);
  const patch = (value: Partial<Config>) => {
    send({ type: 'configure', patch: value });
  };
  const back = () => {
    setStep(order[Math.max(0, index - 1)] ?? 'welcome');
  };

  // She waves once, when she and the streamer first meet.
  const waved = useRef(false);
  useEffect(() => {
    if (step !== 'welcome' || waved.current || !connected || state.retracted) return;
    waved.current = true;
    const timer = setTimeout(() => {
      send({ type: 'perform', sequence: 'greeting' });
    }, 700);
    return () => {
      clearTimeout(timer);
    };
  }, [step, connected, state.retracted, send]);

  const heard = () => {
    setChatConnected(true);
    if (!progress.chat) onProgress({ chat: true });
    if (step === 'chat') setStep('done');
  };
  // Her line for each step. Short, friendly and her own; never eager to please.
  const bubble: Record<StepId, string> = {
    welcome: `Hi. I’m ${c.name}.`,
    hello: 'Nice to meet you.',
    obs: 'Got room for one more?',
    chat: 'I listen. I don’t post.',
    done: 'Let’s go.',
  };

  let content: ReactNode;
  if (step === 'welcome')
    content = (
      <>
        <div className="sn-wz-scroll">
          <div className="sn-wz-head">
            <h1 className="sn-wz-title sn-wz-title-big">Meet your stream companion</h1>
            <p className="sn-wz-lede">
              She keeps you company on stream, reacts in her own way, and knows when to hang back.
              Three quick steps and she joins you.
            </p>
          </div>
          <ol className="sn-wz-how">
            <li>
              <span>
                <b>Say hello.</b> Her name, and what she is like.
              </span>
            </li>
            <li>
              <span>
                <b>Bring her to OBS.</b> Paste one link.
              </span>
            </li>
            <li>
              <span>
                <b>Introduce her to chat.</b> Optional. She listens and never posts.
              </span>
            </li>
          </ol>
        </div>
        <div className="sn-actions sn-wz-foot">
          <button
            type="button"
            className="sn-btn sn-btn-primary sn-btn-big"
            onClick={() => {
              setStep('hello');
            }}
          >
            Get started
          </button>
          <span className="sn-hint">About two minutes</span>
        </div>
      </>
    );
  else if (step === 'hello')
    content = (
      <>
        <div className="sn-wz-scroll">
          <div className="sn-wz-head">
            <h1 className="sn-wz-title">Say hello</h1>
            <p className="sn-wz-lede">Her look comes later, in Studio. Start with who she is.</p>
          </div>
          <label className="sn-field sn-field-narrow">
            <span className="sn-label">Her name</span>
            <input
              name="companion-name"
              autoComplete="off"
              spellCheck={false}
              value={name}
              maxLength={24}
              disabled={!connected}
              onChange={(event) => {
                editingName.current = true;
                setName(event.target.value);
                if (event.target.value.trim()) patch({ name: event.target.value });
              }}
              onBlur={() => {
                editingName.current = false;
                setName(c.name);
              }}
            />
          </label>
          <div className="sn-group">
            <span className="sn-label" id="wizard-nature">
              What is she like?
            </span>
            <RadioGroup
              className="sn-natures"
              aria-labelledby="wizard-nature"
              value={c.personality}
              disabled={!connected}
              onValueChange={(next) => {
                patch({ personality: next });
              }}
            >
              {natureIds.map((id) => (
                <Radio.Root key={id} value={id} className="sn-nature">
                  <span className="sn-nature-icon" aria-hidden="true">
                    {natureIcons[id]}
                  </span>
                  <span>
                    <b>{natures[id].label}</b>
                    <span>{natures[id].line}</span>
                  </span>
                </Radio.Root>
              ))}
            </RadioGroup>
          </div>
        </div>
        <div className="sn-actions sn-wz-foot">
          <button type="button" className="sn-btn sn-btn-quiet" onClick={back}>
            Back
          </button>
          <button
            type="button"
            className="sn-btn sn-btn-primary sn-btn-wide"
            onClick={() => {
              onProgress({ look: true });
              setStep('obs');
            }}
          >
            Continue
          </button>
        </div>
      </>
    );
  else if (step === 'obs')
    content = (
      <>
        <div className="sn-wz-scroll">
          <div className="sn-wz-head">
            <h1 className="sn-wz-title">Invite her onto your stream</h1>
            <p className="sn-wz-lede">She joins your OBS scene as a transparent layer.</p>
          </div>
          <ol className="sn-wz-how">
            <li>
              <span>
                In OBS, under <b>Sources</b>, click <b>+</b> and choose <b>Browser</b>.
              </span>
            </li>
            <li>
              <div className="sn-group">
                <span>
                  Paste this link into the <b>URL</b> box.
                </span>
                <CopyField label="Overlay link" value={overlayUrl} />
              </div>
            </li>
            <li>
              <span>
                Set the size to <b>1280 × 720</b> and click <b>OK</b>.
              </span>
            </li>
          </ol>
          <p className="sn-hint">
            Studio cannot see inside OBS, so you say when she is in. Keep Tavi running while you
            stream.
          </p>
        </div>
        <div className="sn-actions sn-wz-foot">
          <button type="button" className="sn-btn sn-btn-quiet" onClick={back}>
            Back
          </button>
          <button
            type="button"
            className="sn-btn sn-btn-primary sn-btn-wide"
            onClick={() => {
              onProgress({ obs: true });
              setStep('chat');
            }}
          >
            She’s in
          </button>
          <button
            type="button"
            className="sn-linkish"
            onClick={() => {
              setStep('chat');
            }}
          >
            I’ll do this later
          </button>
          <a className="st-link" href={overlayUrl} target="_blank" rel="noreferrer">
            Preview the overlay <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
      </>
    );
  else if (step === 'chat')
    content = (
      <>
        <div className="sn-wz-scroll">
          <div className="sn-wz-head">
            <div className="sn-wz-title-row">
              <h1 className="sn-wz-title">Introduce her to chat</h1>
              <span className="sn-tag">Optional</span>
            </div>
            <p className="sn-wz-lede">
              She listens to chat and never posts. How she reacts to it follows rules, not AI.
            </p>
          </div>
          <div className="sn-providers">
            <div className="sn-provider">
              <TwitchPanel
                serviceConnected={connected}
                onPhase={(phase) => {
                  if (phase === 'connected') heard();
                }}
              />
            </div>
            <div className="sn-provider">
              <YoutubePanel
                serviceConnected={connected}
                onPhase={(phase) => {
                  if (phase === 'connected') heard();
                }}
              />
            </div>
          </div>
        </div>
        <div className="sn-actions sn-wz-foot">
          <button type="button" className="sn-btn sn-btn-quiet" onClick={back}>
            Back
          </button>
          <button
            type="button"
            className="sn-linkish"
            onClick={() => {
              if (!progress.chat) onProgress({ chat: true });
              setStep('done');
            }}
          >
            Skip for now
          </button>
        </div>
      </>
    );
  else
    content = (
      <>
        <div className="sn-wz-scroll">
          <span className="sn-done-check" data-celebrate aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <div className="sn-wz-head">
            <h1 className="sn-wz-title sn-wz-title-big">{c.name} is here</h1>
            <p className="sn-wz-lede">
              Here is what is set. Everything can change later in Settings.
            </p>
          </div>
          <dl className="sn-wz-summary">
            <div>
              <dt>She is</dt>
              <dd>{natures[c.personality].label}</dd>
            </div>
            <div>
              <dt>OBS overlay</dt>
              <dd>{progress.obs ? 'She’s in' : 'Not yet'}</dd>
            </div>
            <div>
              <dt>Chat</dt>
              <dd>{chatConnected ? 'Connected' : 'Not yet'}</dd>
            </div>
          </dl>
          <section className="sn-wz-extra" aria-labelledby="wizard-dock">
            <div className="sn-wz-title-row">
              <h2 id="wizard-dock">Cue her from inside OBS</h2>
              <span className="sn-tag">Optional</span>
            </div>
            <p className="sn-hint">
              In OBS, open <b>Docks</b> › <b>Custom Browser Docks</b>, name it Tavi and paste this
              link. It is also in Settings.
            </p>
            <CopyField label="Dock link" value={judgingDockUrl()} />
          </section>
        </div>
        <div className="sn-actions sn-wz-foot">
          <button type="button" className="sn-btn sn-btn-primary sn-btn-big" onClick={onDone}>
            Open the stage
          </button>
          <button
            type="button"
            className="sn-btn sn-btn-quiet"
            onClick={() => {
              setStep('hello');
            }}
          >
            Change something
          </button>
        </div>
      </>
    );

  return (
    <div className="sn-wz">
      <header className="sn-wz-top">
        <a href="/" className="st-brand" aria-label="Tavi home">
          tavi <small>Studio</small>
        </a>
        {step === 'done' ? null : (
          <button type="button" className="sn-linkish" onClick={onDone}>
            Skip setup for now
          </button>
        )}
      </header>
      <main className="sn-wz-main" id="studio-main" tabIndex={-1}>
        <div className="sn-wz-figure">
          <p className="sn-wz-bubble" role="status">
            {connected
              ? bubble[step]
              : 'I’ve lost the connection for a moment. Your choices unlock when I’m back.'}
          </p>
          <div className="sn-wz-floor" aria-hidden="true" />
          <div className="sn-wz-avatar portrait-space" aria-hidden="true">
            <Avatar state={state} serverNow={serverNow} presentation="portrait" captions={false} />
          </div>
          <div className="sn-wz-name">
            <b>{c.name}</b>
            <span>{natures[c.personality].line}</span>
          </div>
        </div>

        <div className="sn-wz-side">
          <ol
            className="sn-stepper"
            data-hidden={step === 'welcome' || undefined}
            aria-label={index > 0 && index < 4 ? `Step ${String(index)} of 3` : 'Setup steps'}
          >
            {stops.map((stop, i) => {
              const at = order.indexOf(stop.id);
              return (
                <li
                  key={stop.id}
                  data-state={index > at ? 'done' : index === at ? 'current' : undefined}
                  aria-current={index === at ? 'step' : undefined}
                >
                  <i aria-hidden="true">{index > at ? <Check size={15} /> : i + 1}</i>
                  <span>{stop.label}</span>
                </li>
              );
            })}
          </ol>
          <div className="sn-wz-panes">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={step}
                className="sn-wz-pane"
                initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                animate={{ opacity: 1, y: 0, transition: reduced ? { duration: 0 } : ENTER }}
                exit={{ opacity: 0, transition: reduced ? { duration: 0 } : EXIT }}
              >
                {content}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
