import { useRef, useState, type PointerEvent } from 'react';
import {
  ChevronDown,
  Cookie,
  Gem,
  Gift,
  Move,
  Music,
  Pointer,
  Square,
  Star,
  TrainFront,
  UserPlus,
  Users,
} from 'lucide-react';
import type { StreamEventBody } from '../../shared/streamEvents';
import { Avatar } from '../renderer/Avatar';
import { BodyStateDock } from '../StatesPanel';
import { catalog } from '../renderer/characters/registry';
import { supportedSequences } from '../../shared/capabilities';
import {
  channelInfo,
  channels,
  expressionIds,
  expressions,
  sequences,
} from '../../shared/expressions';
import type { Config } from '../../shared/protocol';
import type { StudioProps } from './types';
import { Card, Segmented, SwitchRow, natures, quickCues, supports, type Cue } from './parts';

// Live: what Tavi is doing on stream right now. The preview is the overlay itself, over outlines
// of the streamer's layout (Setup › Match your stream layout); clicking or dragging on it sets her
// home spot. Reactions fire from the pad (or keys 1–8).

const frameLabels = { game: 'Game', webcam: 'Webcam', chat: 'Chat' };
// Stream-event previews: the same rules as live Twitch events, always labelled "not real".
const streamPreviews: {
  label: string;
  icon: React.ReactNode;
  title: string;
  event: StreamEventBody | ((level: number) => StreamEventBody);
}[] = [
  {
    label: 'Follow',
    icon: <UserPlus />,
    title: 'A new follower',
    event: { kind: 'follow', user: 'Preview viewer' },
  },
  {
    label: 'Raid',
    icon: <Users />,
    title: 'A 42-viewer raid',
    event: { kind: 'raid', from: 'Preview streamer', viewers: 42 },
  },
  {
    label: 'Sub',
    icon: <Star />,
    title: 'A tier 1 subscription',
    event: { kind: 'subscription', user: 'Preview viewer', tier: '1000', gifted: false },
  },
  {
    label: 'Gift ×5',
    icon: <Gift />,
    title: 'Five gifted subs',
    event: { kind: 'gift', user: 'Preview viewer', count: 5 },
  },
  {
    label: 'Cheer 500',
    icon: <Gem />,
    title: '500 bits',
    event: { kind: 'cheer', user: 'Preview viewer', bits: 500 },
  },
  {
    label: 'Hype train',
    icon: <TrainFront />,
    title: 'Starts a hype train, then each click is the next level; the fifth click ends it',
    event: (level) =>
      level === 0
        ? { kind: 'hype-train', phase: 'begin', level: 1 }
        : level >= 4
          ? { kind: 'hype-train', phase: 'end', level }
          : { kind: 'hype-train', phase: 'progress', level: level + 1 },
  },
  {
    label: 'Poke',
    icon: <Pointer />,
    title: 'Channel points: Poke Tavi',
    event: { kind: 'redemption', user: 'Preview viewer', reward: 'Poke Tavi', mischief: 'poke' },
  },
  {
    label: 'Dance',
    icon: <Music />,
    title: 'Channel points: Make Tavi dance',
    event: {
      kind: 'redemption',
      user: 'Preview viewer',
      reward: 'Make Tavi dance',
      mischief: 'dance',
    },
  },
  {
    label: 'Snack',
    icon: <Cookie />,
    title: 'Channel points: Feed Tavi a snack',
    event: {
      kind: 'redemption',
      user: 'Preview viewer',
      reward: 'Feed Tavi a snack',
      mischief: 'snack',
    },
  },
];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function LiveView({
  state,
  connected,
  send,
  serverNow,
  performing,
  statusLine,
}: StudioProps) {
  const c = state.config;
  const character = catalog[c.character];
  const patch = (value: Partial<Config>) => {
    send({ type: 'configure', patch: value });
  };
  const [hypeLevel, setHypeLevel] = useState(0);
  const previewStream = (entry: (typeof streamPreviews)[number]) => {
    if (typeof entry.event === 'function') {
      send({ type: 'preview-stream-event', event: entry.event(hypeLevel) });
      setHypeLevel(hypeLevel >= 4 ? 0 : hypeLevel + 1);
      return;
    }
    send({ type: 'preview-stream-event', event: entry.event });
  };
  const perform = (cue: Cue, target?: (typeof quickCues)[number]['target']) => {
    send({ type: 'perform', ...cue, ...(target ? { target } : {}) });
  };
  const scenePosition = state.performance.body?.spot?.approach ??
    state.performance.movement?.to ?? { x: c.x, y: c.y };
  const livePosition = useRef<{ x: number; y: number } | null>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [drop, setDrop] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  // Where on the stream a pointer is, in the overlay's terms (feet position, kept in bounds).
  const spot = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - box.left) / box.width, 0.08, 0.92),
      y: clamp((event.clientY - box.top) / box.height, 0.35, 0.95),
    };
  };
  const canMove = connected && !state.retracted;

  return (
    <div className="st-cols">
      <div className="st-col-main">
        <section className="st-screen-wrap" aria-label="Stream preview">
          <div
            className="st-screen"
            data-dragging={drop ? 'true' : undefined}
            onPointerDown={(event) => {
              if (!canMove || event.button !== 0) return;
              dragging.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              setDrop(spot(event));
            }}
            onPointerMove={(event) => {
              if (dragging.current) setDrop(spot(event));
            }}
            onPointerUp={(event) => {
              if (!dragging.current) return;
              dragging.current = false;
              const to = spot(event);
              setDrop(null);
              patch({ x: to.x, y: to.y });
            }}
            onPointerCancel={() => {
              dragging.current = false;
              setDrop(null);
            }}
          >
            <div className="st-screen-scene" aria-hidden="true">
              {(['game', 'webcam', 'chat'] as const).map((frame) => {
                const rect = c.scene[frame];
                return rect.enabled ? (
                  <span
                    key={frame}
                    className="st-screen-frame"
                    style={{
                      left: `${String(rect.x * 100)}%`,
                      top: `${String(rect.y * 100)}%`,
                      width: `${String(rect.w * 100)}%`,
                      height: `${String(rect.h * 100)}%`,
                    }}
                  >
                    {frameLabels[frame]}
                  </span>
                ) : null;
              })}
            </div>
            <Avatar
              state={state}
              serverNow={serverNow}
              captions={c.captions.overlay}
              onPosition={(point) => {
                livePosition.current = point;
                const element = ring.current;
                if (element) {
                  element.style.left = `${String(point.x * 100)}%`;
                  element.style.top = `${String(point.y * 100)}%`;
                }
              }}
            />
            <div className="st-screen-ring" ref={ring} aria-hidden="true" />
            {drop ? (
              <div
                className="st-screen-drop"
                style={{ left: `${String(drop.x * 100)}%`, top: `${String(drop.y * 100)}%` }}
                aria-hidden="true"
              />
            ) : null}
            <span className="st-screen-tag">What viewers see</span>
            <span className="st-screen-hint">
              <Move size={14} /> Click or drag to move her
            </span>
          </div>
          <p className="st-note">
            The outlines are your stream layout from Setup; on stream she sits over your real scene.
          </p>
        </section>

        <section className="st-block" aria-labelledby="reactions-title">
          <div className="st-block-head">
            <h2 id="reactions-title">Make her react</h2>
            <span className="st-hint">Keys 1–8 · Esc to stop</span>
          </div>
          <div className="st-pad" role="group" aria-label="Reactions">
            {quickCues.map((entry, i) => (
              <button
                key={entry.label}
                type="button"
                className="st-pad-key"
                disabled={!connected || state.retracted || !supports(character, entry.cue)}
                title={
                  'sequence' in entry.cue
                    ? sequences[entry.cue.sequence].meaning
                    : expressions[entry.cue.expression].meaning
                }
                onClick={() => {
                  perform(entry.cue, entry.target);
                }}
              >
                <kbd aria-hidden="true">{i + 1}</kbd>
                {entry.icon}
                <span>{entry.label}</span>
              </button>
            ))}
            <button
              type="button"
              className="st-pad-key st-pad-stop"
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

          <details className="st-more">
            <summary>
              Every expression she knows <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <fieldset disabled={!connected || state.retracted} className="st-gallery">
              {channels
                .filter((channel) => channel !== 'idle')
                .map((channel) => (
                  <div key={channel} className="st-gallery-group">
                    <h3 title={channelInfo[channel].meaning}>{channelInfo[channel].label}</h3>
                    <div>
                      {expressionIds
                        .filter(
                          (id) => expressions[id].channel === channel && expressions[id].selectable,
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
              <div className="st-gallery-group">
                <h3>Little stories</h3>
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
          </details>
        </section>

        <section className="st-block" aria-labelledby="stream-events-title">
          <div className="st-block-head">
            <h2 id="stream-events-title">Try a stream event</h2>
            <span className="st-hint">
              Previews, never real events · she reacts the way she feels
            </span>
          </div>
          <div className="st-pad" role="group" aria-label="Stream event previews">
            {streamPreviews.map((entry) => (
              <button
                key={entry.label}
                type="button"
                className="st-pad-key"
                disabled={!connected || state.retracted}
                title={entry.title}
                onClick={() => {
                  previewStream(entry);
                }}
              >
                {entry.icon}
                <span>
                  {entry.label === 'Hype train' && hypeLevel > 0
                    ? hypeLevel >= 4
                      ? 'End hype train'
                      : `Hype level ${String(hypeLevel + 1)}`
                    : entry.label}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <aside className="st-col-side" aria-label="Tavi right now">
        <Card label="Right now">
          <div className="st-now">
            <span className="st-now-dot" data-state={state.retracted ? 'away' : 'here'} />
            <div>
              <b>{statusLine}</b>
              <span>
                {performing
                  ? `${performing.decidedBy.label}: ${performing.beats
                      .map((beat) => expressions[beat.expression].label.toLowerCase())
                      .join(', ')}`
                  : state.retracted
                    ? 'Off screen until you bring her back'
                    : 'Ready when you are'}
              </span>
            </div>
          </div>
          <SwitchRow
            title="Quiet mode"
            detail="Fewer reactions, no big moves"
            checked={state.quiet}
            disabled={!connected}
            onChange={(value) => {
              send({ type: 'quiet', value });
            }}
          />
          <SwitchRow
            title="Tuck her away"
            detail="She slips off screen until you call her back"
            checked={state.retracted}
            disabled={!connected}
            onChange={(value) => {
              send({ type: 'retract', value });
            }}
          />
          <div className="st-field-block">
            <span className="st-label">Where she is</span>
            <BodyStateDock
              state={state}
              send={send}
              connected={connected}
              position={scenePosition}
              getPosition={() => livePosition.current ?? scenePosition}
            />
          </div>
        </Card>

        <Card title="Mood">
          <Segmented
            label="Mood"
            options={(['cozy', 'playful', 'shy'] as const).map((id) => ({
              id,
              label: natures[id].label,
            }))}
            value={c.personality}
            disabled={!connected}
            onPick={(personality) => {
              patch({ personality });
            }}
          />
          <p className="st-note">{natures[c.personality].line}</p>
        </Card>

        <Card title="Last reaction">
          <p className="st-last" role="status">
            {state.performance.note || 'Nothing yet. Try a reaction, or say hi in Personality.'}
          </p>
        </Card>

        {state.performance.affect && (
          <Card title="How she feels">
            <p className="st-last" role="status">
              {state.performance.affect.label}
            </p>
            <dl className="st-mood">
              {(
                [
                  ['Joy', state.performance.affect.pleasure, true],
                  ['Energy', state.performance.affect.arousal, true],
                  ['Boldness', state.performance.affect.dominance, true],
                  ['Tired', state.performance.affect.fatigue, false],
                  ['Bored', state.performance.affect.boredom, false],
                  ['Overwhelmed', state.performance.affect.overload, false],
                ] as const
              ).map(([label, value, signed]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    <meter
                      min={signed ? -1 : 0}
                      max={1}
                      value={value}
                      aria-label={`${label} ${value.toFixed(2)}`}
                    />
                  </dd>
                </div>
              ))}
            </dl>
            <p className="st-note">Rules, not AI. Mood only shades timing and motion.</p>
          </Card>
        )}
      </aside>
    </div>
  );
}
