import { createClient } from '@redis/client';
import { randomUUID } from 'node:crypto';
import { JUDGING_EXTENSION_MS } from '../../shared/judging.js';
import {
  JudgingError,
  type SessionStore,
  type SessionRecord,
  type Snapshot,
  type StatePacket,
  type SessionEvent,
  type WorkerRequest,
  type WorkerReply,
} from './types.js';

/** Marketplace URLs may retain redis:// after TLS is enabled. Cloud auth always uses TLS. */
export function redisConnectionUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Set a valid Redis TCP/TLS connection URL.');
  }
  if (!['redis:', 'rediss:'].includes(url.protocol))
    throw new Error('Use a Redis TCP/TLS connection URL.');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) url.protocol = 'rediss:';
  return url.href;
}

// One atomic script owns all record transitions and absolute TTLs. Redis TIME is authoritative.
const transition = `
local action=ARGV[1]
local clock=redis.call('TIME')
local now=tonumber(clock[1])*1000+math.floor(tonumber(clock[2])/1000)
local raw=redis.call('GET',KEYS[1])
local channel=KEYS[4]
local id=ARGV[2]
if action=='create' then
  redis.call('ZREMRANGEBYSCORE',KEYS[3],'-inf',now)
  if redis.call('ZCARD',KEYS[3])>=tonumber(ARGV[4]) then return 'BUSY' end
  local record=cjson.decode(ARGV[3])
  record.createdAt=now
  record.expiresAt=now+1800000
  redis.call('SET',KEYS[1],cjson.encode(record),'PXAT',record.expiresAt)
  redis.call('ZADD',KEYS[3],record.expiresAt,id)
  return cjson.encode(record)
end
if action=='end' then
  redis.call('DEL',KEYS[1],KEYS[2])
  redis.call('ZREM',KEYS[3],id)
  redis.call('PUBLISH',channel,'{"type":"ended"}')
  return 'OK'
end
if not raw then return 'GONE' end
local record=cjson.decode(raw)
if record.expiresAt<=now then
  redis.call('DEL',KEYS[1],KEYS[2])
  redis.call('ZREM',KEYS[3],id)
  redis.call('PUBLISH',channel,'{"type":"ended"}')
  return 'GONE'
end
if action=='get' then return raw end
if action=='snapshot' then return redis.call('GET',KEYS[2]) or 'EMPTY' end
if action=='extend' then
  if record.extended then return 'USED' end
  record.extended=true
  record.expiresAt=record.expiresAt+tonumber(ARGV[3])
  redis.call('PEXPIREAT',KEYS[2],record.expiresAt)
  redis.call('ZADD',KEYS[3],record.expiresAt,id)
elseif action=='reset' then
  record.epoch=record.epoch+1
  record.lastTestEvent=cjson.null
  redis.call('DEL',KEYS[2])
elseif action=='test' then
  record.lastTestEvent={label=ARGV[3],at=now}
elseif action=='save' then
  if record.epoch~=tonumber(ARGV[3]) then return 'STALE' end
  record.revision=record.revision+1
  -- Preserve the application JSON verbatim: Lua cjson turns empty object tables into arrays.
  local encoded='{"revision":'..cjson.encode(record.revision)..',"packet":'..ARGV[4]..'}'
  redis.call('SET',KEYS[2],encoded,'PXAT',record.expiresAt)
  redis.call('SET',KEYS[1],cjson.encode(record),'PXAT',record.expiresAt)
  redis.call('PUBLISH',channel,'{"type":"state","snapshot":'..encoded..'}')
  return encoded
end
local encoded=cjson.encode(record)
redis.call('SET',KEYS[1],encoded,'PXAT',record.expiresAt)
redis.call('PUBLISH',channel,'{"type":"metadata"}')
return encoded
`;

/** Shared clients multiplex subscriptions; no client or retained queue per browser. */
export class RedisSessionStore implements SessionStore {
  readonly now = Date.now;
  private client;
  private subscriber;
  private channels = new Map<
    string,
    {
      listeners: Set<(value: string) => void>;
      ready: Promise<void>;
    }
  >();
  private closing = new Map<string, Promise<void>>();
  constructor(
    url: string,
    private prefix = 'tavi:judging',
    private capacity = 100,
  ) {
    if (!/^[a-zA-Z0-9:_-]+$/.test(prefix)) throw new Error('Invalid judging namespace.');
    this.client = createClient({
      url: redisConnectionUrl(url),
      socket: { connectTimeout: 5000 },
      disableOfflineQueue: true,
    });
    this.subscriber = this.client.duplicate();
    // Never log connection strings or Redis payloads, which include private preview state.
    this.client.on('error', () => undefined);
    this.subscriber.on('error', () => undefined);
  }
  async connect() {
    await Promise.all([this.client.connect(), this.subscriber.connect()]);
  }
  private key(id: string, suffix: string) {
    return `${this.prefix}:${id}:${suffix}`;
  }
  private async run(action: string, id: string, ...args: string[]) {
    const result = await this.client.eval(transition, {
      keys: [
        this.key(id, 'meta'),
        this.key(id, 'state'),
        `${this.prefix}:active`,
        this.key(id, 'events'),
      ],
      arguments: [action, id, ...args],
    });
    if (typeof result !== 'string') throw new JudgingError(503, 'Invalid preview store response.');
    if (result === 'BUSY') throw new JudgingError(503, 'Preview is busy. Try again shortly.');
    if (result === 'USED') throw new JudgingError(409, 'The extension has already been used.');
    return result;
  }
  async create(record: SessionRecord) {
    const created = JSON.parse(
      await this.run('create', record.id, JSON.stringify(record), String(this.capacity)),
    ) as SessionRecord;
    // Surface the server-assigned clock/deadline to the caller.
    Object.assign(record, created);
  }
  async get(id: string) {
    const value = await this.run('get', id);
    return value === 'GONE' ? null : (JSON.parse(value) as SessionRecord);
  }
  private async required(action: string, id: string, ...args: string[]) {
    const value = await this.run(action, id, ...args);
    if (value === 'GONE') throw new JudgingError(410, 'This preview has ended.');
    return JSON.parse(value) as SessionRecord;
  }
  extend(id: string) {
    return this.required('extend', id, String(JUDGING_EXTENSION_MS));
  }
  reset(id: string) {
    return this.required('reset', id);
  }
  async end(id: string) {
    await this.run('end', id);
  }
  async markTest(id: string, label: string) {
    await this.required('test', id, label);
  }
  async snapshot(id: string) {
    const value = await this.run('snapshot', id);
    return ['GONE', 'EMPTY'].includes(value) ? null : (JSON.parse(value) as Snapshot);
  }
  async save(id: string, epoch: number, packet: StatePacket) {
    const value = await this.run('save', id, String(epoch), JSON.stringify(packet));
    return ['GONE', 'STALE'].includes(value) ? null : (JSON.parse(value) as Snapshot);
  }
  async activeIds() {
    const time = await this.client.sendCommand<string[]>(['TIME']);
    const now = Number(time[0]) * 1000 + Math.floor(Number(time[1]) / 1000);
    await this.client.zRemRangeByScore(`${this.prefix}:active`, '-inf', now);
    return this.client.zRange(`${this.prefix}:active`, 0, -1);
  }
  private async listen(channel: string, listener: (value: string) => void) {
    let group = this.channels.get(channel);
    if (!group) {
      const listeners = new Set<(value: string) => void>();
      const ready = (this.closing.get(channel) ?? Promise.resolve()).then(() =>
        this.subscriber.subscribe(channel, (value) => {
          for (const receive of listeners) receive(value);
        }),
      );
      group = { listeners, ready };
      this.channels.set(channel, group);
    }
    group.listeners.add(listener);
    try {
      await group.ready;
    } catch (error) {
      group.listeners.delete(listener);
      this.channels.delete(channel);
      throw error;
    }
    return async () => {
      group.listeners.delete(listener);
      if (group.listeners.size || this.channels.get(channel) !== group) return;
      this.channels.delete(channel);
      const closing = group.ready.then(() => this.subscriber.unsubscribe(channel));
      this.closing.set(channel, closing);
      try {
        await closing;
      } finally {
        if (this.closing.get(channel) === closing) this.closing.delete(channel);
      }
    };
  }
  subscribe(id: string, listener: (event: SessionEvent) => void) {
    return this.listen(this.key(id, 'events'), (value) => {
      try {
        listener(JSON.parse(value) as SessionEvent);
      } catch {
        /* Ignore corrupt notifications. */
      }
    });
  }
  async request(request: WorkerRequest): Promise<WorkerReply> {
    const channel = this.key(request.id, 'reply');
    let resolve!: (reply: WorkerReply) => void;
    let reject!: (error: unknown) => void;
    const response = new Promise<WorkerReply>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    void response.catch(() => undefined);
    const stop = await this.listen(channel, (value) => {
      try {
        resolve(JSON.parse(value) as WorkerReply);
      } catch {
        reject(new JudgingError(503, 'Invalid worker response.'));
      }
    });
    const timer = setTimeout(() => {
      reject(new JudgingError(503, 'Preview is reconnecting. Try again shortly.'));
    }, 15000);
    try {
      const receivers = await this.client.publish(
        `${this.prefix}:requests`,
        JSON.stringify(request),
      );
      if (!receivers) throw new JudgingError(503, 'Preview is warming up. Try again shortly.');
      return await response;
    } finally {
      clearTimeout(timer);
      await stop();
    }
  }
  async serve(handler: (request: WorkerRequest) => Promise<WorkerReply>) {
    const workerId = randomUUID();
    const lock = `${this.prefix}:worker`;
    // During a rolling deploy the new process waits for the old worker's lease to clear.
    const waitingUntil = Date.now() + 90000;
    while (!(await this.client.set(lock, workerId, { NX: true, PX: 30000 }))) {
      if (Date.now() >= waitingUntil) throw new Error('Another judging worker is active.');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    let active = true;
    let renewedAt = Date.now();
    const watchdog = setInterval(() => {
      // A hung Redis command must not leave a Twitch listener running after lease ownership is lost.
      if (Date.now() - renewedAt > 15000) process.kill(process.pid, 'SIGTERM');
    }, 1000);
    watchdog.unref();
    const heartbeat = setInterval(() => {
      void this.client
        .eval(
          "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('PEXPIRE',KEYS[1],30000) else return 0 end",
          {
            keys: [lock],
            arguments: [workerId],
          },
        )
        .then((ok) => {
          if (!ok) process.kill(process.pid, 'SIGTERM');
          else renewedAt = Date.now();
        })
        .catch(() => {
          process.kill(process.pid, 'SIGTERM');
        });
    }, 5000);
    heartbeat.unref();
    const stop = await this.listen(`${this.prefix}:requests`, (value) => {
      if (!active) return;
      let request: WorkerRequest;
      try {
        request = JSON.parse(value) as WorkerRequest;
      } catch {
        return;
      }
      void handler(request)
        .then((reply) => this.client.publish(this.key(request.id, 'reply'), JSON.stringify(reply)))
        .catch(() => undefined);
    });
    return async () => {
      active = false;
      clearInterval(heartbeat);
      clearInterval(watchdog);
      await stop();
      await this.client.eval(
        "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
        {
          keys: [lock],
          arguments: [workerId],
        },
      );
    };
  }
  async close() {
    this.channels.clear();
    await Promise.allSettled([this.client.close(), this.subscriber.close()]);
  }
}
