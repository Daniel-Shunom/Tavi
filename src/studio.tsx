import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronDown,
  Cloud,
  Coffee,
  Copy,
  Expand,
  Eye,
  FlaskConical,
  Hand,
  Heart,
  Layers,
  Monitor,
  Moon,
  Palette,
  PanelLeftClose,
  Radio,
  Shield,
  Smile,
  Sparkles,
  Sun,
  VolumeX,
  Wifi,
  WifiOff,
  Zap,
  CircleAlert,
} from 'lucide-react';
import { TwitchPanel } from './TwitchPanel';
import { Avatar } from './renderer/Avatar';
import type { useConnection } from './useConnection';
import type { Config, Gesture } from '../shared/protocol';
const gestures: Record<Gesture, ReactNode> = {
  wave: <Hand />,
  smile: <Smile />,
  surprise: <CircleAlert />,
  point: <ArrowUpRight />,
  peek: <Eye />,
  idle: <Heart />,
  listening: <Eye />,
  skeptical: <CircleAlert />,
  caught: <Cloud />,
  nod: <Check />,
  celebrate: <Sparkles />,
  scene: <FlaskConical />,
};
const personalities = {
  cozy: { icon: <Coffee />, description: 'Warm, calm, quietly present.' },
  playful: { icon: <Sparkles />, description: 'A little cheek. A lot of character.' },
  shy: { icon: <Cloud />, description: 'Gentle, observant, taking it all in.' },
};
const sections = [
  { id: 'appearance', name: 'Make it yours', icon: <Palette /> },
  { id: 'personality', name: 'Personality', icon: <Heart /> },
  { id: 'connections', name: 'Twitch', icon: <Radio /> },
  { id: 'playground', name: 'Playground', icon: <FlaskConical /> },
  { id: 'setup', name: 'Stream setup', icon: <Monitor /> },
] as const;
export function Studio({ state, connected, error, send }: ReturnType<typeof useConnection>) {
  const c = state.config;
  const [tab, setTab] = useState<'character' | 'scene'>('character');
  const [lighting, setLighting] = useState<'moonlight' | 'daydream' | 'afterhours'>('moonlight');
  const [spacious, setSpacious] = useState(false);
  const [active, setActive] = useState('appearance');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [text, setText] = useState('Tavi, that was a close one!');
  const [source, setSource] = useState<'streamer' | 'chat'>('streamer');
  const tools = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(copyTimer.current);
    },
    [],
  );
  const patch = (value: Partial<Config>) => {
    send({ type: 'configure', patch: value });
  };
  const overlayURL = `${location.origin}/overlay`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(overlayURL);
      setCopied(true);
      setCopyError('');
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopyError('Copy the overlay URL in Stream setup.');
    }
  }
  function navigate(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
    history.replaceState(null, '', '#' + id);
  }
  function updateSection() {
    const container = tools.current;
    if (!container) return;
    const top = container.getBoundingClientRect().top + 70;
    let current = 'appearance';
    for (const section of sections) {
      const node = document.getElementById(section.id);
      if (node && node.getBoundingClientRect().top <= top) current = section.id;
    }
    setActive(current);
  }
  function anchor(value: Config['anchor']) {
    patch({
      anchor: value,
      ...(value === 'webcam'
        ? { x: 0.23, y: 0.72 }
        : value === 'chat'
          ? { x: 0.82, y: 0.63 }
          : { x: 0.9, y: 0.92 }),
    });
  }
  return (
    <div className={`companion-studio ${spacious ? 'tools-expanded' : ''}`}>
      <a className="skip-link" href="#studio-tools">
        Skip to companion tools
      </a>
      <header className="studio-header">
        <a href="/" className="wordmark" aria-label="Tavi Studio home">
          <span className="brand-star">
            <Sparkles size={21} />
          </span>
          tavi
          <span className="wordmark-divider" />
          <small>Companion studio</small>
        </a>
        <div className="header-right">
          <span className={`connection ${connected ? 'online' : ''}`} role="status">
            {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>{connected ? 'Local service connected' : 'Reconnecting to service'}</span>
          </span>
          <button className="primary-button" onClick={() => void copy()}>
            {copied ? <Check size={15} /> : <Monitor size={15} />}
            <span>{copied ? 'Overlay URL copied' : 'Add to OBS'}</span>
            <ArrowUpRight size={14} />
          </button>
        </div>
      </header>
      <main className="studio-body">
        <section
          className="companion-stage"
          data-lighting={lighting}
          aria-label="Companion stage"
          onWheel={(event) => {
            tools.current?.scrollBy({ top: event.deltaY, behavior: 'instant' });
          }}
        >
          <div className="stage-grain" aria-hidden="true" />
          <div className="stage-orbit orbit-one" aria-hidden="true" />
          <div className="stage-orbit orbit-two" aria-hidden="true" />
          <div className="stage-floor" aria-hidden="true" />
          <div className="stage-intro">
            <span className="stage-eyebrow">
              <span className="status-dot" />
              Your little corner of the internet
            </span>
            <h1>
              Good company.
              <br />
              Your kind of energy.
            </h1>
            <p>
              One little character.
              <br />
              Entirely your own.
            </p>
          </div>
          <div className="stage-lighting" role="group" aria-label="Stage lighting">
            {(
              [
                { value: 'moonlight', icon: <Moon size={15} />, name: 'Moonlight' },
                { value: 'daydream', icon: <Sun size={15} />, name: 'Daydream' },
                { value: 'afterhours', icon: <Sparkles size={15} />, name: 'Afterhours' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                aria-label={option.name}
                title={option.name}
                aria-pressed={lighting === option.value}
                onClick={() => {
                  setLighting(option.value);
                }}
              >
                {option.icon}
              </button>
            ))}
          </div>
          <span className="stage-name" aria-hidden="true">
            {c.name}
          </span>
          <div className="portrait-space">
            <div className="portrait-halo" aria-hidden="true" />
            <Avatar state={state} presentation="portrait" />
            <button
              className="avatar-touch-target"
              aria-label={`Wave to ${c.name}`}
              title="Say hello"
              disabled={!connected || state.retracted}
              onClick={() => {
                send({ type: 'gesture', gesture: 'wave' });
              }}
            />
          </div>
          <div className="companion-caption">
            <span className="personality-chip">
              {personalities[c.personality].icon}
              {c.personality} soul
            </span>
            <span>
              {state.retracted
                ? 'Taking a little break'
                : state.quiet
                  ? 'Just enjoying the quiet'
                  : 'Click your companion to say hello'}
            </span>
          </div>
          <div className="stage-session">
            <span className="session-label">
              <span className="status-dot" />
              {state.retracted ? 'Tucked away' : state.quiet ? 'Quiet mode' : 'Hanging out'}
            </span>
            <div>
              <button
                className={state.quiet ? 'active' : ''}
                aria-pressed={state.quiet}
                disabled={!connected}
                onClick={() => {
                  send({ type: 'quiet', value: !state.quiet });
                }}
              >
                <VolumeX size={15} />
                {state.quiet ? 'Quiet mode on' : 'Quiet mode'}
              </button>
              <button
                className={state.retracted ? 'active' : ''}
                disabled={!connected}
                onClick={() => {
                  send({ type: 'retract', value: !state.retracted });
                }}
              >
                <PanelLeftClose size={15} />
                {state.retracted ? 'Bring Tavi back' : 'Tuck away'}
              </button>
            </div>
          </div>
          <div className="gesture-dock" role="group" aria-label="Try an expression">
            {(
              [
                'wave',
                'listening',
                'skeptical',
                'caught',
                'nod',
                'celebrate',
                'peek',
                'scene',
              ] as const
            ).map((gesture) => (
              <button
                key={gesture}
                disabled={!connected || state.retracted}
                onClick={() => {
                  send({ type: 'gesture', gesture });
                }}
              >
                {gestures[gesture]}
                <span>
                  {
                    {
                      wave: 'wave',
                      listening: 'listen',
                      skeptical: 'really?',
                      caught: 'oops',
                      nod: 'nod',
                      celebrate: 'celebrate',
                      peek: 'peek',
                      scene: 'try scene',
                    }[gesture]
                  }
                </span>
              </button>
            ))}
          </div>
          <div className="stage-footnote">
            <span>
              Live character preview <span className="preview-dot" />{' '}
              <a href="/credits/rive-avatar.md" target="_blank" rel="noreferrer">
                Character by alisketch (CC BY)
              </a>
            </span>
            <button
              onClick={() => {
                navigate('appearance');
              }}
            >
              <ArrowDown size={13} /> A little more you, below
            </button>
          </div>
        </section>
        <section className="tool-deck" id="studio-tools" aria-label="Companion tools">
          <div className="tool-deck-heading">
            <div>
              <span className="deck-handle" aria-hidden="true" />
              <h2>Behind the little personality</h2>
              <span className="deck-hint">
                Scroll to explore your tools <ChevronDown size={13} />
              </span>
            </div>
            <button
              className="tool-space-button"
              aria-label={spacious ? 'Give avatar more room' : 'Give tools more room'}
              aria-pressed={spacious}
              onClick={() => {
                setSpacious(!spacious);
              }}
            >
              <Expand size={15} />
              <span>{spacious ? 'More avatar' : 'More tools'}</span>
            </button>
          </div>
          {error || copyError ? (
            <p className="error-banner" role="alert">
              {error || copyError}
            </p>
          ) : null}
          <div className="tool-deck-layout">
            <nav className="tools-navigation" aria-label="Companion tools">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={'#' + section.id}
                  aria-current={active === section.id ? 'location' : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(section.id);
                  }}
                >
                  {section.icon}
                  <span>{section.name}</span>
                  <ArrowUpRight size={12} />
                </a>
              ))}
            </nav>
            <div
              className="tools-scroll"
              ref={tools}
              onScroll={updateSection}
              tabIndex={0}
              aria-label="Scrollable companion settings"
            >
              <section className="tool-section" id="appearance">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      <Palette size={14} /> Character studio
                    </span>
                    <h2>Make a little you.</h2>
                    <p>A familiar face, a favorite color, a finishing touch.</p>
                  </div>
                  <span className="saved-indicator">
                    <Check size={12} />
                    {connected ? 'Saved locally' : 'Offline'}
                  </span>
                </div>
                <div
                  className="tabs"
                  role="tablist"
                  aria-label="Character settings"
                  onKeyDown={(event) => {
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    const next =
                      event.key === 'Home'
                        ? 'character'
                        : event.key === 'End'
                          ? 'scene'
                          : tab === 'character'
                            ? 'scene'
                            : 'character';
                    setTab(next);
                    document
                      .getElementById(next === 'character' ? 'character-tab' : 'placement-tab')
                      ?.focus();
                  }}
                >
                  <button
                    role="tab"
                    id="character-tab"
                    tabIndex={tab === 'character' ? 0 : -1}
                    aria-selected={tab === 'character'}
                    aria-controls="character-controls"
                    onClick={() => {
                      setTab('character');
                    }}
                  >
                    <Smile size={14} />
                    Character
                  </button>
                  <button
                    role="tab"
                    id="placement-tab"
                    tabIndex={tab === 'scene' ? 0 : -1}
                    aria-selected={tab === 'scene'}
                    aria-controls="character-controls"
                    onClick={() => {
                      setTab('scene');
                    }}
                  >
                    <Monitor size={14} />
                    Placement
                  </button>
                </div>
                <fieldset
                  disabled={!connected}
                  className="character-controls"
                  id="character-controls"
                  role="tabpanel"
                  aria-labelledby={tab === 'character' ? 'character-tab' : 'placement-tab'}
                >
                  {tab === 'character' ? (
                    <>
                      <div className="control-column">
                        <label className="field">
                          Companion name
                          <input
                            name="companion-name"
                            autoComplete="off"
                            spellCheck={false}
                            aria-label="Companion name"
                            value={c.name}
                            maxLength={24}
                            onChange={(event) => {
                              if (event.target.value.trim()) patch({ name: event.target.value });
                            }}
                          />
                        </label>
                        <label className="field">
                          Hair color
                          <select
                            name="rive-hair"
                            value={c.riveHair}
                            onChange={(event) => {
                              patch({ riveHair: event.target.value as Config['riveHair'] });
                            }}
                          >
                            <option value="Pink">Pink</option>
                            <option value="Orange">Blonde</option>
                            <option value="Brown">Brown</option>
                          </select>
                        </label>
                      </div>
                      <div className="control-column">
                        <label className="field">
                          Outfit color
                          <select
                            name="rive-outfit"
                            value={c.riveOutfit}
                            onChange={(event) => {
                              patch({ riveOutfit: event.target.value as Config['riveOutfit'] });
                            }}
                          >
                            <option value="green">Green</option>
                            <option value="black">Black</option>
                            <option value="light green">Light green</option>
                          </select>
                        </label>
                        <label className="field">
                          Glasses color
                          <select
                            name="rive-glasses"
                            value={c.riveGlasses}
                            onChange={(event) => {
                              patch({ riveGlasses: event.target.value as Config['riveGlasses'] });
                            }}
                          >
                            <option value="blue">Blue</option>
                            <option value="white">White</option>
                            <option value="grey">Grey</option>
                          </select>
                        </label>
                        <p className="field">
                          This character has one hairstyle and built-in glasses. More looks will
                          need new character artwork.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="control-column">
                        <label className="field">
                          Favorite perch
                          <select
                            name="perch"
                            value={c.anchor}
                            onChange={(event) => {
                              anchor(event.target.value as Config['anchor']);
                            }}
                          >
                            <option value="webcam">Webcam panel</option>
                            <option value="chat">Chat panel</option>
                            <option value="corner">Bottom corner</option>
                          </select>
                        </label>
                        <label className="field">
                          Horizontal position <output>{Math.round(c.x * 100)}%</output>
                          <input
                            aria-label="Horizontal position"
                            type="range"
                            min="8"
                            max="92"
                            value={c.x * 100}
                            onChange={(event) => {
                              patch({ x: Number(event.target.value) / 100 });
                            }}
                          />
                        </label>
                        <label className="field">
                          Vertical position <output>{Math.round(c.y * 100)}%</output>
                          <input
                            aria-label="Vertical position"
                            type="range"
                            min="35"
                            max="95"
                            value={c.y * 100}
                            onChange={(event) => {
                              patch({ y: Number(event.target.value) / 100 });
                            }}
                          />
                        </label>
                      </div>
                      <div className="placement-mini" aria-label="Overlay placement preview">
                        <span>OBS canvas</span>
                        <div className="mini-webcam" />
                        <div className="mini-chat" />
                        <span
                          className="mini-avatar"
                          style={{ left: `${String(c.x * 100)}%`, top: `${String(c.y * 100)}%` }}
                        >
                          <Sparkles size={20} />
                        </span>
                        <p>Studio stays centered. Placement updates your stream.</p>
                      </div>
                    </>
                  )}
                </fieldset>
              </section>
              <section className="tool-section" id="personality">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      <Heart size={14} /> A mind of their own
                    </span>
                    <h2>Set the energy.</h2>
                    <p>How they show up is just as personal as how they look.</p>
                  </div>
                </div>
                <fieldset disabled={!connected}>
                  <div className="personality-options">
                    {(['cozy', 'playful', 'shy'] as const).map((personality) => (
                      <button
                        key={personality}
                        aria-pressed={c.personality === personality}
                        onClick={() => {
                          patch({ personality });
                        }}
                      >
                        {personalities[personality].icon}
                        <strong>{personality}</strong>
                        <span>{personalities[personality].description}</span>
                        {c.personality === personality ? (
                          <Check className="personality-check" size={15} />
                        ) : null}
                      </button>
                    ))}
                  </div>
                  <label className="field">
                    Attitude
                    <select
                      value={c.attitude}
                      onChange={(event) => {
                        patch({ attitude: event.target.value as Config['attitude'] });
                      }}
                    >
                      <option value="gentle">Gentle</option>
                      <option value="cheeky">Cheeky</option>
                      <option value="spicy">Spicy</option>
                    </select>
                  </label>
                  <div className="range-row">
                    <label className="field">
                      Energy <output>{c.energy}%</output>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={c.energy}
                        onChange={(event) => {
                          patch({ energy: Number(event.target.value) });
                        }}
                      />
                    </label>
                    <label className="field">
                      Chat engagement <output>{c.chatEngagement}%</output>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={c.chatEngagement}
                        onChange={(event) => {
                          patch({ chatEngagement: Number(event.target.value) });
                        }}
                      />
                    </label>
                  </div>
                </fieldset>
                <p className="helper-note">
                  <Shield size={14} />
                  Streamer first. Zero chat engagement disables reactions; higher values shorten the
                  cooldown.
                </p>
              </section>
              <section className="tool-section" id="connections">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      <Radio size={14} /> Stay in the loop
                    </span>
                    <h2>A little closer to chat.</h2>
                    <p>Let your companion keep an ear on the room.</p>
                  </div>
                </div>
                <TwitchPanel serviceConnected={connected} />
              </section>
              <section className="tool-section" id="playground">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      <FlaskConical size={14} /> Try a moment
                    </span>
                    <h2>See their personality happen.</h2>
                    <p>Same words. A different little reaction.</p>
                  </div>
                  <span className="demo-badge">Simulated input</span>
                </div>
                <form
                  className="playground-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (text.trim()) send({ type: 'simulate', source, text });
                  }}
                >
                  <label className="field">
                    Demo input
                    <select
                      value={source}
                      onChange={(event) => {
                        setSource(event.target.value as typeof source);
                      }}
                    >
                      <option value="streamer">Streamer says...</option>
                      <option value="chat">Chat says...</option>
                    </select>
                  </label>
                  <label className="field message-field">
                    Message
                    <textarea
                      name="simulated-message"
                      autoComplete="off"
                      aria-label="Simulated message"
                      value={text}
                      maxLength={280}
                      rows={2}
                      onChange={(event) => {
                        setText(event.target.value);
                      }}
                    />
                  </label>
                  <button className="primary-button" disabled={!connected || !text.trim()}>
                    <Zap size={15} />
                    Try reaction
                  </button>
                </form>
                <p className="reaction-note" role="status">
                  {state.action.note}
                </p>
                <p className="helper-note">
                  <Eye size={14} />
                  This playground is simulated. Twitch can be live; microphone and AI are not
                  connected yet.
                </p>
              </section>
              <section className="tool-section" id="setup">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      <Monitor size={14} /> Take them with you
                    </span>
                    <h2>A home in your stream.</h2>
                    <p>Add a Browser Source in OBS at 1280 x 720.</p>
                  </div>
                </div>
                <div className="overlay-url">
                  <code>{overlayURL}</code>
                  <button onClick={() => void copy()} aria-label="Copy overlay URL">
                    {copied ? <Check size={17} /> : <Copy size={17} />}
                  </button>
                </div>
                <a className="overlay-link" href="/overlay" target="_blank" rel="noreferrer">
                  Open transparent overlay
                  <ArrowUpRight size={14} />
                </a>
                <p className="helper-note">
                  <Layers size={14} />
                  Keep Tavi running while streaming. The stage lighting is studio-only.
                </p>
              </section>
              <footer className="tools-footer">
                <Sparkles size={13} />
                <span>Made for your stream. At your pace.</span>
                <span>Twitch x Codex</span>
              </footer>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
