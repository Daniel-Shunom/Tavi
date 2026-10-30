import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createScreenPainter } from '../landing/crtScreen';
import { extractGlass, screenTexture } from '../landing/crtGlass';
import { sampleStride } from './sampleStride';
import { TabletopPerformance } from './tabletop';
import { createFace, type FacialExpression } from './facial';

function dispose(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const mesh = object as THREE.Mesh;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material as unknown as Record<string, unknown>))
        if (value instanceof THREE.Texture) textures.add(value as THREE.Texture);
    }
  });
  textures.forEach((texture) => {
    texture.dispose();
  });
  materials.forEach((material) => {
    material.dispose();
  });
}

/** The production scene assets share one depth buffer with the actual avatar.
 * Only the character's root/rig/morphs animate; furniture never receives motion.
 */
export function TabletopStage({ hero = false }: { hero?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [expression, setExpression] = useState<FacialExpression>('neutral');
  const [status, setStatus] = useState('Loading the tabletop…');
  const latest = useRef({ playing, expression });
  latest.current = { playing, expression };
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setStatus('The tabletop needs WebGL. Try a browser with hardware acceleration.');
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute(
      'aria-label',
      '3D character walking around a fixed CRT television on a table. Drag to orbit.',
    );
    element.append(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 20);
    camera.position.set(0.1, hero ? 0.34 : 0.53, 1.85);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enabled = !hero;
    orbit.target.set(0, 0.19, 0);
    orbit.enableDamping = true;
    orbit.minDistance = 0.8;
    orbit.maxDistance = 3;
    orbit.maxPolarAngle = Math.PI * 0.49;
    scene.add(new THREE.HemisphereLight('#ffffff', '#b9a6bb', 2.8));
    const light = new THREE.DirectionalLight('#fff6e9', 3);
    light.position.set(-1, 2, 2);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = light.shadow.camera.bottom = -1;
    light.shadow.camera.right = light.shadow.camera.top = 1;
    light.shadow.bias = -0.0001;
    scene.add(light);
    const fill = new THREE.DirectionalLight('#e0d3ff', 1.2);
    fill.position.set(1, 1, -1);
    scene.add(fill);
    const actor = new THREE.Group();
    scene.add(actor);
    const painter = createScreenPainter();
    const painted = screenTexture(painter.canvas);
    const loader = new GLTFLoader();
    let disposed = false;
    let visible = true;
    const owned: THREE.Object3D[] = [];
    let mixer: THREE.AnimationMixer | undefined;
    let face: ReturnType<typeof createFace> | undefined;
    let performance: TabletopPerformance | undefined;
    let actions = new Map<string, THREE.AnimationAction>();
    let active: THREE.AnimationAction | undefined;
    let lastClip = '';
    async function load() {
      const loaded = await Promise.allSettled([
        loader.loadAsync('/models/television-01/Television_01_1k.gltf'),
        loader.loadAsync('/models/wooden-table-02/wooden_table_02_1k.gltf'),
        loader.loadAsync('/models/avatar-lab/kaykit/Tavi_Ranger.blend.glb'),
      ]);
      for (const result of loaded)
        if (result.status === 'fulfilled') owned.push(result.value.scene);
      if (disposed) {
        owned.forEach(dispose);
        return;
      }
      const tvResult = loaded[0],
        deskResult = loaded[1],
        modelResult = loaded[2];
      if (
        tvResult.status !== 'fulfilled' ||
        deskResult.status !== 'fulfilled' ||
        modelResult.status !== 'fulfilled'
      )
        throw new Error('A tabletop asset could not load. Refresh to retry.');
      const tv = tvResult.value.scene;
      const desk = deskResult.value.scene;
      const model = modelResult.value;
      tv.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const glass = extractGlass((node as THREE.Mesh).geometry);
        if (glass) {
          const screen = new THREE.Mesh(
            glass,
            new THREE.MeshStandardMaterial({
              map: painted,
              emissiveMap: painted,
              emissive: '#ffffff',
              emissiveIntensity: 0.65,
              roughness: 0.2,
              metalness: 0.05,
            }),
          );
          screen.matrix.copy(node.matrix);
          screen.matrixAutoUpdate = false;
          // Add after traversal to avoid visiting generated geometry again.
          screens.push(screen);
        }
      });
      tv.add(...screens);
      const tvBox = new THREE.Box3().setFromObject(tv);
      const deskBox = new THREE.Box3().setFromObject(desk);
      const deskScale = 1.25 / (deskBox.max.x - deskBox.min.x);
      desk.scale.setScalar(deskScale);
      desk.position.set(0, -deskBox.max.y * deskScale - 0.001, 0);
      scene.add(tv, desk);
      const bounds = new THREE.Box3().setFromObject(model.scene);
      const height = bounds.getSize(new THREE.Vector3()).y;
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = 0.23 / height;
      model.scene.scale.setScalar(scale);
      model.scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      // Calibrate at body height 2, where the contact detector's thresholds are
      // defined, then convert the measured distances back to tabletop units.
      model.scene.scale.setScalar(2 / height);
      const walk = model.animations.find((clip) => clip.name === 'Walking_A');
      if (!walk) throw new Error('The authored walk clip is missing');
      const curve = sampleStride(model.scene, walk, ['toesl', 'toesr']);
      curve.distance *= 0.23 / 2;
      curve.distances = curve.distances.map((distance) => (distance * 0.23) / 2);
      model.scene.scale.setScalar(scale);
      actor.add(model.scene);
      face = createFace(model.scene);
      const animationMixer = new THREE.AnimationMixer(model.scene);
      mixer = animationMixer;
      actions = new Map(
        model.animations.map((clip) => [clip.name, animationMixer.clipAction(clip)]),
      );
      const left = tvBox.min.x - 0.1,
        right = tvBox.max.x + 0.1;
      const front = tvBox.max.z + 0.09,
        back = tvBox.min.z - 0.09;
      const sideZ = (tvBox.max.z + tvBox.min.z) / 2;
      // Palm plane is authored at 0.44 source units in front of the rig.
      const contactX = tvBox.max.x + 0.44 * scale;
      performance = new TabletopPerformance(
        [
          { x: left, z: front },
          { x: right, z: front },
          { x: right, z: sideZ },
          { x: contactX, z: sideZ, pause: 'brace' },
          { x: right, z: sideZ },
          { x: right, z: back },
          { x: left, z: back },
          { x: left, z: front },
        ],
        curve,
      );
      for (const object of [tv, desk, model.scene])
        object.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
      setStatus('Autonomous tabletop · shared depth, planted hand contact and facial controls');
    }
    const screens: THREE.Mesh[] = [];
    void load().catch((error: unknown) => {
      if (!disposed)
        setStatus(error instanceof Error ? error.message : 'The tabletop could not load.');
    });
    const resize = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.position.z = Math.max(1.85, 1.05 / camera.aspect);
      camera.updateProjectionMatrix();
    });
    resize.observe(element);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    observer.observe(element);
    let previous = 0;
    let time = 0;
    renderer.setAnimationLoop((now) => {
      const dt = previous ? Math.min(0.05, (now - previous) / 1000) : 0;
      previous = now;
      if (!visible || document.hidden) return;
      const motionDt = latest.current.playing ? dt : 0;
      time += motionDt;
      if (performance && mixer) {
        const frame = performance.update(motionDt);
        actor.position.set(frame.x, 0, frame.z);
        actor.rotation.y = frame.yaw;
        if (lastClip !== frame.clip) {
          const next = actions.get(frame.clip);
          if (next) {
            next.reset().setEffectiveWeight(1).play();
            next.setLoop(frame.clip === 'Tavi_Brace' ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
            next.clampWhenFinished = frame.clip === 'Tavi_Brace';
            if (active) active.crossFadeTo(next, 0.25, false);
            active = next;
          }
          lastClip = frame.clip;
        }
        mixer.update(motionDt);
        if (active) {
          active.time = frame.clipTime;
          mixer.update(0);
        }
        face?.update(motionDt, latest.current.expression, Math.sin(time * 0.45) * 0.6);
        element.dataset['phase'] = frame.phase;
      }
      painter.paint(
        time * 1000,
        { started: true, starting: false, avatar: null, walker: null, screen: null, webcam: null },
        !latest.current.playing,
      );
      painted.needsUpdate = true;
      orbit.update();
      renderer.render(scene, camera);
    });
    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      resize.disconnect();
      observer.disconnect();
      orbit.dispose();
      mixer?.stopAllAction();
      dispose(scene);
      for (const object of owned) if (!object.parent) dispose(object);
      painter.dispose();
      painted.dispose();
      light.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [hero]);
  if (hero) return <div className="avatar-tabletop-hero">
    <div className="avatar-tabletop-canvas" ref={host} />
    <p className="visually-hidden" role="status">{status}</p>
  </div>;
  return (
    <section className="avatar-tabletop" aria-labelledby="tabletop-heading">
      <div className="avatar-lab-card-title">
        <h2 id="tabletop-heading">A little life around the TV.</h2>
      </div>
      <div className="avatar-tabletop-canvas" ref={host} />
      <div className="avatar-lab-toolbar">
        <button
          onClick={() => {
            setPlaying((value) => !value);
          }}
        >
          {playing ? 'Pause tabletop' : 'Play tabletop'}
        </button>
        <label>
          Expression
          <select
            value={expression}
            onChange={(event) => {
              setExpression(event.target.value as FacialExpression);
            }}
          >
            <option value="auto">Automatic</option>
            <option value="neutral">Neutral</option>
            <option value="happy">Happy</option>
            <option value="surprised">Surprised</option>
          </select>
        </label>
      </div>
      <p role="status">{status}</p>
    </section>
  );
}
