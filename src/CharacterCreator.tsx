// Character creator: pick a starting preset, then change skin tone, undertone, face, build, age,
// eyes, hair style and colour, features and head covering independently. Every control writes the
// whole variant to the saved configuration; the renderer rebuilds the character on change.
// Labels describe features only (docs/character/VARIANTS-RESEARCH.md section 7). Studio shows it
// one part at a time (body, hair, face, details), each a column of tap-to-pick choices.
import { useEffect, useRef, useState } from 'react';
import {
  ages,
  builds,
  eyeColors,
  faceShapes,
  facialHair,
  hairStyles,
  headCoverings,
  isOriginal,
  originalVariant,
  sides,
  skinTones,
  undertones,
  vitiligoAreas,
  withChanges,
  type Variant,
  type VariantPatch,
} from '../shared/variants';
import { describeVariant, variantPresets } from '../shared/variantPresets';
import { variantRigs } from './renderer/characters/variantRigs';
import { characters } from './renderer/characters/registry';
import { coveringLabels } from './renderer/characters/variants/overlay/features';
import { hairStyleLabels } from './renderer/characters/variants/overlay/hairstyles';
import {
  eyePalettes,
  hairColors,
  originalSkin,
  skinPalette,
} from './renderer/characters/variants/palettes';

const faceLabels: Record<(typeof faceShapes)[number], string> = {
  round: 'Round',
  'soft-square': 'Soft square',
  oval: 'Oval',
  heart: 'Heart',
  full: 'Full',
};
const buildLabels: Record<(typeof builds)[number], string> = {
  slim: 'Slim',
  average: 'Average',
  broad: 'Broad',
  full: 'Full',
};
const ageLabels: Record<(typeof ages)[number], string> = {
  young: 'Young',
  adult: 'Adult',
  elder: 'Elder (smile lines)',
};
const sideLabels: Record<(typeof sides)[number], string> = {
  none: 'None',
  left: 'Viewer’s left',
  right: 'Viewer’s right',
  both: 'Both',
};
const vitiligoLabels: Record<(typeof vitiligoAreas)[number], string> = {
  none: 'None',
  face: 'Face',
  hands: 'Hands',
  'face-hands': 'Face and hands',
};
const facialHairLabels: Record<(typeof facialHair)[number], string> = {
  none: 'None',
  stubble: 'Stubble',
  moustache: 'Moustache',
  beard: 'Beard',
};
const toneLabel = (tone: (typeof skinTones)[number]) =>
  tone === 'original' ? 'Original' : `Tone ${tone}`;
const toneColor = (tone: (typeof skinTones)[number], undertone: Variant['skin']['undertone']) =>
  tone === 'original' ? originalSkin.base : skinPalette(tone, undertone).base;

/** Commits a colour after the picker settles (each commit rebuilds the character). */
function ColorInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  return (
    <label className="field color-field">
      {label}
      <input
        type="color"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            onCommit(next);
          }, 350);
        }}
      />
    </label>
  );
}

function Swatches<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly { id: T; label: string; color: string }[];
  value: T | undefined;
  onPick: (id: T) => void;
}) {
  return (
    <div className="creator-group">
      <span className="creator-label" id={`creator-${label}`}>
        {label}
      </span>
      <div className="creator-swatches" role="radiogroup" aria-labelledby={`creator-${label}`}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.id === value}
            aria-label={option.label}
            title={option.label}
            className="creator-swatch"
            style={{ background: option.color }}
            onClick={() => {
              onPick(option.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** A short list of choices, picked with one tap (a radio group named by its label). */
function Choice<T extends string>({
  label,
  options,
  labels,
  value,
  onPick,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onPick: (value: T) => void;
}) {
  const id = `creator-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="creator-group">
      <span className="creator-label" id={id}>
        {label}
      </span>
      <div className="creator-chips" role="radiogroup" aria-labelledby={id}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === value}
            className="creator-chip"
            onClick={() => {
              onPick(option);
            }}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

function pickOne<T>(options: readonly T[]): T {
  const option = options[Math.floor(Math.random() * options.length)];
  if (option === undefined) throw new Error('Nothing to pick from');
  return option;
}

/** A fresh, random look: skin, face, build, eyes, hair and colour (features left as they are). */
export function randomVariant(variant: Variant): Variant {
  return withChanges(variant, {
    skin: {
      tone: pickOne(skinTones.filter((tone) => tone !== 'original')),
      undertone: pickOne(undertones),
    },
    face: pickOne(faceShapes),
    build: pickOne(builds),
    eyes: pickOne(eyeColors),
    hair: { style: pickOne(hairStyles), color: pickOne(hairColors).hex },
  });
}

export { isOriginal, originalVariant };

export type CreatorPart = 'body' | 'hair' | 'face' | 'details';

export function CharacterCreator({
  characterId,
  variant,
  disabled,
  part,
  onChange,
  onUseCharacter,
}: {
  characterId: string;
  variant: Variant;
  disabled: boolean;
  part: CreatorPart;
  onChange: (variant: Variant) => void;
  onUseCharacter: (id: string) => void;
}) {
  const supported = Object.keys(variantRigs).filter((id) => characters.has(id));
  if (!variantRigs[characterId]) {
    const target = supported[0];
    return (
      <div className="creator-notice">
        <p>
          Skin tones, builds, faces and hairstyles work on characters with a variant rig.{' '}
          {target ? `${characters.get(target)?.name ?? target} supports them.` : ''}
        </p>
        {target ? (
          <button
            type="button"
            className="secondary-button"
            disabled={disabled}
            onClick={() => {
              onUseCharacter(target);
            }}
          >
            Use {characters.get(target)?.name ?? target}
          </button>
        ) : null}
      </div>
    );
  }
  const change = (patch: VariantPatch) => {
    onChange(withChanges(variant, patch));
  };
  const hairColor = variant.hair.color;
  return (
    <fieldset className="creator" disabled={disabled}>
      {part === 'body' ? (
        <>
          <div className="creator-group">
            <span className="creator-label" id="creator-presets">
              Start from a look
            </span>
            <div className="creator-presets" role="radiogroup" aria-labelledby="creator-presets">
              {variantPresets.map((preset) => (
                <button
                  key={preset.preset}
                  type="button"
                  role="radio"
                  aria-checked={preset.preset === variant.preset}
                  className="creator-preset"
                  title={describeVariant(preset, {
                    hair: hairStyleLabels[preset.hair.style],
                    covering: coveringLabels[preset.covering.kind],
                  })}
                  onClick={() => {
                    onChange(preset);
                  }}
                >
                  <span className="creator-preset-dots" aria-hidden="true">
                    <i style={{ background: toneColor(preset.skin.tone, preset.skin.undertone) }} />
                    <i
                      style={{
                        background:
                          preset.covering.kind !== 'none'
                            ? preset.covering.color
                            : (preset.hair.color ?? '#d80b4c'),
                      }}
                    />
                  </span>
                  {preset.covering.kind !== 'none'
                    ? coveringLabels[preset.covering.kind]
                    : hairStyleLabels[preset.hair.style]}
                </button>
              ))}
            </div>
          </div>
          <Swatches
            label="Skin tone"
            options={skinTones.map((tone) => ({
              id: tone,
              label: toneLabel(tone),
              color: toneColor(tone, variant.skin.undertone),
            }))}
            value={variant.skin.tone}
            onPick={(tone) => {
              change({ skin: { tone } });
            }}
          />
          <Choice
            label="Undertone"
            options={undertones}
            labels={{ warm: 'Warm', neutral: 'Neutral', cool: 'Cool', olive: 'Olive' }}
            value={variant.skin.undertone}
            onPick={(undertone) => {
              change({ skin: { undertone } });
            }}
          />
          <Choice
            label="Build"
            options={builds}
            labels={buildLabels}
            value={variant.build}
            onPick={(build) => {
              change({ build });
            }}
          />
          <Choice
            label="Age"
            options={ages}
            labels={ageLabels}
            value={variant.age}
            onPick={(age) => {
              change({ age });
            }}
          />
        </>
      ) : null}
      {part === 'hair' ? (
        <>
          <div className="creator-group">
            <span className="creator-label" id="creator-hair">
              Style
            </span>
            <div className="creator-chips" role="radiogroup" aria-labelledby="creator-hair">
              {hairStyles.map((style) => (
                <button
                  key={style}
                  type="button"
                  role="radio"
                  aria-checked={style === variant.hair.style}
                  className="creator-chip"
                  onClick={() => {
                    change({ hair: { style } });
                  }}
                >
                  {hairStyleLabels[style]}
                </button>
              ))}
            </div>
          </div>
          <Swatches
            label="Natural colours"
            options={hairColors
              .filter((c) => c.group === 'natural')
              .map((c) => ({ id: c.hex, label: c.label, color: c.hex }))}
            value={hairColor}
            onPick={(color) => {
              change({ hair: { color } });
            }}
          />
          <Swatches
            label="Dyed"
            options={hairColors
              .filter((c) => c.group === 'dyed')
              .map((c) => ({ id: c.hex, label: c.label, color: c.hex }))}
            value={hairColor}
            onPick={(color) => {
              change({ hair: { color } });
            }}
          />
          <ColorInput
            label="Any colour"
            value={hairColor ?? '#2a211e'}
            onCommit={(color) => {
              change({ hair: { color } });
            }}
          />
          <Choice
            label="Head covering"
            options={headCoverings}
            labels={coveringLabels}
            value={variant.covering.kind}
            onPick={(kind) => {
              change({ covering: { kind } });
            }}
          />
          {variant.covering.kind !== 'none' ? (
            <ColorInput
              label="Covering colour"
              value={variant.covering.color}
              onCommit={(color) => {
                change({ covering: { color } });
              }}
            />
          ) : null}
        </>
      ) : null}
      {part === 'face' ? (
        <>
          <Choice
            label="Face shape"
            options={faceShapes}
            labels={faceLabels}
            value={variant.face}
            onPick={(face) => {
              change({ face });
            }}
          />
          <Swatches
            label="Eyes"
            options={eyeColors.map((id) => ({
              id,
              label: eyePalettes[id].label,
              color: eyePalettes[id].light,
            }))}
            value={variant.eyes}
            onPick={(eyes) => {
              change({ eyes });
            }}
          />
          <div className="creator-group">
            <span className="creator-label">Features</span>
            {(
              [
                ['freckles', 'Freckles'],
                ['blush', 'Blush'],
                ['glasses', 'Glasses'],
              ] as const
            ).map(([key, label]) => (
              <label className="field checkbox-field" key={key}>
                <input
                  type="checkbox"
                  checked={variant.features[key]}
                  onChange={(event) => {
                    change({ features: { [key]: event.target.checked } });
                  }}
                />
                {label}
              </label>
            ))}
          </div>
          <Choice
            label="Facial hair"
            options={facialHair}
            labels={facialHairLabels}
            value={variant.features.facialHair}
            onPick={(value) => {
              change({ features: { facialHair: value } });
            }}
          />
        </>
      ) : null}
      {part === 'details' ? (
        <>
          <Choice
            label="Vitiligo"
            options={vitiligoAreas}
            labels={vitiligoLabels}
            value={variant.features.vitiligo}
            onPick={(vitiligo) => {
              change({ features: { vitiligo } });
            }}
          />
          <Choice
            label="Hearing aids"
            options={sides}
            labels={sideLabels}
            value={variant.features.hearingAids}
            onPick={(hearingAids) => {
              change({ features: { hearingAids } });
            }}
          />
          {variant.features.hearingAids !== 'none' ? (
            <ColorInput
              label="Hearing aid colour"
              value={variant.features.hearingAidColor}
              onCommit={(hearingAidColor) => {
                change({ features: { hearingAidColor } });
              }}
            />
          ) : null}
          <Choice
            label="Prosthetic forearm"
            options={['none', 'left', 'right'] as const}
            labels={{ none: 'None', left: sideLabels.left, right: sideLabels.right }}
            value={variant.features.prosthetic}
            onPick={(prosthetic) => {
              change({ features: { prosthetic } });
            }}
          />
          {variant.features.prosthetic !== 'none' ? (
            <ColorInput
              label="Prosthetic colour"
              value={variant.features.prostheticColor}
              onCommit={(prostheticColor) => {
                change({ features: { prostheticColor } });
              }}
            />
          ) : null}
          <p className="helper-note">
            Every option works with every other. Hairstyles and features are drawn shape sets that
            follow the rig; they have not yet had community review.
          </p>
        </>
      ) : null}
    </fieldset>
  );
}
