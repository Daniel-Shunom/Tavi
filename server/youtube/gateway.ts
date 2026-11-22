import { z } from 'zod';

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().positive(),
  scope: z.string().optional(),
});
export type YoutubeToken = z.infer<typeof tokenSchema>;
const channelSchema = z.object({
  items: z.array(z.object({ id: z.string(), snippet: z.object({ title: z.string() }) })),
});
const broadcastsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.object({ title: z.string(), liveChatId: z.string().optional() }),
    }),
  ),
});
export type YoutubeBroadcast = { id: string; title: string; chatId: string };
export const youtubePageSchema = z.object({
  nextPageToken: z.string().optional(),
  pollingIntervalMillis: z.number().nonnegative(),
  offlineAt: z.string().optional(),
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.object({
        type: z.string(),
        publishedAt: z.string(),
        displayMessage: z.string().optional(),
        messageDeletedDetails: z.object({ deletedMessageId: z.string() }).optional(),
        userBannedDetails: z
          .object({ bannedUserDetails: z.object({ channelId: z.string() }) })
          .optional(),
      }),
      authorDetails: z.object({ channelId: z.string(), displayName: z.string() }).optional(),
    }),
  ),
});
export type YoutubePage = z.infer<typeof youtubePageSchema>;
export interface YoutubeCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}
export interface YoutubeGateway {
  exchange(code: string, verifier: string): Promise<YoutubeToken>;
  refresh(token: string): Promise<YoutubeToken>;
  revoke(token: string): Promise<void>;
  account(token: string): Promise<{ id: string; title: string }>;
  broadcasts(token: string): Promise<YoutubeBroadcast[]>;
  messages(token: string, chatId: string, pageToken: string | undefined): Promise<YoutubePage>;
}
export class YoutubeRequestError extends Error {
  constructor(
    readonly kind: 'auth' | 'quota' | 'rate_limit' | 'ended' | 'unavailable' | 'permission',
  ) {
    super(kind);
  }
}
export function createYoutubeGateway(
  credentials: YoutubeCredentials,
  request = fetch,
): YoutubeGateway {
  async function json(url: string, init?: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await request(url, { ...init, signal: AbortSignal.timeout(10000) });
    } catch {
      throw new YoutubeRequestError('unavailable');
    }
    let details: unknown;
    try {
      details = await response.json();
    } catch (error) {
      // A body stream can fail after successful headers. Retry transport errors;
      // malformed successful JSON remains a protocol error, as do schema mismatches.
      if (!(error instanceof SyntaxError)) throw new YoutubeRequestError('unavailable');
      if (response.ok) throw error;
      details = null;
    }
    if (!response.ok) {
      const parsed = z
        .object({
          error: z.object({ errors: z.array(z.object({ reason: z.string() })).optional() }),
        })
        .safeParse(details);
      const reasons = parsed.success ? (parsed.data.error.errors?.map((e) => e.reason) ?? []) : [];
      if (
        response.status === 401 ||
        (response.status === 400 && url.includes('oauth2.googleapis.com'))
      )
        throw new YoutubeRequestError('auth');
      if (reasons.some((reason) => ['quotaExceeded', 'dailyLimitExceeded'].includes(reason)))
        throw new YoutubeRequestError('quota');
      if (
        response.status === 429 ||
        reasons.some((reason) => ['rateLimitExceeded', 'userRateLimitExceeded'].includes(reason))
      )
        throw new YoutubeRequestError('rate_limit');
      if (
        reasons.some((reason) =>
          ['liveChatEnded', 'liveChatDisabled', 'liveChatNotFound'].includes(reason),
        )
      )
        throw new YoutubeRequestError('ended');
      throw new YoutubeRequestError(response.status === 403 ? 'permission' : 'unavailable');
    }
    return details;
  }
  async function token(params: Record<string, string>) {
    return tokenSchema.parse(
      await json('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          ...params,
        }),
      }),
    );
  }
  function get(path: string, access: string, params: Record<string, string>) {
    return json(
      'https://www.googleapis.com/youtube/v3/' +
        path +
        '?' +
        new URLSearchParams(params).toString(),
      { headers: { Authorization: 'Bearer ' + access } },
    );
  }
  return {
    exchange: (code, verifier) =>
      token({
        code,
        code_verifier: verifier,
        redirect_uri: credentials.redirectUri,
        grant_type: 'authorization_code',
      }),
    refresh: (refresh_token) => token({ refresh_token, grant_type: 'refresh_token' }),
    async revoke(access) {
      await request('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        body: new URLSearchParams({ token: access }),
        signal: AbortSignal.timeout(10000),
      });
    },
    async account(access) {
      const channel = channelSchema.parse(
        await get('channels', access, { part: 'snippet', mine: 'true' }),
      ).items[0];
      if (!channel) throw new YoutubeRequestError('permission');
      return { id: channel.id, title: channel.snippet.title };
    },
    async broadcasts(access) {
      // broadcastStatus and mine are mutually exclusive filters. OAuth scopes the active list.
      return broadcastsSchema
        .parse(
          await get('liveBroadcasts', access, {
            part: 'snippet',
            broadcastStatus: 'active',
            broadcastType: 'all',
            maxResults: '50',
          }),
        )
        .items.flatMap((item) =>
          item.snippet.liveChatId
            ? [{ id: item.id, title: item.snippet.title, chatId: item.snippet.liveChatId }]
            : [],
        );
    },
    async messages(access, liveChatId, pageToken) {
      return youtubePageSchema.parse(
        await get('liveChat/messages', access, {
          part: 'snippet,authorDetails',
          liveChatId,
          maxResults: '200',
          ...(pageToken ? { pageToken } : {}),
        }),
      );
    },
  };
}
