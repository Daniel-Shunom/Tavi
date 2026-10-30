import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('art/tavi-rive-lab/interactive/scene.rml', 'utf8');
function animation(name: string) {
  const start = source.indexOf(`name="${name}"`);
  if (start < 0) throw new Error(`Missing ${name}`);
  return source.slice(start, source.indexOf('</LinearAnimation>', start));
}
function keys(body: string) {
  const result = new Map<string, [number, number][]>();
  for (const object of body.matchAll(
    /<KeyedObject\b[^>]*objectId="([^"]+)"[^>]*>([\s\S]*?)<\/KeyedObject>/g,
  ))
    for (const prop of (object[2] ?? '').matchAll(
      /<KeyedProperty\b[^>]*property="([^"]+)"[^>]*>([\s\S]*?)<\/KeyedProperty>/g,
    ))
      result.set(
        `${object[1] ?? ''}.${prop[1] ?? ''}`,
        [...(prop[2] ?? '').matchAll(/<KeyFrameDouble\b([^>]*)>/g)].map((key) => {
          const attributes = key[1] ?? '';
          return [
            Number(/frame="([^"]+)"/.exec(attributes)?.[1] ?? 0),
            Number(/value="([^"]+)"/.exec(attributes)?.[1] ?? 0),
          ];
        }),
      );
  return result;
}
describe('isolated Tavi three-quarter rig', () => {
  it('does not squeeze, tilt or relocate the legs or their common parent', () => {
    const props = keys(animation('tavi/turnBody'));
    for (const node of ['0:635', '0:2518', '0:2507', '0:2519', '0:2520', '0:2494', '0:2495'])
      for (const property of ['scaleX', 'scaleY', 'rotation', 'x', 'y'])
        expect(props.has(`${node}.${property}`), `${node}.${property}`).toBe(false);
    for (const foot of ['0:2559', '0:2506'])
      for (const property of ['x', 'y']) expect(props.has(`${foot}.${property}`)).toBe(false);
  });
  it('keeps shoulder roots under the garment at both facing endpoints', () => {
    const rules = [
      ...source.matchAll(
        /<DrawRules\b[^>]*name="tavi\/turn-arm-[LR]"[^>]*>([\s\S]*?)<\/DrawRules>/g,
      ),
    ];
    expect(rules).toHaveLength(2);
    for (const rule of rules) {
      expect(rule[1]?.match(/placementValue="after"/g)).toHaveLength(2);
      expect(rule[1]).not.toContain('placementValue="before"');
      expect(rule[1]).toContain('drawableId="29:10"');
      expect(rule[1]).toContain('drawableId="37:10"');
    }
    expect(source).toContain('name="tavi/waist-overlap"');
  });
  it('preserves shoe width and sole height between left and right views', () => {
    const props = keys(animation('tavi/turnBody'));
    for (const vertices of [
      ['0:13095', '0:13102', '0:13097', '0:13098', '0:13101', '0:13100'],
      ['0:13185', '0:13187', '0:13189', '0:13191', '0:13193', '0:13195'],
    ]) {
      const endpoint = (index: number, axis: string) =>
        vertices.map((vertex) => {
          const samples = props.get(`${vertex}.${axis}`);
          const value = index === 0 ? samples?.[0]?.[1] : samples?.at(-1)?.[1];
          if (value === undefined) throw new Error(`Missing ${vertex}.${axis}`);
          return value;
        });
      const width = (values: number[]) => Math.max(...values) - Math.min(...values);
      expect(width(endpoint(0, 'x'))).toBeCloseTo(width(endpoint(1, 'x')), 5);
      expect(Math.max(...endpoint(0, 'y'))).toBeCloseTo(Math.max(...endpoint(1, 'y')), 5);
    }
  });
  it('restores the full front contour during a cross-side turn', () => {
    const from = keys(animation('tavi/turn/left-to-right'));
    const turn = keys(animation('tavi/turnBody'));
    const key = '29:1.scaleX';
    const start = from.get(key)?.[0]?.[1];
    const middle = from.get(key)?.find(([frame]) => frame === 27)?.[1];
    const rest = turn.get(key)?.find(([frame]) => frame === 30)?.[1];
    if (start === undefined || middle === undefined || rest === undefined)
      throw new Error('Missing turn samples');
    expect(Math.abs(middle - rest)).toBeLessThan(Math.abs(start - rest));
    expect(source).toContain('name="Three-quarter orientation"');
    for (const route of ['left-to-right', 'right-to-left', 'front-to-left', 'front-to-right'])
      expect(source).toContain(`name="tavi/turn/${route}"`);
  });
  it('skins one continuous top to both shoulders and pins its hem to the waist', () => {
    const start = source.indexOf('name="tavi/continuous-shirt"');
    const shape = source.slice(start, source.indexOf('</Shape>', start));
    expect(shape.match(/<PointsPath /g)).toHaveLength(1);
    for (const bone of ['29:1', '29:2', '29:3', '29:4'])
      expect(shape).toContain(`boneId="${bone}"`);
    const influences = new Map<string, Map<number, number>>();
    for (const vertex of shape.matchAll(
      /<CubicDetachedVertex\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/CubicDetachedVertex>/g,
    )) {
      const weight = /<CubicWeight\b[^>]*indices="(\d+)"[^>]*values="(\d+)"/.exec(vertex[2] ?? '');
      if (!weight) throw new Error('Garment vertex has no bone weight');
      const indices = Number(weight[1]),
        values = Number(weight[2]);
      const decoded = new Map<number, number>();
      let total = 0;
      for (let slot = 0; slot < 4; slot++) {
        const value = (values >>> (8 * slot)) & 255;
        total += value;
        decoded.set((indices >>> (8 * slot)) & 255, value);
      }
      expect(total).toBe(255);
      influences.set(vertex[1] ?? '', decoded);
    }
    for (const vertex of ['29:104', '29:105', '29:106'])
      expect(influences.get(vertex)?.get(4)).toBe(255);
    expect(influences.get('29:102')?.get(2)).toBe(255);
    expect(influences.get('29:108')?.get(3)).toBe(255);
    expect(influences.get('29:100')?.get(5)).toBe(255);
    for (const vertex of ['29:101', '29:109']) expect(influences.get(vertex)?.get(5)).toBe(255);
    expect(shape).toContain('boneId="35:2"');
    expect(source).toContain('name="Shoulder attachment test"');
  });
  it('connects neck skin between head and collar and gives each shoe one foot attachment', () => {
    for (const bone of ['35:1', '35:2']) expect(source).toContain(`boneId="${bone}"`);
    expect(source).toContain('name="tavi/neck/head-anchor"');
    expect(source).toContain('name="tavi/neck/collar-anchor"');
    for (const [group, foot] of [
      ['0:13134', '0:2559'],
      ['0:13158', '0:2506'],
    ]) {
      const start = source.search(new RegExp(`<Node\\b[^>]*id="${group ?? ''}"`));
      const assembly = source.slice(start, source.indexOf('</Node>', start));
      expect(assembly).toContain(`targetId="${foot ?? ''}"`);
      expect(assembly).toContain('name="tavi/footwear-attachment"');
    }
    for (const shoe of ['0:13091', '0:13183']) {
      const start = source.search(new RegExp(`<Shape\\b[^>]*id="${shoe}"`));
      const shape = source.slice(start, source.indexOf('</Shape>', start));
      expect(shape).toContain('<Skin');
      expect(shape.match(/<CubicWeight /g)).toHaveLength(6);
      // The opening belongs to the ankle; toe, heel and sole to the foot.
      expect(shape.match(/indices="2" values="255"/g)).toHaveLength(3);
      expect(shape.match(/indices="1" values="255"/g)).toHaveLength(3);
    }
    for (const [sock, shin] of [
      ['0:13119', '0:2520'],
      ['0:13201', '0:2495'],
    ]) {
      const start = source.search(new RegExp(`<Shape\\b[^>]*id="${sock ?? ''}"`));
      expect(source.slice(start, source.indexOf('</Shape>', start))).toContain('<Skin');
      expect(source).toContain(`name="shin cuff attachment" targetId="${shin ?? ''}"`);
    }
  });
  it('keeps the neck head anchor horizontally aligned with its collar during yaw', () => {
    const attribute = (tag: string, id: string, name: string) => {
      const match = new RegExp(`<${tag}\\b[^>]*id="${id}"[^>]*>`).exec(source)?.[0];
      if (!match) throw new Error(`Missing ${id}`);
      return Number(new RegExp(`\\b${name}="([^"]+)"`).exec(match)?.[1] ?? 0);
    };
    const top = attribute('Node', '0:5358', 'x') + attribute('RootBone', '35:1', 'x');
    const collar = attribute('RootBone', '35:2', 'x');
    expect(top).toBeCloseTo(collar, 6);
    const headTurn = keys(animation('tavi/turnHead'));
    expect(headTurn.has('35:1.x')).toBe(false);
    expect(headTurn.has('35:1.rotation')).toBe(false);
  });
  it('uses one pelvis-bound skirt while retaining the underlying body for coverage checks', () => {
    const start = source.indexOf('name="tavi/continuous-skirt"');
    const skirt = source.slice(start, source.indexOf('</Shape>', start));
    expect(skirt.match(/<PointsPath /g)).toHaveLength(1);
    expect(skirt).toContain('boneId="29:4"');
    expect(skirt).toContain('boneId="37:1"');
    expect(skirt).toContain('boneId="0:2519"');
    expect(skirt).toContain('boneId="0:2494"');
    expect(skirt.match(/<CubicWeight /g)).toHaveLength(10);
    expect(source).toContain('name="tavi/cloth/pelvis-target"');
    const body = /<Shape\b[^>]*id="0:656"[^>]*>/.exec(source)?.[0] ?? '';
    expect(body).not.toContain('hidden="true"');
  });
  it('grades the whole shoulder ridge and its handles between neck and shoulder', () => {
    for (const id of ['29:110', '29:111', '29:112', '29:113']) {
      const start = source.search(new RegExp(`<CubicDetachedVertex\\b[^>]*id="${id}"`));
      const vertex = source.slice(start, source.indexOf('</CubicDetachedVertex>', start));
      const packed = Number(/\bvalues="(\d+)"/.exec(vertex)?.[1]);
      expect(packed & 255).toBeGreaterThan(0);
      expect((packed >>> 8) & 255).toBeGreaterThan(0);
      const incoming = Number(/\binValues="(\d+)"/.exec(vertex)?.[1]);
      const outgoing = Number(/\boutValues="(\d+)"/.exec(vertex)?.[1]);
      expect(incoming).not.toBe(outgoing);
    }
  });
  it('retains shoulder span through yaw and rounds the garment shoulder caps', () => {
    const props = keys(animation('tavi/turnBody'));
    for (const arm of ['0:2090', '0:2339']) {
      const samples = props.get(`${arm}.x`)?.map(([, value]) => value) ?? [];
      expect(samples.length).toBeGreaterThan(0);
      // The fixed neckline leaves an 18.5u rest shoulder span. Reserve at
      // least 12u at yaw so a 12u shrug cannot collapse it into a narrow peak.
      expect(Math.max(...samples) - Math.min(...samples)).toBeLessThanOrEqual(6.5);
    }
    for (const id of ['29:102', '29:108']) {
      const vertex =
        new RegExp(`<CubicDetachedVertex\\b[^>]*id="${id}"[^>]*>`).exec(source)?.[0] ?? '';
      const incoming = Number(/inRotation="([^"]+)"/.exec(vertex)?.[1]);
      const outgoing = Number(/outRotation="([^"]+)"/.exec(vertex)?.[1]);
      expect(Math.abs(outgoing - incoming)).toBeCloseTo(Math.PI, 6);
    }
  });
  it('turns the hair as one volume: fringe with the face, mass swinging against it', () => {
    const props = keys(animation('tavi/turnHead'));
    // No hair section slides as a flat cutout: crown, rear mass and fringe
    // groups carry no group-level translation or squeeze; every vertex turns.
    for (const id of ['0:596', '0:684', '0:1296', '0:438', '0:447']) {
      expect(props.has(`${id}.x`), `${id}.x`).toBe(false);
      expect(props.has(`${id}.scaleX`), `${id}.scaleX`).toBe(false);
    }
    const vertexIds = (shape: string) => {
      const start = source.indexOf(`id="${shape}"`);
      const body = source.slice(start, source.indexOf('</Shape>', start));
      return [...body.matchAll(/<CubicDetachedVertex\b[^>]*id="([^"]+)"/g)].map((m) => m[1] ?? '');
    };
    const travel = (id: string) => {
      const values = props.get(`${id}.x`) ?? [];
      const at = (frame: number) => values.find(([f]) => f === frame)?.[1] ?? NaN;
      return at(60) - at(30);
    };
    const face = travel('0:1284');
    expect(face).toBeGreaterThan(20);
    // The fringe follows the face; only tips tucked into the outline ride the
    // hair mass as it swings back, never further than that swing.
    const fringe = [...vertexIds('0:438'), ...vertexIds('0:447')];
    expect(fringe.length).toBeGreaterThan(10);
    const following = fringe.filter((id) => travel(id) * face > 0).length;
    expect(following / fringe.length).toBeGreaterThan(0.6);
    for (const id of fringe) expect(travel(id) * Math.sign(face), id).toBeGreaterThan(-16);
    expect(Math.max(...fringe.map(travel))).toBeGreaterThan(face * 0.6);
    // The crown (the mass behind the neck) swings against the turn.
    const crown = vertexIds('0:596');
    expect(crown.length).toBe(4);
    for (const id of crown) expect(travel(id) * face, id).toBeLessThan(0);
    const rear = vertexIds('0:685');
    expect(Math.min(...rear.map(travel))).toBeLessThan(-10);
    for (const id of rear) expect(travel(id), id).toBeLessThanOrEqual(1e-6);
  });
  it('binds each rounded limb surface to its existing upper and lower bones', () => {
    for (const [name, upper, lower] of [
      ['armL', '0:2079', '0:2080'],
      ['armR', '0:2340', '0:2341'],
      ['legL', '0:2519', '0:2520'],
      ['legR', '0:2494', '0:2495'],
    ]) {
      const start = source.indexOf(`name="tavi/${name ?? ''}.surface"`);
      expect(start).toBeGreaterThan(0);
      const shape = source.slice(start, source.indexOf('</Shape>', start));
      expect(shape.match(/<CubicDetachedVertex /g)).toHaveLength(4);
      expect(shape).toContain(`boneId="${upper ?? ''}"`);
      expect(shape).toContain(`boneId="${lower ?? ''}"`);
      expect(shape.match(/<CubicWeight /g)).toHaveLength(4);
      expect(shape.match(/indices="1" values="255"/g)).toHaveLength(2);
      expect(shape.match(/indices="2" values="255"/g)).toHaveLength(2);
      expect(shape).toContain('join="round"');
      expect(shape).toContain('name="bend entry"');
      expect(shape).toContain('name="bend exit"');
    }
  });
  it('bends joints without scaling limbs or moving the planted foot targets', () => {
    const pose = keys(animation('tavi/joints/both'));
    expect(pose.has('0:2080.rotation')).toBe(true);
    expect(pose.has('0:2341.rotation')).toBe(true);
    expect(pose.has('0:2207.y')).toBe(true);
    for (const key of pose.keys()) {
      expect(key).not.toMatch(/\.(scaleX|scaleY|length)$/);
      expect(key).not.toMatch(/^(0:2559|0:2506)\./);
    }
    expect(source).toContain('name="jointPose"');
    expect(source).toContain('name="Elbow and knee review"');
  });
  it('draws only the near forearm in front while keeping its shoulder under the garment', () => {
    const turn = keys(animation('tavi/turnBody'));
    for (const [side, last] of [
      ['L', 1],
      ['R', 0],
    ] as const) {
      const start = source.indexOf(`name="tavi/near-forearm-${side}"`);
      expect(start).toBeGreaterThan(0);
      const shape = source.slice(start, source.indexOf('</Shape>', start));
      expect(shape.match(/<CubicDetachedVertex /g)).toHaveLength(3);
      expect(shape).not.toContain('name="limb start"');
      expect(shape).toContain('name="bend entry"');
      expect(shape).toContain('placementValue="before"');
      expect(shape).toContain('drawableId="29:10"');
      const id = /\bid="([^"]+)"/.exec(shape)?.[1];
      const opacity = turn.get(`${id ?? ''}.opacity`);
      expect(opacity?.find(([frame]) => frame === 30)?.[1]).toBe(0);
      expect(opacity?.at(-1)?.[1]).toBe(last);
      expect(opacity?.[0]?.[1]).toBe(1 - last);
    }
  });
});
