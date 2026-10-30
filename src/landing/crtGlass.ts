import * as THREE from 'three';
import { GLASS } from './crtScreen';

// The 3D side of the CRT: only the layer renderer (tools/crt-layers) and the Avatar Lab load
// three.js. The landing page shows pre-rendered layers and a 2D screen.

/** Split the actual glass triangles out of the housing, keeping the authored curvature. */
export function extractGlass(source: THREE.BufferGeometry): THREE.BufferGeometry | null {
  const position = source.getAttribute('position');
  const normal = source.getAttribute('normal');
  const index = source.getIndex();
  if (!index || !source.hasAttribute('normal')) return null;
  const glass: number[] = [];
  const housing: number[] = [];
  const isGlass = (i: number) =>
    position.getX(i) >= GLASS.left - 0.0001 &&
    position.getX(i) <= GLASS.right + 0.0001 &&
    position.getY(i) >= GLASS.bottom - 0.0001 &&
    position.getY(i) <= GLASS.top + 0.0001 &&
    position.getZ(i) > 0.16 &&
    normal.getZ(i) > 0.95;
  for (let i = 0; i < index.count; i += 3) {
    const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    (triangle.every(isGlass) ? glass : housing).push(...triangle);
  }
  if (!glass.length) return null;
  const xyz: number[] = [];
  const normals: number[] = [];
  const uv: number[] = [];
  for (const i of glass) {
    xyz.push(position.getX(i), position.getY(i), position.getZ(i));
    normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
    const u = (position.getX(i) - GLASS.left) / (GLASS.right - GLASS.left) - 0.5;
    const v = (position.getY(i) - GLASS.bottom) / (GLASS.top - GLASS.bottom) - 0.5;
    const lens = 1 + 0.075 * (u * u + v * v);
    uv.push(0.5 + u * lens, 0.5 + v * lens);
  }
  source.setIndex(housing);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(xyz, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geometry;
}

/** The 2D screen painter's canvas as a texture for the curved glass. */
export function screenTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}
