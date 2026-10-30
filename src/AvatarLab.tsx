import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './avatar-lab.css';
import { retargetSharedRigClip } from './avatar-lab/retarget';
import { sampleStride } from './avatar-lab/sampleStride';
import { WalkShuttle } from './avatar-lab/shuttle';
import type { StrideCurve } from './avatar-lab/stride';
import { TabletopStage } from './avatar-lab/TabletopStage';

type Action = 'idle' | 'walk' | 'run' | 'look' | 'rest';
const assets = '/models/avatar-lab/';
const models = {
  kaykit: {
    name: 'KayKit',
    file: 'kaykit/Tavi_Ranger.blend.glb',
    source: 'https://kaylousberg.itch.io/kaykit-adventurers',
  },
  quaternius: {
    name: 'Quaternius',
    file: 'quaternius/Superhero_Female_FullBody.gltf',
    source: 'https://quaternius.itch.io/universal-base-characters',
  },
} as const;
type Family = keyof typeof models;
type Controls = { action: Action; yaw: number; playing: boolean; speed: number; travel: boolean };

function disposeObjects(roots: THREE.Object3D[]) {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  for (const root of roots)
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh) && !(node instanceof THREE.LineSegments)) return;
      const drawable = node as THREE.Mesh;
      drawable.geometry.dispose();
      for (const material of Array.isArray(drawable.material)
        ? drawable.material
        : [drawable.material]) {
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

function Preview({ family, controls }: { family: Family; controls: Controls }) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(controls);
  latest.current = controls;
  const [status, setStatus] = useState('Loading model…');
  const [error, setError] = useState('');
  const [cycleTravel, setCycleTravel] = useState<{ walk: number; run: number } | null>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setError('WebGL could not start.');
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor('#f5f2ed');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.setAttribute(
      'aria-label',
      `${models[family].name} 3D character preview. Drag to orbit; scroll to zoom.`,
    );
    element.append(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
    camera.position.set(0, 1.3, 5.7);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.target.set(0, 1.05, 0);
    orbit.enableDamping = true;
    orbit.minDistance = 2.8;
    orbit.maxDistance = 8;
    orbit.maxPolarAngle = Math.PI * 0.52;
    scene.add(new THREE.HemisphereLight('#ffffff', '#a79cba', 2.5));
    const sun = new THREE.DirectionalLight('#fff4e5', 3);
    sun.position.set(3, 5, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#d7cdff', 1.5);
    fill.position.set(-3, 2, -2);
    scene.add(fill);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.6, 64),
      new THREE.MeshStandardMaterial({ color: '#e9e3d9', roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(7, 28, '#d1c5df', '#ded7cd');
    grid.position.y = 0.002;
    scene.add(grid);
    const table = new THREE.Group();
    scene.add(table);
    let disposed = false;
    const isDisposed = (): boolean => disposed;
    let mixer: THREE.AnimationMixer | null = null;
    let active: THREE.AnimationAction | null = null;
    let lastAction = '';
    let ready = false;
    const clips = new Map<Action, THREE.AnimationClip>();
    const strides = new Map<Action, StrideCurve>();
    let shuttle = new WalkShuttle();
    let previousTravel = false;
    let travelAction: Action = 'walk';
    const loader = new GLTFLoader();
    const ownedScenes: THREE.Object3D[] = [];
    async function load() {
      const model = await loader.loadAsync(assets + models[family].file);
      ownedScenes.push(model.scene);
      if (isDisposed()) return;
      model.scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      const box = new THREE.Box3().setFromObject(model.scene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      if (family === 'kaykit') {
        for (const [action, name] of [
          ['idle', 'Idle_A'],
          ['walk', 'Walking_A'],
          ['run', 'Running_A'],
          ['look', 'Tavi_LookAround'],
        ] as const) {
          const clip = model.animations.find((item) => item.name === name);
          if (!clip) throw new Error(`Missing Blender export animation ${name}`);
          clips.set(action, clip);
        }
      } else {
        const motion = await loader.loadAsync(assets + 'quaternius/UAL1_Standard.glb');
        ownedScenes.push(motion.scene);
        for (const [action, name] of [
          ['idle', 'Idle_Loop'],
          ['walk', 'Walk_Loop'],
          ['run', 'Jog_Fwd_Loop'],
        ] as const) {
          const clip = motion.animations.find((item) => item.name === name);
          if (!clip) throw new Error(`Missing animation ${name}`);
          clips.set(action, retargetSharedRigClip(clip, motion.scene, model.scene));
        }
        const idle = clips.get('idle');
        if (idle) clips.set('look', idle);
      }
      if (isDisposed()) return;
      const scale = 2 / size.y;
      model.scene.scale.setScalar(scale);
      model.scene.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      table.add(model.scene);
      const footNames: [string, string] =
        family === 'kaykit' ? ['toesl', 'toesr'] : ['ball_l', 'ball_r'];
      for (const action of ['walk', 'run'] as const) {
        const clip = clips.get(action);
        if (clip) strides.set(action, sampleStride(model.scene, clip, footNames));
      }
      setCycleTravel({
        walk: (strides.get('walk')?.distance ?? 0) / 2,
        run: (strides.get('run')?.distance ?? 0) / 2,
      });
      mixer = new THREE.AnimationMixer(model.scene);
      ready = true;
      setStatus(
        family === 'kaykit'
          ? 'Blender export · idle, walk, run and authored look around'
          : 'Shared humanoid rig · rest-pose compensation',
      );
    }
    void load()
      .catch((reason: unknown) => {
        if (!disposed)
          setError(reason instanceof Error ? reason.message : 'Could not load the character.');
      })
      .finally(() => {
        if (disposed) disposeObjects(ownedScenes);
      });
    const resize = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      if (latest.current.travel)
        camera.position.set(
          0,
          1.4,
          Math.max(5.7, 3 / Math.tan(THREE.MathUtils.degToRad(17)) / camera.aspect),
        );
    });
    resize.observe(element);
    let visible = true;
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    visibility.observe(element);
    let previous = 0;
    renderer.setAnimationLoop((now) => {
      const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      if (document.hidden || !visible) return;
      const state = latest.current;
      const motionDt = state.playing ? dt * state.speed : 0;
      let desiredAction = state.action;
      let yaw = state.yaw;
      const curve = state.action === 'walk' ? strides.get('walk') : undefined;
      if (ready && state.travel && curve) {
        if (!previousTravel || travelAction !== state.action) {
          shuttle = new WalkShuttle(table.position.x);
          travelAction = state.action;
          camera.position.set(
            0,
            1.4,
            Math.max(5.7, 3 / Math.tan(THREE.MathUtils.degToRad(17)) / camera.aspect),
          );
          orbit.target.set(0, 1.05, 0);
        }
        const frame = shuttle.update(motionDt, curve);
        table.position.x = frame.x;
        yaw = frame.yaw;
        desiredAction = frame.walking ? state.action : 'idle';
        element.dataset['travelState'] = frame.state;
      } else element.dataset['travelState'] = 'in-place';
      previousTravel = ready && state.travel && Boolean(curve);
      if (ready && lastAction !== desiredAction) {
        const clip = clips.get(desiredAction);
        if (clip && mixer) {
          const next = mixer.clipAction(clip);
          next.reset().setEffectiveWeight(1).play();
          if (active) active.crossFadeTo(next, 0.35, false);
          active = next;
        } else {
          mixer?.stopAllAction();
          active = null;
        }
        lastAction = desiredAction;
      }
      if (mixer) mixer.update(motionDt);
      const target = new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
      table.quaternion.slerp(target, 1 - Math.exp(-(state.travel ? motionDt : dt) * 8));
      orbit.update();
      renderer.render(scene, camera);
    });
    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      resize.disconnect();
      visibility.disconnect();
      orbit.dispose();
      mixer?.stopAllAction();
      disposeObjects([scene, ...ownedScenes]);
      sun.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [family]);
  return (
    <article className="avatar-lab-card">
      <div className="avatar-lab-card-title">
        <h2>{models[family].name}</h2>
        <a href={models[family].source} target="_blank" rel="noreferrer">
          Asset source ↗
        </a>
      </div>
      <div className="avatar-lab-canvas" ref={host} />
      <p role="status">
        {error || status}
        {!error && cycleTravel && (controls.action === 'walk' || controls.action === 'run')
          ? ` · measured cycle travel ${cycleTravel[controls.action].toFixed(2)} body heights`
          : ''}
      </p>
    </article>
  );
}

export function AvatarLab() {
  const [controls, setControls] = useState<Controls>({
    action: 'walk',
    yaw: 0,
    playing: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    speed: 1,
    travel: true,
  });
  return (
    <main className="avatar-lab">
      <header>
        <a href="/">← Tavi</a>
        <span>Avatar experiment · 3D</span>
      </header>
      <h1>A different way to move.</h1>
      <p className="avatar-lab-intro">
        Compare the original character rigs before choosing Tavi’s next foundation. Drag either
        scene to inspect its shape from every side.
      </p>
      <TabletopStage />
      <div className="avatar-lab-toolbar" aria-label="Comparison controls">
        <label>
          Motion
          <select
            value={controls.action}
            onChange={(event) => {
              setControls((value) => ({
                ...value,
                action: event.target.value as Action,
                travel: value.travel && event.target.value === 'walk',
              }));
            }}
          >
            <option value="idle">Idle</option>
            <option value="walk">Walk</option>
            <option value="run">Run in place</option>
            <option value="look">Look around (KayKit study)</option>
            <option value="rest">Rest pose</option>
          </select>
        </label>
        <label>
          Playback
          <select
            value={controls.speed}
            onChange={(event) => {
              setControls((value) => ({ ...value, speed: Number(event.target.value) }));
            }}
          >
            <option value={0.5}>Half speed</option>
            <option value={1}>Normal</option>
          </select>
        </label>
        <label className="avatar-lab-travel">
          <input
            type="checkbox"
            checked={controls.travel}
            onChange={(event) => {
              setControls((value) => ({ ...value, travel: event.target.checked, action: 'walk' }));
            }}
          />
          Walk across floor
        </label>
        <button
          onClick={() => {
            setControls((value) => ({ ...value, playing: !value.playing }));
          }}
        >
          {controls.playing ? 'Pause motion' : 'Play motion'}
        </button>
        <div className="avatar-lab-directions" aria-label="Character facing">
          {[
            ['Left', -Math.PI / 2],
            ['Front', 0],
            ['Right', Math.PI / 2],
          ].map(([name, yaw]) => (
            <button
              key={name}
              aria-pressed={controls.yaw === yaw}
              disabled={controls.travel}
              title={controls.travel ? 'Turn off floor travel to choose a fixed facing' : undefined}
              onClick={() => {
                setControls((value) => ({ ...value, yaw: Number(yaw) }));
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="avatar-lab-grid">
        <Preview family="kaykit" controls={controls} />
        <Preview family="quaternius" controls={controls} />
      </div>
      <p className="avatar-lab-note">
        Both rigs walk forward, stop, turn and return. Floor travel is derived from each clip’s
        low-foot motion. Turn off floor travel for an in-place pose comparison. These are comparison
        characters; contact accuracy and final Tavi design are still under review.
      </p>
    </main>
  );
}
