import {
  disconnectedTwitch,
  TWITCH_CLIENT_ID,
  TWITCH_SCOPES,
  type ChatMessage,
  type TwitchStatus,
} from '../../shared/twitch.js';
import {
  createTwitchGateway,
  TwitchRequestError,
  type ChatChange,
  type Identity,
  type Token,
  type TwitchGateway,
} from './gateway.js';
export type TwitchOptions = {
  gateway?: TwitchGateway;
  clientId?: string;
  onMessage?: (message: ChatMessage) => void;
  onModeration?: (event: Exclude<ChatChange, { type: 'message' }>) => void;
};
const errorMessages = {
  denied: 'Twitch authorization was declined. You can try again.',
  expired: 'The Twitch code expired. Connect again to get a new code.',
  invalid_token: 'Twitch access was revoked or expired. Connect again.',
  unavailable: 'Could not reach Twitch. Check your connection and try again.',
  invalid_client:
    'Twitch rejected the Client ID. Check that the app is registered as a Public client.',
};
export class TwitchIntegration {
  private readonly gateway: TwitchGateway;
  private readonly clientId: string;
  private state: TwitchStatus = disconnectedTwitch();
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopListener: (() => void) | undefined;
  private token: Token | undefined;
  private identity: Identity | undefined;
  private expiresAt = 0;
  private validateAt = 0;
  private readonly seen = new Set<string>();
  constructor(private readonly options: TwitchOptions = {}) {
    this.gateway = options.gateway ?? createTwitchGateway();
    this.clientId = options.clientId ?? TWITCH_CLIENT_ID;
  }
  snapshot(): TwitchStatus {
    return structuredClone(this.state);
  }
  private cleanup() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.stopListener?.();
    this.stopListener = undefined;
  }
  private later(run: number, delay: number, task: () => Promise<void>) {
    this.timer = setTimeout(() => {
      if (run !== this.generation) return;
      void task().catch((error: unknown) => {
        if (run === this.generation) this.fail(error);
      });
    }, delay);
    this.timer.unref();
  }
  private fail(error: unknown) {
    this.generation++;
    this.cleanup();
    this.token = undefined;
    this.identity = undefined;
    this.seen.clear();
    this.state = {
      ...disconnectedTwitch(),
      phase: 'error',
      error:
        error instanceof TwitchRequestError ? errorMessages[error.kind] : errorMessages.unavailable,
    };
  }
  async connect(): Promise<TwitchStatus> {
    if (['authorizing', 'connecting', 'connected', 'reconnecting'].includes(this.state.phase))
      return this.snapshot();
    const run = ++this.generation;
    this.cleanup();
    this.state = { ...disconnectedTwitch(), phase: 'authorizing' };
    try {
      const device = await this.gateway.device(this.clientId);
      if (run !== this.generation) return this.snapshot();
      const expiresAt = Date.now() + device.expires_in * 1000;
      this.state.authorization = {
        userCode: device.user_code,
        verificationUri: device.verification_uri,
        expiresAt,
      };
      this.poll(run, device.device_code, Math.max(1000, device.interval * 1000), expiresAt);
    } catch (error) {
      if (run === this.generation) this.fail(error);
    }
    return this.snapshot();
  }
  private poll(run: number, deviceCode: string, interval: number, expiresAt: number) {
    this.later(run, Math.min(interval, Math.max(0, expiresAt - Date.now())), async () => {
      if (Date.now() >= expiresAt) throw new TwitchRequestError('expired');
      const result = await this.gateway.poll(this.clientId, deviceCode);
      if (run !== this.generation) {
        if (result.kind === 'token') {
          try {
            await this.gateway.revoke(this.clientId, result.token.access_token);
          } catch {
            /* Token is discarded locally even if Twitch is unavailable. */
          }
        }
        return;
      }
      if (result.kind === 'token') await this.attach(run, result.token);
      else
        this.poll(
          run,
          deviceCode,
          result.kind === 'slow_down' ? interval + 5000 : interval,
          expiresAt,
        );
    });
  }
  private async attach(run: number, token: Token) {
    if (run !== this.generation) {
      try {
        await this.gateway.revoke(this.clientId, token.access_token);
      } catch {
        /* No local session remains. */
      }
      return;
    }
    const identity = await this.gateway.validate(token.access_token);
    if (run !== this.generation) return;
    if (
      identity.client_id !== this.clientId ||
      !TWITCH_SCOPES.every((scope) => identity.scopes.includes(scope))
    )
      throw new TwitchRequestError('invalid_token');
    if (this.identity && this.identity.user_id !== identity.user_id)
      throw new TwitchRequestError('invalid_token');
    this.token = token;
    this.identity = identity;
    this.expiresAt = Date.now() + Math.min(identity.expires_in, token.expires_in) * 1000;
    this.validateAt = Date.now() + 3600000;
    this.state = {
      ...this.state,
      phase: 'connecting',
      account: { id: identity.user_id, login: identity.login },
      authorization: null,
      error: null,
    };
    this.stopListener?.();
    this.stopListener = this.gateway.listen({
      clientId: this.clientId,
      token,
      identity,
      onChange: (event) => {
        if (run === this.generation) this.receive(event);
      },
      onStatus: (status) => {
        if (run !== this.generation) return;
        if (status === 'revoked') {
          this.fail(new TwitchRequestError('invalid_token'));
          return;
        }
        if (status === 'failed') {
          this.fail(new TwitchRequestError('unavailable'));
          return;
        }
        this.state.phase = status;
      },
    });
    if (run === this.generation) this.maintain(run);
  }
  private maintain(run: number) {
    this.later(
      run,
      Math.min(60000, Math.max(1000, this.expiresAt - Date.now() - 120000)),
      async () => {
        const token = this.token;
        if (!token) return;
        if (Date.now() >= this.expiresAt - 120000) {
          await this.attach(run, await this.gateway.refresh(this.clientId, token.refresh_token));
          return;
        }
        if (Date.now() >= this.validateAt) {
          const identity = await this.gateway.validate(token.access_token);
          if (run !== this.generation) return;
          if (
            identity.client_id !== this.clientId ||
            identity.user_id !== this.identity?.user_id ||
            !TWITCH_SCOPES.every((scope) => identity.scopes.includes(scope))
          )
            throw new TwitchRequestError('invalid_token');
          this.expiresAt = Date.now() + identity.expires_in * 1000;
          this.validateAt = Date.now() + 3600000;
        }
        if (run === this.generation) this.maintain(run);
      },
    );
  }
  private receive(event: ChatChange) {
    if (event.type !== 'message') this.options.onModeration?.(event);
    if (event.type === 'delete') {
      this.state.messages = this.state.messages.filter((message) => message.id !== event.id);
      return;
    }
    if (event.type === 'clearUser') {
      this.state.messages = this.state.messages.filter(
        (message) => message.userId !== event.userId,
      );
      return;
    }
    if (event.type === 'clear') {
      this.state.messages = [];
      return;
    }
    if (this.seen.has(event.message.id)) return;
    this.seen.add(event.message.id);
    if (this.seen.size > 1000) {
      const first = this.seen.values().next();
      if (!first.done) this.seen.delete(first.value);
    }
    this.state.messages = [...this.state.messages, event.message].slice(-20);
    this.options.onMessage?.(event.message);
  }
  async disconnect(): Promise<TwitchStatus> {
    const token = this.token;
    this.generation++;
    this.cleanup();
    this.token = undefined;
    this.identity = undefined;
    this.seen.clear();
    this.state = disconnectedTwitch();
    if (token) {
      try {
        await this.gateway.revoke(this.clientId, token.access_token);
      } catch {
        this.state.error =
          'Disconnected locally. Twitch could not confirm revocation; remove Tavi in Twitch Connections if needed.';
      }
    }
    return this.snapshot();
  }
  close() {
    this.generation++;
    this.cleanup();
    this.token = undefined;
    this.identity = undefined;
    this.seen.clear();
    this.state = disconnectedTwitch();
  }
}
