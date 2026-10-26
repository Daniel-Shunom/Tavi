import { describe, expect, it } from 'vitest';
import attachmentCatalog from '../assets/catalog.json' with { type: 'json' };
import { configSchema, defaults, initialState, reduce } from '../shared/protocol';
import { pickChoreography } from '../shared/presence';
import { itemCatalogFrom } from '../shared/wardrobe';
import { catalog } from '../src/renderer/characters/registry';

const items = itemCatalogFrom(attachmentCatalog);
describe('wardrobe configuration', () => {
  it('loads saves from before the wardrobe existed', () => {
    const older = Object.fromEntries(
      Object.entries(defaults).filter(([key]) => key !== 'wardrobe'),
    );
    expect(configSchema.parse(older).wardrobe).toEqual({ attachments: {}, tints: {} });
  });
  it('keeps known items in their slot and drops unknown or mis-slotted ones', () => {
    expect(items.get('beanie')).toBe('head.top');
    const state = initialState();
    const next = reduce(
      state,
      {
        type: 'configure',
        patch: {
          wardrobe: {
            attachments: { 'head.top': 'beanie', neck: 'no-such-item', 'hand.r': 'beanie' },
            tints: { beanie: { primary: '#4a7bd8' }, ghost: { primary: '#000000' } },
            hairColor: '#123456',
          },
        },
      },
      catalog,
      items,
    );
    expect(next.config.wardrobe).toEqual({
      attachments: { 'head.top': 'beanie' },
      tints: { beanie: { primary: '#4a7bd8' } },
      hairColor: '#123456',
    });
  });
  it('rejects malformed colours and item ids', () => {
    expect(
      configSchema.safeParse({
        ...defaults,
        wardrobe: { attachments: {}, tints: {}, hairColor: 'red' },
      }).success,
    ).toBe(false);
    expect(
      configSchema.safeParse({
        ...defaults,
        wardrobe: { attachments: { neck: 'Bad Id' }, tints: {} },
      }).success,
    ).toBe(false);
  });
});

describe('surprise-me entrances', () => {
  it('lean toward each personality style, deterministically', () => {
    const count = (personality: string, style: string) =>
      Array.from({ length: 300 }, (_, seed) =>
        pickChoreography('random', seed, undefined, personality),
      ).filter((value) => value === style).length;
    expect(count('playful', 'drop')).toBeGreaterThan(count('playful', 'walk'));
    expect(count('shy', 'climb')).toBeGreaterThan(count('shy', 'drop'));
    expect(count('cozy', 'walk')).toBeGreaterThan(count('cozy', 'climb'));
    expect(pickChoreography('random', 42, undefined, 'shy')).toBe(
      pickChoreography('random', 42, undefined, 'shy'),
    );
  });
});
