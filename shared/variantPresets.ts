// Starting points for the character creator: complete variants spread across every axis. They
// are labelled by their features only (never by people, ethnicity or race) and are listed in
// an order that does not begin with the lightest tone (VARIANTS-RESEARCH.md section 7).
// Every field stays independently editable after picking one.
import { originalVariant, variantSchema, type Variant } from './variants.js';

type Features = Partial<Variant['features']>;
function preset(
  id: string,
  spec: Omit<Variant, 'preset' | 'features' | 'covering'> & {
    features?: Features;
    covering?: Variant['covering'];
  },
): Variant {
  return variantSchema.parse({
    ...spec,
    preset: id,
    features: { ...originalVariant.features, glasses: false, ...spec.features },
    covering: spec.covering ?? originalVariant.covering,
  });
}

const BLACK = '#2a211e',
  BLUE_BLACK = '#232331',
  DARK_BROWN = '#3f2a20',
  BROWN = '#6a4430';

export const variantPresets: readonly Variant[] = [
  preset('locs-full', {
    skin: { tone: '8', undertone: 'warm' },
    face: 'soft-square',
    build: 'full',
    age: 'adult',
    eyes: 'dark-brown',
    hair: { style: 'locs', color: BLACK },
  }),
  preset('afro-glasses', {
    skin: { tone: '6', undertone: 'neutral' },
    face: 'round',
    build: 'average',
    age: 'young',
    eyes: 'brown',
    hair: { style: 'afro', color: DARK_BROWN },
    features: { glasses: true, freckles: true },
  }),
  preset('bob-vitiligo', {
    skin: { tone: '10', undertone: 'warm' },
    face: 'oval',
    build: 'slim',
    age: 'adult',
    eyes: 'dark-brown',
    hair: { style: 'bob', color: BLACK },
    features: { vitiligo: 'face-hands' },
  }),
  preset('braids-hearing-aid', {
    skin: { tone: '9', undertone: 'cool' },
    face: 'heart',
    build: 'broad',
    age: 'adult',
    eyes: 'brown',
    hair: { style: 'box-braids', color: BLUE_BLACK },
    features: { hearingAids: 'right', hearingAidColor: '#e0b04a' },
  }),
  preset('pixie-elder', {
    skin: { tone: '2', undertone: 'neutral' },
    face: 'round',
    build: 'slim',
    age: 'elder',
    eyes: 'blue',
    hair: { style: 'pixie', color: '#c4c6cc' },
    features: { glasses: true },
  }),
  preset('puffs-young', {
    skin: { tone: '5', undertone: 'warm' },
    face: 'full',
    build: 'average',
    age: 'young',
    eyes: 'hazel',
    hair: { style: 'puffs', color: DARK_BROWN },
  }),
  preset('waves-beard', {
    skin: { tone: '7', undertone: 'neutral' },
    face: 'soft-square',
    build: 'broad',
    age: 'adult',
    eyes: 'dark-brown',
    hair: { style: 'waves', color: BLACK },
    features: { facialHair: 'beard', blush: false },
  }),
  preset('hijab', {
    skin: { tone: '4', undertone: 'olive' },
    face: 'oval',
    build: 'average',
    age: 'adult',
    eyes: 'brown',
    hair: { style: 'long', color: DARK_BROWN },
    covering: { kind: 'hijab', color: '#4f68b0' },
  }),
  preset('dastar-elder', {
    skin: { tone: '5', undertone: 'warm' },
    face: 'soft-square',
    build: 'full',
    age: 'elder',
    eyes: 'brown',
    hair: { style: 'shaved', color: '#ebe9e4' },
    covering: { kind: 'dastar', color: '#c8463a' },
    features: { facialHair: 'beard', blush: false },
  }),
  preset('long-prosthetic', {
    skin: { tone: '3', undertone: 'olive' },
    face: 'heart',
    build: 'average',
    age: 'adult',
    eyes: 'green',
    hair: { style: 'long', color: '#8a3a22' },
    features: { prosthetic: 'right', prostheticColor: '#4f6170' },
  }),
  preset('bantu-freckles', {
    skin: { tone: '9', undertone: 'warm' },
    face: 'round',
    build: 'slim',
    age: 'young',
    eyes: 'dark-brown',
    hair: { style: 'bantu-knots', color: BLACK },
    features: { freckles: true },
  }),
  preset('cornrows-stubble', {
    skin: { tone: '8', undertone: 'neutral' },
    face: 'round',
    build: 'broad',
    age: 'adult',
    eyes: 'brown',
    hair: { style: 'cornrows', color: BLACK },
    features: {
      hearingAids: 'both',
      hearingAidColor: '#7b5cc4',
      facialHair: 'stubble',
      blush: false,
    },
  }),
  preset('ponytail-freckles', {
    skin: { tone: '1', undertone: 'neutral' },
    face: 'oval',
    build: 'average',
    age: 'young',
    eyes: 'grey',
    hair: { style: 'ponytail', color: '#b5502b' },
    features: { freckles: true },
  }),
  preset('bun-glasses', {
    skin: { tone: '6', undertone: 'cool' },
    face: 'heart',
    build: 'full',
    age: 'adult',
    eyes: 'dark-brown',
    hair: { style: 'top-bun', color: BROWN },
    features: { glasses: true },
  }),
  preset('shaved-headwrap', {
    skin: { tone: '10', undertone: 'neutral' },
    face: 'full',
    build: 'average',
    age: 'adult',
    eyes: 'brown',
    hair: { style: 'shaved', color: BLACK },
    covering: { kind: 'headwrap', color: '#e08a2c' },
  }),
  originalVariant,
];

/** Feature-only description of a variant, e.g. "Tone 8 · locs · full build". */
export function describeVariant(variant: Variant, labels: { hair: string; covering?: string }) {
  const parts = [
    variant.skin.tone === 'original' ? 'Original colours' : `Tone ${variant.skin.tone}`,
    variant.covering.kind !== 'none' && labels.covering ? labels.covering : labels.hair,
    `${variant.build} build`,
  ];
  return parts.join(' · ');
}
