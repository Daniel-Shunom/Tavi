import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemorySessionStore } from '../server/judging/memory-store';
import { JudgingSessions } from '../server/judging/sessions';
import { JudgingWorker } from '../server/judging/worker';
import { JUDGING_DURATION_MS, JUDGING_EXTENSION_MS } from '../shared/judging';
import type { TwitchOptions } from '../server/twitch/integration';
import type { TwitchGateway, ListenerInput } from '../server/twitch/gateway';
import { TWITCH_CLIENT_ID } from '../shared/twitch';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((close) => close()));
  vi.useRealTimers();
});
async function fixture(twitchOptions: () => TwitchOptions = () => ({})) {
  const store = new MemorySessionStore();
  const worker = new JudgingWorker(store, 'https://tavi.example', twitchOptions);
  await worker.start();
  cleanups.push(async () => {
    await worker.close();
    await store.close();
  });
  const service = new JudgingSessions(store, 'https://tavi.example', 'test-secret-'.repeat(4));
  const created = await service.create();
  const url = new URL(created.studioUrl);
  const access = await service.authenticate(
    url.searchParams.get('judge'),
    url.searchParams.get('key'),
  );
  return { store, service, created, access };
}
describe('temporary judging sessions', () => {
  it('revokes Twitch and stops listeners on reset and unattended expiry without storing credentials', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    let listener: ListenerInput | undefined;
    const stop = vi.fn();
    const revoke = vi.fn<TwitchGateway['revoke']>().mockResolvedValue(undefined);
    const gateway: TwitchGateway = {
      device: () =>
        Promise.resolve({
          device_code: 'private-device',
          user_code: 'TEST123',
          verification_uri: 'https://www.twitch.tv/activate',
          expires_in: 120,
          interval: 1,
        }),
      poll: () =>
        Promise.resolve({
          kind: 'token' as const,
          token: {
            access_token: 'private-access',
            refresh_token: 'private-refresh',
            expires_in: 7200,
            scope: ['user:read:chat'],
          },
        }),
      validate: () =>
        Promise.resolve({
          client_id: TWITCH_CLIENT_ID,
          user_id: '42',
          login: 'judge',
          scopes: ['user:read:chat'],
          expires_in: 7200,
        }),
      refresh: () => Promise.reject(new Error('No refresh expected')),
      revoke,
      listen: (input) => {
        listener = input;
        input.onStatus('connected');
        return stop;
      },
    };
    const { service, access, store } = await fixture(() => ({ gateway }));
    await service.http(access, 'POST', '/api/twitch/connect');
    await vi.advanceTimersByTimeAsync(1000);
    expect((await service.http(access, 'GET', '/api/twitch')).body).toMatchObject({
      phase: 'connected',
    });
    const late = listener;
    await service.reset(access);
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    late?.onChange({
      type: 'message',
      message: { id: 'late', userId: '1', author: 'Old', text: 'hello', receivedAt: Date.now() },
    });
    expect((await service.http(access, 'GET', '/api/twitch')).body).toMatchObject({
      phase: 'disconnected',
      messages: [],
    });
    await service.http(access, 'POST', '/api/twitch/connect');
    await vi.advanceTimersByTimeAsync(1000);
    const snapshot = JSON.stringify(await store.snapshot(access.record.id));
    for (const secret of ['private-access', 'private-refresh', 'private-device'])
      expect(snapshot).not.toContain(secret);
    await vi.advanceTimersByTimeAsync(JUDGING_DURATION_MS - 2000);
    expect(revoke).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalledTimes(2);
    await expect(service.http(access, 'GET', '/api/twitch')).rejects.toMatchObject({ status: 410 });
  });
  it('isolates state, publishes real runtime snapshots, and gives overlays read-only capabilities', async () => {
    const { service, access, created } = await fixture();
    const other = await service.create();
    const otherUrl = new URL(other.studioUrl);
    const otherAccess = await service.authenticate(
      otherUrl.searchParams.get('judge'),
      otherUrl.searchParams.get('key'),
    );
    await service.command(access, { type: 'configure', patch: { name: 'Only mine' } });
    expect((await service.snapshot(access)).packet.state.config.name).toBe('Only mine');
    expect((await service.snapshot(otherAccess)).packet.state.config.name).not.toBe('Only mine');
    const overlay = new URL(created.session.overlayUrl);
    const viewer = await service.authenticate(
      overlay.searchParams.get('judge'),
      overlay.searchParams.get('key'),
    );
    expect(viewer.role).toBe('viewer');
    expect((await service.snapshot(viewer)).packet.state.config.name).toBe('Only mine');
    await expect(service.command(viewer, { type: 'quiet', value: true })).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.reset(viewer)).rejects.toMatchObject({ status: 403 });
    await expect(service.extend(viewer)).rejects.toMatchObject({ status: 403 });
    await expect(service.http(viewer, 'GET', '/api/twitch')).rejects.toMatchObject({ status: 403 });
    await expect(service.authenticate(access.record.id, 'wrong')).rejects.toMatchObject({
      status: 401,
    });
  });
  it('extends once atomically, resets without renewing time, and rejects old-epoch writes', async () => {
    const { store, service, access } = await fixture();
    const before = await service.snapshot(access);
    const results = await Promise.allSettled([service.extend(access), service.extend(access)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const extended = await service.status(access);
    expect(extended.expiresAt - extended.createdAt).toBe(
      JUDGING_DURATION_MS + JUDGING_EXTENSION_MS,
    );
    await service.command(access, { type: 'configure', patch: { name: 'Reset me' } });
    const reset = await service.reset(access);
    expect(reset.epoch).toBe(1);
    expect(reset.expiresAt).toBe(extended.expiresAt);
    expect(reset.canExtend).toBe(false);
    expect((await service.snapshot(access)).packet.state.config.name).not.toBe('Reset me');
    expect(await store.save(access.record.id, 0, before.packet)).toBeNull();
  });
  it('expires on the server without an open browser, even with stale controller access', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const { store, service, access } = await fixture();
    const ended = vi.fn();
    await store.subscribe(access.record.id, (event) => {
      if (event.type === 'ended') ended();
    });
    await vi.advanceTimersByTimeAsync(JUDGING_DURATION_MS);
    expect(ended).toHaveBeenCalledOnce();
    expect(await store.get(access.record.id)).toBeNull();
    await expect(service.snapshot(access)).rejects.toMatchObject({ status: 410 });
    await expect(service.command(access, { type: 'quiet', value: true })).rejects.toMatchObject({
      status: 410,
    });
    await expect(service.extend(access)).rejects.toMatchObject({ status: 410 });
  });
  it('labels test events and never enables owner-funded cloud AI or remote OBS control', async () => {
    const { service, access } = await fixture();
    await service.command(access, { type: 'simulate', source: 'chat', text: 'Hello Tavi!' });
    expect((await service.status(access)).lastTestEvent?.label).toBe('Chat');
    await expect(service.http(access, 'POST', '/api/ai', {})).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.http(access, 'POST', '/api/obs/connect', {})).rejects.toMatchObject({
      status: 404,
    });
    const status = await service.http(access, 'GET', '/api/ai');
    expect(JSON.stringify(status.body)).not.toContain('api_key');
  });
});
