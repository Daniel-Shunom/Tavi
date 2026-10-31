import { useState } from 'react';
import { Check, Cloud, Coffee, Send, Sparkles } from 'lucide-react';
import { AiPanel } from '../AiPanel';
import { EventReactionsPanel } from '../EventReactionsPanel';
import type { Config } from '../../shared/protocol';
import type { StudioProps } from './types';
import { Card, Segmented, natures } from './parts';

// Personality: who she is (her nature, energy and humour), how much she notices chat, a place to
// try her out, and what decides her reactions. Everything here is a bounded rule unless the
// streamer connects an AI model in "What decides her reactions".

const natureIcons = { cozy: <Coffee />, playful: <Sparkles />, shy: <Cloud /> };

function Slider({
  label,
  value,
  low,
  high,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  low: string;
  high: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="st-slider">
      <span className="st-sr">{label}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
      />
      <span className="st-slider-ends" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </span>
    </label>
  );
}

const word = (value: number, words: readonly string[]) =>
  words[Math.min(words.length - 1, Math.floor((value / 101) * words.length))] ?? '';

export function PersonalityView({ state, connected, send }: StudioProps) {
  const c = state.config;
  const patch = (value: Partial<Config>) => {
    send({ type: 'configure', patch: value });
  };
  const [text, setText] = useState(`${c.name}, that was a close one!`);
  const [source, setSource] = useState<'streamer' | 'chat'>('streamer');
  // Her answer shows once something has been sent from here, not an older, unrelated note.
  const [sent, setSent] = useState(false);

  return (
    <div className="st-stack">
      <section aria-labelledby="nature-title" className="st-block">
        <h2 id="nature-title" className="st-block-title">
          Her nature
        </h2>
        <div className="st-natures" role="radiogroup" aria-labelledby="nature-title">
          {(['cozy', 'playful', 'shy'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={c.personality === id}
              className="st-nature"
              disabled={!connected}
              onClick={() => {
                patch({ personality: id });
              }}
            >
              <span className="st-nature-icon" aria-hidden="true">
                {natureIcons[id]}
              </span>
              <span>
                <b>{natures[id].label}</b>
                <span>{natures[id].line}</span>
              </span>
              {c.personality === id ? (
                <Check className="st-nature-check" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <div className="st-cols">
        <div className="st-col-main st-stack">
          <Card
            title="Try her out"
            aside={source === 'chat' ? <span className="st-tag">Test chat</span> : null}
          >
            <Segmented
              label="Who is talking"
              options={[
                { id: 'streamer', label: `You, to ${c.name}` },
                { id: 'chat', label: 'Pretend chat' },
              ]}
              value={source}
              onPick={setSource}
            />
            <form
              className="st-try"
              onSubmit={(event) => {
                event.preventDefault();
                if (!text.trim()) return;
                setSent(true);
                if (source === 'streamer') send({ type: 'say', text });
                else send({ type: 'simulate', source: 'chat', text });
              }}
            >
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
              <button className="st-button st-primary" disabled={!connected || !text.trim()}>
                <Send size={16} />
                {source === 'streamer' ? 'Say it' : 'Send test chat'}
              </button>
            </form>
            <p className="st-answer" role="status">
              {sent && state.performance.note
                ? state.performance.note
                : `Send something and ${c.name}'s reaction shows here.`}
            </p>
            <p className="st-note">
              Test chat is labelled as a test and never reaches your real chat. The microphone is
              not connected yet.
            </p>
          </Card>

          <Card className="st-support" label="Donations and subs">
            <EventReactionsPanel config={c} connected={connected} send={send} />
          </Card>
        </div>

        <aside className="st-col-side st-stack">
          <Card
            title="Energy"
            aside={
              <span className="st-value">
                {word(c.energy, ['Very calm', 'Calm', 'Easygoing', 'Lively', 'Very lively'])}
              </span>
            }
          >
            <Slider
              label="Energy"
              value={c.energy}
              low="Calm"
              high="Lively"
              disabled={!connected}
              onChange={(energy) => {
                patch({ energy });
              }}
            />
            <span className="st-label">How often she starts things</span>
            <Segmented
              label="How often she starts things"
              options={[
                { id: 'reserved', label: 'Rarely' },
                { id: 'occasional', label: 'Sometimes' },
                { id: 'outgoing', label: 'Often' },
              ]}
              value={c.initiative}
              disabled={!connected}
              onPick={(initiative) => {
                patch({ initiative });
              }}
            />
            <span className="st-label">Her humour</span>
            <Segmented
              label="Her humour"
              options={[
                { id: 'gentle', label: 'Gentle' },
                { id: 'cheeky', label: 'Cheeky' },
                { id: 'spicy', label: 'Spicy' },
              ]}
              value={c.attitude}
              disabled={!connected}
              onPick={(attitude) => {
                patch({ attitude });
              }}
            />
          </Card>

          <Card
            title="Chat"
            aside={
              <span className="st-value">
                {c.chatEngagement === 0
                  ? 'Ignores chat'
                  : word(c.chatEngagement, ['Barely', 'A little', 'Often', 'Very often'])}
              </span>
            }
          >
            <Slider
              label="How much she notices chat"
              value={c.chatEngagement}
              low="Ignores"
              high="All ears"
              disabled={!connected}
              onChange={(chatEngagement) => {
                patch({ chatEngagement });
              }}
            />
            <p className="st-note">
              At zero she never reacts to chat. Higher means shorter waits between reactions. You
              always come first.
            </p>
          </Card>

          <Card title="What decides her reactions" className="st-brain">
            <AiPanel serviceConnected={connected} />
            <p className="st-note">
              Keys stay with the local service and never reach Studio or the overlay. Chat is
              treated as untrusted text.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
