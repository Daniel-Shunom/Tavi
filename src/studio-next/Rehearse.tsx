import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Send, X } from 'lucide-react';
import { supportedSequences } from '../../shared/capabilities';
import {
  channelInfo,
  channels,
  expressionIds,
  expressions,
  sequences,
} from '../../shared/expressions';
import { catalog } from '../renderer/characters/registry';
import { streamPreviews } from '../studio/LiveView';
import type { StudioProps } from '../studio/types';
import { Segmented, useLayer } from './ui';

// Rehearse: every way to try her out, in one drawer beside the stage. It does not dim or block
// the stage, because the point is to watch her react. Everything here is a preview: stream
// events and test chat are labelled as tests and never reach a real chat.

export function Rehearse({
  open,
  onOpenChange,
  state,
  connected,
  send,
}: StudioProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const layer = useLayer();
  const c = state.config;
  const character = catalog[c.character];
  const [hypeLevel, setHypeLevel] = useState(0);
  const [source, setSource] = useState<'streamer' | 'chat'>('streamer');
  const [text, setText] = useState(`${c.name}, that was a close one!`);
  // Her answer shows once something has been sent from here, not an older, unrelated note.
  const [sent, setSent] = useState(false);
  const blocked = !connected || state.retracted;
  const affect = state.performance.affect;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false} disablePointerDismissal>
      <Dialog.Portal container={layer}>
        <Dialog.Popup className="sn-drawer">
          <div className="sn-drawer-head">
            <Dialog.Title className="sn-serif">Rehearse</Dialog.Title>
            <Dialog.Close className="sn-icon-btn" aria-label="Close Rehearse">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sn-hint">
            Previews, never real events, and never shown as live. She reacts by her rules, not AI.
          </Dialog.Description>

          <section className="sn-group" aria-labelledby="rehearse-events">
            <h3 className="sn-label" id="rehearse-events">
              Try a stream event
            </h3>
            <div className="sn-chips">
              {streamPreviews.map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  className="sn-chip"
                  disabled={blocked}
                  title={entry.title}
                  onClick={() => {
                    if (typeof entry.event === 'function') {
                      send({ type: 'preview-stream-event', event: entry.event(hypeLevel) });
                      setHypeLevel(hypeLevel >= 4 ? 0 : hypeLevel + 1);
                    } else send({ type: 'preview-stream-event', event: entry.event });
                  }}
                >
                  {entry.label === 'Hype train' && hypeLevel > 0
                    ? hypeLevel >= 4
                      ? 'End hype train'
                      : `Hype level ${String(hypeLevel + 1)}`
                    : entry.label}
                </button>
              ))}
            </div>
          </section>

          <section className="sn-group" aria-labelledby="rehearse-say">
            <h3 className="sn-label" id="rehearse-say">
              Say something to her
            </h3>
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
              className="sn-say"
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
                aria-label="What to say"
                value={text}
                maxLength={280}
                rows={2}
                onChange={(event) => {
                  setText(event.target.value);
                }}
              />
              <button className="sn-btn sn-btn-primary" disabled={!connected || !text.trim()}>
                <Send size={16} aria-hidden="true" />
                {source === 'streamer' ? 'Say it' : 'Send test chat'}
              </button>
            </form>
            <p className="sn-answer" role="status">
              {sent && state.performance.note
                ? state.performance.note
                : `Send something and ${c.name}'s reaction shows here.`}
            </p>
            <p className="sn-hint">The microphone is not connected yet.</p>
          </section>

          {affect ? (
            <section className="sn-group" aria-labelledby="rehearse-feels">
              <h3 className="sn-label" id="rehearse-feels">
                How she feels: {affect.label}
              </h3>
              <dl className="st-mood">
                {(
                  [
                    ['Joy', affect.pleasure, true],
                    ['Energy', affect.arousal, true],
                    ['Boldness', affect.dominance, true],
                    ['Tired', affect.fatigue, false],
                    ['Bored', affect.boredom, false],
                    ['Overwhelmed', affect.overload, false],
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
              <p className="sn-hint">Mood only shades her timing and motion.</p>
            </section>
          ) : null}

          <section className="sn-group" aria-labelledby="rehearse-all">
            <h3 className="sn-label" id="rehearse-all">
              Every expression she knows
            </h3>
            <fieldset disabled={blocked} className="st-gallery">
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
                                send({ type: 'perform', expression: id });
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
                        send({ type: 'perform', sequence: id });
                      }}
                    >
                      {sequences[id].label}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>
          </section>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
