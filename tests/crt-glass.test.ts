import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BufferGeometry, BufferAttribute } from 'three';
import { expect, it } from 'vitest';
import { extractGlass } from '../src/landing/crtGlass';

it('maps the actual curved CRT glass without removing any housing triangles', () => {
  const root = new URL('../public/models/television-01/', import.meta.url);
  const model = JSON.parse(readFileSync(new URL('Television_01_1k.gltf', root), 'utf8')) as {
    accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number }[];
    bufferViews: { byteOffset?: number }[];
    meshes: {
      primitives: { attributes: { POSITION: number; NORMAL: number }; indices: number }[];
    }[];
  };
  const bytes = readFileSync(new URL('Television_01.bin', root));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const attribute = (id: number, size: number) => {
    const accessor = model.accessors[id];
    assert(accessor);
    const view = model.bufferViews[accessor.bufferView];
    assert(view);
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const values =
      accessor.componentType === 5126
        ? new Float32Array(buffer, offset, accessor.count * size)
        : new Uint16Array(buffer, offset, accessor.count * size);
    return new BufferAttribute(values, size);
  };
  const primitive = model.meshes[0]?.primitives[0];
  assert(primitive);
  const housing = new BufferGeometry();
  housing.setAttribute('position', attribute(primitive.attributes.POSITION, 3));
  housing.setAttribute('normal', attribute(primitive.attributes.NORMAL, 3));
  housing.setIndex(attribute(primitive.indices, 1));
  assert(housing.index);
  const total = housing.index.count;
  const glass = extractGlass(housing);
  assert(glass);
  expect(glass).not.toBeNull();
  expect(glass.getAttribute('position').count).toBe(162 * 3);
  expect(housing.index.count + glass.getAttribute('position').count).toBe(total);
  glass.computeBoundingBox();
  assert(glass.boundingBox);
  expect(glass.boundingBox.max.z - glass.boundingBox.min.z).toBeGreaterThan(0.02);
  // A second pass must not pull any bezel triangles into the screen.
  expect(extractGlass(housing)).toBeNull();
});
