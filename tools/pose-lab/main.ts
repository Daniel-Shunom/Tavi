// Pose lab (dev only, served by Vite at /tools/pose-lab/): pick a character and a beat, scrub the
// timeline, onion-skin the key poses, toggle a silhouette view and the line-of-action, skeleton
// and contact overlays against the scene frames, tweak key poses with sliders and export the beat.
// The character is drawn through its production binding (puppet.ts); overlays come from the proxy
// rig that the automated checks use, so what the checks measure is what you see drawn on top.
import { RuntimeLoader } from '@rive-app/webgl2';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import { defaultScene } from '../../shared/states';
import { anchors } from '../../shared/locomotion';
import { lylaProxy, lylaV2Proxy } from '../../src/renderer/characters/mascot/pose';
import {
  checkBeat,
  contactGap,
  spine,
  CONTACT_TOLERANCE,
  type Finding,
} from '../../src/renderer/motion/pose/checks';
import { channelSpecs } from '../../src/renderer/motion/pose/contract';
import { foldElbows } from '../../src/renderer/motion/pose/ik';
import { joints, type Joints, type ProxyRig, type Vec } from '../../src/renderer/motion/pose/proxy';
import { defineBeat, type Beat, type BeatInput } from '../../src/renderer/motion/pose/schema';
import { channelNames, type Channel } from '../../src/renderer/motion/types';
import { createPuppet, type Puppet } from './puppet';
import { allSources, beatSource, type Sampled, type Source } from './sources';

RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);

const W = 1280,
  H = 720;
/** Body height in overlay pixels (the 600-unit artboard at 1280 x 720). */
const BODY = 176;
const home = anchors.webcam;
const params = new URLSearchParams(location.search);

const $ = <T extends HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error('missing #' + id);
  return element as T;
};
const stage = $<HTMLDivElement>('stage');
const wrap = $<HTMLDivElement>('stageWrap');
const puppetCanvas = $<HTMLCanvasElement>('puppet');
const onionCanvas = $<HTMLCanvasElement>('onion');
const overlay = $<HTMLCanvasElement>('overlay');
const ratio = Math.min(devicePixelRatio || 1, 2);
for (const c of [onionCanvas, overlay]) {
  c.width = W * ratio;
  c.height = H * ratio;
}
const octx = overlay.getContext('2d')!;
const onionCtx = onionCanvas.getContext('2d')!;

const proxies: Record<string, ProxyRig> = { mascot: lylaProxy, 'mascot-v2': lylaV2Proxy };
const state = {
  character: params.get('character') ?? 'mascot-v2',
  sources: allSources(),
  source: null as Source | null,
  t: Number(params.get('t') ?? 0),
  playing: false,
  speed: 1,
  key: 0,
  view: (params.get('view') ?? 'overlay') as 'overlay' | 'large',
  onion: params.get('onion') !== '0',
  silhouette: params.has('silhouette'),
  skeleton: params.get('skeleton') !== '0',
  loa: params.get('loa') !== '0',
  contacts: params.get('contacts') !== '0',
  scene: params.get('scene') !== '0',
};
let puppet: Puppet | null = null;
const runtimePromise = RuntimeLoader.awaitInstance();

/** Where the beat's origin sits on the stage (CSS px). */
function origin(source: Source): Vec {
  const x = home.x * W;
  if (source.frame === 'ledge') return { x, y: defaultScene.webcam.y * H };
  return { x, y: home.y * H };
}
const toStage = (source: Source, p: Vec): Vec => {
  const o = origin(source);
  return { x: o.x + p.x * BODY, y: o.y - p.y * BODY };
};

function rig(): ProxyRig {
  return proxies[state.character] ?? lylaV2Proxy;
}

/** Pose as the character receives it (v1 folds the elbows into the shoulders). */
function forCharacter(sample: Sampled) {
  const r = rig();
  return r.capabilities.elbows ? sample.pose : foldElbows(lylaV2Proxy, sample.pose);
}

function render(target: Puppet, sample: Sampled, source: Source) {
  target.pose(forCharacter(sample));
  const o = origin(source);
  target.draw({
    x: o.x + sample.place.dx * BODY,
    y: o.y - sample.place.lift * BODY + sample.place.dy * BODY,
    bodyPx: BODY,
    rotation: sample.place.rot,
    facing: 1,
    scaleX: sample.place.scaleX,
    scaleY: sample.place.scaleY,
  });
}

function clipStyle(source: Source, sample: Sampled) {
  if (sample.clipBelow === null) return '';
  const y = toStage(source, { x: 0, y: sample.clipBelow }).y;
  return `inset(0 0 ${String(Math.max(0, H - y))}px 0)`;
}

function drawOnion(source: Source) {
  onionCtx.setTransform(1, 0, 0, 1, 0, 0);
  onionCtx.clearRect(0, 0, onionCanvas.width, onionCanvas.height);
  if (!state.onion || !puppet) return;
  const r = rig();
  source.keys.forEach((key, index) => {
    const sample = source.sample(key.at, r);
    render(puppet!, sample, source);
    onionCtx.save();
    onionCtx.globalAlpha = 0.18 + (0.12 * index) / Math.max(1, source.keys.length - 1);
    if (sample.clipBelow !== null) {
      const y = toStage(source, { x: 0, y: sample.clipBelow }).y * ratio;
      onionCtx.beginPath();
      onionCtx.rect(0, 0, onionCanvas.width, y);
      onionCtx.clip();
    }
    onionCtx.drawImage(puppetCanvas, 0, 0, onionCanvas.width, onionCanvas.height);
    onionCtx.restore();
  });
}

function line(points: Vec[], color: string, width = 2, dash: number[] = []) {
  octx.strokeStyle = color;
  octx.lineWidth = width;
  octx.setLineDash(dash);
  octx.beginPath();
  points.forEach((p, i) => (i ? octx.lineTo(p.x, p.y) : octx.moveTo(p.x, p.y)));
  octx.stroke();
  octx.setLineDash([]);
}
function dot(p: Vec, color: string, r = 4) {
  octx.fillStyle = color;
  octx.beginPath();
  octx.arc(p.x, p.y, r, 0, Math.PI * 2);
  octx.fill();
}

function drawOverlay(source: Source, sample: Sampled, j: Joints) {
  octx.setTransform(ratio, 0, 0, ratio, 0, 0);
  octx.clearRect(0, 0, W, H);
  const S = (p: Vec) => toStage(source, p);
  // Surfaces and the clip line.
  for (const surface of source.surfaces) {
    if (surface.kind === 'wall') {
      line([S({ x: surface.at, y: -0.2 }), S({ x: surface.at, y: 1.2 })], '#ffd54f', 2);
    } else {
      const a = S({ x: surface.from ?? -0.8, y: surface.at }),
        b = S({ x: surface.to ?? 0.8, y: surface.at });
      line([a, b], '#ffd54f', 2);
      octx.fillStyle = '#ffd54f';
      octx.font = '11px sans-serif';
      octx.fillText(surface.id, b.x + 4, b.y + 4);
    }
  }
  if (sample.clipBelow !== null) {
    const y = S({ x: 0, y: sample.clipBelow }).y;
    line(
      [
        { x: 0, y },
        { x: W, y },
      ],
      '#ff5252',
      1,
      [6, 4],
    );
  }
  if (state.skeleton) {
    const bone = (a: Vec, b: Vec, color = '#00e5ff') => line([S(a), S(b)], color, 2);
    bone(j.shoulderL, j.elbowL);
    bone(j.elbowL, j.handL);
    bone(j.shoulderR, j.elbowR);
    bone(j.elbowR, j.handR);
    bone(j.hips, j.kneeL, '#80deea');
    bone(j.kneeL, j.soleL, '#80deea');
    bone(j.hips, j.kneeR, '#80deea');
    bone(j.kneeR, j.soleR, '#80deea');
    line([...j.torsoQuad, j.torsoQuad[0]].map(S), 'rgba(0,229,255,.6)', 1);
    const c = S(j.head.centre);
    octx.strokeStyle = 'rgba(0,229,255,.7)';
    octx.lineWidth = 1;
    octx.beginPath();
    octx.ellipse(c.x, c.y, j.head.rx * BODY, j.head.ry * BODY, -j.head.angle, 0, Math.PI * 2);
    octx.stroke();
  }
  if (state.loa) {
    // Line of action: a smooth curve through soles, hips, neck and head centre.
    const pts = spine(j).map(S);
    octx.strokeStyle = '#ff4081';
    octx.lineWidth = 3;
    octx.beginPath();
    const [p0, p1, p2, p3] = pts;
    if (p0 && p1 && p2 && p3) {
      octx.moveTo(p0.x, p0.y);
      octx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }
    octx.stroke();
    // Centre of mass and its plumb line.
    const com = S(j.com);
    dot(com, '#ff4081', 5);
    line([com, { x: com.x, y: S({ x: 0, y: 0 }).y }], 'rgba(255,64,129,.6)', 1, [3, 3]);
  }
  if (state.contacts) {
    for (const contact of sample.contacts) {
      const gap = contactGap(j, contact, source.surfaces, rig());
      const ok = Math.abs(gap) <= (contact.tolerance ?? CONTACT_TOLERANCE);
      const part =
        contact.part === 'head'
          ? j.head.centre
          : (j[contact.part as Exclude<typeof contact.part, 'head'>] as Vec);
      dot(S(part), ok ? '#69f0ae' : '#ff1744', 6);
    }
    for (const target of [sample.reach.L, sample.reach.R]) {
      if (!target) continue;
      const p = S(target);
      line(
        [
          { x: p.x - 6, y: p.y },
          { x: p.x + 6, y: p.y },
        ],
        '#fff',
        1,
      );
      line(
        [
          { x: p.x, y: p.y - 6 },
          { x: p.x, y: p.y + 6 },
        ],
        '#fff',
        1,
      );
    }
  }
}

function frame() {
  const source = state.source;
  if (!source || !puppet) return;
  const sample = source.sample(state.t, rig());
  render(puppet, sample, source);
  puppetCanvas.style.clipPath = clipStyle(source, sample);
  drawOverlay(source, sample, joints(rig(), sample.pose, sample.place));
  $('time').textContent = `${state.t.toFixed(2)} s / ${source.duration.toFixed(2)} s`;
  ($('scrub') as HTMLInputElement).value = String(
    Math.round((state.t / Math.max(0.01, source.duration)) * 1000),
  );
  document.body.dataset['t'] = state.t.toFixed(3);
}

function layout() {
  const source = state.source;
  const bounds = wrap.getBoundingClientRect();
  if (state.view === 'overlay' || !source) {
    const k = Math.min(bounds.width / W, bounds.height / H);
    stage.style.transform = `scale(${String(k)})`;
  } else {
    const k = Math.min(bounds.width, bounds.height) / (BODY * 1.35);
    const o = origin(source);
    const cy = o.y - (source.frame === 'edge' ? 0.15 : 0.45) * BODY;
    stage.style.transform = `translate(${String(bounds.width / 2 - o.x * k)}px, ${String(bounds.height / 2 - cy * k)}px) scale(${String(k)})`;
  }
  const scene = defaultScene;
  for (const id of ['webcam', 'chat'] as const) {
    const rect = scene[id];
    const el = $(id);
    el.style.left = `${String(rect.x * W)}px`;
    el.style.top = `${String(rect.y * H)}px`;
    el.style.width = `${String(rect.w * W)}px`;
    el.style.height = `${String(rect.h * H)}px`;
    el.hidden = !state.scene;
  }
  stage.classList.toggle('plain', !state.scene);
  puppetCanvas.classList.toggle('silhouette', state.silhouette);
  onionCanvas.classList.toggle('silhouette', state.silhouette);
}

function showFindings(findings: Finding[]) {
  const list = $('findings');
  list.replaceChildren();
  if (!findings.length) {
    const li = document.createElement('li');
    li.className = 'ok';
    li.textContent = 'All measurable rubric items pass.';
    list.append(li);
  }
  for (const f of findings) {
    const li = document.createElement('li');
    li.className = f.level;
    li.textContent = `[${f.rule}] ${f.where}: ${f.message}`;
    list.append(li);
  }
  document.body.dataset['findings'] = JSON.stringify(findings);
}

function rebuildPanel() {
  const source = state.source;
  const keys = $('keys');
  keys.replaceChildren();
  if (!source) return;
  source.keys.forEach((key, index) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = key.name;
    b.className = index === state.key ? 'active' : '';
    b.onclick = () => {
      state.key = index;
      state.t = key.at;
      rebuildPanel();
      frame();
    };
    keys.append(b);
  });
  const sliders = $('sliders');
  sliders.replaceChildren();
  const beat = source.beat;
  const key = beat?.keys[state.key];
  if (!beat || !key) {
    sliders.textContent = 'Runtime sources are read-only. Author a beat to edit.';
    showFindings([]);
    return;
  }
  const slider = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    set: (v: number) => void,
  ) => {
    const row = document.createElement('div');
    row.className = 'slider';
    const name = document.createElement('span');
    name.textContent = label;
    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = String(value);
    const num = document.createElement('input');
    num.type = 'number';
    num.step = String(step);
    num.value = String(value);
    const commit = (v: number) => {
      range.value = num.value = String(v);
      set(v);
    };
    range.oninput = () => commit(Number(range.value));
    num.onchange = () => commit(Number(num.value));
    row.append(name, range, num);
    sliders.append(row);
  };
  const edit = (mutate: (input: BeatInput) => void) => {
    const input = structuredClone(beat) as BeatInput;
    mutate(input);
    try {
      const next = defineBeat(input);
      const index = state.sources.indexOf(source);
      const replaced = beatSource(next);
      state.sources[index] = replaced;
      state.source = replaced;
      state.t = next.keys[state.key]?.at ?? state.t;
      drawOnion(replaced);
      showFindings(checkBeat(next, rig()).findings);
      frame();
    } catch (error) {
      $('status').textContent = String(error);
    }
  };
  for (const field of ['lift', 'dx', 'dy', 'rot'] as const) {
    const value = key.place[field] ?? 0;
    const range = field === 'rot' ? 90 : field === 'lift' ? 1.5 : 0.3;
    slider(`place.${field}`, value, -range, range, field === 'rot' ? 0.5 : 0.002, (v) =>
      edit((input) => {
        const k = input.keys[state.key];
        if (k) k.place = { ...k.place, [field]: v };
      }),
    );
  }
  for (const [channel, value] of Object.entries(key.pose) as [Channel, number][]) {
    const spec = channelSpecs[channel];
    slider(channel, value, spec.min, spec.max, spec.discrete ? 1 : 0.005, (v) =>
      edit((input) => {
        const k = input.keys[state.key];
        if (k) k.pose = { ...k.pose, [channel]: v };
      }),
    );
  }
  for (const side of ['L', 'R'] as const) {
    const reach = key.reach[side];
    if (!reach) continue;
    for (const axis of ['x', 'y'] as const)
      slider(`reach${side}.${axis}`, reach.at[axis], -0.6, 1, 0.002, (v) =>
        edit((input) => {
          const r = input.keys[state.key]?.reach?.[side];
          if (r) r.at = { ...r.at, [axis]: v };
        }),
      );
  }
  const add = $<HTMLSelectElement>('addChannel');
  add.replaceChildren(new Option('…', ''));
  for (const name of channelNames) if (!(name in key.pose)) add.append(new Option(name, name));
  add.onchange = () => {
    const channel = add.value as Channel;
    if (!channel) return;
    edit((input) => {
      const k = input.keys[state.key];
      if (k) k.pose = { ...k.pose, [channel]: 0 };
    });
    rebuildPanel();
  };
  showFindings(checkBeat(beat, rig()).findings);
}

async function load() {
  const runtime = await runtimePromise;
  puppet = await createPuppet(runtime, puppetCanvas, state.character);
  puppet.resize(W, H);
  const source = state.source;
  if (source) drawOnion(source);
  frame();
}

function choose(id: string) {
  state.source = state.sources.find((s) => s.id === id) ?? state.sources[0] ?? null;
  state.key = 0;
  state.t = Math.min(state.t, state.source?.duration ?? 0);
  layout();
  rebuildPanel();
  if (state.source) drawOnion(state.source);
  frame();
}

function setup() {
  const characterSelect = $<HTMLSelectElement>('character');
  for (const id of Object.keys(proxies))
    characterSelect.append(new Option(id, id, false, id === state.character));
  characterSelect.onchange = () => {
    state.character = characterSelect.value;
    void load().then(rebuildPanel);
  };
  const beatSelect = $<HTMLSelectElement>('beat');
  for (const s of state.sources) beatSelect.append(new Option(s.label, s.id));
  beatSelect.value = params.get('beat') ?? state.sources[0]?.id ?? '';
  beatSelect.onchange = () => choose(beatSelect.value);
  const toggle = (
    id: string,
    key: 'onion' | 'silhouette' | 'skeleton' | 'loa' | 'contacts' | 'scene',
  ) => {
    const box = $<HTMLInputElement>(id);
    box.checked = state[key];
    box.onchange = () => {
      state[key] = box.checked;
      layout();
      if (state.source) drawOnion(state.source);
      frame();
    };
  };
  toggle('onionToggle', 'onion');
  toggle('silhouetteToggle', 'silhouette');
  toggle('skeletonToggle', 'skeleton');
  toggle('loaToggle', 'loa');
  toggle('contactsToggle', 'contacts');
  toggle('sceneToggle', 'scene');
  const view = $<HTMLSelectElement>('view');
  view.value = state.view;
  view.onchange = () => {
    state.view = view.value as 'overlay' | 'large';
    layout();
  };
  $<HTMLInputElement>('scrub').oninput = (event) => {
    const v = Number((event.target as HTMLInputElement).value) / 1000;
    state.t = v * (state.source?.duration ?? 0);
    frame();
  };
  $<HTMLSelectElement>('speed').onchange = (event) => {
    state.speed = Number((event.target as HTMLSelectElement).value);
  };
  const play = $<HTMLButtonElement>('play');
  play.onclick = () => {
    state.playing = !state.playing;
    play.textContent = state.playing ? 'Pause' : 'Play';
    if (state.playing && state.t >= (state.source?.duration ?? 0)) state.t = 0;
  };
  $('export').onclick = () => {
    const beat = state.source?.beat;
    $<HTMLTextAreaElement>('exported').value = beat ? JSON.stringify(beat, null, 2) : '';
  };
  addEventListener('resize', layout);
  let last = performance.now();
  const tick = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    if (state.playing && state.source) {
      state.t += dt * state.speed;
      if (state.t > state.source.duration) state.t = 0;
      frame();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  choose(beatSelect.value);
}

/** Scripting API for the screenshot script (tools/pose-lab/shoot.mjs). */
Object.assign(window, {
  poseLab: {
    sources: () =>
      state.sources.map((s) => ({ id: s.id, label: s.label, duration: s.duration, keys: s.keys })),
    async set(options: {
      character?: string;
      beat?: string;
      t?: number;
      view?: 'overlay' | 'large';
      onion?: boolean;
      silhouette?: boolean;
      overlays?: boolean;
    }) {
      if (options.character && options.character !== state.character) {
        state.character = options.character;
        await load();
      }
      if (options.onion !== undefined) state.onion = options.onion;
      if (options.silhouette !== undefined) state.silhouette = options.silhouette;
      if (options.overlays !== undefined)
        state.skeleton = state.loa = state.contacts = options.overlays;
      if (options.view) state.view = options.view;
      if (options.beat) {
        ($('beat') as HTMLSelectElement).value = options.beat;
        choose(options.beat);
      }
      if (options.t !== undefined) state.t = options.t;
      layout();
      if (state.source) drawOnion(state.source);
      frame();
      return state.source
        ? {
            duration: state.source.duration,
            keys: state.source.keys,
            origin: origin(state.source),
            frame: state.source.frame,
          }
        : null;
    },
    findings: () => (state.source?.beat ? checkBeat(state.source.beat, rig()).findings : []),
  },
});

setup();
load()
  .then(() => {
    $('status').textContent =
      'Ready. Proxy overlays: cyan skeleton, pink line of action and centre of mass, contacts green/red.';
    document.body.dataset['ready'] = 'true';
  })
  .catch((error: unknown) => {
    console.error(error);
    $('status').textContent = String(error);
    document.body.dataset['error'] = String(error);
  });
