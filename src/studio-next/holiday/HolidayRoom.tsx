import type { CSSProperties } from 'react';
import type { Room, RoomProp } from './rooms';

// Draws her holiday room on the stage, in two layers: one behind her (the wall, the floor, and
// whatever stands or hangs at the back) and one in front of her (props near the viewer). Studio
// only: none of this is in the overlay or on stream.

const art = import.meta.glob<string>('./art/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});
const url = (name: string) => art[`./art/${name}.svg`];

function Prop({ prop }: { prop: RoomProp }) {
  const src = url(prop.art);
  if (!src) return null;
  const hanging = prop.layer === 'ceiling';
  // Threads are measured against the stage's height; CSS padding is measured against its width.
  const thread = hanging ? ((prop.hang ?? 0) * 9) / 16 / prop.size : 0;
  const style: CSSProperties = hanging
    ? { left: `${String(prop.x)}%`, width: `${String(prop.size)}%`, top: 0 }
    : {
        left: `${String(prop.x)}%`,
        width: `${String(prop.size)}%`,
        top: `${String(prop.y ?? 100)}%`,
      };
  return (
    <span
      className="sn-prop"
      data-place={hanging ? 'hang' : 'stand'}
      data-glow={prop.glow || undefined}
      data-move={prop.move}
      data-window={prop.window || undefined}
      style={style}
    >
      {hanging ? (
        <i className="sn-prop-thread" style={{ paddingTop: `${String(thread * 100)}%` }} />
      ) : null}
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          transform:
            `${prop.flip ? 'scaleX(-1) ' : ''}${prop.tilt ? `rotate(${String(prop.tilt)}deg)` : ''}`.trim() ||
            undefined,
        }}
      />
    </span>
  );
}

export function RoomBack({ room }: { room: Room }) {
  return (
    <div className="sn-room sn-room-back" aria-hidden="true">
      <div className="sn-room-wall" />
      <div className="sn-room-floor" />
      <div className="sn-room-rug" />
      {room.props
        .filter((prop) => prop.layer !== 'front')
        .map((prop, i) => (
          <Prop key={i} prop={prop} />
        ))}
    </div>
  );
}

export function RoomFront({ room }: { room: Room }) {
  return (
    <div className="sn-room sn-room-front" aria-hidden="true">
      {room.props
        .filter((prop) => prop.layer === 'front')
        .map((prop, i) => (
          <Prop key={i} prop={prop} />
        ))}
    </div>
  );
}
