import type { Command, State } from '../../shared/protocol.js';

export type SessionRecord = {
  id: string;
  controllerHash: string;
  createdAt: number;
  expiresAt: number;
  extended: boolean;
  epoch: number;
  revision: number;
  lastTestEvent: { label: string; at: number } | null;
};
export type StatePacket = { type: 'state'; state: State; now: number };
export type Snapshot = { revision: number; packet: StatePacket };
export type SessionEvent =
  { type: 'state'; snapshot: Snapshot } | { type: 'metadata' } | { type: 'ended' };
export type WorkerRequest = {
  id: string;
  sessionId: string;
  action: 'ensure' | 'command' | 'http' | 'reset' | 'close';
  epoch?: number;
  command?: Command;
  http?: { method: 'GET' | 'POST'; path: string; body?: unknown };
};
export type WorkerReply = { status: number; body: unknown };

export class JudgingError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Session storage has an authoritative deadline; writes never extend it implicitly. */
export interface SessionStore {
  readonly now: () => number;
  create(session: SessionRecord): Promise<void>;
  get(id: string): Promise<SessionRecord | null>;
  extend(id: string): Promise<SessionRecord>;
  reset(id: string): Promise<SessionRecord>;
  end(id: string): Promise<void>;
  markTest(id: string, label: string): Promise<void>;
  snapshot(id: string): Promise<Snapshot | null>;
  save(id: string, epoch: number, packet: StatePacket): Promise<Snapshot | null>;
  activeIds(): Promise<string[]>;
  subscribe(id: string, listener: (event: SessionEvent) => void): Promise<() => Promise<void>>;
  request(request: WorkerRequest): Promise<WorkerReply>;
  serve(handler: (request: WorkerRequest) => Promise<WorkerReply>): Promise<() => Promise<void>>;
  close(): Promise<void>;
}
