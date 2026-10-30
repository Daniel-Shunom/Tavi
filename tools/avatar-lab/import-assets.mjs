// Import only the comparison assets from the author's official free downloads.
// Unpack the archives under build/avatar-assets before running this script.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, basename } from 'node:path';
const out = 'public/models/avatar-lab';
const credits = 'public/credits/avatar-lab';
mkdirSync(credits, { recursive: true });
function find(root, name) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isFile() && entry.name === name) return path;
    if (entry.isDirectory()) {
      const result = find(path, name);
      if (result) return result;
    }
  }
  return null;
}
function copy(source, target) {
  if (!source) throw new Error(`Missing source for ${target}`);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
const kay = 'build/avatar-assets/kaykit';
for (const name of [
  'Ranger.glb',
  'Mage.glb',
  'Rig_Medium_General.glb',
  'Rig_Medium_MovementBasic.glb',
])
  copy(find(kay, name), `${out}/kaykit/${name}`);
copy(find(kay, 'License.txt'), `${credits}/KayKit-License.txt`);
const quat = 'build/avatar-assets/quaternius';
for (const name of ['Superhero_Female_FullBody.gltf', 'Superhero_Male_FullBody.gltf']) {
  const source = find(quat, name);
  if (!source) throw new Error(`Missing ${name}`);
  const gltf = JSON.parse(readFileSync(source, 'utf8'));
  for (const item of [...(gltf.images ?? []), ...(gltf.buffers ?? [])]) {
    if (!item.uri || item.uri.startsWith('data:')) continue;
    if (basename(item.uri) !== item.uri) throw new Error(`Unexpected asset path ${item.uri}`);
    let input = join(dirname(source), item.uri);
    // The official pack refers to T_Eye_Normal_png.png but ships T_Eye_Normal.png.
    if (!existsSync(input)) input = join(dirname(source), item.uri.replace('_png.png', '.png'));
    copy(input, `${out}/quaternius/${item.uri}`);
  }
  writeFileSync(`${out}/quaternius/${name}`, JSON.stringify(gltf));
}
copy(find(quat, 'License_Standard.txt'), `${credits}/Quaternius-License.txt`);
const animations = 'build/avatar-assets/quaternius-animations';
copy(find(animations, 'UAL1_Standard.glb'), `${out}/quaternius/UAL1_Standard.glb`);
copy(find(animations, 'License.txt'), `${credits}/Quaternius-Animations-License.txt`);
// Keep the author's root-motion reference distances for calibration checks.
const rm = readFileSync(find(animations, 'UAL1_Standard_RM.glb'));
const jsonLength = rm.readUInt32LE(12);
const document = JSON.parse(
  rm
    .subarray(20, 20 + jsonLength)
    .toString()
    .trim(),
);
function accessorValues(index) {
  const accessor = document.accessors[index];
  const view = document.bufferViews[accessor.bufferView];
  const components = accessor.type === 'VEC3' ? 3 : 1;
  const offset = 28 + jsonLength + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return Array.from({ length: accessor.count }, (_, frame) =>
    Array.from({ length: components }, (_, axis) =>
      rm.readFloatLE(offset + frame * (view.byteStride ?? components * 4) + axis * 4),
    ),
  );
}
const reference = {};
for (const name of ['Walk_Loop', 'Jog_Fwd_Loop']) {
  const animation = document.animations.find((clip) => clip.name === name);
  const channel = animation.channels.find(
    (item) =>
      document.nodes[item.target.node].name === 'root' && item.target.path === 'translation',
  );
  const sampler = animation.samplers[channel.sampler];
  const times = accessorValues(sampler.input).flat();
  const positions = accessorValues(sampler.output);
  reference[name] = {
    duration: times[times.length - 1],
    distance: positions[positions.length - 1][2] - positions[0][2],
  };
}
writeFileSync(`${out}/quaternius/root-motion.json`, JSON.stringify(reference, null, 2));
console.log('Imported official KayKit and Quaternius comparison assets and licenses.');
