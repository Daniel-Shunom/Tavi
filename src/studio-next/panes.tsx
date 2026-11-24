import { useEffect, useRef, useState, type RefObject } from 'react';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Tabs } from '@base-ui/react/tabs';
import { Cloud, Coffee, FlaskConical, RotateCcw, Shuffle, Sparkles, Undo2 } from 'lucide-react';
import { BodyStateDock } from '../StatesPanel';
import {
  CharacterCreator,
  isOriginal,
  originalVariant,
  randomVariant,
  type CreatorPart,
} from '../CharacterCreator';
import { EventReactionsPanel } from '../EventReactionsPanel';
import { WardrobePanel } from '../WardrobePanel';
import { catalog, defaultCharacterId, studioCharacterIds } from '../renderer/characters/registry';
import { variantRigs } from '../renderer/characters/variantRigs';
import { expressions } from '../../shared/expressions';
import type { Config } from '../../shared/protocol';
import { natures } from '../studio/parts';
import type { StudioProps } from '../studio/types';
import { HolidayCard, type Holiday } from './holiday/HolidayCard';
import { spoken } from './model';
import { Dial, Segmented, ToggleRow } from './ui';

// The three panels beside the stage. Only one shows at a time; the stage and the reaction keys
// never leave.

/** Live: what she is doing, and the switches a streamer reaches for mid-stream. */
export function LivePane({
  state,
  connected,
  send,
  performing,
  statusLine,
  livePosition,
  onRehearse,
  holiday,
}: StudioProps & {
  livePosition: RefObject<{ x: number; y: number } | null>;
  onRehearse: () => void;
  holiday?: Holiday;
}) {
  const c = state.config;
  const scenePosition = state.performance.body?.spot?.approach ??
    state.performance.movement?.to ?? { x: c.x, y: c.y };
  return (
    <div className="sn-pane">
      <div className="sn-now">
        <i className="sn-dot" data-state={!connected || state.retracted ? 'away' : 'here'} />
        <div>
          <b className="sn-now-line">{statusLine}</b>
          <span>
            {performing
              ? `${performing.decidedBy.label}: ${performing.beats
                  .map((beat) => expressions[beat.expression].label.toLowerCase())
                  .join(', ')}`
              : state.retracted
                ? 'Off screen until you call her back'
                : 'Doing her own thing'}
          </span>
        </div>
      </div>
      <p className="sn-last" role="status" title={state.performance.note}>
        <span className="sn-label">Last reaction</span>
        <span className="sn-last-text">{state.performance.note || 'Nothing yet.'}</span>
      </p>
      <div>
        <ToggleRow
          title="Quiet mode"
          detail="Fewer reactions, no big moves"
          checked={state.quiet}
          disabled={!connected}
          onChange={(value) => {
            send({ type: 'quiet', value });
          }}
        />
        <ToggleRow
          title="Give her a break"
          detail="Off screen until you call her back"
          checked={state.retracted}
          disabled={!connected}
          onChange={(value) => {
            send({ type: 'retract', value });
          }}
        />
      </div>
      <div className="sn-group">
        <span className="sn-label">Where she is</span>
        <BodyStateDock
          state={state}
          send={send}
          connected={connected}
          position={scenePosition}
          getPosition={() => livePosition.current ?? scenePosition}
        />
      </div>
      {holiday ? <HolidayCard holiday={holiday} /> : null}
      <div className="sn-group sn-divide">
        <button type="button" className="sn-btn sn-wide" onClick={onRehearse}>
          <FlaskConical size={16} aria-hidden="true" /> Rehearse
        </button>
        <p className="sn-hint">
          Stream events, test chat and every expression she knows, in one place.
        </p>
      </div>
    </div>
  );
}

type Part = CreatorPart | 'outfit';
const parts: { id: Part; label: string }[] = [
  { id: 'body', label: 'Body' },
  { id: 'hair', label: 'Hair' },
  { id: 'face', label: 'Face' },
  { id: 'details', label: 'Details' },
  { id: 'outfit', label: 'Outfit' },
];

/** Look: her name, then one part of her at a time. Every change is saved and shows on stream. */
export function LookPane({ state, connected, send }: StudioProps) {
  const c = state.config;
  const character = catalog[c.character];
  const isCoreModel = (studioCharacterIds as readonly string[]).includes(c.character);
  const [part, setPart] = useState<Part>('body');
  const history = useRef<Config['variant'][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [name, setName] = useState(c.name);
  const editingName = useRef(false);
  // While the field is idle it follows the saved name (it may load, or change elsewhere).
  useEffect(() => {
    if (!editingName.current) setName(c.name);
  }, [c.name]);
  const hasVariants = Boolean(variantRigs[c.character]);
  const patch = (value: Partial<Config>) => {
    send({ type: 'configure', patch: value });
  };
  const changeVariant = (variant: Config['variant']) => {
    history.current = [...history.current.slice(-29), c.variant];
    setCanUndo(true);
    patch({ variant });
  };
  const appearance = Object.entries(character?.appearance ?? {});

  return (
    <div className="sn-pane">
      <label className="sn-field">
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
      {!isCoreModel ? (
        <div className="sn-group">
          <p className="sn-hint">
            This character model is in beta. Switching to Tavi cannot be undone here.
          </p>
          <button
            type="button"
            className="sn-btn"
            disabled={!connected}
            onClick={() => {
              if (
                c.character === 'mascot-v2' &&
                !isOriginal(c.variant) &&
                !window.confirm(
                  'Switch to Tavi? Your custom look will no longer appear. You cannot switch back to this model in Studio.',
                )
              )
                return;
              patch({ character: defaultCharacterId });
            }}
          >
            Switch to Tavi
          </button>
        </div>
      ) : null}
      <div className="sn-actions">
        <button
          type="button"
          className="sn-btn"
          disabled={!connected || !hasVariants}
          onClick={() => {
            changeVariant(randomVariant(c.variant));
          }}
        >
          <Shuffle size={16} aria-hidden="true" /> Surprise me
        </button>
        <button
          type="button"
          className="sn-btn"
          disabled={!connected || !canUndo}
          onClick={() => {
            const previous = history.current.pop();
            setCanUndo(history.current.length > 0);
            if (previous) patch({ variant: previous });
          }}
        >
          <Undo2 size={16} aria-hidden="true" /> Undo
        </button>
        <button
          type="button"
          className="sn-btn sn-btn-quiet"
          disabled={!connected || isOriginal(c.variant)}
          onClick={() => {
            changeVariant(originalVariant);
          }}
        >
          <RotateCcw size={16} aria-hidden="true" /> Original
        </button>
      </div>
      <Tabs.Root
        className="sn-parts"
        value={part}
        onValueChange={(next) => {
          setPart(next as Part);
        }}
      >
        <Tabs.List className="sn-tabs" aria-label="Part of her">
          {parts.map((entry) => (
            <Tabs.Tab key={entry.id} value={entry.id} className="sn-tab">
              {entry.label}
            </Tabs.Tab>
          ))}
          <Tabs.Indicator className="sn-tabs-pill" />
        </Tabs.List>
        {parts.map((entry) => (
          <Tabs.Panel key={entry.id} value={entry.id} className="sn-look-body">
            {entry.id === 'outfit' ? (
              <>
                {appearance.length ? (
                  <fieldset className="creator" disabled={!connected}>
                    {appearance.map(([slot, definition]) => (
                      <div className="creator-group" key={slot}>
                        <span className="creator-label" id={`appearance-${slot}`}>
                          {definition.label}
                        </span>
                        <div
                          className="creator-chips"
                          role="radiogroup"
                          aria-labelledby={`appearance-${slot}`}
                        >
                          {definition.options.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              role="radio"
                              className="creator-chip"
                              aria-checked={
                                (c.appearance[slot] ?? definition.default) === option.id
                              }
                              onClick={() => {
                                patch({ appearance: { [slot]: option.id } });
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </fieldset>
                ) : null}
                <WardrobePanel
                  characterId={c.character}
                  wardrobe={c.wardrobe}
                  disabled={!connected}
                  onChange={(wardrobe) => {
                    patch({ wardrobe });
                  }}
                />
              </>
            ) : (
              <CharacterCreator
                characterId={c.character}
                variant={c.variant}
                disabled={!connected}
                part={entry.id}
                onChange={changeVariant}
              />
            )}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
      <p className="sn-hint">
        {connected
          ? 'Saved on this PC. Changes show on stream as you make them.'
          : 'Offline: changes wait'}
      </p>
    </div>
  );
}

const natureIcons = { cozy: <Coffee />, playful: <Sparkles />, shy: <Cloud /> };
const natureIds = ['cozy', 'playful', 'shy'] as const;

/** Personality: who she is and how much she notices chat. All bounded rules, not AI. */
export function PersonalityPane({ state, connected, send }: StudioProps) {
  const c = state.config;
  const patch = (value: Partial<Config>) => {
    send({ type: 'configure', patch: value });
  };
  return (
    <div className="sn-pane">
      <RadioGroup
        className="sn-natures"
        aria-label="Her nature"
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
      <Dial
        label="Energy"
        word={spoken(c.energy, ['Very calm', 'Calm', 'Easygoing', 'Lively', 'Very lively'])}
        value={c.energy}
        low="Calm"
        high="Lively"
        disabled={!connected}
        onChange={(energy) => {
          patch({ energy });
        }}
      />
      <div className="sn-group">
        <span className="sn-label">How often she starts things</span>
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
      </div>
      <div className="sn-group">
        <span className="sn-label">Her humour</span>
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
      </div>
      <Dial
        label="How much she notices chat"
        word={
          c.chatEngagement === 0
            ? 'Ignores chat'
            : spoken(c.chatEngagement, ['Barely', 'A little', 'Often', 'Very often'])
        }
        value={c.chatEngagement}
        low="Ignores"
        high="All ears"
        disabled={!connected}
        onChange={(chatEngagement) => {
          patch({ chatEngagement });
        }}
      />
      <div className="sn-divide sn-support">
        <EventReactionsPanel config={c} connected={connected} send={send} />
      </div>
    </div>
  );
}
