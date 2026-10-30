import * as THREE from 'three';
import { measureStride, type StrideSample } from './stride';

/** Sample the actual animated skeleton, including rest-pose compensation and
 * display normalization. Ball/toe bones provide the forward contact reference.
 */
export function sampleStride(
  root: THREE.Object3D,
  clip: THREE.AnimationClip,
  names: readonly [string, string],
) {
  const left = root.getObjectByName(names[0]);
  const right = root.getObjectByName(names[1]);
  if (!left || !right) throw new Error(`Missing stride reference ${names.join(', ')}`);
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();
  const samples: StrideSample[] = [];
  for (let frame = 0; frame <= 120; frame++) {
    mixer.setTime((frame / 120) * clip.duration);
    root.updateWorldMatrix(true, true);
    const point = (foot: THREE.Object3D) => {
      const point = foot.getWorldPosition(new THREE.Vector3());
      return { y: point.y, z: point.z };
    };
    samples.push([point(left), point(right)]);
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
  root.updateWorldMatrix(true, true);
  return measureStride(samples, clip.duration);
}
