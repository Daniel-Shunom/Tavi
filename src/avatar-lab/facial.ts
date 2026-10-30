import * as THREE from 'three';

export type FacialExpression = 'auto' | 'neutral' | 'happy' | 'surprised';
const names = [
  'blink',
  'happy',
  'surprised',
  'lookLeft',
  'lookRight',
  'lookUp',
  'lookDown',
] as const;

/** Morph controls remain independent of the skeletal locomotion mixer. */
export function createFace(root: THREE.Object3D) {
  const faces: THREE.Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Mesh && node.morphTargetDictionary?.['blink'] !== undefined)
      faces.push(node as THREE.Mesh);
  });
  let time = 0;
  return {
    supported: faces.length > 0,
    update(dt: number, expression: FacialExpression, attention = 0) {
      time += dt;
      const blinkPhase = time % 4.7;
      const blink = blinkPhase < 0.18 ? Math.sin((blinkPhase / 0.18) * Math.PI) : 0;
      const selected =
        expression === 'auto' ? (Math.floor(time / 7) % 3 === 1 ? 'happy' : 'neutral') : expression;
      const targets: Record<(typeof names)[number], number> = {
        blink,
        happy: selected === 'happy' ? 1 : 0,
        surprised: selected === 'surprised' ? 1 : 0,
        lookLeft: Math.max(0, -attention),
        lookRight: Math.max(0, attention),
        lookUp: 0,
        lookDown: 0,
      };
      for (const face of faces) {
        const dictionary = face.morphTargetDictionary;
        const influences = face.morphTargetInfluences;
        if (!dictionary || !influences) continue;
        for (const name of names) {
          const index = dictionary[name];
          if (index === undefined) continue;
          const current = influences[index] ?? 0;
          influences[index] =
            name === 'blink' ? blink : THREE.MathUtils.damp(current, targets[name], 9, dt);
        }
      }
    },
  };
}
