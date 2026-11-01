import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { JUDGING_DURATION_MS, type JudgingSession } from '../../shared/judging.js';
import { commandSchema, type Command } from '../../shared/protocol.js';
import { JudgingError, type SessionRecord, type SessionStore } from './types.js';

export type SessionAccess = { record: SessionRecord; role: 'controller' | 'viewer' };
const hash = (key: string) => createHash('sha256').update(key).digest('hex');
const equal = (left: string, right: string) =>
  timingSafeEqual(Buffer.from(hash(left), 'hex'), Buffer.from(hash(right), 'hex'));

/** Public capabilities expire with the record; Twitch tokens never enter this store. */
export class JudgingSessions {
  readonly origin: string;
  constructor(
    readonly store: SessionStore,
    origin: string,
    private secret: string,
  ) {
    const url = new URL(origin);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
      throw new Error('Set a valid judging public origin.');
    this.origin = url.origin;
    if (secret.length < 32) throw new Error('JUDGING_SECRET must contain at least 32 characters.');
  }
  private viewerKey(id: string) {
    return createHmac('sha256', this.secret).update(`overlay:${id}`).digest('base64url');
  }
  private url(path: string, id: string, key: string) {
    const url = new URL(path, this.origin);
    url.searchParams.set('judge', id);
    url.searchParams.set('key', key);
    return url.href;
  }
  metadata(access: SessionAccess): JudgingSession {
    const { record, role } = access;
    return {
      id: record.id,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      serverNow: this.store.now(),
      canExtend: role === 'controller' && !record.extended,
      epoch: record.epoch,
      role,
      overlayUrl: this.url('/overlay', record.id, this.viewerKey(record.id)),
      lastTestEvent: record.lastTestEvent,
    };
  }
  async create() {
    const id = randomUUID();
    const key = randomBytes(32).toString('base64url');
    const record: SessionRecord = {
      id,
      controllerHash: hash(key),
      createdAt: this.store.now(),
      expiresAt: this.store.now() + JUDGING_DURATION_MS,
      extended: false,
      epoch: 0,
      revision: 0,
      lastTestEvent: null,
    };
    await this.store.create(record);
    try {
      await this.call(id, 'ensure');
    } catch (error) {
      await this.store.end(id);
      throw error;
    }
    return {
      session: this.metadata({ record, role: 'controller' }),
      studioUrl: this.url('/studio', id, key),
    };
  }
  async authenticate(id: string | null, key: string | null): Promise<SessionAccess> {
    if (!id || !key || id.length > 64 || key.length > 128)
      throw new JudgingError(401, 'Open your preview link to continue.');
    const record = await this.store.get(id);
    if (!record) throw new JudgingError(410, 'This preview has ended.');
    if (timingSafeEqual(Buffer.from(hash(key), 'hex'), Buffer.from(record.controllerHash, 'hex')))
      return { record, role: 'controller' };
    if (equal(key, this.viewerKey(id))) return { record, role: 'viewer' };
    throw new JudgingError(401, 'This preview link is not valid.');
  }
  controller(access: SessionAccess) {
    if (access.role !== 'controller')
      throw new JudgingError(403, 'This overlay link is view-only.');
  }
  private async current(access: SessionAccess) {
    const record = await this.store.get(access.record.id);
    if (!record) throw new JudgingError(410, 'This preview has ended.');
    return { record, role: access.role };
  }
  async status(access: SessionAccess) {
    return this.metadata(await this.current(access));
  }
  async extend(access: SessionAccess) {
    this.controller(access);
    const record = await this.store.extend(access.record.id);
    // Redis is authoritative even if a worker is briefly restarting.
    await this.call(record.id, 'ensure').catch(() => undefined);
    return this.metadata({ record, role: access.role });
  }
  async reset(access: SessionAccess) {
    this.controller(access);
    const record = await this.store.reset(access.record.id);
    await this.call(record.id, 'reset');
    return this.metadata({ record, role: access.role });
  }
  async command(access: SessionAccess, input: unknown) {
    this.controller(access);
    const current = await this.current(access);
    const command: Command = commandSchema.parse(input);
    if (command.type === 'simulate') await this.store.markTest(current.record.id, 'Chat');
    if (command.type === 'preview-support-event')
      await this.store.markTest(current.record.id, command.event.kind);
    await this.call(current.record.id, 'command', { command, epoch: current.record.epoch });
  }
  async snapshot(access: SessionAccess) {
    await this.current(access);
    let snapshot = await this.store.snapshot(access.record.id);
    if (!snapshot) {
      await this.call(access.record.id, 'ensure');
      snapshot = await this.store.snapshot(access.record.id);
    }
    if (!snapshot) throw new JudgingError(503, 'Preview is reconnecting. Try again shortly.');
    return snapshot;
  }
  async http(access: SessionAccess, method: 'GET' | 'POST', path: string, body?: unknown) {
    this.controller(access);
    const current = await this.current(access);
    if (!/^\/api\/(?:twitch(?:\/(?:connect|disconnect))?|ai|obs)$/.test(path))
      throw new JudgingError(404, 'Unknown preview action.');
    if (method === 'POST' && !/^\/api\/twitch\/(?:connect|disconnect)$/.test(path))
      throw new JudgingError(403, 'This connection is available in the desktop app.');
    return this.call(access.record.id, 'http', {
      epoch: current.record.epoch,
      http: { method, path, ...(body === undefined ? {} : { body }) },
    });
  }
  private async call(id: string, action: 'ensure' | 'reset' | 'command' | 'http', extra = {}) {
    const reply = await this.store.request({ id: randomUUID(), sessionId: id, action, ...extra });
    if (reply.status >= 400) {
      const message =
        reply.body && typeof reply.body === 'object' && 'error' in reply.body
          ? String(reply.body.error)
          : 'Preview is unavailable. Try again shortly.';
      throw new JudgingError(reply.status, message);
    }
    return reply;
  }
}
