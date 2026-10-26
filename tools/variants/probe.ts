// Probe for variant authoring: draws Lyla v2 large with a variant applied (?v=<json patch>),
// chosen fill components recoloured to bright green (?hl=17,20) and a pose (?pose=smile=1).
// Serve with Vite and open /tools/variants/probe.html?v={"build":"full"}
import { RuntimeLoader } from '@rive-app/webgl2';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import avatarURL from '../../src/renderer/characters/mascot-v2/mascot-v2.riv?url';
import { originalVariant, withChanges, type VariantPatch } from '../../shared/variants';
import { applyVariant } from '../../src/renderer/characters/variants/apply';
import { editComponents } from '../../src/renderer/characters/variants/rivEdit';
import { mascotV2VariantRig } from '../../src/renderer/characters/variants/rigs/mascotV2';
import { createSheetRig } from '../expression-sheet/rig';

RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);

const params = new URLSearchParams(location.search);
const ARTBOARD = 'lyla animation';

async function main() {
  const runtime = await RuntimeLoader.awaitInstance();
  let bytes = new Uint8Array(await (await fetch(avatarURL)).arrayBuffer());
  const patch = JSON.parse(params.get('v') ?? '{}') as VariantPatch;
  bytes = applyVariant(bytes, mascotV2VariantRig, withChanges(originalVariant, patch));
  const hl = (params.get('hl') ?? '').split(',').filter(Boolean).map(Number);
  bytes = editComponents(bytes, ARTBOARD, { colors: new Map(hl.map((i) => [i, 0xff00e040])) });
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const size = Number(params.get('size') ?? 640);
  const rig = await createSheetRig(runtime, canvas, bytes, size, size, true);
  const pose = Object.fromEntries(
    (params.get('pose') ?? '')
      .split(',')
      .filter(Boolean)
      .map((pair) => {
        const [name = '', value = '0'] = pair.split('=');
        return [name, Number(value)];
      }),
  );
  for (let i = 0; i < 10; i++) rig.draw(pose);
  document.body.dataset.ready = '1';
}
main().catch((error: unknown) => {
  document.body.dataset.error = String(error);
  throw error;
});
