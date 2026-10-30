import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mascotV2Face } from '../../src/renderer/characters/mascot-v2/acting.ts';
import { expressions } from '../../shared/expressions.ts';

const channels: Record<string, string> = {
  browL: 'browLeft',
  browR: 'browRight',
  blinkL: 'blinkLeft',
  blinkR: 'blinkRight',
  squintL: 'lidLeft',
  squintR: 'lidRight',
  smile: 'mouthCurve',
  mouthX: 'mouthX',
  mouthY: 'mouthY',
  mouthShape: 'mouthShape',
  mouthOpen: 'mouthOpen',
  mouthWide: 'mouthWide',
  mouthTilt: 'mouthTilt',
  mouthPop: 'mouthPop',
  browTiltL: 'browTiltL',
  browTiltR: 'browTiltR',
};
const filter = (values: Record<string, number> | undefined) =>
  Object.fromEntries(
    Object.entries(values ?? {})
      .filter(([name]) => name in channels)
      .map(([name, value]) => [channels[name], value]),
  );
const catalog = Object.fromEntries(
  Object.entries(mascotV2Face.poses ?? {})
    .filter(([id]) => expressions[id as keyof typeof expressions].channel === 'emote')
    .map(([id, entry]) => {
      const pose = entry as {
        pose: Record<string, number>;
        strong?: Record<string, number>;
        onset?: { pose?: Record<string, number>; seconds?: number; hold?: number };
        keys?: { channels?: Record<string, [number, number][]>; every?: number };
      };
      return [
        id,
        {
          label: expressions[id as keyof typeof expressions].label,
          typical: filter(pose.pose),
          strong: filter(pose.strong),
          ...(pose.onset ? { onset: { ...pose.onset, pose: filter(pose.onset.pose) } } : {}),
          ...(pose.keys
            ? {
                keys: {
                  ...pose.keys,
                  channels: Object.fromEntries(
                    Object.entries(pose.keys.channels ?? {})
                      .filter(([name]) => name in channels)
                      .map(([name, keys]) => [channels[name], keys]),
                  ),
                },
              }
            : {}),
          deferredChannels: [
            ...new Set(
              [
                ...Object.keys(pose.pose),
                ...Object.keys(pose.strong ?? {}),
                ...Object.keys(pose.keys?.channels ?? {}),
              ].filter((name) => !(name in channels)),
            ),
          ],
        },
      ];
    }),
);
const sources = [
  'src/renderer/characters/mascot-v2/acting.ts',
  'src/renderer/characters/mascot/acting/core.ts',
  'src/renderer/characters/mascot/acting/faces.ts',
  'src/renderer/characters/mascot/acting/custom.ts',
  'shared/expressions.ts',
];
const result = {
  schema: 1,
  purpose: 'Facial-only port from the original Tavi acting library; no body or gaze ownership.',
  sourceSha256: Object.fromEntries(
    sources.map((path) => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]),
  ),
  channels,
  expressions: catalog,
};
const destination = fileURLToPath(new URL('./expression-catalog.json', import.meta.url));
writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
console.log(`Exported ${Object.keys(catalog).length} canonical facial emotes to ${destination}`);
