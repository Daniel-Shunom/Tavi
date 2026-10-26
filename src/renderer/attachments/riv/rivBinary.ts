// Minimal .riv reader/writer shared by the motion rig patch (motion/rive/patch.ts) and the
// attachment/recolour patcher; scans objects with byte spans and value offsets.
// Minimal reader/writer for the Rive runtime binary format (format 7).
// Layout follows rive-runtime
// include/rive/runtime_header.hpp. Only what the motion patcher needs: a lossless object scan
// with byte spans, so new properties/objects can be spliced in without re-encoding the file.
import { fieldTypes } from './fieldTypes.generated';

export const Field = { Uint: 0, String: 1, Double: 2, Color: 3 } as const;

export interface RivObject {
  typeKey: number;
  /** Offset of the typeKey varuint. */
  start: number;
  /** Offset of the 0 terminator that ends the property list. */
  terminator: number;
  /** Offset just past the terminator. */
  end: number;
  /** Decoded scalar properties (strings decoded as UTF-8; bytes properties skipped). */
  props: Map<number, number | string>;
  /** Byte offset of each property's value (after its key). */
  at: Map<number, number>;
}

export interface RivScan {
  major: number;
  minor: number;
  /** Byte offset where the object stream starts (after the header and ToC). */
  bodyStart: number;
  objects: RivObject[];
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export function scanRiv(bytes: Uint8Array): RivScan {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const varuint = () => {
    let result = 0,
      shift = 0,
      byte: number;
    do {
      if (offset >= bytes.length) throw new Error('Truncated .riv varuint');
      byte = bytes[offset++] ?? 0;
      result += (byte & 0x7f) * 2 ** shift;
      shift += 7;
    } while (byte & 0x80);
    return result;
  };
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'RIVE') throw new Error('Not a .riv file');
  offset = 4;
  const major = varuint(),
    minor = varuint();
  varuint(); // file id
  const tocKeys: number[] = [];
  for (let key = varuint(); key !== 0; key = varuint()) tocKeys.push(key);
  const toc = new Map<number, number>();
  let word = 0;
  // Four 2-bit field codes per little-endian uint32 (runtime_header.hpp).
  tocKeys.forEach((key, index) => {
    if (index % 4 === 0) {
      word = view.getUint32(offset, true);
      offset += 4;
    }
    toc.set(key, (word >>> ((index % 4) * 2)) & 3);
  });
  const bodyStart = offset;
  const objects: RivObject[] = [];
  while (offset < bytes.length) {
    const start = offset;
    const typeKey = varuint();
    const props = new Map<number, number | string>();
    const at = new Map<number, number>();
    let terminator: number;
    for (;;) {
      terminator = offset;
      const key = varuint();
      if (key === 0) break;
      at.set(key, offset);
      const kind: number | undefined = toc.get(key) ?? fieldTypes[key];
      if (kind === undefined)
        throw new Error('Unknown .riv property ' + String(key) + ' at ' + String(offset));
      if (kind === Field.String) {
        const length = varuint();
        const raw = bytes.subarray(offset, offset + length);
        offset += length;
        // Byte payloads (embedded fonts/images) are large; keep only short strings.
        if (length < 256) props.set(key, decoder.decode(raw));
      } else if (kind === Field.Double) {
        props.set(key, view.getFloat32(offset, true));
        offset += 4;
      } else if (kind === Field.Color) {
        props.set(key, view.getUint32(offset, true));
        offset += 4;
      } else props.set(key, varuint());
    }
    objects.push({ typeKey, start, terminator, end: offset, props, at });
  }
  return { major, minor, bodyStart, objects };
}

/** Append-only encoder for new objects/properties. */
export class RivWriter {
  private chunks: number[] = [];
  varuint(value: number) {
    let rest = Math.floor(value);
    do {
      let byte = rest % 128;
      rest = Math.floor(rest / 128);
      if (rest > 0) byte |= 0x80;
      this.chunks.push(byte);
    } while (rest > 0);
    return this;
  }
  uintProp(key: number, value: number) {
    return this.varuint(key).varuint(value);
  }
  doubleProp(key: number, value: number) {
    this.varuint(key);
    const buffer = new DataView(new ArrayBuffer(4));
    buffer.setFloat32(0, value, true);
    for (let i = 0; i < 4; i++) this.chunks.push(buffer.getUint8(i));
    return this;
  }
  stringProp(key: number, value: string) {
    const encoded = encoder.encode(value);
    this.varuint(key).varuint(encoded.length);
    for (const byte of encoded) this.chunks.push(byte);
    return this;
  }
  object(typeKey: number) {
    return this.varuint(typeKey);
  }
  end() {
    return this.varuint(0);
  }
  bytes() {
    return Uint8Array.from(this.chunks);
  }
}

/** Splice insertions (offset -> bytes) into a copy of the source, preserving order per offset. */
export function splice(source: Uint8Array, insertions: { at: number; bytes: Uint8Array }[]) {
  const sorted = insertions.map((entry, order) => ({ ...entry, order }));
  sorted.sort((a, b) => a.at - b.at || a.order - b.order);
  const total = source.length + sorted.reduce((sum, entry) => sum + entry.bytes.length, 0);
  const out = new Uint8Array(total);
  let read = 0,
    write = 0;
  for (const entry of sorted) {
    out.set(source.subarray(read, entry.at), write);
    write += entry.at - read;
    read = entry.at;
    out.set(entry.bytes, write);
    write += entry.bytes.length;
  }
  out.set(source.subarray(read), write);
  return out;
}
