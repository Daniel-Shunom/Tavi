import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { retargetSharedRigClip } from '../src/avatar-lab/retarget';
import { required } from './helpers/required';

function rig(height: number, angle: number) {
  const root = new THREE.Group();
  const hip = new THREE.Bone();
  hip.name = 'pelvis';
  hip.position.set(0, height, 0);
  hip.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
  const leg = new THREE.Bone();
  leg.name = 'thigh_l';
  leg.position.set(0.1, -height / 2, 0);
  root.add(hip);
  hip.add(leg);
  return { root, hip, leg };
}

describe('shared-rig avatar comparison', () => {
  it('maps the source rest pose to target anatomy without copying limb lengths or scale', () => {
    const source = rig(1, 0.2);
    const target = rig(2, 0.4);
    const clip = new THREE.AnimationClip('walk', 1, [
      new THREE.QuaternionKeyframeTrack(
        'pelvis.quaternion',
        [0, 1],
        [...source.hip.quaternion.toArray(), ...source.hip.quaternion.toArray()],
      ),
      new THREE.VectorKeyframeTrack('pelvis.position', [0, 1], [0, 1, 0, 0, 1.1, 0]),
      new THREE.VectorKeyframeTrack('thigh_l.position', [0, 1], [0.1, -0.5, 0, 0.1, -0.5, 0]),
      new THREE.VectorKeyframeTrack('thigh_l.scale', [0, 1], [1, 1, 1, 0.8, 1.2, 1]),
    ]);
    const retargeted = retargetSharedRigClip(clip, source.root, target.root);
    expect(retargeted.tracks.map((track) => track.name)).toEqual([
      'pelvis.quaternion',
      'pelvis.position',
    ]);
    const rotation = new THREE.Quaternion().fromArray(required(retargeted.tracks[0]).values);
    expect(rotation.angleTo(target.hip.quaternion)).toBeLessThan(0.001);
    expect(required(retargeted.tracks[1]).values[1]).toBeCloseTo(2);
    expect(required(retargeted.tracks[1]).values[4]).toBeCloseTo(2.2);
    expect(target.leg.position.y).toBe(-1);
    expect(clip.tracks).toHaveLength(4);
    expect(source.hip.position.y).toBe(1);
  });

  it('rejects a clip with no compatible skeleton rather than showing a false success', () => {
    const clip = new THREE.AnimationClip('unrelated', 1, [
      new THREE.NumberKeyframeTrack('unknown.rotation', [0], [0]),
    ]);
    expect(() => retargetSharedRigClip(clip, new THREE.Group(), new THREE.Group())).toThrow(
      'No compatible bones',
    );
  });
});
