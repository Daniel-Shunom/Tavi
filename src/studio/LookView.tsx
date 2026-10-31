import { useRef, useState } from 'react';
import { Shuffle, Undo2, RotateCcw } from 'lucide-react';
import { Avatar } from '../renderer/Avatar';
import { catalog, characters } from '../renderer/characters/registry';
import { variantRigs } from '../renderer/characters/variantRigs';
import {
  CharacterCreator,
  isOriginal,
  originalVariant,
  randomVariant,
  type CreatorPart,
} from '../CharacterCreator';
import { WardrobePanel } from '../WardrobePanel';
import type { Config } from '../../shared/protocol';
import type { StudioProps } from './types';

// Look: a big preview of her, and one part of her at a time (body, hair, face, details, outfit).
// Every change is saved and shows on stream at once; Undo steps back through this visit's looks.

type Part = CreatorPart | 'outfit';
const parts: { id: Part; label: string }[] = [
  { id: 'body', label: 'Body' },
  { id: 'hair', label: 'Hair' },
  { id: 'face', label: 'Face' },
  { id: 'details', label: 'Details' },
  { id: 'outfit', label: 'Outfit' },
];

export function LookView({ state, connected, send, serverNow }: StudioProps) {
  const c = state.config;
  const character = catalog[c.character];
  const [part, setPart] = useState<Part>('body');
  const history = useRef<Config['variant'][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [name, setName] = useState(c.name);
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
    <div className="st-cols st-look">
      <section className="st-stage" aria-label="Preview">
        <div className="st-stage-floor" aria-hidden="true" />
        <div className="st-stage-figure portrait-space">
          <Avatar
            state={state}
            serverNow={serverNow}
            presentation="portrait"
            captions={c.captions.studio}
          />
          <button
            type="button"
            className="avatar-touch-target"
            aria-label={`Wave to ${c.name}`}
            title="Say hello"
            disabled={!connected || state.retracted}
            onClick={() => {
              send({ type: 'perform', sequence: 'greeting' });
            }}
          />
        </div>
        <div className="st-stage-bar">
          <label className="st-name">
            Her name
            <input
              name="companion-name"
              autoComplete="off"
              spellCheck={false}
              aria-label="Companion name"
              value={name}
              maxLength={24}
              disabled={!connected}
              onChange={(event) => {
                setName(event.target.value);
                if (event.target.value.trim()) patch({ name: event.target.value });
              }}
              onBlur={() => {
                setName(c.name);
              }}
            />
          </label>
          {characters.size > 1 ? (
            <label className="st-name">
              Character
              <select
                name="character"
                value={c.character}
                disabled={!connected}
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
      </section>

      <section className="st-card st-look-panel" aria-label="Customise">
        <div className="st-look-actions">
          <button
            type="button"
            className="st-button"
            disabled={!connected || !hasVariants}
            onClick={() => {
              changeVariant(randomVariant(c.variant));
            }}
          >
            <Shuffle size={17} /> Surprise me
          </button>
          <button
            type="button"
            className="st-button"
            disabled={!connected || !canUndo}
            onClick={() => {
              const previous = history.current.pop();
              setCanUndo(history.current.length > 0);
              if (previous) patch({ variant: previous });
            }}
          >
            <Undo2 size={17} /> Undo
          </button>
          <button
            type="button"
            className="st-button"
            disabled={!connected || isOriginal(c.variant)}
            onClick={() => {
              changeVariant(originalVariant);
            }}
          >
            <RotateCcw size={17} /> Original look
          </button>
        </div>
        <div className="st-tabs" role="tablist" aria-label="Part of her">
          {parts.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`look-tab-${entry.id}`}
              aria-selected={part === entry.id}
              aria-controls="look-panel"
              tabIndex={part === entry.id ? 0 : -1}
              onClick={() => {
                setPart(entry.id);
              }}
              onKeyDown={(event) => {
                const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                if (!step) return;
                event.preventDefault();
                const index =
                  (parts.findIndex((p) => p.id === part) + step + parts.length) % parts.length;
                const next = parts[index];
                if (!next) return;
                setPart(next.id);
                document.getElementById(`look-tab-${next.id}`)?.focus();
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div
          className="st-look-body"
          id="look-panel"
          role="tabpanel"
          aria-labelledby={`look-tab-${part}`}
        >
          {part === 'outfit' ? (
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
                            aria-checked={(c.appearance[slot] ?? definition.default) === option.id}
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
              part={part}
              onChange={changeVariant}
              onUseCharacter={(id) => {
                patch({ character: id });
              }}
            />
          )}
        </div>
        <p className="st-saved">{connected ? 'Saved on this PC' : 'Offline: changes wait'}</p>
      </section>
    </div>
  );
}
