import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const directory = 'art/tavi-rive-lab/';
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const xml = readFileSync(directory + 'interactive/scene.rml', 'utf8');

describe('isolated expressive Tavi workspace', () => {
  it('preserves the exact fallback source and runtime asset', () => {
    const expected = JSON.parse(readFileSync(directory + 'fallback/sha256.json', 'utf8')) as Record<
      string,
      string
    >;
    expect(hash(directory + 'fallback/scene.rml')).toBe(expected['scene.rml']);
    expect(hash(directory + 'fallback/mascot-v2.riv')).toBe(expected['mascot-v2.riv']);
    expect(hash('art/mascot-remix/scene.rml')).toBe(expected['scene.rml']);
    expect(hash('src/renderer/characters/mascot-v2/mascot-v2.riv')).toBe(expected['mascot-v2.riv']);
  });

  it('blends complete neutral and expression endpoints across a 0–100 intensity axis', () => {
    const states = [...xml.matchAll(/<BlendState1DInput\b[^>]*>([\s\S]*?)<\/BlendState1DInput>/g)];
    expect(states).toHaveLength(7);
    for (const state of states) {
      expect(state[1]).toContain('value="0"');
      expect(state[1]).toContain('value="100"');
    }
    const poses = new Map<string, Set<string>>();
    for (const animation of xml.matchAll(
      /<LinearAnimation\b[^>]*name="tavi\/held\/([^"]+)"[^>]*>([\s\S]*?)<\/LinearAnimation>/g,
    )) {
      const properties = new Set<string>();
      for (const object of (animation[2] ?? '').matchAll(
        /<KeyedObject\b[^>]*objectId="([^"]+)"[^>]*>([\s\S]*?)<\/KeyedObject>/g,
      ))
        for (const prop of (object[2] ?? '').matchAll(/<KeyedProperty\b[^>]*property="([^"]+)"/g))
          properties.add(`${object[1] ?? ''}.${prop[1] ?? ''}`);
      poses.set(animation[1] ?? '', properties);
    }
    expect(poses.size).toBe(7);
    for (const properties of poses.values()) expect(properties).toEqual(poses.get('neutral'));
  });

  it('provides distinct endpoint tracks, eased changes and eye-local attachments', () => {
    for (const name of ['neutral', 'joy', 'surprise', 'concern', 'focus', 'sleepy', 'playful'])
      expect(xml).toContain(`name="tavi/expression/${name}"`);
    expect(xml.match(/duration="260" interpolationType="cubic"/g)).toHaveLength(42);
    expect(xml).toContain('name="tavi/eye-white"');
    expect(xml).toContain('name="tavi/eye-highlight"');
    for (const pupil of ['0:507', '0:537'])
      expect(xml).toContain(
        `targetId="${pupil}" sourceSpaceValue="local" destSpaceValue="local" offset="true"`,
      );
    expect(xml).not.toContain('<Script');
  });
});
