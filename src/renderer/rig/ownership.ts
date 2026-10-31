export type RigChannel = 'torso' | 'legs' | 'arms' | 'face' | 'cloth';
export interface RigLayer {
  id: string;
  priority: number;
  owns: readonly RigChannel[];
}
/** Highest priority owns a channel. Ambiguous writes are rejected, never order-dependent. */
export function resolveOwnership(layers: readonly RigLayer[]): ReadonlyMap<RigChannel, string> {
  const winners = new Map<RigChannel, RigLayer>();
  const ids = new Set<string>();
  const claims = new Set<string>();
  for (const layer of layers) {
    if (ids.has(layer.id) || !Number.isFinite(layer.priority))
      throw new Error('Invalid rig layer: ' + layer.id);
    ids.add(layer.id);
    for (const channel of layer.owns) {
      const claim = `${channel}:${String(layer.priority)}`;
      if (claims.has(claim)) throw new Error('Ambiguous rig ownership: ' + channel);
      claims.add(claim);
      const previous = winners.get(channel);
      if (previous?.priority === layer.priority)
        throw new Error('Ambiguous rig ownership: ' + channel);
      if (!previous || layer.priority > previous.priority) winners.set(channel, layer);
    }
  }
  return new Map([...winners].map(([channel, layer]) => [channel, layer.id]));
}
