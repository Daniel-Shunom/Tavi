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
  Square,
  Brain,
  Shirt,
  Sun,
  VolumeX,
  Wifi,
  WifiOff,
  Zap,
  CircleAlert,
  UserRound,
  MessageCircle,
} from 'lucide-react';
import { TwitchPanel } from './TwitchPanel';
import { AiPanel } from './AiPanel';
import { EventReactionsPanel } from './EventReactionsPanel';
import { WardrobePanel } from './WardrobePanel';
import { CharacterCreator } from './CharacterCreator';
import { BodyStateDock, SceneEditor } from './StatesPanel';
import { Avatar } from './renderer/Avatar';
import { catalog, characters } from './renderer/characters/registry';
import type { useConnection } from './useConnection';
import type { Config } from '../shared/protocol';
import { supportedSequences, type CharacterCapabilities } from '../shared/capabilities';
import { isScriptActive } from '../shared/cue';
import {
  channelInfo,
  channels,
  expressionIds,
  expressions,
  sequences,
  type ExpressionId,
  type SequenceId,
  type Target,
} from '../shared/expressions';
import { anchors, movementStyles, type AnchorId } from '../shared/locomotion';
import { anchorPoint } from '../shared/attention';
import { choreographies, choreographyIds } from '../shared/presence';
type Cue = { expression: ExpressionId } | { sequence: SequenceId };
/** The six core reactions plus a greeting and peek, offered when the character supports them. */
const coreCues: { cue: Cue; label: string; icon: ReactNode; target?: Target }[] = [
  { cue: { sequence: 'greeting' }, label: 'wave', icon: <Hand /> },
  { cue: { expression: 'listening' }, label: 'listen', icon: <Eye />, target: 'streamer' },
  // Looks at the real chat panel from the scene layout (shared/attention.ts).
  { cue: { expression: 'glance' }, label: 'chat', icon: <MessageCircle />, target: 'chat' },
  { cue: { sequence: 'doubt-then-nod' }, label: 'really?', icon: <CircleAlert /> },
  { cue: { sequence: 'caught-innocent' }, label: 'oops', icon: <Cloud /> },
  { cue: { sequence: 'restrained-approval' }, label: 'nice', icon: <Check /> },
  { cue: { sequence: 'big-win' }, label: 'celebrate', icon: <Sparkles /> },
  { cue: { expression: 'peek' }, label: 'peek', icon: <Smile /> },
];
function supports(character: CharacterCapabilities | undefined, cue: Cue) {
  if (!character) return false;
  return 'sequence' in cue
    ? supportedSequences(character).includes(cue.sequence)
    : character.expressions.includes(cue.expression);
}
const personalities = {
  cozy: { icon: <Coffee />, description: 'Warm, calm, quietly present.' },
  playful: { icon: <Sparkles />, description: 'A little cheek. A lot of character.' },
  shy: { icon: <Cloud />, description: 'Gentle, observant, taking it all in.' },
};
const sections = [
  { id: 'appearance', name: 'Make it yours', icon: <Palette /> },
  { id: 'creator', name: 'Character', icon: <UserRound /> },
  { id: 'wardrobe', name: 'Wardrobe', icon: <Shirt /> },
  { id: 'personality', name: 'Personality', icon: <Heart /> },
  { id: 'expressions', name: 'Expressions', icon: <Smile /> },
  { id: 'brain', name: 'Brain', icon: <Brain /> },
  { id: 'connections', name: 'Twitch', icon: <Radio /> },
  { id: 'playground', name: 'Playground', icon: <FlaskConical /> },
  { id: 'setup', name: 'Stream setup', icon: <Monitor /> },
] as const;
export function Studio({
  state,
  connected,
  error,
  send,
  serverNow,
}: ReturnType<typeof useConnection>) {
  const c = state.config;
  const scenePosition = state.performance.body?.spot?.approach ??
    state.performance.movement?.to ?? { x: c.x, y: c.y };
  const character = catalog[c.character];
  const script = state.performance.script;
  useEffect(() => {
    // Escape stops the current performance, as a streamer-first control.
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && connected) send({ type: 'cancel' });
    }
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
    };
  }, [connected, send]);
  const perform = (cue: Cue, target?: Target) => {
    send({ type: 'perform', ...cue, ...(target ? { target } : {}) });
  };
  const [tab, setTab] = useState<'character' | 'scene'>('character');
  const [lighting, setLighting] = useState<'moonlight' | 'daydream' | 'afterhours'>('moonlight');
  const [spacious, setSpacious] = useState(false);
  const [active, setActive] = useState('appearance');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [text, setText] = useState('Tavi, that was a close one!');
  const [source, setSource] = useState<'streamer' | 'chat'>('streamer');
  const [, setTick] = useState(0);
  useEffect(() => {
    // Re-render once a second so the "currently performing" line clears when a cue finishes.
    const timer = setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  const performing = isScriptActive(script, serverNow()) ? script : null;
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
  function anchor(value: AnchorId) {
    const point = anchorPoint(value, c.scene);
    patch({ anchor: value, x: point.x, y: point.y });
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
            <Avatar state={state} serverNow={serverNow} presentation="portrait" />
            <button
              className="avatar-touch-target"
              aria-label={`Wave to ${c.name}`}
              title="Say hello"
              disabled={!connected || state.retracted}
              onClick={() => {
                perform(
                  supports(character, { sequence: 'greeting' })
                    ? { sequence: 'greeting' }
                    : { expression: 'wave' },
                );
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
                : performing
                  ? `${performing.decidedBy.label}: ${performing.beats.map((value) => expressions[value.expression].label.toLowerCase()).join(', ')}`
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
              <select
                className="presence-style"
                aria-label="Entrance and exit style"
                title="Entrance and exit style"
                value={c.presenceStyle}
                disabled={!connected}
                onChange={(event) => {
                  const value = event.target.value;
                  patch({
                    presenceStyle: choreographyIds.find((id) => id === value) ?? 'random',
                  });
                }}
              >
                <option value="random">Surprise me</option>
                {choreographyIds.map((id) => (
                  <option key={id} value={id}>
                    {choreographies[id].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <BodyStateDock state={state} send={send} connected={connected} position={scenePosition} />
          <div className="gesture-dock" role="group" aria-label="Try an expression">
            {coreCues
              .filter((entry) => supports(character, entry.cue))
              .map((entry) => (
                <button
                  key={entry.label}
                  disabled={!connected || state.retracted}
                  title={
                    'sequence' in entry.cue
                      ? sequences[entry.cue.sequence].meaning
                      : expressions[entry.cue.expression].meaning
                  }
                  onClick={() => {
                    perform(entry.cue, entry.target);
                  }}
                >
                  {entry.icon}
                  <span>{entry.label}</span>
                </button>
              ))}
            <button
              disabled={!connected || !performing}
              title="Stop the current performance (Esc)"
              onClick={() => {
                send({ type: 'cancel' });
              }}
            >
              <Square />
              <span>stop</span>
            </button>
          </div>
          <div className="stage-footnote">
            <span>
              Live character preview <span className="preview-dot" />{' '}
              <a href={character?.creditUrl ?? '#'} target="_blank" rel="noreferrer">
                {character?.credit ?? 'Character'}
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
                        {characters.size > 1 ? (
                          <label className="field">
                            Character
                            <select
                              name="character"
                              value={c.character}
                              onChange={(event) => {
                                patch({ character: event.target.value });
                              }}
                            >
                              {[...characters.values()].map((entry) => (
                                <option key={entry.id} value={entry.id}>
                                  {entry.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                      </div>
                      <div className="control-column">
                        {Object.entries(character?.appearance ?? {}).map(([slot, definition]) => (
                          <label className="field" key={slot}>
                            {definition.label}
                            <select
                              name={'appearance-' + slot}
                              value={c.appearance[slot] ?? definition.default}
                              onChange={(event) => {
                                patch({ appearance: { [slot]: event.target.value } });
                              }}
                            >
                              {definition.options.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                        <p className="field">
                          Options come from the character&apos;s artwork. More looks need new
                          character artwork.
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
                              const value = event.target.value;
                              const found = (Object.keys(anchors) as AnchorId[]).find(
                                (id) => id === value,
                              );
                              if (found) anchor(found);
                            }}
                          >
                            {(Object.keys(anchors) as AnchorId[]).map((id) => (
                              <option key={id} value={id}>
                                {anchors[id].label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          How it moves
                          <select
                            name="movement-style"
                            value={c.movementStyle}
                            onChange={(event) => {
                              const value = event.target.value;
                              patch({
                                movementStyle: movementStyles.find((id) => id === value) ?? 'auto',
                              });
                            }}
                          >
                            {movementStyles.map((id) => (
                              <option key={id} value={id}>
                                {id === 'auto'
                                  ? 'Auto (by mood and reason)'
                                  : id.charAt(0).toUpperCase() + id.slice(1)}
                              </option>
                            ))}
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
                      <SceneEditor
                        config={c}
                        send={send}
                        connected={connected}
                        body={state.performance.body}
                        position={scenePosition}
                      />
                    </>
                  )}
                </fieldset>
              </section>
              <section className="tool-section" id="creator">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      <UserRound size={14} /> Character
                    </span>
                    <h2>Make them look like you, or not.</h2>
                    <p>Skin, face, build, hair and features are separate choices. Mix freely.</p>
                  </div>
                </div>
                <CharacterCreator
                  characterId={c.character}
                  variant={c.variant}
                  disabled={!connected}
                  onChange={(variant) => {
                    patch({ variant });
                  }}
                  onUseCharacter={(character) => {
                    patch({ character });
                  }}
                />
              </section>
              <section className="tool-section" id="wardrobe">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      <Shirt size={14} /> Wardrobe
                    </span>
                    <h2>Dress them up.</h2>
                    <p>One item per slot. Colours apply when you let go of the picker.</p>
                  </div>
                </div>
                <WardrobePanel
                  characterId={c.character}
                  wardrobe={c.wardrobe}
                  disabled={!connected}
                  onChange={(wardrobe) => {
                    patch({ wardrobe });
                  }}
                />
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
                    Initiative
                    <select
                      value={c.initiative}
                      onChange={(event) => {
                        patch({ initiative: event.target.value as Config['initiative'] });
                      }}
                    >
                      <option value="reserved">Reserved</option>
                      <option value="occasional">Occasional</option>
                      <option value="outgoing">Outgoing</option>
                    </select>
                  </label>
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
              <section className="tool-section" id="expressions">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      <Smile size={14} /> Expression library
                    </span>
                    <h2>Everything they can show.</h2>
                    <p>Only what {character?.name ?? 'this character'} can perform is enabled.</p>
                  </div>
                </div>
                <fieldset disabled={!connected || state.retracted} className="expression-gallery">
                  {channels
                    .filter((channel) => channel !== 'idle')
                    .map((channel) => (
                      <div key={channel} className="expression-group">
                        <h3 title={channelInfo[channel].meaning}>{channelInfo[channel].label}</h3>
                        <div>
                          {expressionIds
                            .filter(
                              (id) =>
                                expressions[id].channel === channel && expressions[id].selectable,
                            )
                            .map((id) => {
                              const supported = character?.expressions.includes(id) ?? false;
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  disabled={!supported}
                                  title={
                                    supported
                                      ? expressions[id].meaning
                                      : `${expressions[id].meaning} (not supported by this character)`
                                  }
                                  onClick={() => {
                                    perform({ expression: id });
                                  }}
                                >
                                  {expressions[id].label}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  <div className="expression-group">
                    <h3>Sequences</h3>
                    <div>
                      {(character ? supportedSequences(character) : []).map((id) => (
                        <button
                          key={id}
                          type="button"
                          title={`${sequences[id].meaning} ${sequences[id].useWhen}`}
                          onClick={() => {
                            perform({ sequence: id });
                          }}
                        >
                          {sequences[id].label}
                        </button>
                      ))}
                    </div>
                  </div>
                </fieldset>
                {!c.scene.chat.enabled ? (
                  <p className="helper-note">
                    No chat panel is placed, so {c.name} looks to the right for chat. Place it in
                    the scene editor so glances and pointing aim at your real chat.
                  </p>
                ) : null}
                <div className="range-row">
                  <label className="field checkbox-field">
                    <input
                      type="checkbox"
                      checked={c.captions.studio}
                      disabled={!connected}
                      onChange={(event) => {
                        patch({ captions: { ...c.captions, studio: event.target.checked } });
                      }}
                    />
                    Show captions in the studio
                  </label>
                  <label className="field checkbox-field">
                    <input
                      type="checkbox"
                      checked={c.captions.overlay}
                      disabled={!connected}
                      onChange={(event) => {
                        patch({ captions: { ...c.captions, overlay: event.target.checked } });
                      }}
                    />
                    Show captions on stream
                  </label>
                </div>
              </section>
              <section className="tool-section" id="brain">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      <Brain size={14} /> Who decides
                    </span>
                    <h2>Pick their brain.</h2>
                    <p>
                      Built-in rules, or any OpenAI-compatible or Anthropic model you configure.
                    </p>
                  </div>
                </div>
                <AiPanel serviceConnected={connected} />
                <p className="helper-note">
                  <Shield size={14} />
                  API keys are read by the local service from its environment and never reach the
                  studio or the overlay. Chat text is treated as untrusted input.
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
                    <h2>Talk to them.</h2>
                    <p>Say something and watch the reaction. Same words, different personality.</p>
                  </div>
                  {source === 'chat' ? <span className="demo-badge">Simulated chat</span> : null}
                </div>
                <form
                  className="playground-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!text.trim()) return;
                    if (source === 'streamer') send({ type: 'say', text });
                    else send({ type: 'simulate', source: 'chat', text });
                  }}
                >
                  <label className="field">
                    Who is talking
                    <select
                      value={source}
                      onChange={(event) => {
                        setSource(event.target.value as typeof source);
                      }}
                    >
                      <option value="streamer">I say... (to {c.name})</option>
                      <option value="chat">Simulated chat says...</option>
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
                    {source === 'streamer' ? 'Say it' : 'Send test chat'}
                  </button>
                </form>
                <p className="reaction-note" role="status">
                  {state.performance.note}
                </p>
                <p className="helper-note">
                  <Eye size={14} />
                  Typed lines go through the decision provider shown in Brain. Simulated chat is
                  labelled as a test. The microphone is not connected yet.
                </p>
                <EventReactionsPanel config={c} connected={connected} send={send} />
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
