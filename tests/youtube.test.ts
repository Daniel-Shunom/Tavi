import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { YoutubeIntegration } from '../server/youtube/integration';
import {
  createYoutubeGateway,
  YoutubeRequestError,
  type YoutubeGateway,
  type YoutubePage,
} from '../server/youtube/gateway';
import { createApp } from '../server/app';
import { runtimeOf } from '../server/app';
import { youtubeStatusSchema, YOUTUBE_SCOPE } from '../shared/youtube';

const credentials = {
  clientId: 'test.apps.googleusercontent.com',
  clientSecret: 'client-private',
  redirectUri: 'http://127.0.0.1:4318/api/youtube/callback',
};
const token = {
  access_token: 'access-private',
  refresh_token: 'refresh-private',
  expires_in: 3600,
  scope: YOUTUBE_SCOPE,
};
const broadcast = { id: 'stream', title: 'Live stream', chatId: 'live-chat' };
function page(ids: string[] = [], interval = 1000): YoutubePage {
  return {
    nextPageToken: 'next-page',
    pollingIntervalMillis: interval,
    items: ids.map((id) => ({
      id,
      snippet: {
        type: 'textMessageEvent',
        publishedAt: new Date().toISOString(),
        displayMessage: 'Hi Tavi!',
      },
      authorDetails: { channelId: 'viewer', displayName: 'Pixel' },
    })),
  };
}
function fixture() {
  const gateway = {
    exchange: vi.fn<YoutubeGateway['exchange']>().mockResolvedValue(token),
    refresh: vi
      .fn<YoutubeGateway['refresh']>()
      .mockResolvedValue({ ...token, access_token: 'refreshed-private' }),
    revoke: vi.fn<YoutubeGateway['revoke']>().mockResolvedValue(undefined),
    account: vi
      .fn<YoutubeGateway['account']>()
      .mockResolvedValue({ id: 'channel', title: 'My channel' }),
    broadcasts: vi.fn<YoutubeGateway['broadcasts']>().mockResolvedValue([broadcast]),
    messages: vi.fn<YoutubeGateway['messages']>().mockResolvedValue(page()),
  } satisfies YoutubeGateway;
  return { gateway };
}
function clock() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-21T12:00:00Z'));
}
function authorization(integration: YoutubeIntegration) {
  const auth = integration.connect().authorization;
  if (!auth) throw new Error('Missing authorization');
  const url = new URL(auth.url);
  const state = url.searchParams.get('state');
  if (!state) throw new Error('Missing state');
  return { url, state };
}
afterEach(() => {
  vi.useRealTimers();
});

describe('YouTube authorization and lifecycle', () => {
  it('uses read-only PKCE authorization, single-use state and never exposes secrets', async () => {
    clock();
    const { gateway } = fixture();
    const integration = new YoutubeIntegration({ credentials, gateway });
    try {
      const { url, state } = authorization(integration);
      expect(url.origin).toBe('https://accounts.google.com');
      expect(url.searchParams.get('scope')).toBe(YOUTUBE_SCOPE);
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('redirect_uri')).toBe(credentials.redirectUri);
      expect(await integration.authorize('bad-state', 'code', false)).toBe(false);
      expect(await integration.authorize('é'.repeat(state.length), 'code', false)).toBe(false);
      expect(gateway.exchange).not.toHaveBeenCalled();
      expect(await integration.authorize(state, 'code', false)).toBe(true);
      await vi.advanceTimersByTimeAsync(0);
      const verifier = gateway.exchange.mock.calls[0]?.[1];
      expect(verifier).toHaveLength(64);
      expect(
        createHash('sha256')
          .update(verifier ?? '')
          .digest('base64url'),
      ).toBe(url.searchParams.get('code_challenge'));
      expect(await integration.authorize(state, 'code', false)).toBe(false);
      expect(youtubeStatusSchema.parse(integration.snapshot()).phase).toBe('connected');
      const serialized = JSON.stringify(integration.snapshot());
      for (const secret of [
        token.access_token,
        token.refresh_token,
        credentials.clientSecret,
        verifier,
      ])
        if (secret) expect(serialized).not.toContain(secret);
      await integration.disconnect();
      expect(gateway.revoke).toHaveBeenCalledWith(token.refresh_token);
      expect(integration.snapshot().phase).toBe('disconnected');
    } finally {
      integration.close();
    }
  });
  it('handles denial, expiration and missing configuration without API calls', async () => {
    clock();
    const unconfigured = new YoutubeIntegration().connect();
    expect(unconfigured).toMatchObject({
      configured: false,
      phase: 'disconnected',
    });
    expect(unconfigured.error).toContain('version of Tavi');
    const { gateway } = fixture();
    const integration = new YoutubeIntegration({ credentials, gateway });
    try {
      const { state } = authorization(integration);
      expect(await integration.authorize(state, undefined, true)).toBe(true);
      expect(integration.snapshot().phase).toBe('error');
      const next = authorization(integration);
      await vi.advanceTimersByTimeAsync(600001);
      expect(integration.snapshot().authorization).toBeNull();
      expect(await integration.authorize(next.state, 'code', false)).toBe(false);
      expect(gateway.exchange).not.toHaveBeenCalled();
    } finally {
      integration.close();
    }
  });
  it('cannot resurrect a connection canceled during token exchange', async () => {
    const { gateway } = fixture();
    let finish: ((value: typeof token) => void) | undefined;
    gateway.exchange.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const integration = new YoutubeIntegration({ credentials, gateway });
    const { state } = authorization(integration);
    const pending = integration.authorize(state, 'code', false);
    await integration.disconnect();
    finish?.(token);
    await pending;
    expect(integration.snapshot().phase).toBe('disconnected');
    expect(gateway.account).not.toHaveBeenCalled();
    expect(gateway.revoke).toHaveBeenCalledWith(token.refresh_token);
    integration.close();
  });
  it('waits offline, lets the streamer choose concurrent broadcasts, and stops checking on close', async () => {
    clock();
    const { gateway } = fixture();
    gateway.broadcasts
      .mockResolvedValueOnce([])
      .mockResolvedValue([broadcast, { id: 'second', title: 'Second stream', chatId: 'chat-two' }]);
    const integration = new YoutubeIntegration({ credentials, gateway });
    const { state } = authorization(integration);
    await integration.authorize(state, 'code', false);
    expect(integration.snapshot().phase).toBe('waiting');
    await vi.advanceTimersByTimeAsync(60000);
    expect(integration.snapshot().broadcasts).toHaveLength(2);
    expect(gateway.messages).not.toHaveBeenCalled();
    expect(integration.select('unknown')).toBe(false);
    expect(integration.select('second')).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(gateway.messages).toHaveBeenCalledWith(token.access_token, 'chat-two', undefined);
    integration.close();
    await vi.advanceTimersByTimeAsync(120000);
    expect(gateway.messages).toHaveBeenCalledTimes(1);
  });
});

describe('YouTube live chat', () => {
  it('retries account lookup without exchanging the code again', async () => {
    clock();
    const { gateway } = fixture();
    gateway.account.mockRejectedValueOnce(new YoutubeRequestError('unavailable'));
    const integration = new YoutubeIntegration({ credentials, gateway });
    try {
      await integration.authorize(authorization(integration).state, 'code', false);
      expect(integration.snapshot().phase).toBe('reconnecting');
      await vi.advanceTimersByTimeAsync(4000);
      expect(integration.snapshot().phase).toBe('connected');
      expect(gateway.exchange).toHaveBeenCalledTimes(1);
      expect(gateway.account).toHaveBeenCalledTimes(2);
    } finally {
      integration.close();
    }
  });
  it.each(['result', 'error'] as const)(
    'ignores a discovery %s that arrives after a selection',
    async (outcome) => {
      clock();
      const { gateway } = fixture();
      const second = { id: 'second', title: 'Second', chatId: 'second-chat' };
      gateway.broadcasts.mockResolvedValue([broadcast, second]);
      const integration = new YoutubeIntegration({ credentials, gateway });
      let finish: ((value: (typeof broadcast)[]) => void) | undefined;
      let fail: ((error: Error) => void) | undefined;
      try {
        await integration.authorize(authorization(integration).state, 'code', false);
        gateway.broadcasts.mockImplementationOnce(
          () =>
            new Promise((resolve, reject) => {
              finish = resolve;
              fail = reject;
            }),
        );
        await vi.advanceTimersByTimeAsync(60000);
        expect(integration.select(broadcast.id)).toBe(true);
        await vi.advanceTimersByTimeAsync(0);
        if (outcome === 'result') finish?.([second]);
        else fail?.(new YoutubeRequestError('permission'));
        await vi.advanceTimersByTimeAsync(0);
        expect(integration.snapshot()).toMatchObject({
          phase: 'connected',
          broadcastId: broadcast.id,
        });
        await vi.advanceTimersByTimeAsync(10000);
        expect(gateway.messages).toHaveBeenCalledTimes(2);
        expect(gateway.messages.mock.calls.map((call) => call[1])).toEqual([
          'live-chat',
          'live-chat',
        ]);
      } finally {
        integration.close();
      }
    },
  );
  it('removes an ended broadcast while keeping another choice available', async () => {
    clock();
    const { gateway } = fixture();
    gateway.broadcasts.mockResolvedValue([
      broadcast,
      { id: 'second', title: 'Second', chatId: 'second-chat' },
    ]);
    gateway.messages.mockRejectedValueOnce(new YoutubeRequestError('ended'));
    const integration = new YoutubeIntegration({ credentials, gateway });
    try {
      await integration.authorize(authorization(integration).state, 'code', false);
      integration.select(broadcast.id);
      await vi.advanceTimersByTimeAsync(0);
      expect(integration.snapshot().broadcasts.map((item) => item.id)).toEqual(['second']);
      expect(integration.select(broadcast.id)).toBe(false);
      expect(integration.select('second')).toBe(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(integration.snapshot().broadcastId).toBe('second');
    } finally {
      integration.close();
    }
  });
  it('skips history, deduplicates, uses continuation tokens, honors intervals and moderates', async () => {
    clock();
    const { gateway } = fixture();
    const fresh = page(['history', 'fresh', 'banned', 'keep']);
    for (const item of fresh.items) {
      if (item.id === 'banned')
        item.authorDetails = { channelId: 'banned-viewer', displayName: 'Banned viewer' };
      if (item.id === 'keep')
        item.authorDetails = { channelId: 'other-viewer', displayName: 'Other viewer' };
    }
    gateway.messages
      .mockResolvedValueOnce(page(['history'], 15000))
      .mockResolvedValueOnce(fresh)
      .mockResolvedValueOnce({
        ...page(),
        items: [
          {
            id: 'delete',
            snippet: {
              type: 'messageDeletedEvent',
              publishedAt: new Date().toISOString(),
              messageDeletedDetails: { deletedMessageId: 'fresh' },
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        ...page(),
        items: [
          {
            id: 'ban',
            snippet: {
              type: 'userBannedEvent',
              publishedAt: new Date().toISOString(),
              userBannedDetails: { bannedUserDetails: { channelId: 'banned-viewer' } },
            },
          },
        ],
      });
    const onMessage = vi.fn();
    const onModeration = vi.fn();
    const integration = new YoutubeIntegration({ credentials, gateway, onMessage, onModeration });
    try {
      await integration.authorize(authorization(integration).state, 'code', false);
      await vi.advanceTimersByTimeAsync(14999);
      expect(onMessage).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(onMessage).toHaveBeenCalledTimes(3);
      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'youtube:fresh', userId: 'youtube:viewer' }),
      );
      expect(gateway.messages).toHaveBeenLastCalledWith(
        token.access_token,
        'live-chat',
        'next-page',
      );
      await vi.advanceTimersByTimeAsync(10000);
      expect(integration.snapshot().messages.map((message) => message.id)).toEqual([
        'youtube:banned',
        'youtube:keep',
      ]);
      await vi.advanceTimersByTimeAsync(10000);
      expect(integration.snapshot().messages.map((message) => message.id)).toEqual([
        'youtube:keep',
      ]);
      expect(onModeration.mock.calls).toEqual([
        [{ type: 'delete', id: 'youtube:fresh' }],
        [{ type: 'clearUser', userId: 'youtube:banned-viewer' }],
      ]);
    } finally {
      integration.close();
    }
  });
  it('refreshes expiring tokens, retries network failures and stops on quota exhaustion', async () => {
    clock();
    const { gateway } = fixture();
    gateway.exchange.mockResolvedValue({ ...token, expires_in: 61 });
    const integration = new YoutubeIntegration({ credentials, gateway });
    try {
      await integration.authorize(authorization(integration).state, 'code', false);
      await vi.advanceTimersByTimeAsync(10000);
      expect(gateway.refresh).toHaveBeenCalledWith(token.refresh_token);
      gateway.messages.mockRejectedValueOnce(new YoutubeRequestError('unavailable'));
      await vi.advanceTimersByTimeAsync(10000);
      expect(integration.snapshot().phase).toBe('reconnecting');
      await vi.advanceTimersByTimeAsync(4000);
      expect(integration.snapshot().phase).toBe('connected');
      gateway.messages.mockRejectedValue(new YoutubeRequestError('quota'));
      await vi.advanceTimersByTimeAsync(10000);
      expect(integration.snapshot().phase).toBe('error');
      expect(integration.snapshot().error).toContain('quota');
      const calls = gateway.messages.mock.calls.length;
      await vi.advanceTimersByTimeAsync(120000);
      expect(gateway.messages).toHaveBeenCalledTimes(calls);
    } finally {
      integration.close();
    }
  });
  it('returns to discovery when the broadcast ends', async () => {
    clock();
    const { gateway } = fixture();
    gateway.messages.mockResolvedValue({ ...page(), offlineAt: new Date().toISOString() });
    const integration = new YoutubeIntegration({ credentials, gateway });
    try {
      await integration.authorize(authorization(integration).state, 'code', false);
      await vi.advanceTimersByTimeAsync(0);
      expect(integration.snapshot()).toMatchObject({ phase: 'waiting', broadcastId: null });
      gateway.broadcasts.mockResolvedValue([]);
      await vi.advanceTimersByTimeAsync(60000);
      expect(gateway.broadcasts).toHaveBeenCalledTimes(2);
    } finally {
      integration.close();
    }
  });
});

describe('YouTube service boundary', () => {
  it('guards mutations and OAuth state, feeds real chat inputs into behaviour, and keeps secrets private', async () => {
    clock();
    const { gateway } = fixture();
    gateway.messages.mockResolvedValueOnce(page(['old'])).mockResolvedValueOnce(page(['new']));
    const app = await createApp(undefined, undefined, {}, [], {
      youtube: { credentials, gateway },
    });
    const headers = { origin: 'http://127.0.0.1:5173', 'x-tavi-request': 'studio' };
    try {
      expect((await app.inject({ method: 'POST', url: '/api/youtube/connect' })).statusCode).toBe(
        403,
      );
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/youtube/connect',
            headers: { ...headers, origin: 'https://evil.example' },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (await app.inject('/api/youtube/callback?state=invalid&code=private-code')).statusCode,
      ).toBe(400);
      const status = youtubeStatusSchema.parse(
        (await app.inject({ method: 'POST', url: '/api/youtube/connect', headers })).json(),
      );
      const state = new URL(status.authorization?.url ?? '').searchParams.get('state') ?? '';
      const callback =
        '/api/youtube/callback?' + new URLSearchParams({ state, code: 'private-code' }).toString();
      const response = await app.inject(callback);
      expect(response.statusCode).toBe(200);
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.body).not.toContain('private-code');
      await vi.advanceTimersByTimeAsync(10010);
      expect(runtimeOf(app).companion.state.performance.script?.sourceEventId).toBe('youtube:new');
      await runtimeOf(app).command({ type: 'quiet', value: true });
      gateway.messages.mockResolvedValue(page(['quiet-message']));
      await vi.advanceTimersByTimeAsync(100000);
      expect(runtimeOf(app).companion.state.performance.script?.sourceEventId).not.toBe(
        'youtube:quiet-message',
      );
      for (const url of ['/api/youtube', '/api/state', '/api/health']) {
        const body = (await app.inject(url)).body;
        for (const secret of [
          token.access_token,
          token.refresh_token,
          credentials.clientSecret,
          'private-code',
        ])
          expect(body).not.toContain(secret);
      }
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/youtube/select',
            headers,
            payload: { id: 'unowned' },
          })
        ).statusCode,
      ).toBe(400);
    } finally {
      await app.close();
    }
  });
});

describe('YouTube HTTP adapter', () => {
  it.each([403, 429])(
    'retries temporary rate limits (%i) at the last polling interval',
    async (status) => {
      clock();
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json(page([], 20000)))
        .mockResolvedValueOnce(
          Response.json({ error: { errors: [{ reason: 'rateLimitExceeded' }] } }, { status }),
        )
        .mockResolvedValue(Response.json(page()));
      const { gateway } = fixture();
      const http = createYoutubeGateway(credentials, request);
      gateway.messages.mockImplementation((...args) => http.messages(...args));
      const integration = new YoutubeIntegration({ credentials, gateway });
      try {
        await integration.authorize(authorization(integration).state, 'code', false);
        await vi.advanceTimersByTimeAsync(20000);
        expect(integration.snapshot().phase).toBe('reconnecting');
        await vi.advanceTimersByTimeAsync(19999);
        expect(request).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(integration.snapshot().phase).toBe('connected');
        expect(request).toHaveBeenCalledTimes(3);
      } finally {
        integration.close();
      }
    },
  );
  it('classifies a body-read transport error for retry, but preserves malformed JSON errors', async () => {
    const response = Response.json(page());
    vi.spyOn(response, 'json').mockRejectedValue(new TypeError('terminated'));
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response)
      .mockResolvedValueOnce(new Response('malformed JSON', { status: 200 }));
    const gateway = createYoutubeGateway(credentials, request);
    await expect(gateway.messages('access', 'chat', undefined)).rejects.toMatchObject({
      kind: 'unavailable',
    });
    await expect(gateway.messages('access', 'chat', undefined)).rejects.toBeInstanceOf(SyntaxError);
  });
  it('sends credentials only to Google, correct mutually exclusive broadcast filters and bearer headers', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(token))
      .mockResolvedValueOnce(
        Response.json({ items: [{ id: 'channel', snippet: { title: 'Channel' } }] }),
      )
      .mockResolvedValueOnce(
        Response.json({
          items: [{ id: 'b', snippet: { title: 'Broadcast', liveChatId: 'chat' } }],
        }),
      )
      .mockResolvedValueOnce(Response.json(page()));
    const gateway = createYoutubeGateway(credentials, request);
    await gateway.exchange('code', 'verifier');
    expect(request.mock.calls[0]?.[0]).toBe('https://oauth2.googleapis.com/token');
    const body = request.mock.calls[0]?.[1]?.body;
    expect(body instanceof URLSearchParams ? body.get('code_verifier') : null).toBe('verifier');
    expect(await gateway.account(token.access_token)).toEqual({ id: 'channel', title: 'Channel' });
    expect(await gateway.broadcasts(token.access_token)).toEqual([
      { id: 'b', title: 'Broadcast', chatId: 'chat' },
    ]);
    const target = request.mock.calls[2]?.[0];
    if (typeof target !== 'string') throw new Error('Expected URL string');
    const url = new URL(target);
    expect(url.searchParams.get('broadcastStatus')).toBe('active');
    expect(url.searchParams.has('mine')).toBe(false);
    await gateway.messages(token.access_token, 'chat', 'next');
    expect(request.mock.calls[3]?.[1]?.headers).toEqual({
      Authorization: 'Bearer ' + token.access_token,
    });
    expect(request.mock.calls[3]?.[0]).not.toContain(token.access_token);
  });
  it('classifies quota failures without leaking raw API errors', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { error: { errors: [{ reason: 'quotaExceeded' }], message: 'secret raw detail' } },
          { status: 403 },
        ),
      );
    await expect(
      createYoutubeGateway(credentials, request).broadcasts('access'),
    ).rejects.toMatchObject({ kind: 'quota', message: 'quota' });
  });
});
