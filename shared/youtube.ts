import { z } from 'zod';
import { chatMessageSchema } from './twitch.js';

export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
export const youtubeStatusSchema = z.object({
  configured: z.boolean(),
  phase: z.enum([
    'disconnected',
    'authorizing',
    'connecting',
    'waiting',
    'connected',
    'reconnecting',
    'error',
  ]),
  account: z.object({ id: z.string(), title: z.string() }).nullable(),
  authorization: z.object({ url: z.url(), expiresAt: z.number() }).nullable(),
  broadcasts: z.array(z.object({ id: z.string(), title: z.string() })),
  broadcastId: z.string().nullable(),
  error: z.string().nullable(),
  messages: z.array(chatMessageSchema).max(20),
});
export type YoutubeStatus = z.infer<typeof youtubeStatusSchema>;
export function disconnectedYoutube(configured = false): YoutubeStatus {
  return {
    configured,
    phase: 'disconnected',
    account: null,
    authorization: null,
    broadcasts: [],
    broadcastId: null,
    error: null,
    messages: [],
  };
}
