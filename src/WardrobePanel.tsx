import { useEffect, useRef, useState } from 'react';
import { loadAttachments } from './renderer/attachments/bundle';
import { itemsForSlot } from './renderer/attachments/catalog';
import {
  IDENTITY,
  createAttachmentLayer,
  multiply,
  scale,
  translate,
} from './renderer/attachments/layer';
import type { AttachmentSpec, SlotId } from './renderer/attachments/schema';
import { attachmentRigs } from './renderer/characters/attachmentRigs';
import { wardrobePolicy, type Wardrobe, type WardrobeSlot } from '../shared/wardrobe';

const slotLabels: Record<SlotId, string> = {
  'head.top': 'Hat',
  'head.hair': 'Hair extra',
  'head.face': 'Face',
  'head.back': 'Back of head',
  'head.side': 'Side',
  neck: 'Neck',
  torso: 'Torso',
  'hand.l': 'Left hand',
  'hand.r': 'Right hand',
};

/** Draws one item centred in a small canvas, using the same layer code as the stage. */
function Thumbnail({ spec }: { spec: AttachmentSpec }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const size = 48;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    const layer = createAttachmentLayer({
      slots: {
        [spec.slot]: { node: null, kind: 'node', offset: [0, 0], size: 30, follow: 1, rotation: 0 },
      },
      items: new Map([[spec.id, spec]]),
      path: (d) => new Path2D(d),
    });
    context.clearRect(0, 0, canvas.width, canvas.height);
    layer.draw(context, context, {
      view: multiply(translate((size / 2) * ratio, (size / 2) * ratio), scale(ratio)),
      world: () => IDENTITY,
      equipped: { [spec.slot]: spec.id },
      dt: 0,
      still: true,
    });
  }, [spec]);
  return <canvas ref={ref} className="wardrobe-thumb" aria-hidden="true" />;
}

/** Commits a colour after the picker settles, so recolours (file rebuilds) are not per input. */
function ColorField({
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
          }, 400);
        }}
      />
    </label>
  );
}

export function WardrobePanel({
  characterId,
  wardrobe,
  disabled,
  onChange,
}: {
  characterId: string;
  wardrobe: Wardrobe;
  disabled: boolean;
  onChange: (next: Wardrobe) => void;
}) {
  const rig = attachmentRigs[characterId];
  if (!rig) return <p className="helper-note">This character has no wardrobe slots yet.</p>;
  const { items } = loadAttachments();
  const slots = (Object.keys(slotLabels) as SlotId[]).filter((slot) => rig.slots[slot]);
  const equip = (slot: WardrobeSlot, id: string | null) => {
    const others = Object.fromEntries(
      Object.entries(wardrobe.attachments).filter(([key]) => key !== slot),
    );
    onChange({ ...wardrobe, attachments: id ? { ...others, [slot]: id } : others });
  };
  const setTint = (item: string, tint: string, color: string | null) => {
    const kept = Object.fromEntries(
      Object.entries(wardrobe.tints[item] ?? {}).filter(([key]) => key !== tint),
    );
    const current = color ? { ...kept, [tint]: color } : kept;
    const others = Object.fromEntries(
      Object.entries(wardrobe.tints).filter(([key]) => key !== item),
    );
    onChange({
      ...wardrobe,
      tints: Object.keys(current).length ? { ...others, [item]: current } : others,
    });
  };
  return (
    <fieldset className="wardrobe" disabled={disabled}>
      <div className="range-row">
        <ColorField
          label="Hair colour"
          value={wardrobe.hairColor ?? rig.recolor.hair?.base ?? '#d80b4c'}
          onCommit={(hairColor) => {
            onChange({ ...wardrobe, hairColor });
          }}
        />
        <ColorField
          label="Outfit colour"
          value={wardrobe.outfitColor ?? rig.recolor.outfit?.base ?? '#276065'}
          onCommit={(outfitColor) => {
            onChange({ ...wardrobe, outfitColor });
          }}
        />
        {wardrobe.hairColor || wardrobe.outfitColor ? (
          <button
            type="button"
            className="wardrobe-reset"
            onClick={() => {
              onChange({ attachments: wardrobe.attachments, tints: wardrobe.tints });
            }}
          >
            Use preset colours
          </button>
        ) : null}
      </div>
      {slots.map((slot) => {
        const equipped = wardrobe.attachments[slot];
        const spec = equipped ? items.get(equipped) : undefined;
        return (
          <div className="wardrobe-slot" key={slot}>
            <h3>{slotLabels[slot]}</h3>
            <div role="radiogroup" aria-label={slotLabels[slot]}>
              <button
                type="button"
                role="radio"
                aria-checked={!equipped}
                className="wardrobe-item"
                onClick={() => {
                  equip(slot, null);
                }}
              >
                None
              </button>
              {itemsForSlot(items, slot).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={equipped === item.id}
                  className="wardrobe-item"
                  title={item.notes ?? item.name}
                  onClick={() => {
                    equip(slot, item.id);
                  }}
                >
                  <Thumbnail spec={item} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
            {spec
              ? Object.entries(spec.tints).map(([name, tint]) => {
                  const override = wardrobe.tints[spec.id]?.[name];
                  return (
                    <div className="wardrobe-tint" key={name}>
                      {tint.follow === 'hair' ? (
                        <label className="field checkbox-field">
                          <input
                            type="checkbox"
                            checked={!override}
                            onChange={(event) => {
                              setTint(spec.id, name, event.target.checked ? null : tint.default);
                            }}
                          />
                          Match hair
                        </label>
                      ) : null}
                      {tint.follow !== 'hair' || override ? (
                        <ColorField
                          label={tint.label}
                          value={override ?? tint.default}
                          onCommit={(color) => {
                            setTint(spec.id, name, color);
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })
              : null}
            {slot === 'head.face' && equipped && wardrobePolicy.eyewearHidesBuiltInGlasses ? (
              <p className="helper-note">Built-in glasses are hidden while this is worn.</p>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}
