// Renders the landing hero's CRT and table once, as separate transparent layers, from the same
// scene the page used to render live (camera, lights, shadows and the CC0 Poly Haven models).
// The page stacks them in 2D: table, Tavi behind the TV, live screen, TV housing, glass shine.
// Run through tools/crt-layers/render.mjs, which serves this page and saves each layer.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { extractGlass } from '../../src/landing/crtGlass';

type Layer = 'table' | 'tv' | 'glass-shine' | 'full';
const params = new URLSearchParams(location.search);
const layer = (params.get('layer') ?? 'full') as Layer;
const width = Number(params.get('width') ?? 1800);
const height = Math.round((width * 2) / 3);

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(1);
renderer.setSize(width, height, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const viewHeight = 0.56;
const aspect = width / height;
const camera = new THREE.OrthographicCamera(
  (-viewHeight * aspect) / 2,
  (viewHeight * aspect) / 2,
  viewHeight / 2,
  -viewHeight / 2,
  0.05,
  10,
);
camera.position.set(0, 0.228, 3);
camera.lookAt(0, 0.228, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x65574c, 2.3));
const key = new THREE.DirectionalLight(0xfff4e8, 2.6);
key.position.set(-1.25, 1.5, 1.8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -0.8;
key.shadow.camera.right = 0.8;
key.shadow.camera.top = 0.8;
key.shadow.camera.bottom = -0.4;
key.shadow.bias = -0.0004;
scene.add(key);
const fill = new THREE.PointLight(0xded6ee, 0.65, 4);
fill.position.set(0.9, 0.7, 1.4);
scene.add(fill);
const rim = new THREE.PointLight(0xffffff, 0.6, 4);
rim.position.set(-0.8, 0.55, -0.5);
scene.add(rim);

/** Seen by the shadow pass and the depth buffer, but draws no colour. */
const hide = (mesh: THREE.Mesh, depth = false) => {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    material.colorWrite = false;
    material.depthWrite = depth;
  }
};
// The page's glass material without its picture: black base, so only reflections remain.
const shine = () =>
  new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    roughness: 0.22,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.14,
  });

const loader = new GLTFLoader();
const [tv, desk] = await Promise.all([
  loader.loadAsync('/models/television-01/Television_01_1k.gltf'),
  loader.loadAsync('/models/wooden-table-02/wooden_table_02_1k.gltf'),
]);

const housings: THREE.Mesh[] = [];
const screens: THREE.Mesh[] = [];
tv.scene.traverse((child) => {
  if (!(child instanceof THREE.Mesh)) return;
  child.castShadow = true;
  child.receiveShadow = true;
  housings.push(child);
  const glass = extractGlass((child as THREE.Mesh).geometry);
  if (!glass) return;
  let material: THREE.Material;
  if (layer === 'tv')
    // Punch a clear hole where the glass is in front: the live screen shows through it.
    material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      blending: THREE.NoBlending,
    });
  else material = shine();
  const screen = new THREE.Mesh(glass, material);
  screen.matrix.copy(child.matrix);
  screen.matrixAutoUpdate = false;
  screens.push(screen);
});
tv.scene.add(...screens);
scene.add(tv.scene);

const bounds = new THREE.Box3().setFromObject(desk.scene);
const scale = 0.81 / (bounds.max.x - bounds.min.x);
desk.scene.scale.setScalar(scale);
desk.scene.position.set(0, -bounds.max.y * scale - 0.001, -0.025);
const tables: THREE.Mesh[] = [];
desk.scene.traverse((child) => {
  if (child instanceof THREE.Mesh) {
    child.castShadow = true;
    child.receiveShadow = true;
    tables.push(child);
  }
});
scene.add(desk.scene);

if (layer === 'table') {
  // The TV still casts its shadow onto the tabletop.
  housings.forEach((mesh) => {
    hide(mesh);
  });
  screens.forEach((mesh) => {
    hide(mesh);
  });
} else if (layer === 'tv') {
  tables.forEach((mesh) => {
    hide(mesh);
  });
} else if (layer === 'glass-shine') {
  // Only the glass draws; the housing still hides its rounded edges.
  housings.forEach((mesh) => {
    hide(mesh, true);
  });
  tables.forEach((mesh) => {
    hide(mesh);
  });
}

renderer.render(scene, camera);
const out = document.createElement('output');
out.id = 'done';
out.value = renderer.domElement.toDataURL('image/png');
document.body.appendChild(out);
