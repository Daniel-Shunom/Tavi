import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { YoutubeCredentials } from './gateway.js';

// Replaced by the desktop packager. This is Google's public Desktop app identity,
// not an account token or a confidential server-side OAuth client.
declare const __TAVI_YOUTUBE_CLIENT__: unknown;

const clientSchema = z.object({
  client_id: z.string().endsWith('.apps.googleusercontent.com'),
  client_secret: z.string().min(1),
});
/** Accept Google's Desktop client download; never expose its contents through the API. */
export async function youtubeCredentials(
  port: number,
  directory = '.data',
): Promise<YoutubeCredentials | undefined> {
  let client: unknown;
  if (process.env['TAVI_YOUTUBE_CLIENT_ID'] || process.env['TAVI_YOUTUBE_CLIENT_SECRET']) {
    client = {
      client_id: process.env['TAVI_YOUTUBE_CLIENT_ID'],
      client_secret: process.env['TAVI_YOUTUBE_CLIENT_SECRET'],
    };
  } else if (typeof __TAVI_YOUTUBE_CLIENT__ !== 'undefined') {
    client = __TAVI_YOUTUBE_CLIENT__;
  } else {
    try {
      const parsed: unknown = JSON.parse(
        await readFile(resolve(directory, 'youtube-client.json'), 'utf8'),
      );
      client = z.object({ installed: clientSchema }).parse(parsed).installed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        console.warn('YouTube client configuration is invalid. See docs/YOUTUBE.md.');
      return undefined;
    }
  }
  const parsed = clientSchema.safeParse(client);
  if (!parsed.success) {
    console.warn('YouTube client configuration is incomplete. See docs/YOUTUBE.md.');
    return undefined;
  }
  return {
    clientId: parsed.data.client_id,
    clientSecret: parsed.data.client_secret,
    redirectUri: `http://127.0.0.1:${String(port)}/api/youtube/callback`,
  };
}
