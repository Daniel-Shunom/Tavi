// Offline .riv inventory: artboards, components (nodes/bones/shapes/constraints),
// linear animations (with the objects/properties they key), state machines and inputs,
// view models. Reads files only; no network or shell actions.
// Usage: node tools/riv-inspect/inspect.mjs <file.riv> [--json]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const defs = JSON.parse(readFileSync(new URL('./riv-defs.json', import.meta.url), 'utf8'));

function reader(bytes) {
  let offset = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    get offset() {
      return offset;
    },
    done: () => offset >= bytes.length,
    varuint() {
      let result = 0,
        shift = 0,
        byte;
      do {
        byte = bytes[offset++];
        result += (byte & 0x7f) * 2 ** shift;
        shift += 7;
      } while (byte & 0x80);
      return result;
    },
    float() {
      const value = view.getFloat32(offset, true);
      offset += 4;
      return value;
    },
    uint32() {
      const value = view.getUint32(offset, true);
      offset += 4;
      return value;
    },
    bytes(length) {
      const slice = bytes.subarray(offset, offset + length);
      offset += length;
      return slice;
    },
  };
}

export function parseRiv(bytes) {
  const r = reader(bytes);
  const magic = String.fromCharCode(...r.bytes(4));
  if (magic !== 'RIVE') throw new Error('Not a .riv file');
  const major = r.varuint(),
    minor = r.varuint(),
    fileId = r.varuint();
  const tocKeys = [];
  for (let key = r.varuint(); key !== 0; key = r.varuint()) tocKeys.push(key);
  const toc = new Map();
  let bits = 0,
    word = 0;
  for (let i = 0; i < tocKeys.length; i++) {
    if (i % 4 === 0) word = r.uint32();
    bits = (word >>> ((i % 4) * 2)) & 3;
    toc.set(tocKeys[i], ['uint', 'string', 'double', 'color'][bits]);
  }
  const objects = [];
  while (!r.done()) {
    const typeKey = r.varuint();
    const object = { typeKey, type: defs.types[typeKey]?.name ?? 'Unknown' + typeKey, props: {} };
    for (let key = r.varuint(); key !== 0; key = r.varuint()) {
      const def = defs.properties[key];
      const kind = toc.get(key) ?? def?.type;
      if (process.env.RIV_TRACE && r.offset < Number(process.env.RIV_TRACE))
        console.log('type', typeKey, 'key', key, kind, 'at', r.offset);
      const name = def?.name ?? 'p' + key;
      let value;
      if (kind === 'string' || kind === 'bytes') {
        const raw = r.bytes(r.varuint());
        value =
          def?.type === 'bytes' ? '<' + raw.length + ' bytes>' : new TextDecoder().decode(raw);
      } else if (kind === 'double') value = r.float();
      else if (kind === 'color') value = '#' + r.uint32().toString(16).padStart(8, '0');
      else if (kind === 'uint' || kind === 'bool') value = r.varuint();
      else throw new Error('Unknown field type for property ' + key + ' at ' + r.offset);
      object.props[name] = value;
    }
    objects.push(object);
  }
  return { version: major + '.' + minor, fileId, objects };
}

function inherits(typeName, ancestor) {
  for (let name = typeName; name;) {
    if (name === ancestor) return true;
    const entry = Object.values(defs.types).find((t) => t.name === name);
    name = entry?.parent;
  }
  return false;
}

// Group the flat object stream into artboards. Components index from 0 = artboard;
// animations/state machines follow their artboard's components.
export function inventory(parsed) {
  const artboards = [];
  let board = null,
    animation = null,
    keyedObject = null,
    machine = null,
    layer = null;
  const viewModels = [];
  for (const object of parsed.objects) {
    const { type, props } = object;
    if (type === 'Artboard') {
      board = {
        name: props.name ?? '',
        width: props.width,
        height: props.height,
        components: [{ index: 0, type, name: props.name ?? '' }],
        animations: [],
        stateMachines: [],
      };
      artboards.push(board);
      animation = machine = null;
      continue;
    }
    if (type === 'ViewModel') viewModels.push({ name: props.name ?? '', properties: [] });
    else if (type.startsWith('ViewModelProperty') && viewModels.length)
      viewModels.at(-1).properties.push({ type, name: props.name ?? '' });
    if (!board) continue;
    if (type === 'LinearAnimation') {
      animation = {
        name: props.name ?? '',
        fps: props.fps ?? 60,
        duration: props.duration ?? 60,
        loop: ['oneShot', 'loop', 'pingPong'][props.loopValue ?? 0],
        speed: props.speed ?? 1,
        keyed: [],
      };
      board.animations.push(animation);
      machine = null;
    } else if (type === 'KeyedObject' && animation) {
      keyedObject = { objectId: props.objectId ?? 0, properties: [] };
      animation.keyed.push(keyedObject);
    } else if (type === 'KeyedProperty' && keyedObject) {
      keyedObject.properties.push({ key: props.propertyKey, frames: 0, values: new Set() });
    } else if (type.startsWith('KeyFrame') && keyedObject?.properties.length) {
      const property = keyedObject.properties.at(-1);
      property.frames++;
      if ('value' in props) property.values.add(props.value);
    } else if (type === 'StateMachine') {
      machine = { name: props.name ?? '', inputs: [], layers: [], listeners: 0 };
      board.stateMachines.push(machine);
      animation = null;
    } else if (machine && inherits(type, 'StateMachineInput')) {
      machine.inputs.push({ type: type.replace('StateMachine', ''), name: props.name ?? '' });
    } else if (machine && type === 'StateMachineLayer') {
      layer = { name: props.name ?? '', states: [] };
      machine.layers.push(layer);
    } else if (machine && layer && inherits(type, 'LayerState')) {
      layer.states.push(type + (props.animationId !== undefined ? '#' + props.animationId : ''));
    } else if (machine && inherits(type, 'StateMachineListener')) {
      machine.listeners++;
    } else if (!animation && !machine && inherits(type, 'Component')) {
      board.components.push({
        index: board.components.length,
        type,
        name: props.name ?? '',
        parentId: props.parentId ?? 0,
        x: props.x,
        y: props.y,
        rotation: props.rotation,
      });
    }
  }
  for (const art of artboards)
    for (const anim of art.animations)
      for (const ko of anim.keyed) {
        const target = art.components[ko.objectId];
        ko.target = target ? target.type + ' "' + target.name + '"' : '#' + ko.objectId;
        for (const p of ko.properties) {
          p.name = defs.properties[p.key]?.name ?? 'p' + p.key;
          p.distinct = p.values.size;
          delete p.values;
        }
      }
  return { version: parsed.version, artboards, viewModels };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  const result = inventory(parseRiv(readFileSync(file)));
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 1));
  else {
    console.log(file, 'format', result.version);
    for (const art of result.artboards) {
      const counts = {};
      for (const c of art.components) counts[c.type] = (counts[c.type] ?? 0) + 1;
      console.log('\nARTBOARD', JSON.stringify(art.name), art.width + 'x' + art.height);
      console.log('  components', JSON.stringify(counts));
      for (const a of art.animations)
        console.log(
          '  anim',
          JSON.stringify(a.name),
          (a.duration / a.fps).toFixed(2) + 's',
          a.fps + 'fps',
          a.loop,
          'keys',
          a.keyed.length,
        );
      for (const m of art.stateMachines)
        console.log(
          '  SM',
          JSON.stringify(m.name),
          'inputs',
          JSON.stringify(m.inputs),
          'layers',
          m.layers.map((l) => l.name + '(' + l.states.length + ')').join(', '),
          'listeners',
          m.listeners,
        );
    }
    for (const vm of result.viewModels)
      console.log('VIEWMODEL', vm.name, vm.properties.map((p) => p.name).join(', '));
  }
}
