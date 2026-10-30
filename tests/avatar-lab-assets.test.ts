import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { retargetSharedRigClip } from '../src/avatar-lab/retarget';
import { sampleStride } from '../src/avatar-lab/sampleStride';
import { required } from './helpers/required';
import { createFace } from '../src/avatar-lab/facial';

/** Keep the real geometry, bones and clips; omit materials for this CPU-only test. */
async function rig(path: string) {
  const file = readFileSync(path);
  const glb = path.endsWith('.glb');
  const jsonLength = glb ? file.readUInt32LE(12) : 0;
  const document = JSON.parse(
    glb ? file.subarray(20, 20 + jsonLength).toString() : file.toString(),
  ) as {
    buffers: { uri?: string; byteLength: number }[];
    meshes?: { primitives: { material?: number }[] }[];
    materials?: unknown;
    images?: unknown;
    textures?: unknown;
  };
  const binary = glb
    ? file.subarray(28 + jsonLength)
    : readFileSync(join(dirname(path), required(required(document.buffers[0]).uri)));
  delete required(document.buffers[0]).uri;
  delete document.materials;
  delete document.images;
  delete document.textures;
  for (const mesh of document.meshes ?? [])
    for (const primitive of mesh.primitives) delete primitive.material;
  const json = Buffer.from(JSON.stringify(document));
  const paddedJson = Math.ceil(json.length / 4) * 4;
  const paddedBin = Math.ceil(binary.length / 4) * 4;
  const output = Buffer.alloc(28 + paddedJson + paddedBin);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(paddedJson, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  output.fill(32, 20, 20 + paddedJson);
  json.copy(output, 20);
  output.writeUInt32LE(paddedBin, 20 + paddedJson);
  output.writeUInt32LE(0x004e4942, 24 + paddedJson);
  binary.copy(output, 28 + paddedJson);
  return new GLTFLoader().parseAsync(
    output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength),
    '',
  );
}

describe('actual comparison asset gait calibration', () => {
  it('plays the Blender bundle with moving feet and a planted look-around study', async () => {
    const model = await rig('public/models/avatar-lab/kaykit/Tavi_Ranger.blend.glb');
    expect(model.animations.map((clip) => clip.name)).toEqual(
      expect.arrayContaining(['Idle_A', 'Walking_A', 'Running_A', 'Tavi_LookAround']),
    );
    const height = new THREE.Box3().setFromObject(model.scene).getSize(new THREE.Vector3()).y;
    model.scene.scale.setScalar(2 / height);
    const walk = required(model.animations.find((clip) => clip.name === 'Walking_A'));
    expect(sampleStride(model.scene, walk, ['toesl', 'toesr']).distance).toBeGreaterThan(0.3);
    const look = required(model.animations.find((clip) => clip.name === 'Tavi_LookAround'));
    const mixer = new THREE.AnimationMixer(model.scene);
    mixer.clipAction(look).play();
    const foot = required(model.scene.getObjectByName('toesl'));
    const head = required(model.scene.getObjectByName('head'));
    mixer.setTime(0);
    const startFoot = foot.getWorldPosition(new THREE.Vector3());
    const startHead = head.quaternion.clone();
    mixer.setTime(2.5);
    expect(foot.getWorldPosition(new THREE.Vector3()).distanceTo(startFoot)).toBeLessThan(0.001);
    expect(head.quaternion.angleTo(startHead)).toBeGreaterThan(0.1);
    mixer.stopAllAction();
    mixer.uncacheRoot(model.scene);
  });
  it('exports stable two-hand contact and independent facial controls on the real mesh', async () => {
    const model = await rig('public/models/avatar-lab/kaykit/Tavi_Ranger.blend.glb');
    const head = required(model.scene.getObjectByName('Ranger_Head')) as THREE.Mesh;
    const dictionary = required(head.morphTargetDictionary);
    for (const name of ['blink', 'happy', 'surprised', 'lookLeft', 'lookRight'])
      expect(dictionary[name]).toBeTypeOf('number');
    const height = new THREE.Box3().setFromObject(model.scene).getSize(new THREE.Vector3()).y;
    expect(height).toBeGreaterThan(2);
    expect(height).toBeLessThan(2.6);
    const face = createFace(model.scene);
    expect(face.supported).toBe(true);
    face.update(0.09, 'happy', 1);
    const weights = required(head.morphTargetInfluences);
    expect(weights[required(dictionary['blink'])]).toBeCloseTo(1);
    expect(weights[required(dictionary['happy'])]).toBeGreaterThan(0);
    expect(weights[required(dictionary['lookRight'])]).toBeGreaterThan(0);
    const brace = required(model.animations.find((clip) => clip.name === 'Tavi_Brace'));
    const mixer = new THREE.AnimationMixer(model.scene);
    mixer.clipAction(brace).play();
    const left = required(model.scene.getObjectByName('handl'));
    const right = required(model.scene.getObjectByName('handr'));
    const feet = ['toesl', 'toesr'].map((name) => required(model.scene.getObjectByName(name)));
    const reference: THREE.Vector3[] = [];
    for (const time of [1.3, 1.6, 2, 2.4, 2.7]) {
      mixer.setTime(time);
      const points = [left, right, ...feet].map((bone) =>
        bone.getWorldPosition(new THREE.Vector3()),
      );
      if (reference.length === 0) reference.push(...points.map((point) => point.clone()));
      points.forEach((point, index) => {
        expect(point.distanceTo(required(reference[index]))).toBeLessThan(0.0001);
      });
      expect(points[0]?.z).toBeCloseTo(0.44, 3);
      expect(points[1]?.z).toBeCloseTo(0.44, 3);
    }
    // Skeletal action updates never reset the separately controlled expression.
    expect(weights[required(dictionary['happy'])]).toBeGreaterThan(0);
    mixer.stopAllAction();
    mixer.uncacheRoot(model.scene);
  });
  it.each(['kaykit', 'quaternius'] as const)(
    'measures walking and running on the actual %s rig',
    async (family) => {
      const base = 'public/models/avatar-lab/';
      const model = await rig(
        base +
          (family === 'kaykit' ? 'kaykit/Ranger.glb' : 'quaternius/Superhero_Female_FullBody.gltf'),
      );
      const source = await rig(
        base +
          (family === 'kaykit'
            ? 'kaykit/Rig_Medium_MovementBasic.glb'
            : 'quaternius/UAL1_Standard.glb'),
      );
      const box = new THREE.Box3().setFromObject(model.scene);
      const height = box.getSize(new THREE.Vector3()).y;
      const restOffsets = new Map<string, number[]>();
      model.scene.traverse((bone) => {
        if (bone instanceof THREE.Bone) restOffsets.set(bone.name, bone.position.toArray());
      });
      const clips = (
        family === 'kaykit' ? ['Walking_A', 'Running_A'] : ['Walk_Loop', 'Jog_Fwd_Loop']
      ).map((name) => {
        const original = required(source.animations.find((clip) => clip.name === name));
        return family === 'kaykit'
          ? original
          : retargetSharedRigClip(original, source.scene, model.scene);
      });
      model.scene.scale.setScalar(2 / height);
      const feet: [string, string] =
        family === 'kaykit' ? ['toesl', 'toesr'] : ['ball_l', 'ball_r'];
      for (const clip of clips) {
        const curve = sampleStride(model.scene, clip, feet);
        expect(curve.distance).toBeGreaterThan(0.3);
        if (family === 'quaternius') {
          const reference = JSON.parse(
            readFileSync(base + 'quaternius/root-motion.json', 'utf8'),
          ) as Record<string, { distance: number }>;
          const sourceHip = required(source.scene.getObjectByName('pelvis'));
          const targetHip = required(model.scene.getObjectByName('pelvis'));
          const expected =
            (required(reference[clip.name]).distance * (2 / height) * targetHip.position.length()) /
            sourceHip.position.length();
          expect(curve.distance).toBeGreaterThan(expected * 0.7);
          expect(curve.distance).toBeLessThan(expected * 1.3);
        } else expect(curve.distance).toBeLessThan(6);
        expect(
          curve.distances.every(
            (distance, index) => index === 0 || distance >= required(curve.distances[index - 1]),
          ),
        ).toBe(true);
      }
      model.scene.traverse((bone) => {
        if (bone instanceof THREE.Bone) {
          const before = required(restOffsets.get(bone.name));
          bone.position.toArray().forEach((value, index) => {
            expect(value).toBeCloseTo(required(before[index]), 5);
          });
        }
      });
    },
  );
});
