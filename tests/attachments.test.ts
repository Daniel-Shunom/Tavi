import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { parseCatalog } from '../src/renderer/attachments/catalog';
import { loadAttachments } from '../src/renderer/attachments/bundle';
import { parseHex, retarget, shade } from '../src/renderer/attachments/color';
import {
  apply,
  createAttachmentLayer,
  itemMatrix,
  multiply,
  slotFrame,
  SwingState,
  resolvePaint,
  type Affine,
  type Canvas2D,
} from '../src/renderer/attachments/layer';
import { hide, lylaRecolor, recolor } from '../src/renderer/attachments/recolor';
import { patchForAttachments, riveTransformSource } from '../src/renderer/attachments/rive';
import { colorKeys } from '../src/renderer/attachments/riv/rivPatch';
import { lylaAttachmentRig, lylaSlots } from '../src/renderer/attachments/rigs/lyla';
import { AttachmentSpec, SlotBinding, Spring } from '../src/renderer/attachments/schema';

const mascot = async () =>
  new Uint8Array(await readFile(new URL('../src/renderer/assets/mascot.riv', import.meta.url)));

describe('attachment catalog', () => {
  it('validates every bundled item and has a starter pack across categories', () => {
    const { items, catalog } = loadAttachments();
    expect(items.size).toBeGreaterThanOrEqual(12);
    const categories = new Set([...items.values()].map((item) => item.category));
    for (const category of ['hat', 'hair', 'eyewear', 'headwear', 'neckwear', 'prop'])
      expect(categories).toContain(category);
    for (const item of items.values()) expect(lylaSlots[item.slot]).toBeDefined();
    const rejected = catalog.items.filter((entry) => entry.status === 'rejected');
    for (const entry of rejected) expect(entry.notes).toBeTruthy();
  });

  it('refuses items that are unlicensed, misnamed or missing from the catalog', () => {
    const item = { ...[...loadAttachments().items.values()][0] };
    const catalog = (license: boolean) => ({
      version: 1,
      items: [
        {
          id: item.id,
          origin: 'discovered',
          status: 'converted',
          author: 'x',
          license: 'unknown',
          redistribution: license,
          modification: license,
        },
      ],
    });
    expect(() => parseCatalog(catalog(false), { [`a/${String(item.id)}.json`]: item })).toThrow(
      /not licensed/,
    );
    expect(() => parseCatalog(catalog(true), { 'a/other.json': item })).toThrow(/must be named/);
    expect(() =>
      parseCatalog({ version: 1, items: [] }, { [`a/${String(item.id)}.json`]: item }),
    ).toThrow(/missing from/);
    expect(() => parseCatalog(catalog(true), {})).toThrow(/has no item spec/);
  });
});

describe('slot transforms', () => {
  const spec = AttachmentSpec.parse({
    id: 'probe',
    name: 'Probe',
    category: 'prop',
    slot: 'hand.r',
    viewBox: [0, 0, 100, 50],
    anchor: [30, 40],
    size: 0.5,
    layers: [{ d: 'M0 0 L1 1', fill: '#ffffff' }],
  });

  it('pins the item anchor to the slot origin wherever the node moves or rotates', () => {
    const binding = SlotBinding.parse({ node: 'n', offset: [10, 0], size: 100 });
    const world: Affine = [0, 1, -1, 0, 200, 300]; // rotated 90 degrees, translated
    const frame = slotFrame(binding, world);
    expect(frame.origin[0]).toBeCloseTo(200);
    expect(frame.origin[1]).toBeCloseTo(310);
    const [x, y] = apply(multiply(frame.matrix, itemMatrix(spec)), 30, 40);
    expect(x).toBeCloseTo(200);
    expect(y).toBeCloseTo(310);
    // 0.5 * reference size 100 = 50 artboard units across the 100-unit viewBox.
    const [x2, y2] = apply(multiply(frame.matrix, itemMatrix(spec)), 130, 40);
    expect(Math.hypot(x2 - x, y2 - y)).toBeCloseTo(50);
  });

  it('keeps props upright when follow is zero', () => {
    const binding = SlotBinding.parse({ node: 'n', size: 100, follow: 0 });
    expect(slotFrame(binding, [0, 1, -1, 0, 0, 0]).rotation).toBe(0);
  });

  it('swings springs after a jolt, stays bounded and settles', () => {
    const spring = Spring.parse({ pivot: [0, 0], maxAngle: 20 });
    const swing = new SwingState();
    const frame = slotFrame(SlotBinding.parse({ node: null, size: 100 }), null);
    let peak = 0;
    for (let i = 0; i < 600; i++) {
      const x = i < 30 ? i * 4 : 120;
      const angle = swing.step(spring, frame, [x, 0], 1 / 60);
      expect(Number.isFinite(angle)).toBe(true);
      peak = Math.max(peak, Math.abs(angle));
    }
    expect(peak).toBeGreaterThan(0.01);
    expect(peak).toBeLessThanOrEqual((20 * Math.PI) / 180 + 1e-9);
    expect(Math.abs(swing.angle)).toBeLessThan(0.01);
  });

  it('draws front and behind layers on their canvases with resolved tints', () => {
    const { items } = loadAttachments();
    const calls: { canvas: string; fill: unknown }[] = [];
    const fake = (canvas: string): Canvas2D => ({
      save() {},
      restore() {},
      setTransform() {},
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineJoin: '',
      lineCap: '',
      fill() {
        calls.push({ canvas, fill: this.fillStyle });
      },
      stroke() {},
    });
    const layer = createAttachmentLayer({ slots: lylaSlots, items, path: (d) => d });
    layer.draw(fake('back'), fake('front'), {
      view: [1, 0, 0, 1, 0, 0],
      world: () => [1, 0, 0, 1, 300, 300],
      equipped: { 'head.hair': 'ponytail' },
      palette: { hair: '#3366ff' },
      dt: 1 / 60,
    });
    expect(calls.some((call) => call.canvas === 'back' && call.fill === '#3366ff')).toBe(true);
    expect(calls.some((call) => call.canvas === 'front')).toBe(true);
  });
});

describe('colour', () => {
  it('shades toward white and warm ink, and resolves tint paints', () => {
    expect(shade('#808080', 1)).toBe('#ffffff');
    expect(shade('#808080', 0)).toBe('#808080');
    const spec = loadAttachments().items.get('beanie');
    if (!spec) throw new Error('missing beanie');
    expect(resolvePaint({ tint: 'primary', shade: 0, alpha: 1 }, spec, {}, {})).toBe('#f2a65a');
    expect(
      resolvePaint(
        { tint: 'primary', shade: 0, alpha: 0.5 },
        spec,
        { beanie: { primary: '#000000' } },
        {},
      ),
    ).toBe('#00000080');
  });

  it('retargets a palette so the base colour becomes the chosen colour exactly', () => {
    const base = parseHex('#d80b4c');
    const argb = (0xff << 24) | (base.r << 16) | (base.g << 8) | base.b;
    const out = retarget(argb >>> 0, '#d80b4c', '#3366ff');
    expect(((out & 0xffffff) >>> 0).toString(16).padStart(6, '0')).toMatch(/^3[23]6[56]f[ef]$/);
    expect(out >>> 24).toBe(0xff);
  });
});

describe('mascot.riv patches', () => {
  it('recolours hair keys in place and can hide the built-in glasses', async () => {
    const bytes = await mascot();
    const recoloured = recolor(bytes, lylaRecolor.artboard, lylaRecolor.hair, '#3366ff');
    expect(recoloured.length).toBe(bytes.length);
    const before = colorKeys(bytes, lylaRecolor.artboard, 'hair Pink');
    const after = colorKeys(recoloured, lylaRecolor.artboard, 'hair Pink');
    expect(after).toHaveLength(before.length);
    expect(after.filter((key, index) => key !== before[index]).length).toBe(before.length);
    const hidden = colorKeys(
      hide(bytes, lylaRecolor.artboard, lylaRecolor.glasses),
      lylaRecolor.artboard,
      'glasses blue',
    );
    for (const key of hidden) expect(key).toMatch(/=#00/);
    // Outfit recolour keeps the shoes.
    const outfit = colorKeys(
      recolor(bytes, lylaRecolor.artboard, lylaRecolor.outfit, '#aa3300'),
      lylaRecolor.artboard,
      'clothing green',
    );
    expect(outfit.filter((key) => key.endsWith('#ff7992af'))).toHaveLength(2);
  });

  it('names slot components so the runtime resolves world transforms for every slot', async () => {
    const require = createRequire(import.meta.url);
    const wasm = await readFile(require.resolve('@rive-app/webgl2/rive.wasm'));
    (globalThis as Record<string, unknown>)['window'] ??= globalThis;
    const { RuntimeLoader } = await import('@rive-app/webgl2');
    RuntimeLoader.setWasmUrl('data:application/wasm;base64,' + wasm.toString('base64'));
    RuntimeLoader.setWasmFallbackUrl(null);
    const runtime = await RuntimeLoader.awaitInstance();
    const file = await runtime.load(
      patchForAttachments(await mascot(), lylaAttachmentRig),
      undefined,
      false,
    );
    const board = file.artboardByName('lyla animation');
    board.advance(0);
    const world = riveTransformSource(board);
    for (const binding of Object.values(lylaSlots)) {
      const matrix = world(binding);
      expect(matrix, binding.node ?? 'artboard').not.toBeNull();
      const origin = slotFrame(binding, matrix).origin;
      expect(origin[0]).toBeGreaterThan(150);
      expect(origin[0]).toBeLessThan(450);
      expect(origin[1]).toBeGreaterThan(40);
      expect(origin[1]).toBeLessThan(450);
    }
    board.delete();
    file.unref();
  });
});
