// Motion lab (dev only, served by Vite at /tools/motion-lab/; not part of the build or overlay).
// Left stage reproduces the previous renderer's approach (scrubbed frozen clip frames, smoothstep
// envelope, sine "breath", exponential glide); right stage runs the motion layer.
import { RuntimeLoader } from '@rive-app/webgl2';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import avatarURL from '../../assets/mascot.riv?url';
import { MotionLayer } from '../motion';
import { createMotionRig, type MotionRig } from '../rive/motionRig';
import { lylaPatch, lylaRig } from '../rigs/lyla';
import { bindLyla } from '../rigs/lylaBinding';
import { expressionLibrary } from '../systems/expressions';
import type { Attitude, MotionSettings, Personality } from '../types';

RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);

const settings: MotionSettings = {
  personality: 'cozy',
  attitude: 'cheeky',
  energy: 50,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  quiet: false,
};
const palette = ['hair Pink', 'clothing green', 'glasses blue'];
const legacyClip: Record<string, { name: string; time: number } | undefined> = {
  listening: { name: 'blink 3', time: 0.4 },
  skeptical: { name: 'thoughtful', time: 1.2 },
  caught: { name: 'blink 3', time: 1.3 },
  approve: { name: 'blink 2', time: 0.5 },
  wave: { name: 'wave Non Looping', time: -1 },
  celebrate: { name: 'celebration', time: -1 },
};

const smooth = (v: number) => {
  const x = Math.max(0, Math.min(1, v));
  return x * x * (3 - 2 * x);
};

function stageCanvas(id: string) {
  const host = document.getElementById(id);
  const canvas = host?.querySelector('canvas');
  if (!host || !canvas) throw new Error('lab markup missing ' + id);
  return { host, canvas };
}

async function main() {
  const [runtime, bytes] = await Promise.all([
    RuntimeLoader.awaitInstance(),
    fetch(avatarURL).then(async (r) => new Uint8Array(await r.arrayBuffer())),
  ]);
  const before = stageCanvas('before');
  const after = stageCanvas('after');
  const rigs: [MotionRig, MotionRig] = [
    await createMotionRig(runtime, before.canvas, bytes, lylaPatch, lylaRig),
    await createMotionRig(runtime, after.canvas, bytes, lylaPatch, lylaRig),
  ];
  const stage = { aspect: 16 / 9, bodyHeight: 0.3, margin: 0.02 };
  const layer = new MotionLayer(7, settings, stage, { feet: true });
  layer.place(0.5, 0.92);
  const legacy = { x: 0.5, target: 0.5, action: '', started: -10, hidden: false };
  let clock = 0,
    last: number | null = null,
    cue = 0;

  const controls = document.getElementById('controls');
  const status = document.getElementById('status');
  const add = (element: HTMLElement) => controls?.append(element);
  const select = (
    label: string,
    values: string[],
    onChange: (v: string) => void,
    initial: string,
  ) => {
    const wrap = document.createElement('label');
    wrap.textContent = label + ' ';
    const s = document.createElement('select');
    for (const v of values) s.append(new Option(v, v, v === initial, v === initial));
    s.onchange = () => {
      onChange(s.value);
    };
    wrap.append(s);
    add(wrap);
  };
  const button = (label: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = onClick;
    add(b);
  };
  const apply = () => {
    layer.setSettings({ ...settings });
  };
  select(
    'Personality',
    ['cozy', 'playful', 'shy'],
    (v) => {
      settings.personality = v as Personality;
      apply();
    },
    settings.personality,
  );
  select(
    'Attitude',
    ['gentle', 'cheeky', 'spicy'],
    (v) => {
      settings.attitude = v as Attitude;
      apply();
    },
    settings.attitude,
  );
  const energy = document.createElement('label');
  energy.textContent = 'Energy ';
  const slider = Object.assign(document.createElement('input'), {
    type: 'range',
    min: '0',
    max: '100',
    value: '50',
  });
  slider.oninput = () => {
    settings.energy = Number(slider.value);
    apply();
  };
  energy.append(slider);
  add(energy);
  for (const [key, label] of [
    ['reducedMotion', 'Reduced motion'],
    ['quiet', 'Quiet'],
  ] as const) {
    const wrap = document.createElement('label');
    const box = Object.assign(document.createElement('input'), {
      type: 'checkbox',
      checked: settings[key],
    });
    box.onchange = () => {
      settings[key] = box.checked;
      apply();
    };
    wrap.append(box, ' ' + label);
    add(wrap);
  }
  const express = (id: string) => {
    layer.express(id, { at: clock });
    legacy.action = id;
    legacy.started = clock;
  };
  for (const id of Object.keys(expressionLibrary).filter(
    (id) => !['dustOff', 'determined'].includes(id),
  ))
    button(id, () => {
      express(id);
    });
  const show = (id?: string) => {
    legacy.hidden = false;
    layer.enter({
      at: clock,
      cue: String(++cue),
      anchor: layer.locomotion.position,
      ...(id ? { id } : {}),
    });
  };
  const hide = (id?: string) => {
    legacy.hidden = true;
    layer.exit({ at: clock, cue: String(++cue), ...(id ? { id } : {}) });
  };
  button('Drop in', () => {
    show('drop');
  });
  button('Hop off', () => {
    hide('hopOff');
  });
  button('Random hide / show', () => {
    if (layer.hidden) show();
    else hide();
  });
  const moveTo = (x: number) => {
    legacy.target = x;
    layer.moveTo({ x, at: clock });
  };
  for (const host of [before.host, after.host])
    host.addEventListener('click', (event) => {
      const box = host.getBoundingClientRect();
      moveTo((event.clientX - box.left) / box.width);
    });

  const resize = () => {
    for (const [index, host] of [before.host, after.host].entries())
      rigs[index]?.resize(host.clientWidth, host.clientHeight);
  };
  new ResizeObserver(resize).observe(after.host);
  resize();

  const frameTimes: number[] = [];
  function tick(now: number) {
    const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    clock += dt;
    const w = after.host.clientWidth,
      h = after.host.clientHeight;
    const height = h * 0.42;
    stage.aspect = w / h;
    stage.bodyHeight = 0.42;
    layer.setStage(stage);
    const start = performance.now();
    // After: motion layer.
    const frame = layer.update(clock);
    const p = frame.placement;
    rigs[1].frame(dt, bindLyla(frame, palette), {
      x: p.x * w,
      y: p.y * h,
      height,
      rotation: p.lean,
      facing: p.facing,
      scaleX: p.scaleX,
      scaleY: p.scaleY,
    });
    after.canvas.style.opacity = String(p.opacity);
    after.canvas.style.clipPath =
      p.clipBelow === null ? '' : `inset(0 0 ${String((1 - p.clipBelow) * 100)}% 0)`;
    frameTimes.push(performance.now() - start);
    if (frameTimes.length > 300) frameTimes.shift();
    // Before: the previous approach.
    legacy.x += (legacy.target - legacy.x) * (1 - Math.exp(-dt * 9));
    const age = clock - legacy.started;
    const weight = smooth(age / 0.45) * (1 - smooth((age - 3 + 0.65) / 0.65));
    const clips = [
      { name: 'wave Non Looping', time: 0, mix: 1 },
      { name: 'blink_IDLE', time: clock % 2, mix: 1 },
    ];
    const legacyDef = legacyClip[legacy.action];
    if (legacyDef && age < 3)
      clips.push({
        name: legacyDef.name,
        time: legacyDef.time < 0 ? age : legacyDef.time,
        mix: weight,
      });
    for (const name of palette) clips.push({ name, time: 0, mix: 1 });
    rigs[0].frame(
      dt,
      { clips, channels: {}, offsets: {} },
      {
        x: legacy.x * w,
        y: 0.92 * h,
        height: height * (1 + Math.sin(clock * 1.7) * 0.003),
        rotation: 0,
        facing: 1,
        scaleX: 1,
        scaleY: 1,
      },
    );
    before.canvas.style.opacity = legacy.hidden ? '0' : '1';
    if (status) {
      const sorted = [...frameTimes].sort((a, b) => a - b);
      status.textContent = `expressions: ${frame.status.expressions.join(', ') || '-'} | locomotion: ${frame.status.locomotion} | choreography: ${frame.status.choreography ?? '-'} | fidget: ${frame.status.fidget ?? '-'} | motion+draw ms median ${(sorted[Math.floor(sorted.length / 2)] ?? 0).toFixed(2)}`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  Object.assign(window, {
    lab: {
      express,
      moveTo,
      show,
      hide,
      settings: (next: Partial<MotionSettings>) => {
        Object.assign(settings, next);
        apply();
      },
      frameTimes: () => [...frameTimes],
    },
  });
  document.body.dataset['ready'] = 'true';
}

main().catch((error: unknown) => {
  console.error(error);
  document.body.dataset['error'] = String(error);
});
