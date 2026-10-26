// Probe for variant authoring: draws the mascot large with chosen fill components recoloured to
// bright green (?hl=17,20) and stored floats edited (?f=12.16=1.2,40.89=60), so you can see which
// component is which body part and how a proportion edit moves the rig.
// Serve with Vite and open /tools/variants/probe.html?hl=...
import { RuntimeLoader } from '@rive-app/webgl2';
import wasmURL from '@rive-app/webgl2/rive.wasm?url';
import avatarURL from '../../src/renderer/characters/mascot/mascot.riv?url';
import { setComponentColors, setComponentFloats } from '../../src/renderer/characters/variants/rivEdit';
import { createSheetRig } from '../expression-sheet/rig';

RuntimeLoader.setWasmUrl(wasmURL);
RuntimeLoader.setWasmFallbackUrl(null);

const params = new URLSearchParams(location.search);
const ARTBOARD = 'lyla animation';

async function main() {
  const runtime = await RuntimeLoader.awaitInstance();
  let bytes = new Uint8Array(await (await fetch(avatarURL)).arrayBuffer());
  const hl = (params.get('hl') ?? '').split(',').filter(Boolean).map(Number);
  bytes = setComponentColors(bytes, ARTBOARD, new Map(hl.map((i) => [i, 0xff00e040])));
  const floats = (params.get('f') ?? '')
    .split(',')
    .filter(Boolean)
    .map((edit) => {
      const [target = '', value = '0'] = edit.split('=');
      const [index = '0', property = '0'] = target.split('.');
      return { index: Number(index), property: Number(property), value: Number(value) };
    });
  bytes = setComponentFloats(bytes, ARTBOARD, floats);
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const size = Number(params.get('size') ?? 640);
  const rig = await createSheetRig(runtime, canvas, bytes, size, size);
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
