import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTConnection } from '../server/ai/chatgpt';
import type { ChatGPTStore } from '../server/ai/chatgpt-store';
import { AiManager, settingsFromEnv } from '../server/ai/manager';
import { createApp } from '../server/app';
import type { DecisionContext } from '../server/ai/types';
import { catalog } from '../src/renderer/characters/registry';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing test fixture');
  return value;
}
function urlOf(input: RequestInfo | URL) {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}
const connections: ChatGPTConnection[] = [];
afterEach(() => {
  for (const connection of connections.splice(0)) connection.close();
  vi.restoreAllMocks();
});
const models = {
  models: [
    { slug: 'account-model', display_name: 'Account model', visibility: 'list' },
    { slug: 'hidden', display_name: 'Hidden', visibility: 'hidden' },
  ],
};
const token = {
  access_token: 'private-access',
  refresh_token: 'private-refresh',
  id_token: 'private-id',
  expires_in: 3600,
  scope: 'openid chatgpt.tokens.use.direct',
  token_type: 'Bearer',
};
const saved = {
  ...token,
  clientId: 'oaiapp_test',
  subject: 'user1',
  email: 'streamer@example.test',
  expiresAt: Date.now() + 3600000,
  model: 'account-model',
};
const decision = {
  react: true,
  reason: 'A win',
  sequence: 'big-win',
  caption: 'Nice!',
  target: 'streamer',
  beats: [],
  move: null,
};
const context: DecisionContext = {
  persona: {
    name: 'Tavi',
    attitude: 'cheeky',
    initiative: 'occasional',
    personality: 'cozy',
    energy: 40,
    chatEngagement: 20,
  },
  character: required(catalog['mascot']),
  recent: [],
  trigger: { id: 'c1', source: 'chat', author: 'Viewer', text: 'We won!', at: 0, simulated: false },
  canMove: false,
};
const sse = (terminal = 'response.completed') =>
  new Response(
    `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: JSON.stringify(decision) })}\n\ndata: ${JSON.stringify({ type: terminal })}\n\n`,
    { headers: { 'content-type': 'text/event-stream' } },
  );
function fixture(initial: string | null = null) {
  let contents = initial;
  let nonce = '';
  const store: ChatGPTStore = {
    load: vi.fn(() => Promise.resolve(contents)),
    save: vi.fn((value: string) => {
      contents = value;
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      contents = null;
      return Promise.resolve();
    }),
    host: () => Promise.resolve('urn:uuid:12345678-1234-4234-8234-123456789abc'),
  };
  const request = vi.fn<typeof fetch>((url) => {
    const path = urlOf(url);
    if (path.endsWith('/models')) return Promise.resolve(Response.json(models));
    if (path.endsWith('/responses')) return Promise.resolve(sse());
    if (path.endsWith('/revoke')) return Promise.resolve(new Response(null, { status: 200 }));
    return Promise.resolve(Response.json(token));
  });
  const verify = vi.fn(() =>
    Promise.resolve({ sub: 'user1', email: 'streamer@example.test', nonce }),
  );
  const connected = vi.fn(() => Promise.resolve());
  const connection = new ChatGPTConnection({ store, request, verify, onConnected: connected });
  connections.push(connection);
  async function start() {
    const url = new URL((await connection.connect()).authorizationUrl);
    nonce = required(url.searchParams.get('nonce'));
    return url;
  }
  async function callback(url: URL, params: Record<string, string> = {}) {
    const target = new URL(required(url.searchParams.get('redirect_uri')));
    target.search = new URLSearchParams({
      state: required(url.searchParams.get('state')),
      code: 'one-use-code',
      client_id: 'oaiapp_test',
      ...params,
    }).toString();
    return fetch(target);
  }
  return {
    connection,
    store,
    request,
    verify,
    connected,
    start,
    callback,
    contents: () => contents,
  };
}
it('allows up to 15 seconds for a ChatGPT decision before falling back to rules', () => {
  expect(settingsFromEnv({}).timeoutMs).toBe(15_000);
});

describe('ChatGPT public-client sign-in', () => {
  it('uses PKCE and issued registration, saves privately, and exposes only account models', async () => {
    const f = fixture();
    const url = await f.start();
    expect(url.origin).toBe('https://auth.openai.com');
    expect(url.searchParams.get('client_id')).toBe('dynamic_agent_client');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toContain('chatgpt.tokens.use.direct');
    expect((await f.callback(url)).status).toBe(200);
    expect(f.verify).toHaveBeenCalledWith('private-id', 'oaiapp_test');
    const exchange = required(f.request.mock.calls.find(([url]) => urlOf(url).endsWith('/token')));
    const body = exchange[1]?.body as URLSearchParams;
    expect(body.get('client_id')).toBe('oaiapp_test');
    expect(body.get('client_secret')).toBeNull();
    expect(body.get('redirect_uri')).toBe(url.searchParams.get('redirect_uri'));
    expect(body.get('code_verifier')?.length).toBeGreaterThanOrEqual(43);
    expect(f.connection.status()).toMatchObject({
      phase: 'connected',
      models: [{ id: 'account-model', name: 'Account model' }],
    });
    expect(JSON.stringify(f.connection.status())).not.toContain('private-');
    expect(f.connected).toHaveBeenCalledOnce();
    expect(f.contents()).toContain('oaiapp_test');
    const again = await f.start();
    expect(again.searchParams.get('client_id')).toBe('oaiapp_test');
    expect(again.searchParams.get('id_token_hint')).toBe('private-id');
    expect(again.searchParams.has('agent_name_hint')).toBe(false);
  });
  it('rejects invalid state without consuming the legitimate attempt', async () => {
    const f = fixture();
    const url = await f.start();
    expect((await f.callback(url, { state: '界'.repeat(43) })).status).toBe(400);
    expect(f.request).not.toHaveBeenCalled();
    expect((await f.callback(url)).status).toBe(200);
  });
  it.each(['access_denied', 'missing-client', 'wrong-nonce', 'no-plan-scope', 'bad-signature'])(
    'rejects %s without saving credentials',
    async (reason) => {
      const f = fixture();
      const url = await f.start();
      if (reason === 'wrong-nonce')
        f.verify.mockResolvedValueOnce({ sub: 'user1', email: '', nonce: 'wrong' });
      if (reason === 'bad-signature')
        f.verify.mockRejectedValueOnce(new Error('secret-provider-payload'));
      if (reason === 'no-plan-scope')
        f.request.mockResolvedValueOnce(Response.json({ ...token, scope: 'openid' }));
      const params =
        reason === 'access_denied'
          ? { error: 'access_denied' }
          : reason === 'missing-client'
            ? { client_id: '' }
            : {};
      const result = await f.callback(url, params);
      expect(result.status).toBe(400);
      const message = await result.text();
      const expected = {
        access_denied: 'not approved',
        'missing-client': 'complete account registration',
        'wrong-nonce': 'account identity',
        'no-plan-scope': 'plan access was not granted',
        'bad-signature': 'account identity',
      };
      expect(message).toContain(expected[reason as keyof typeof expected]);
      expect(message).not.toContain('secret-provider-payload');
      expect(f.store.save).not.toHaveBeenCalled();
      expect(f.connection.configured).toBe(false);
      expect(JSON.stringify(f.connection.status())).not.toContain('secret-provider-payload');
    },
  );
  it('restores the account and rejects a returning identity change', async () => {
    const f = fixture(JSON.stringify(saved));
    await f.connection.initialize();
    const url = await f.start();
    f.verify.mockResolvedValueOnce({
      sub: 'other',
      nonce: required(url.searchParams.get('nonce')),
      email: 'other',
    });
    expect((await f.callback(url)).status).toBe(400);
    expect(f.connection.status().email).toBe(saved.email);
    expect(f.connection.configured).toBe(true);
  });
  it('uses a completed Responses stream and account model, without storage or API keys', async () => {
    const f = fixture(JSON.stringify(saved));
    await f.connection.initialize();
    expect(await f.connection.decide(context, new AbortController().signal)).toMatchObject({
      react: true,
    });
    const call = required(f.request.mock.calls.find(([url]) => urlOf(url).endsWith('/responses')));
    expect(JSON.parse(call[1]?.body as string)).toMatchObject({
      model: 'account-model',
      store: false,
      stream: true,
    });
    expect(call[1]?.headers).toMatchObject({ authorization: 'Bearer private-access' });
  });
  it.each(['response.failed', 'response.incomplete', 'error', 'stream-ended'])(
    'never accepts partial output after %s',
    async (terminal) => {
      const f = fixture(JSON.stringify(saved));
      await f.connection.initialize();
      f.request.mockResolvedValueOnce(sse(terminal));
      await expect(f.connection.decide(context, new AbortController().signal)).rejects.toThrow();
    },
  );
  it('rotates refresh credentials once for concurrent requests', async () => {
    const f = fixture(JSON.stringify(saved));
    await f.connection.initialize();
    expect(f.store.save).not.toHaveBeenCalled();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3600000);
    await Promise.all([
      f.connection.decide(context, new AbortController().signal),
      f.connection.decide(context, new AbortController().signal),
    ]);
    expect(f.request.mock.calls.filter(([url]) => urlOf(url).endsWith('/token'))).toHaveLength(1);
  });
  it('disconnects locally, revokes remotely and falls back to rules', async () => {
    const f = fixture(JSON.stringify(saved));
    await f.connection.initialize();
    const ai = new AiManager(settingsFromEnv({}));
    ai.attachChatGPT(f.connection);
    ai.select({ provider: 'chatgpt' });
    expect(ai.active.kind).toBe('ai');
    await f.connection.disconnect();
    expect(f.contents()).toBeNull();
    expect(f.connection.status().email).toBeNull();
    expect(f.request.mock.calls.some(([url]) => urlOf(url).endsWith('/revoke'))).toBe(true);
    expect(ai.active.kind).toBe('rules');
    expect((await ai.decide(context, new AbortController().signal)).by.kind).toBe('rules');
  });
  it('keeps the issued registration after refresh fails, for reauthorization', async () => {
    const f = fixture(JSON.stringify(saved));
    await f.connection.initialize();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3600000);
    f.request.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(f.connection.decide(context, new AbortController().signal)).rejects.toThrow();
    expect(f.connection.configured).toBe(false);
    const url = await f.start();
    expect(url.searchParams.get('client_id')).toBe('oaiapp_test');
  });
  it('does not restore credentials when disconnect races with callback storage', async () => {
    const f = fixture();
    const url = await f.start();
    let release!: () => void;
    let entered!: () => void;
    const saving = new Promise<void>((resolve) => {
      entered = resolve;
    });
    f.store.save = vi.fn(async () => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const callback = f.callback(url);
    await saving;
    const disconnect = f.connection.disconnect();
    release();
    expect((await callback).status).toBe(400);
    await disconnect;
    expect(f.store.clear).toHaveBeenCalledOnce();
    expect(f.connection.configured).toBe(false);
    expect(f.connection.status().phase).toBe('disconnected');
    expect(f.connected).not.toHaveBeenCalled();
  });
  it('invalidates revoked access without exposing provider errors', async () => {
    const f = fixture(JSON.stringify(saved));
    await f.connection.initialize();
    f.request.mockResolvedValueOnce(new Response('private-provider-error', { status: 401 }));
    await expect(f.connection.decide(context, new AbortController().signal)).rejects.toThrow();
    expect(f.connection.configured).toBe(false);
    expect(f.connection.status().phase).toBe('error');
    expect(JSON.stringify(f.connection.status())).not.toContain('private-provider-error');
  });
  it('protects account mutations with Studio origin/header and validates model selection', async () => {
    const f = fixture();
    const app = await createApp(undefined, undefined, {}, [], { chatgpt: f.connection });
    try {
      for (const headers of [
        {},
        { origin: 'https://evil.example', 'x-tavi-request': 'studio' },
        { origin: 'http://127.0.0.1:5173' },
      ]) {
        expect(
          (await app.inject({ method: 'POST', url: '/api/chatgpt/connect', headers })).statusCode,
        ).toBe(403);
      }
      const headers = { origin: 'http://127.0.0.1:5173', 'x-tavi-request': 'studio' };
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/ai',
            headers,
            payload: { provider: 'chatgpt', model: 'invented' },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (await app.inject({ method: 'POST', url: '/api/chatgpt/connect', headers })).statusCode,
      ).toBe(200);
      const status = await app.inject('/api/chatgpt');
      expect(status.headers['cache-control']).toBe('no-store');
      expect(status.json<{ phase: string }>().phase).toBe('authorizing');
    } finally {
      await app.close();
    }
  });
});
