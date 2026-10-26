import { z } from 'zod';
export const TWITCH_CLIENT_ID = 'stdwkc13njfgfgvspbj8sls28zra0h';
export const TWITCH_SCOPES = ['user:read:chat'];
export const chatMessageSchema = z.object({
  id: z.string().max(200),
  userId: z.string().max(100),
  author: z.string().max(100),
  text: z.string().max(500),
  receivedAt: z.number(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export const twitchStatusSchema = z.object({
  phase: z.enum([
    'disconnected',
    'authorizing',
    'connecting',
    'connected',
    'reconnecting',
    'error',
  ]),
  account: z.object({ id: z.string(), login: z.string() }).nullable(),
  authorization: z
    .object({ userCode: z.string(), verificationUri: z.url(), expiresAt: z.number() })
    .nullable(),
  error: z.string().nullable(),
  messages: z.array(chatMessageSchema).max(20),
});
export type TwitchStatus = z.infer<typeof twitchStatusSchema>;
export function disconnectedTwitch(): TwitchStatus {
  return { phase: 'disconnected', account: null, authorization: null, error: null, messages: [] };
}
