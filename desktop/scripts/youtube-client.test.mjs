import { test } from 'node:test';
import assert from 'node:assert/strict';
import { youtubeClientDefinition } from './youtube-client.mjs';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

test('embeds the maintainer-configured desktop identity, not other environment credentials', () => {
  const result = youtubeClientDefinition({
    TAVI_YOUTUBE_CLIENT_ID: 'tavi.apps.googleusercontent.com',
    TAVI_YOUTUBE_CLIENT_SECRET: 'desktop-client',
    OPENAI_API_KEY: 'never-bundle',
    GOOGLE_REFRESH_TOKEN: 'never-bundle-either',
  });
  assert.deepEqual(JSON.parse(result), {
    client_id: 'tavi.apps.googleusercontent.com',
    client_secret: 'desktop-client',
  });
  assert.equal(result.includes('never-bundle'), false);
});
test('development builds can omit the client; public releases fail before packaging', () => {
  assert.equal(youtubeClientDefinition({}), 'undefined');
  assert.throws(() => youtubeClientDefinition({ TAVI_REQUIRE_YOUTUBE: '1' }), /Release requires/);
});
test('rejects partial or malformed configuration without including values in the error', () => {
  for (const env of [
    { TAVI_YOUTUBE_CLIENT_ID: 'private-invalid' },
    { TAVI_YOUTUBE_CLIENT_SECRET: 'private-secret' },
    { TAVI_YOUTUBE_CLIENT_ID: 'wrong', TAVI_YOUTUBE_CLIENT_SECRET: 'private-secret' },
  ]) {
    assert.throws(
      () => youtubeClientDefinition(env),
      (error) => error.message.includes('Incomplete') && !error.message.includes('private-'),
    );
  }
});

test('a packaged service loads its shared identity without any user file or environment setup', async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../../server/youtube/config.ts', import.meta.url))],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    define: {
      __TAVI_YOUTUBE_CLIENT__: youtubeClientDefinition({
        TAVI_YOUTUBE_CLIENT_ID: 'bundled.apps.googleusercontent.com',
        TAVI_YOUTUBE_CLIENT_SECRET: 'bundled-desktop-client',
      }),
      'process.env.TAVI_YOUTUBE_CLIENT_ID': 'undefined',
      'process.env.TAVI_YOUTUBE_CLIENT_SECRET': 'undefined',
    },
  });
  const output = result.outputFiles[0];
  assert.ok(output);
  const module = await import(
    'data:text/javascript;base64,' + Buffer.from(output.text).toString('base64')
  );
  assert.deepEqual(await module.youtubeCredentials(5531, '/no-user-configuration-here'), {
    clientId: 'bundled.apps.googleusercontent.com',
    clientSecret: 'bundled-desktop-client',
    redirectUri: 'http://127.0.0.1:5531/api/youtube/callback',
  });
});
