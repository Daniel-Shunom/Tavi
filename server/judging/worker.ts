import { createApp, runtimeOf } from '../app.js';
import { AiManager, settingsFromEnv } from '../ai/manager.js';
import { configSchema, defaults } from '../../shared/protocol.js';
import type { TwitchOptions } from '../twitch/integration.js';
import { JudgingError, type SessionStore, type WorkerReply, type WorkerRequest } from './types.js';

type Runtime = {
  app: Awaited<ReturnType<typeof createApp>>;
  epoch: number;
  expiresAt: number;
  active: boolean;
  timer: ReturnType<typeof setTimeout>;
  unsubscribe: () => void;
};

/** Long-lived owner of session runtimes. Secrets stay in TwitchIntegration RAM only. */
export class JudgingWorker {
  private runtimes = new Map<string, Runtime>();
  private queues = new Map<string, Promise<unknown>>();
  private stopServing: (() => Promise<void>) | undefined;
  private stopping = false;
  constructor(
    private store: SessionStore,
    private origin: string,
    private twitchOptions: () => TwitchOptions = () => ({}),
  ) {}

  async start() {
    this.stopServing = await this.store.serve((request) => this.request(request));
    for (const id of await this.store.activeIds())
      await this.request({ id: 'recover', sessionId: id, action: 'ensure' });
  }
  private request(request: WorkerRequest): Promise<WorkerReply> {
    const previous = this.queues.get(request.sessionId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => this.handle(request));
    this.queues.set(request.sessionId, next);
    void next
      .finally(() => {
        if (this.queues.get(request.sessionId) === next) this.queues.delete(request.sessionId);
      })
      .catch(() => undefined);
    return next.catch((error: unknown) => ({
      status: error instanceof JudgingError ? error.status : 500,
      body: {
        error:
          error instanceof JudgingError ? error.message : 'Preview could not apply this action.',
      },
    }));
  }
  private async dispose(id: string) {
    const runtime = this.runtimes.get(id);
    if (!runtime) return;
    this.runtimes.delete(id);
    runtime.active = false;
    clearTimeout(runtime.timer);
    runtime.unsubscribe();
    // disconnect clears credentials and cancels callbacks synchronously, before network revocation.
    const revoke = runtimeOf(runtime.app).twitch.disconnect();
    await Promise.allSettled([revoke, runtime.app.close()]);
  }
  private schedule(id: string, runtime: Runtime) {
    clearTimeout(runtime.timer);
    runtime.timer = setTimeout(
      () => {
        // Fail closed using our known deadline even if Redis is unreachable.
        void this.dispose(id);
        // Redis has absolute TTLs; reading also prunes the local adapter without browser activity.
        void this.store.get(id).catch(() => undefined);
      },
      Math.max(0, runtime.expiresAt - this.store.now()),
    );
    runtime.timer.unref();
  }
  private async ensure(id: string) {
    const record = await this.store.get(id);
    if (!record) {
      await this.dispose(id);
      throw new JudgingError(410, 'This preview has ended.');
    }
    let runtime = this.runtimes.get(id);
    if (runtime && runtime.epoch !== record.epoch) {
      await this.dispose(id);
      runtime = undefined;
    }
    if (runtime) {
      runtime.expiresAt = record.expiresAt;
      this.schedule(id, runtime);
      return runtime;
    }
    const previous = await this.store.snapshot(id);
    let active = true;
    const app = await createApp(
      configSchema.parse(previous?.packet.state.config ?? structuredClone(defaults)),
      undefined,
      this.twitchOptions(),
      [this.origin],
      {
        ai: new AiManager(settingsFromEnv({})),
        isActive: () =>
          !this.stopping &&
          active &&
          (this.runtimes.get(id)?.active ?? true) &&
          this.store.now() < (this.runtimes.get(id)?.expiresAt ?? record.expiresAt),
      },
    );
    await app.ready();
    if (this.stopping || this.store.now() >= record.expiresAt) {
      active = false;
      const revoke = runtimeOf(app).twitch.disconnect();
      await Promise.allSettled([revoke, app.close()]);
      throw new JudgingError(410, 'This preview has ended.');
    }
    const core = runtimeOf(app);
    const publish = () => {
      if (!active) return;
      void this.store
        .save(id, record.epoch, {
          type: 'state',
          state: core.companion.state,
          now: core.companion.clock(),
        })
        .catch(() => undefined);
    };
    const unsubscribe = core.companion.subscribe(publish);
    runtime = {
      app,
      epoch: record.epoch,
      expiresAt: record.expiresAt,
      active: true,
      timer: setTimeout(() => undefined, 0),
      unsubscribe: () => {
        active = false;
        unsubscribe();
      },
    };
    this.runtimes.set(id, runtime);
    this.schedule(id, runtime);
    await this.store.save(id, record.epoch, {
      type: 'state',
      state: core.companion.state,
      now: core.companion.clock(),
    });
    return runtime;
  }
  private async handle(request: WorkerRequest): Promise<WorkerReply> {
    if (this.stopping) throw new JudgingError(503, 'Preview is restarting.');
    const id = request.sessionId;
    if (request.action === 'close') {
      await this.dispose(id);
      return { status: 200, body: {} };
    }
    if (request.action === 'reset') await this.dispose(id);
    const runtime = await this.ensure(id);
    if (request.epoch !== undefined && request.epoch !== runtime.epoch)
      throw new JudgingError(409, 'Preview was reset. Try that action again.');
    if (request.action === 'command') {
      if (!request.command) throw new JudgingError(400, 'Missing command.');
      await runtimeOf(runtime.app).command(request.command);
    }
    if (request.action === 'http') {
      if (!request.http) throw new JudgingError(400, 'Missing action.');
      const response = await runtime.app.inject({
        method: request.http.method,
        url: request.http.path,
        headers: { origin: this.origin, 'x-tavi-request': 'studio' },
        ...(request.http.body === undefined
          ? {}
          : { payload: request.http.body as Record<string, unknown> }),
      });
      return { status: response.statusCode, body: response.json<unknown>() };
    }
    return { status: 200, body: {} };
  }
  async close() {
    this.stopping = true;
    const closing = [...this.runtimes.keys()].map((id) => this.dispose(id));
    await Promise.allSettled([...closing, this.stopServing?.()]);
  }
}
