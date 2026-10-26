import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scanRiv } from '../src/renderer/attachments/riv/rivBinary';
import {
  RiveProperty,
  artboardComponents,
  controlTime,
  patchRiv,
} from '../src/renderer/motion/rive/patch';
import { lylaRig, lylaPatch } from '../src/renderer/characters/mascot/motionRig';

const source = new Uint8Array(readFileSync('src/renderer/characters/mascot/mascot.riv'));
const JOYSTICK = 148;

describe('riv scanning', () => {
  it('scans the whole mascot file losslessly', () => {
    const scan = scanRiv(source);
    expect(scan.major).toBe(7);
    expect(scan.objects.at(-1)?.end).toBe(source.length);
  });

  it('indexes components the way keyed objects reference them', () => {
    const components = artboardComponents(source, 'lyla animation');
    // Fourteen joysticks drive the face/hair/blink channels.
    const joysticks = components.filter(([, type]) => type === JOYSTICK).map(([index]) => index);
    expect(joysticks).toEqual([
      692, 693, 694, 695, 696, 697, 698, 699, 700, 701, 702, 703, 704, 705,
    ]);
  });
});

describe('rig patch', () => {
  it('adds names and control tracks without disturbing existing objects', () => {
    const patched = patchRiv(source, lylaPatch);
    const before = scanRiv(source).objects;
    const after = scanRiv(patched).objects;
    const added = (lylaPatch.controls ?? []).length * 5;
    expect(after.length).toBe(before.length + added);
    const components = artboardComponents(patched, 'lyla animation');
    for (const [index, name] of Object.entries(lylaPatch.names ?? {}))
      expect(components[Number(index)]?.[2].get(4)).toBe(name);
    // Existing animation order is preserved: joystick xId/yId still point at the same clips.
    const lylaAnimations = (objects: typeof before) => {
      const start = objects.findIndex(
        (o) => o.typeKey === 1 && o.props.get(4) === 'lyla animation',
      );
      const next = objects.findIndex((o, i) => i > start && o.typeKey === 1);
      return objects
        .slice(start, next)
        .filter((o) => o.typeKey === 31)
        .map((o) => o.props.get(55));
    };
    const original = lylaAnimations(before);
    const patchedNames = lylaAnimations(after);
    expect(patchedNames.slice(0, original.length)).toEqual(original);
    expect(patchedNames.slice(original.length)).toEqual(
      (lylaPatch.controls ?? []).map((c) => c.name),
    );
  });

  it('rejects a patch whose expected types do not match', () => {
    expect(() => patchRiv(source, { artboard: 'lyla animation', expectTypes: { 692: 2 } })).toThrow(
      /Rig mismatch/,
    );
  });

  it('maps control values onto track time', () => {
    expect(controlTime({ min: -1, max: 1 }, 0)).toBe(0.5);
    expect(controlTime({ min: -1, max: 1 }, 5)).toBe(1);
    expect(RiveProperty.joystickX).toBe(299);
  });

  it('declares every channel in the manifest against a real control track', () => {
    const tracks = new Set((lylaPatch.controls ?? []).map((c) => c.name));
    for (const channel of Object.values(lylaRig.channels))
      expect(tracks.has(channel.track)).toBe(true);
  });
});

describe('mascot-v2 carries the motion rig natively', () => {
  it('has every named node and control track the gait/locomotion binding uses', () => {
    const v2 = new Uint8Array(readFileSync('src/renderer/characters/mascot-v2/mascot-v2.riv'));
    const scan = scanRiv(v2).objects;
    const names = new Set(scan.map((o) => o.props.get(4)).filter((n) => typeof n === 'string'));
    const clips = new Set(scan.filter((o) => o.typeKey === 31).map((o) => o.props.get(55)));
    for (const node of Object.values(lylaRig.nodes)) expect(names.has(node.name)).toBe(true);
    for (const channel of Object.values(lylaRig.channels))
      expect(clips.has(channel.track)).toBe(true);
  });
});
