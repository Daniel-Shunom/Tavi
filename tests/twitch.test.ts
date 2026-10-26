import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwitchIntegration } from '../server/twitch/integration';
import {
  TwitchRequestError,
  createTwitchGateway,
  type TwitchGateway,
  type ListenerInput,
  type PollResult,
  type Token,
} from '../server/twitch/gateway';
import { TWITCH_CLIENT_ID, twitchStatusSchema } from '../shared/twitch';
import { createApp } from '../server/app';
import { stateSchema } from '../shared/protocol';
const token: Token = {
  access_token: 'test-access-private',
  refresh_token: 'test-refresh-private',
  expires_in: 7200,
  scope: ['user:read:chat'],
};
function fixture() {
  const listener: { input: ListenerInput | undefined } = { input: undefined };
  const stop = vi.fn();
  const gateway = {
    device: vi.fn<TwitchGateway['device']>().mockResolvedValue({
      device_code: 'private-device-code',
      user_code: 'ABCD1234',
      verification_uri: 'https://www.twitch.tv/activate?device-code=ABCD1234',
      expires_in: 120,
      interval: 1,
    }),
    poll: vi.fn<TwitchGateway['poll']>().mockResolvedValue({ kind: 'token', token }),
    validate: vi.fn<TwitchGateway['validate']>().mockResolvedValue({
      client_id: TWITCH_CLIENT_ID,
      user_id: '42',
      login: 'streamer',
      scopes: ['user:read:chat'],
      expires_in: 7200,
    }),
    refresh: vi
      .fn<TwitchGateway['refresh']>()
      .mockResolvedValue({ ...token, access_token: 'new-private-access' }),
    revoke: vi.fn<TwitchGateway['revoke']>().mockResolvedValue(undefined),
    listen: vi.fn<TwitchGateway['listen']>().mockImplementation((input) => {
      listener.input = input;
      input.onStatus('connected');
      return stop;
    }),
  } satisfies TwitchGateway;
  return { gateway, listener, stop };
}
function timers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
}
afterEach(() => {
  vi.useRealTimers();
});
describe('Twitch integration public boundary', () => {
  it('authorizes, receives live chat, respects quiet mode, and never exposes tokens', async () => {
    timers();
    const { gateway, listener } = fixture();
    const app = await createApp(undefined, undefined, { gateway });
    const headers = { origin: 'http://127.0.0.1:5173', 'x-tavi-request': 'studio' };
    try {
      expect((await app.inject({ method: 'POST', url: '/api/twitch/connect' })).statusCode).toBe(
        403,
      );
      const connect = await app.inject({ method: 'POST', url: '/api/twitch/connect', headers });
      expect(twitchStatusSchema.parse(connect.json()).phase).toBe('authorizing');
      await vi.advanceTimersByTimeAsync(1000);
      const status = await app.inject('/api/twitch');
      expect(twitchStatusSchema.parse(status.json()).phase).toBe('connected');
      const message = {
        id: 'm1',
        userId: 'viewer',
        author: 'Pixel',
        text: 'Hi Tavi!',
        receivedAt: Date.now(),
      };
      listener.input?.onChange({ type: 'message', message });
      // The decision pipeline is asynchronous even for rules.
      await vi.advanceTimersByTimeAsync(10);
      const state = stateSchema.parse((await app.inject('/api/state')).json());
      expect(state.performance.script?.source).toBe('chat');
      expect(state.performance.script?.sourceEventId).toBe('m1');
      expect(state.performance.script?.decidedBy.label).toBe('Rules (not AI)');
      expect(state.performance.script?.beats[0]?.target).toBe('chat');
      listener.input?.onChange({ type: 'message', message });
      expect(
        twitchStatusSchema.parse((await app.inject('/api/twitch')).json()).messages,
      ).toHaveLength(1);
      listener.input?.onChange({ type: 'delete', id: 'm1' });
      expect(
        twitchStatusSchema.parse((await app.inject('/api/twitch')).json()).messages,
      ).toHaveLength(0);
      for (const url of ['/api/twitch', '/api/state', '/api/health']) {
        const body = (await app.inject(url)).body;
        expect(body).not.toContain(token.access_token);
        expect(body).not.toContain(token.refresh_token);
        expect(body).not.toContain('private-device-code');
      }
      await app.inject({ method: 'POST', url: '/api/twitch/disconnect', headers });
      expect(gateway.revoke).toHaveBeenCalledWith(TWITCH_CLIENT_ID, token.access_token);
      expect(twitchStatusSchema.parse((await app.inject('/api/twitch')).json()).phase).toBe(
        'disconnected',
      );
    } finally {
      await app.close();
    }
  });
  it('cancels pending authorization and ignores delayed responses', async () => {
    timers();
    const { gateway } = fixture();
    let resolveDevice: ((value: Awaited<ReturnType<TwitchGateway['device']>>) => void) | undefined;
    gateway.device.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDevice = resolve;
        }),
    );
    const integration = new TwitchIntegration({ gateway });
    const pending = integration.connect();
    await integration.disconnect();
    resolveDevice?.({
      device_code: 'private',
      user_code: 'CODE',
      verification_uri: 'https://www.twitch.tv/activate',
      expires_in: 120,
      interval: 1,
    });
    await pending;
    await vi.advanceTimersByTimeAsync(5000);
    expect(integration.snapshot().phase).toBe('disconnected');
    expect(gateway.poll).not.toHaveBeenCalled();
    integration.close();
  });
  it('expires pending codes and reports declined authorization', async () => {
    timers();
    const { gateway } = fixture();
    gateway.device.mockResolvedValue({
      device_code: 'private',
      user_code: 'CODE',
      verification_uri: 'https://www.twitch.tv/activate',
      expires_in: 2,
      interval: 1,
    });
    gateway.poll.mockResolvedValue({ kind: 'pending' });
    const integration = new TwitchIntegration({ gateway });
    await integration.connect();
    await vi.advanceTimersByTimeAsync(2000);
    expect(integration.snapshot().error).toContain('expired');
    gateway.poll.mockRejectedValue(new TwitchRequestError('denied'));
    await integration.connect();
    await vi.advanceTimersByTimeAsync(1000);
    expect(integration.snapshot().error).toContain('declined');
    integration.close();
  });
  it('refreshes an expiring token and disconnects revoked authorizations', async () => {
    timers();
    const { gateway } = fixture();
    gateway.poll.mockResolvedValue({ kind: 'token', token: { ...token, expires_in: 130 } });
    gateway.validate.mockResolvedValue({
      client_id: TWITCH_CLIENT_ID,
      user_id: '42',
      login: 'streamer',
      scopes: ['user:read:chat'],
      expires_in: 130,
    });
    const integration = new TwitchIntegration({ gateway });
    await integration.connect();
    await vi.advanceTimersByTimeAsync(11000);
    expect(gateway.refresh).toHaveBeenCalledWith(TWITCH_CLIENT_ID, token.refresh_token);
    gateway.validate.mockRejectedValue(new TwitchRequestError('invalid_token'));
    await vi.advanceTimersByTimeAsync(10000);
    expect(integration.snapshot().phase).toBe('error');
    integration.close();
  });
  it('honors Twitch slow-down responses rather than over-polling', async () => {
    timers();
    const { gateway } = fixture();
    gateway.poll
      .mockResolvedValueOnce({ kind: 'slow_down' })
      .mockResolvedValue({ kind: 'pending' });
    const integration = new TwitchIntegration({ gateway });
    await integration.connect();
    await vi.advanceTimersByTimeAsync(1000);
    expect(gateway.poll).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5999);
    expect(gateway.poll).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(gateway.poll).toHaveBeenCalledTimes(2);
    integration.close();
  });
});
describe('Twitch HTTP protocol adapter', () => {
  it('requests only read-chat access and maps pending authorization without a secret', async () => {
    const request = vi.fn<typeof fetch>();
    request
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_code: 'device',
            user_code: 'ABCD',
            verification_uri: 'https://www.twitch.tv/activate',
            interval: 5,
            expires_in: 120,
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'authorization_pending' }), { status: 400 }),
      );
    const gateway = createTwitchGateway(request);
    await gateway.device(TWITCH_CLIENT_ID);
    const result: PollResult = await gateway.poll(TWITCH_CLIENT_ID, 'device');
    expect(result.kind).toBe('pending');
    const options = request.mock.calls[0]?.[1];
    expect(options?.body).toBeInstanceOf(URLSearchParams);
    const body = options?.body instanceof URLSearchParams ? options.body.toString() : '';
    expect(body).toContain('scopes=user%3Aread%3Achat');
    expect(body).not.toContain('client_secret');
  });
});
