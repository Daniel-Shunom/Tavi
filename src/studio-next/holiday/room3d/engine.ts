import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Item, Layout } from './layouts';

// Her holiday room as a real space. A one-point-perspective box (floor, back wall, side walls)
// seen from the front, so she can still walk left and right across it. The things in it are 3D
// models placed in depth by the room's layout: some on the back wall, some at the back of the
// floor, and some in the foreground, which draw in front of her. Light is real: a soft key light
// and a lamp inside every lantern, candle and carved pumpkin. A click switches a light, or makes
// the thing hop or swing.
//
// It draws to two canvases with one camera: the room behind her, and the foreground in front of
// her. Nothing animates at rest; frames are drawn only while something is moving.

export type RoomColours = {
  wall: string;
  panel: string;
  floor: string;
  accent: string;
  second: string;
  text: string;
  line: string;
};
export type RoomMood = 'lit' | 'dim' | 'dark';

type Toy = {
  item: Item;
  root: THREE.Object3D;
  /** The model inside the root, which is what hops and swings. */
  body: THREE.Object3D;
  on: boolean;
  kickedAt: number;
  light: THREE.PointLight | null;
  materials: THREE.MeshStandardMaterial[];
  seed: number;
};

const FRONT = 1;
const KICK_SECONDS = 0.9;

export function createRoom(options: {
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
  colours: RoomColours;
  layout: Layout;
  /** Where the model files are served from, ending in a slash. */
  base: string;
  reducedMotion: boolean;
}) {
  const { colours, layout, reducedMotion } = options;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 100);
  const home = new THREE.Vector3(0, 4.2, 17);
  const target = new THREE.Vector3(0, 3.6, 0);
  camera.position.copy(home);
  camera.lookAt(target);

  // If the second renderer cannot be made, the first is released before the error leaves.
  const made: THREE.WebGLRenderer[] = [];
  const makeRenderer = (canvas: HTMLCanvasElement) => {
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      made.push(renderer);
      return renderer;
    } catch (error) {
      for (const renderer of made) renderer.dispose();
      throw error;
    }
  };
  const renderers = [options.back, options.front].map((canvas) => {
    const renderer = makeRenderer(canvas);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    return renderer;
  }) as [THREE.WebGLRenderer, THREE.WebGLRenderer];
  renderers[0].shadowMap.enabled = true;
  renderers[0].shadowMap.type = THREE.PCFShadowMap;

  const toys: Toy[] = [];
  const disposables = new Set<{ dispose: () => void }>();
  const mat = (
    color: THREE.ColorRepresentation,
    extra: THREE.MeshStandardMaterialParameters = {},
  ) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
    disposables.add(material);
    return material;
  };
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    disposables.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.receiveShadow = true;
    return object;
  };
  const mix = (a: string, b: string, amount: number) =>
    new THREE.Color(a).lerp(new THREE.Color(b), amount);

  // ---- The room itself -----------------------------------------------------------------
  const W = 10; // half width
  const BACK = -5;
  const wallColour = mix(colours.wall, layout.wall, 0.88);
  const floorTexture = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const base = mix(colours.floor, layout.floor, 0.7);
      for (let i = 0; i < 8; i++) {
        const shade = base.clone().offsetHSL(0, 0, (i % 3) * 0.015 - 0.015);
        ctx.fillStyle = `#${shade.getHexString()}`;
        ctx.fillRect(i * 64, 0, 64, 512);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(i * 64, 0, 2, 512);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.5, 1.5);
    texture.colorSpace = THREE.SRGBColorSpace;
    disposables.add(texture);
    return texture;
  })();
  const floor = mesh(new THREE.PlaneGeometry(W * 2, 14), mat(0xffffff, { map: floorTexture }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, BACK + 7);
  const wall = mesh(new THREE.PlaneGeometry(W * 2, 12), mat(wallColour));
  wall.position.set(0, 6, BACK);
  scene.add(floor, wall);
  for (const side of [-1, 1]) {
    const sideWall = mesh(
      new THREE.PlaneGeometry(14, 12),
      mat(wallColour.clone().multiplyScalar(0.8)),
    );
    sideWall.rotation.y = (-side * Math.PI) / 2;
    sideWall.position.set(side * W, 6, BACK + 7);
    scene.add(sideWall);
  }
  // Wainscot and rail give the wall a bottom and the eye a horizon.
  const wainscot = mesh(
    new THREE.BoxGeometry(W * 2, 2.6, 0.16),
    mat(mix(colours.panel, layout.trim, 0.7)),
  );
  wainscot.position.set(0, 1.3, BACK + 0.08);
  const rail = mesh(
    new THREE.BoxGeometry(W * 2, 0.18, 0.3),
    mat(mix(colours.line, layout.rail, 0.7)),
  );
  rail.position.set(0, 2.68, BACK + 0.15);
  scene.add(wainscot, rail);

  // ---- Light -----------------------------------------------------------------------------
  const ambient = new THREE.HemisphereLight(layout.sky, layout.ground, 1.5);
  const sun = new THREE.DirectionalLight(layout.sun, 1.3);
  sun.position.set(-9, 9, 6);
  sun.target.position.set(1, 0, -1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -6;
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0006;
  const fill = new THREE.PointLight(layout.fill, 26, 40, 1.4);
  fill.position.set(0, 6, 13);
  scene.add(ambient, sun, sun.target, fill);
  for (const light of [ambient, sun, fill]) light.layers.enable(FRONT);

  // ---- Running it ------------------------------------------------------------------------
  let mood: RoomMood = 'lit';
  let lively = false;
  let frame = 0;
  let disposed = false;
  const started = performance.now();
  const seconds = () => (performance.now() - started) / 1000;
  const pointer = new THREE.Vector2(0, 0);
  const eased = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  raycaster.layers.enableAll();

  function draw() {
    const time = seconds();
    const live = lively && !reducedMotion;
    let moving = live;
    const level = mood === 'lit' ? 1 : mood === 'dim' ? 0.45 : 0;
    for (const toy of toys) {
      const kick = reducedMotion ? 0 : Math.max(0, 1 - (time - toy.kickedAt) / KICK_SECONDS);
      if (kick > 0) moving = true;
      const { item, body } = toy;
      if (item.hangs) {
        body.rotation.z =
          Math.sin(kick * Math.PI * 4) * kick * 0.4 +
          (live ? Math.sin(time * 4 + toy.seed) * 0.06 : 0);
      } else {
        // A squash and a hop when pressed; volume kept.
        const squash = Math.sin(kick * Math.PI * 3) * kick * 0.12;
        body.scale.set(1 + squash, 1 - squash, 1 + squash);
        body.position.y = Math.max(0, Math.sin(kick * Math.PI)) * kick * 0.5;
      }
      const flicker = live && toy.on ? 0.84 + Math.sin(time * 13 + toy.seed) * 0.16 : 1;
      const power = toy.on ? level * flicker : 0;
      if (toy.light && item.lamp) toy.light.intensity = item.lamp.power * power;
      for (const material of toy.materials)
        material.emissiveIntensity = (item.glow ?? 0.22) * power;
    }
    ambient.intensity = mood === 'dark' ? 0.7 : 1.5;
    fill.intensity = mood === 'lit' ? 26 : mood === 'dim' ? 14 : 5;
    // A little parallax as the pointer moves gives the room its depth. With reduced motion the
    // camera stays where it is.
    if (!reducedMotion) {
      eased.lerp(pointer, 0.12);
      if (eased.distanceTo(pointer) > 0.002) moving = true;
    }
    camera.position.set(home.x + eased.x * 0.9, home.y + eased.y * 0.35, home.z);
    camera.lookAt(target);
    camera.layers.set(0);
    renderers[0].render(scene, camera);
    camera.layers.set(FRONT);
    renderers[1].render(scene, camera);
    frame = moving && !disposed ? requestAnimationFrame(draw) : 0;
  }
  const wake = () => {
    if (!frame && !disposed) frame = requestAnimationFrame(draw);
  };

  // ---- The things in it ------------------------------------------------------------------
  const loader = new GLTFLoader();
  const models = new Map<string, Promise<THREE.Object3D>>();
  const load = (model: string) => {
    let pending = models.get(model);
    if (!pending) {
      pending = loader.loadAsync(options.base + model).then((gltf) => {
        gltf.scene.traverse((node) => {
          if (!(node instanceof THREE.Mesh)) return;
          disposables.add(node.geometry as THREE.BufferGeometry);
          for (const material of [node.material].flat() as THREE.MeshStandardMaterial[]) {
            disposables.add(material);
            if (material.map) disposables.add(material.map);
          }
        });
        return gltf.scene;
      });
      models.set(model, pending);
    }
    return pending;
  };

  function place(item: Item, source: THREE.Object3D, index: number) {
    const body = source.clone(true);
    const fitted = new THREE.Group();
    fitted.add(body);
    const size = new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3());
    const scale = item.h ? item.h / size.y : (item.w ?? 1) / Math.max(size.x, size.z);
    body.scale.multiplyScalar(scale);
    const box = new THREE.Box3().setFromObject(body);
    const centre = box.getCenter(new THREE.Vector3());
    // Hanging things turn about their top; everything else stands on its base.
    body.position.x -= centre.x;
    body.position.z -= centre.z;
    body.position.y -= item.hangs ? box.max.y : box.min.y;
    const swing = new THREE.Group();
    swing.add(fitted);
    if (item.hangs) {
      fitted.position.y = 0;
      swing.position.y = box.max.y - box.min.y;
    }
    const root = new THREE.Group();
    root.add(swing);
    root.position.set(item.x, item.y ?? 0, item.z);
    root.rotation.y = item.turn ?? 0;

    const switchable = item.lamp !== undefined || item.glow !== undefined;
    const materials: THREE.MeshStandardMaterial[] = [];
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
      if (!switchable) return;
      // Its own copy of the material, so switching it does not switch its twins.
      const own = (node.material as THREE.MeshStandardMaterial).clone();
      own.emissive = new THREE.Color(0xffffff);
      own.emissiveMap = own.map;
      own.emissiveIntensity = 0;
      disposables.add(own);
      node.material = own;
      materials.push(own);
    });
    let light: THREE.PointLight | null = null;
    if (item.lamp) {
      light = new THREE.PointLight(item.lamp.colour, item.lamp.power, 9, 1.8);
      light.position.set(0, item.lamp.y ?? 0.5, item.lamp.z ?? 0);
      light.layers.enable(FRONT);
      root.add(light);
    }
    if (item.front)
      root.traverse((node) => {
        if (!(node instanceof THREE.Light)) node.layers.set(FRONT);
      });
    scene.add(root);
    if (switchable || item.toy || item.hangs)
      toys.push({
        item,
        root,
        body: item.hangs ? swing : fitted,
        on: !item.off,
        kickedAt: -10,
        light,
        materials,
        seed: index * 1.7,
      });
  }

  layout.items.forEach((item, index) => {
    load(item.model).then(
      (source) => {
        if (disposed) return;
        place(item, source, index);
        wake();
      },
      (error: unknown) => {
        console.warn(`Holiday room: could not load ${item.model}`, error);
      },
    );
  });

  function pick(nx: number, ny: number): Toy | null {
    camera.layers.enableAll();
    raycaster.setFromCamera(new THREE.Vector2(nx * 2 - 1, 1 - ny * 2), camera);
    for (const hit of raycaster.intersectObjects(
      toys.map((toy) => toy.root),
      true,
    )) {
      const toy = toys.find((entry) => {
        let node: THREE.Object3D | null = hit.object;
        while (node) {
          if (node === entry.root) return true;
          node = node.parent;
        }
        return false;
      });
      if (toy) return toy;
    }
    return null;
  }

  wake();
  return {
    resize(width: number, height: number) {
      for (const renderer of renderers) renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      wake();
    },
    setMood(next: RoomMood) {
      mood = next;
      wake();
    },
    setLively(next: boolean) {
      lively = next;
      wake();
    },
    /** The pointer, 0–1 across and down the stage. Returns true when it is over something. */
    hover(nx: number, ny: number) {
      pointer.set(nx - 0.5, 0.5 - ny);
      wake();
      return pick(nx, ny) !== null;
    },
    /** A click. Returns true when it landed on something in the room. */
    press(nx: number, ny: number) {
      const toy = pick(nx, ny);
      if (!toy) return false;
      if (toy.item.lamp !== undefined || toy.item.glow !== undefined) toy.on = !toy.on;
      toy.kickedAt = seconds();
      wake();
      return true;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      for (const item of disposables) item.dispose();
      for (const renderer of renderers) renderer.dispose();
    },
  };
}
export type RoomEngine = ReturnType<typeof createRoom>;
