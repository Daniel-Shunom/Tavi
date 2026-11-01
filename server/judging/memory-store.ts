/* eslint @typescript-eslint/require-await: "off" -- In-memory transitions are intentionally atomic before their Promise settles; production implements the same async interface with Redis. */
import { JUDGING_EXTENSION_MS } from '../../shared/judging.js';
import {
  JudgingError,
  type SessionStore,
  type SessionRecord,
  type SessionEvent,
  type StatePacket,
  type Snapshot,
  type WorkerRequest,
  type WorkerReply,
} from './types.js';

/** Local development/test adapter. Production uses Redis so function reconnects share state. */
export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, SessionRecord>();
  private snapshots = new Map<string, Snapshot>();
  private listeners = new Map<string, Set<(event: SessionEvent) => void>>();
  private handler: ((request: WorkerRequest) => Promise<WorkerReply>) | undefined;
  constructor(
    readonly now: () => number = Date.now,
    private capacity = 100,
  ) {}
  private emit(id: string, event: SessionEvent) {
    for (const listener of this.listeners.get(id) ?? []) listener(event);
  }
  async create(session: SessionRecord) {
    const active = [...this.sessions.keys()].filter((id) => this.live(id));
    if (active.length >= this.capacity)
      throw new JudgingError(503, 'Preview is busy. Try again shortly.');
    this.sessions.set(session.id, structuredClone(session));
  }
  private live(id: string) {
    const session = this.sessions.get(id);
    if (!session) return null;
    if (session.expiresAt <= this.now()) {
      void this.end(id);
      return null;
    }
    return session;
  }
  get(id: string) {
    return Promise.resolve(structuredClone(this.live(id)));
  }
  private required(id: string) {
    const session = this.live(id);
    if (!session) throw new JudgingError(410, 'This preview has ended.');
    return session;
  }
  async extend(id: string) {
    const session = this.required(id);
    if (session.extended) throw new JudgingError(409, 'The extension has already been used.');
    session.extended = true;
    session.expiresAt += JUDGING_EXTENSION_MS;
    this.sessions.set(id, session);
    this.emit(id, { type: 'metadata' });
    return structuredClone(session);
  }
  async reset(id: string) {
    const current = this.required(id);
    const next = { ...current, epoch: current.epoch + 1, lastTestEvent: null };
    this.sessions.set(id, next);
    this.snapshots.delete(id);
    this.emit(id, { type: 'metadata' });
    return structuredClone(next);
  }
  async end(id: string) {
    this.sessions.delete(id);
    this.snapshots.delete(id);
    this.emit(id, { type: 'ended' });
  }
  async markTest(id: string, label: string) {
    const session = this.required(id);
    session.lastTestEvent = { label, at: this.now() };
    this.emit(id, { type: 'metadata' });
  }
  async snapshot(id: string) {
    if (!this.live(id)) return null;
    return structuredClone(this.snapshots.get(id) ?? null);
  }
  async save(id: string, epoch: number, packet: StatePacket) {
    const session = this.live(id);
    if (!session) return null;
    if (session.epoch !== epoch) return null;
    const snapshot = { revision: ++session.revision, packet: structuredClone(packet) };
    this.snapshots.set(id, snapshot);
    this.emit(id, { type: 'state', snapshot: structuredClone(snapshot) });
    return structuredClone(snapshot);
  }
  async activeIds() {
    const ids = [];
    for (const id of [...this.sessions.keys()]) if (this.live(id)) ids.push(id);
    return ids;
  }
  subscribe(id: string, listener: (event: SessionEvent) => void) {
    const listeners = this.listeners.get(id) ?? new Set();
    listeners.add(listener);
    this.listeners.set(id, listeners);
    return Promise.resolve(async () => {
      listeners.delete(listener);
      if (!listeners.size) this.listeners.delete(id);
    });
  }
  async request(request: WorkerRequest) {
    if (!this.handler) throw new JudgingError(503, 'Preview is warming up. Try again shortly.');
    return this.handler(request);
  }
  serve(handler: (request: WorkerRequest) => Promise<WorkerReply>) {
    this.handler = handler;
    return Promise.resolve(async () => {
      this.handler = undefined;
    });
  }
  close() {
    this.handler = undefined;
    this.sessions.clear();
    this.snapshots.clear();
    this.listeners.clear();
    return Promise.resolve();
  }
}
