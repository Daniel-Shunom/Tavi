import * as THREE from 'three';

/** Rest-pose compensation for the two Quaternius assets' matching named skeletons.
 * This is intentionally not a general-purpose retargeter for unrelated rigs.
 * Limb offsets and scales stay on the target: motions must not resize its anatomy.
 */
export function retargetSharedRigClip(
  clip: THREE.AnimationClip,
  source: THREE.Object3D,
  target: THREE.Object3D,
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  const sourceHip = source.getObjectByName('pelvis');
  const targetHip = target.getObjectByName('pelvis');
  const hipRatio =
    sourceHip && targetHip ? targetHip.position.length() / sourceHip.position.length() : 1;
  for (const track of clip.tracks) {
    const split = track.name.lastIndexOf('.');
    const name = track.name.slice(0, split);
    const property = track.name.slice(split + 1);
    const from = source.getObjectByName(name);
    const to = target.getObjectByName(name);
    if (!from || !to) continue;
    if (property === 'quaternion') {
      const correction = to.quaternion.clone().multiply(from.quaternion.clone().invert());
      const values = new Float32Array(track.values.length);
      for (let i = 0; i < values.length; i += 4) {
        const value = new THREE.Quaternion().fromArray(track.values, i);
        correction.clone().multiply(value).normalize().toArray(values, i);
      }
      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          track.name,
          track.times,
          values,
          track.getInterpolation(),
        ),
      );
    } else if (property === 'position' && name === 'pelvis') {
      const values = new Float32Array(track.values.length);
      for (let i = 0; i < values.length; i += 3) {
        const value = new THREE.Vector3()
          .fromArray(track.values, i)
          .sub(from.position)
          .multiplyScalar(hipRatio)
          .add(to.position);
        value.toArray(values, i);
      }
      tracks.push(
        new THREE.VectorKeyframeTrack(track.name, track.times, values, track.getInterpolation()),
      );
    }
  }
  if (!tracks.length) throw new Error(`No compatible bones found for ${clip.name}`);
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}
