// Character variants: rig contract preserved, palettes follow the design guide, every hairstyle
// and feature builds valid shapes on known anchors, presets are diverse, configs migrate.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  builds,
  faceShapes,
  hairStyles,
  headCoverings,
  isOriginal,
  originalVariant,
  skinRamp,
  skinTones,
  undertones,
  variantSchema,
  withChanges,
  type Variant,
} from '../shared/variants';
import { variantPresets } from '../shared/variantPresets';
import { configSchema, defaults } from '../shared/protocol';
import { artboardSection } from '../src/renderer/attachments/riv/rivPatch';
import { characters } from '../src/renderer/characters/registry';
import { applyVariant, variantEdits } from '../src/renderer/characters/variants/apply';
import { oklch } from '../src/renderer/characters/variants/colorScience';
import {
  coveringShapes,
  featureShapes,
} from '../src/renderer/characters/variants/overlay/features';
import { hairstyleShapes } from '../src/renderer/characters/variants/overlay/hairstyles';
import { overlayPalette, variantShapes } from '../src/renderer/characters/variants/overlay/compose';
import {
  browColor,
  hairColors,
  hairPalette,
  skinPalette,
} from '../src/renderer/characters/variants/palettes';
import { mascotV2VariantRig as rig } from '../src/renderer/characters/variants/rigs/mascotV2';

const FILE = 'src/renderer/characters/mascot-v2/mascot-v2.riv';
const source = new Uint8Array(readFileSync(FILE));
const manifest = characters.get('mascot-v2');

/** Every variant a test should exercise: presets plus each axis value on its own. */
const axes: Variant[] = [
  ...variantPresets,
  ...skinTones.map((tone) => withChanges(originalVariant, { skin: { tone } })),
  ...builds.map((build) => withChanges(originalVariant, { build })),
  ...faceShapes.map((face) => withChanges(originalVariant, { face })),
  ...hairStyles.map((style) => withChanges(originalVariant, { hair: { style } })),
  ...headCoverings.map((kind) =>
    withChanges(originalVariant, { covering: { kind, color: '#4f68b0' } }),
  ),
  withChanges(originalVariant, {
    features: { prosthetic: 'left', glasses: false, vitiligo: 'face-hands', facialHair: 'beard' },
  }),
];

function contract(bytes: Uint8Array) {
  const { components, animations } = artboardSection(bytes, rig.artboard);
  return {
    components: components.map((c) => `${String(c.typeKey)}:${String(c.props.get(4) ?? '')}`),
    animations: animations.map((a) => a.name),
  };
}

function keyedProperties(bytes: Uint8Array) {
  const keyed = new Set<string>();
  for (const animation of artboardSection(bytes, rig.artboard).animations) {
    let object = -1;
    for (const o of animation.objects) {
      if (o.typeKey === 25) object = Number(o.props.get(51) ?? -1);
      else if (o.typeKey === 26) keyed.add(`${String(object)}.${String(o.props.get(53))}`);
    }
  }
  return keyed;
}

describe('variant rig contract', () => {
  const original = contract(source);
  it('keeps every component, name, type and animation for every variant', () => {
    for (const variant of axes) {
      const edited = contract(applyVariant(source, rig, variant));
      expect(edited.components).toEqual(original.components);
      expect(edited.animations).toEqual(original.animations);
    }
  }, 60_000);
  it('still provides every track, node and control the v2 manifest binds', () => {
    if (!manifest) throw new Error('mascot-v2 missing');
    const edited = contract(applyVariant(source, rig, variantPresets[0] ?? originalVariant));
    for (const clip of Object.values(manifest.tracks)) expect(edited.animations).toContain(clip);
    const names = new Set(edited.components.map((c) => c.split(':').slice(1).join(':')));
    for (const node of Object.values(manifest.nodes)) expect(names).toContain(node);
    for (const anchor of Object.values(rig.anchors)) expect(names).toContain(anchor.name);
    expect(edited.components.filter((c) => c.startsWith('148:')).length).toBe(14); // joysticks
  });
  it('never edits a property that a clip or control track keys (motion stays shared)', () => {
    const keyed = keyedProperties(source);
    for (const variant of axes)
      for (const edit of variantEdits(source, rig, variant).floats)
        expect(
          keyed.has(`${String(edit.index)}.${String(edit.property)}`),
          `${String(edit.index)}.${String(edit.property)}`,
        ).toBe(false);
  }, 60_000);
  it('leaves the original look byte-identical', () => {
    expect(isOriginal(originalVariant)).toBe(true);
    expect(applyVariant(source, rig, originalVariant)).toEqual(source);
  });
  it('builds never move legs, feet, hips or soles (only limb thickness), so body states hold', () => {
    for (const edit of Object.values(rig.builds).flat())
      if (/foot|leg|LEG|tavi\/body|shoe|sock/.test(edit.target.name))
        expect(edit.property).toBe('thickness');
  });
});

describe('skin ramp (design guide rules)', () => {
  const tones = Object.keys(skinRamp) as (keyof typeof skinRamp)[];
  it('steps from light to deep in clear lightness steps', () => {
    for (const undertone of undertones)
      tones.slice(1).forEach((tone, i) => {
        const previous = oklch(skinPalette(tones[i] ?? '1', undertone).base).l;
        expect(previous - oklch(skinPalette(tone, undertone).base).l).toBeGreaterThan(0.035);
      });
  });
  it('shades rotate toward red and keep chroma: never ashy or grey', () => {
    for (const undertone of undertones)
      for (const tone of tones) {
        const p = skinPalette(tone, undertone);
        const base = oklch(p.base),
          shade = oklch(p.shade),
          highlight = oklch(p.highlight);
        expect(shade.l).toBeLessThan(base.l - 0.05);
        expect(shade.h).toBeLessThanOrEqual(base.h + 1);
        expect(shade.h).toBeGreaterThan(base.h - 16);
        expect(shade.c).toBeGreaterThanOrEqual(base.c * 0.95);
        expect(base.c).toBeGreaterThan(0.03);
        expect(highlight.l).toBeGreaterThan(base.l);
        expect(highlight.h).toBeGreaterThan(30);
        expect(highlight.h).toBeLessThan(90);
      }
  });
  it('keeps the nose and mouth lines legible against every tone', () => {
    for (const undertone of undertones)
      for (const tone of tones) {
        const p = skinPalette(tone, undertone);
        const base = oklch(p.base).l;
        expect(base - oklch(p.mouth).l).toBeGreaterThan(0.15);
        expect(base - oklch(p.nose).l).toBeGreaterThan(0.12);
      }
  });
  it('uses one mouth hue for everyone (shape and hue never change with tone)', () => {
    const hues = tones.map((tone) => oklch(skinPalette(tone, 'neutral').mouth).h);
    expect(Math.max(...hues) - Math.min(...hues)).toBeLessThan(15);
  });
  it('gives dark hair a visible highlight and keeps brows darker than light hair', () => {
    for (const { hex } of hairColors) {
      const p = hairPalette(hex);
      const lift = oklch(p.highlight).l - oklch(p.base).l;
      // Near-white hair has no room above it; its form comes from the shade instead.
      if (oklch(hex).l < 0.8) expect(lift).toBeGreaterThan(0.08);
      else expect(oklch(p.base).l - oklch(p.shade).l).toBeGreaterThan(0.06);
      expect(oklch(browColor(hex)).l).toBeLessThan(Math.max(oklch(hex).l, 0.5));
    }
  });
});

const NUMBERS = /-?\d+(?:\.\d+)?(?:e-?\d+)?/g;
function bounds(d: string) {
  const values = (d.match(NUMBERS) ?? []).map(Number);
  expect(values.every(Number.isFinite)).toBe(true);
  return values;
}

describe('hairstyles, coverings and features', () => {
  it('ships at least 8 overlay hairstyles with real shapes, plus the original curls', () => {
    const drawn = hairStyles.filter((style) => hairstyleShapes(style).layers.length > 0);
    expect(drawn.length).toBeGreaterThanOrEqual(8);
    for (const style of [
      'locs',
      'afro',
      'box-braids',
      'puffs',
      'bob',
      'pixie',
      'long',
      'top-bun',
      'bantu-knots',
    ] as const)
      expect(drawn).toContain(style);
    expect(hairstyleShapes('curls').layers).toEqual([]);
  });
  it('gives textured styles volume and texture marks, not a recoloured straight silhouette', () => {
    for (const style of [
      'locs',
      'afro',
      'box-braids',
      'puffs',
      'bantu-knots',
      'cornrows',
    ] as const) {
      const set = hairstyleShapes(style);
      expect(
        set.layers.some((l) => l.stroke?.slot === 'hairDeep' || l.stroke?.slot === 'scalp'),
      ).toBe(true);
      expect(set.layers.length).toBeGreaterThan(5);
    }
  });
  it('builds valid paths on anchors the rig provides, near the head', () => {
    const sets = [
      ...hairStyles.map(hairstyleShapes),
      ...headCoverings.map(coveringShapes),
      ...axes.map(featureShapes),
    ];
    for (const set of sets)
      for (const layer of set.layers) {
        if (layer.follow) expect(rig.anchors).toHaveProperty(layer.follow);
        if (layer.spring) expect(set.springs).toHaveProperty(layer.spring);
        const values = bounds(layer.d);
        if (layer.space !== 'anchor') for (const v of values) expect(Math.abs(v)).toBeLessThan(320);
      }
  });
  it('resolves every paint slot of every variant to a colour', () => {
    for (const variant of axes) {
      const palette = overlayPalette(variant);
      for (const layer of variantShapes(variant).layers) {
        for (const paint of [layer.fill, layer.stroke])
          if (paint) expect(palette[paint.slot]).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
  it('replaces the hair overlay with a head covering and keeps features', () => {
    const covered = withChanges(originalVariant, {
      hair: { style: 'afro' },
      covering: { kind: 'hijab', color: '#4f68b0' },
      features: { freckles: true },
    });
    const layers = variantShapes(covered).layers;
    expect(layers.some((l) => l.fill?.slot === 'cover')).toBe(true);
    expect(layers.some((l) => l.fill?.slot === 'hair' && l.follow === 'hairBack')).toBe(false);
    expect(layers.some((l) => l.fill?.slot === 'freckle')).toBe(true);
  });
});

describe('presets', () => {
  it('offers at least 8 distinct, valid presets across tones, builds, faces, hair and ages', () => {
    expect(variantPresets.length).toBeGreaterThanOrEqual(8);
    const ids = variantPresets.map((v) => v.preset);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of variantPresets) expect(variantSchema.parse(v)).toEqual(v);
    const distinct = (pick: (v: Variant) => unknown) => new Set(variantPresets.map(pick)).size;
    expect(distinct((v) => v.skin.tone)).toBeGreaterThanOrEqual(8);
    expect(distinct((v) => v.build)).toBe(builds.length);
    expect(distinct((v) => v.face)).toBe(faceShapes.length);
    expect(distinct((v) => v.hair.style)).toBeGreaterThanOrEqual(10);
    expect(distinct((v) => v.age)).toBe(3);
  });
  it('does not lead with the lightest tone and uses no race labels', () => {
    expect(variantPresets[0]?.skin.tone).not.toBe('1');
    const text = JSON.stringify(variantPresets).toLowerCase();
    for (const word of [
      'black',
      'white',
      'asian',
      'latin',
      'african',
      'caucasian',
      'ethnic',
      'race',
      'nude',
      'flesh',
    ])
      expect(text.includes(`"${word}`) || text.includes(`-${word}`)).toBe(false);
  });
});

describe('variant configuration', () => {
  it('defaults saved configs without a variant to the original mascot look', () => {
    const older = Object.fromEntries(Object.entries(defaults).filter(([key]) => key !== 'variant'));
    expect(configSchema.parse(older).variant).toEqual(originalVariant);
  });
  it('maps a legacy skin colour and hairstyle onto the ramp and hairstyles', () => {
    const config = configSchema.parse({ name: 'Old', skin: '#5e3422', hairstyle: 'bob' });
    expect(config.variant.skin.tone).toBe('9');
    expect(config.variant.hair.style).toBe('bob');
  });
  it('round-trips a customised variant and rejects unknown values', () => {
    const variant = variantPresets[0] ?? originalVariant;
    expect(configSchema.parse({ ...defaults, variant }).variant).toEqual(variant);
    expect(() =>
      configSchema.parse({ ...defaults, variant: { ...variant, build: 'tiny' } }),
    ).toThrow();
  });
});
