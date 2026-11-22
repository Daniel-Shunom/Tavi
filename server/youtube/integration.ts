import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { disconnectedYoutube, YOUTUBE_SCOPE } from '../../shared/youtube.js';
import type { ChatMessage } from '../../shared/twitch.js';
import type { ChatChange } from '../twitch/gateway.js';
import {
  createYoutubeGateway,
  YoutubeRequestError,
  type YoutubeBroadcast,
  type YoutubeCredentials,
  type YoutubeGateway,
  type YoutubeToken,
} from './gateway.js';

export interface YoutubeOptions {
  credentials?: YoutubeCredentials;
  gateway?: YoutubeGateway;
  onMessage?: (message: ChatMessage) => void;
  onModeration?: (event: Extract<ChatChange, { type: 'delete' | 'clearUser' }>) => void;
}
/** Tokens and PKCE material stay in service memory, never in status or saved character data. */
export class YoutubeIntegration {
  private readonly gateway: YoutubeGateway | undefined;
  private state;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: { state: string; verifier: string; expiresAt: number } | undefined;
  private token: YoutubeToken | undefined;
  private expiresAt = 0;
  private broadcasts: YoutubeBroadcast[] = [];
  private pageToken: string | undefined;
  private firstPage = true;
  private seen = new Set<string>();
  private failures = 0;
  private authFailures = 0;
  private discoveryOperation = 0;
  private pollingInterval = 10000;
  constructor(private readonly options: YoutubeOptions = {}) {
    this.gateway =
      options.gateway ??
      (options.credentials ? createYoutubeGateway(options.credentials) : undefined);
    this.state = disconnectedYoutube(!!options.credentials && !!this.gateway);
  }
  snapshot() {
    return structuredClone(this.state);
  }
  private later(run: number, delay: number, task: () => Promise<void>) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (run === this.generation) void task();
    }, delay);
    this.timer.unref();
  }
  connect() {
    if (!this.state.configured || !this.options.credentials) {
      this.state.error =
        'YouTube sign-in is not available in this version of Tavi yet. Please use a version with YouTube support enabled.';
      return this.snapshot();
    }
    if (!['disconnected', 'error'].includes(this.state.phase)) return this.snapshot();
    this.close();
    this.state = disconnectedYoutube(true);
    const verifier = randomBytes(48).toString('base64url');
    const state = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + 10 * 60 * 1000;
    this.pending = { state, verifier, expiresAt };
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: this.options.credentials.clientId,
      redirect_uri: this.options.credentials.redirectUri,
      response_type: 'code',
      scope: YOUTUBE_SCOPE,
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    }).toString();
    this.state.phase = 'authorizing';
    this.state.authorization = { url: url.href, expiresAt };
    this.later(this.generation, expiresAt - Date.now(), () => {
      this.pending = undefined;
      this.state.authorization = null;
      this.state.phase = 'error';
      this.state.error = 'Google sign-in expired. Connect again.';
      return Promise.resolve();
    });
    return this.snapshot();
  }
  async authorize(state: string, code: string | undefined, denied: boolean) {
    const pending = this.pending;
    if (
      !pending ||
      pending.expiresAt < Date.now() ||
      Buffer.byteLength(state) !== Buffer.byteLength(pending.state) ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(pending.state))
    )
      return false;
    this.pending = undefined; // Consume once, including denial and failed exchanges.
    clearTimeout(this.timer);
    this.state.authorization = null;
    const run = this.generation;
    if (denied || !code) {
      this.state.phase = 'error';
      this.state.error = 'Google sign-in was not approved. You can try again.';
      return true;
    }
    this.state.phase = 'connecting';
    try {
      const token = await this.gateway?.exchange(code, pending.verifier);
      if (!token) throw new YoutubeRequestError('auth');
      if (run !== this.generation) {
        void this.gateway?.revoke(token.refresh_token ?? token.access_token).catch(() => undefined);
        return false;
      }
      this.token = token;
      if (token.scope && !token.scope.split(' ').includes(YOUTUBE_SCOPE))
        throw new YoutubeRequestError('permission');
      this.expiresAt = Date.now() + token.expires_in * 1000;
      await this.attach(run);
    } catch (error) {
      if (run === this.generation) this.fail(error);
    }
    return true;
  }
  private async attach(run: number) {
    try {
      const access = await this.access();
      if (run !== this.generation) return;
      const account = await this.gateway?.account(access);
      if (!account || run !== this.generation) return;
      this.state.account = account;
      this.failures = 0;
      this.authFailures = 0;
      await this.discover(run);
    } catch (error) {
      this.retry(run, error, () => this.attach(run));
    }
  }
  private fail(error: unknown) {
    clearTimeout(this.timer);
    this.state.phase = 'error';
    this.state.error =
      error instanceof YoutubeRequestError
        ? {
            auth: 'Google access expired or was revoked. Disconnect and reconnect YouTube.',
            quota:
              'YouTube API quota is exhausted. Try again after your Google project quota resets.',
            rate_limit: 'YouTube is receiving requests too quickly. Try connecting again shortly.',
            ended: 'This broadcast chat has ended or is disabled.',
            permission:
              'YouTube access is unavailable. Check your channel, read-only permission and YouTube Data API configuration.',
            unavailable: 'YouTube is unavailable. Try connecting again.',
          }[error.kind]
        : 'Could not connect to YouTube. Check the local configuration and try again.';
  }
  private async access() {
    const token = this.token;
    if (!token || !this.gateway) throw new YoutubeRequestError('auth');
    if (this.expiresAt > Date.now() + 60000) return token.access_token;
    if (!token.refresh_token) throw new YoutubeRequestError('auth');
    const generation = this.generation;
    const next = await this.gateway.refresh(token.refresh_token);
    if (generation !== this.generation) throw new YoutubeRequestError('auth');
    this.token = { ...next, refresh_token: next.refresh_token ?? token.refresh_token };
    this.expiresAt = Date.now() + next.expires_in * 1000;
    return next.access_token;
  }
  private retry(run: number, error: unknown, task: () => Promise<void>) {
    if (run !== this.generation) return;
    if (
      error instanceof YoutubeRequestError &&
      error.kind === 'auth' &&
      this.token?.refresh_token &&
      this.authFailures++ === 0
    ) {
      this.expiresAt = 0;
      this.state.phase = 'reconnecting';
      this.later(run, 1000, task);
      return;
    }
    if (error instanceof YoutubeRequestError && error.kind === 'ended') {
      this.broadcasts = this.broadcasts.filter((item) => item.id !== this.state.broadcastId);
      this.state.broadcasts = this.broadcasts.map(({ id, title }) => ({ id, title }));
      this.state.broadcastId = null;
      this.state.messages = [];
      this.state.phase = 'waiting';
      this.later(run, 60000, () => this.discover(run));
      return;
    }
    if (
      error instanceof YoutubeRequestError &&
      (error.kind === 'unavailable' || error.kind === 'rate_limit') &&
      ++this.failures <= 5
    ) {
      this.state.phase = 'reconnecting';
      const backoff = Math.min(60000, 2000 * 2 ** this.failures);
      this.later(
        run,
        error.kind === 'rate_limit' ? Math.max(backoff, this.pollingInterval) : backoff,
        task,
      );
    } else this.fail(error);
  }
  private async discover(run: number) {
    const operation = ++this.discoveryOperation;
    try {
      const access = await this.access();
      if (run !== this.generation || operation !== this.discoveryOperation) return;
      const broadcasts = await this.gateway?.broadcasts(access);
      if (!broadcasts || run !== this.generation || operation !== this.discoveryOperation) return;
      this.failures = 0;
      this.authFailures = 0;
      this.broadcasts = broadcasts;
      this.state.broadcasts = broadcasts.map(({ id, title }) => ({ id, title }));
      this.state.phase = 'waiting';
      this.state.error = null;
      if (broadcasts.length === 1 && broadcasts[0]) this.select(broadcasts[0].id);
      else this.later(run, 60000, () => this.discover(run));
    } catch (error) {
      if (operation === this.discoveryOperation) this.retry(run, error, () => this.discover(run));
    }
  }
  select(id: string) {
    const broadcast = this.broadcasts.find((item) => item.id === id);
    if (!this.token || !broadcast || this.state.phase !== 'waiting') return false;
    ++this.discoveryOperation;
    clearTimeout(this.timer);
    this.state.broadcastId = id;
    this.state.phase = 'connecting';
    this.state.messages = [];
    this.pageToken = undefined;
    this.firstPage = true;
    this.pollingInterval = 10000;
    this.seen.clear();
    void this.poll(this.generation, broadcast.chatId);
    return true;
  }
  private async poll(run: number, chatId: string) {
    try {
      const access = await this.access();
      if (run !== this.generation) return;
      const page = await this.gateway?.messages(access, chatId, this.pageToken);
      if (!page || run !== this.generation) return;
      if (page.offlineAt) throw new YoutubeRequestError('ended');
      this.pollingInterval = Math.max(10000, page.pollingIntervalMillis);
      for (const item of page.items) {
        if (this.seen.has(item.id)) continue;
        this.seen.add(item.id);
        // Initial history is never replayed into behaviour or shown as fresh live chat.
        if (this.firstPage) continue;
        const snippet = item.snippet;
        if (snippet.type === 'messageDeletedEvent' && snippet.messageDeletedDetails) {
          const id = 'youtube:' + snippet.messageDeletedDetails.deletedMessageId;
          this.state.messages = this.state.messages.filter((message) => message.id !== id);
          this.options.onModeration?.({ type: 'delete', id });
        } else if (snippet.type === 'userBannedEvent' && snippet.userBannedDetails) {
          const userId = 'youtube:' + snippet.userBannedDetails.bannedUserDetails.channelId;
          this.state.messages = this.state.messages.filter((message) => message.userId !== userId);
          this.options.onModeration?.({ type: 'clearUser', userId });
        } else if (
          snippet.type === 'textMessageEvent' &&
          item.authorDetails &&
          snippet.displayMessage
        ) {
          const message: ChatMessage = {
            id: ('youtube:' + item.id).slice(0, 200),
            userId: ('youtube:' + item.authorDetails.channelId).slice(0, 100),
            author: item.authorDetails.displayName.slice(0, 100),
            text: snippet.displayMessage.slice(0, 500),
            receivedAt: Date.now(),
          };
          this.state.messages = [...this.state.messages, message].slice(-20);
          this.options.onMessage?.(message);
        }
      }
      this.seen = new Set([...this.seen].slice(-2000));
      this.firstPage = false;
      this.pageToken = page.nextPageToken;
      if (!this.pageToken) throw new YoutubeRequestError('ended');
      this.failures = 0;
      this.authFailures = 0;
      this.state.phase = 'connected';
      this.state.error = null;
      // REST milestone: respect Google's interval with a 10s floor to limit quota use.
      this.later(run, this.pollingInterval, () => this.poll(run, chatId));
    } catch (error) {
      this.retry(run, error, () => this.poll(run, chatId));
    }
  }
  async disconnect() {
    const token = this.token;
    this.close();
    if (token)
      await this.gateway?.revoke(token.refresh_token ?? token.access_token).catch(() => undefined);
    return this.snapshot();
  }
  close() {
    ++this.generation;
    ++this.discoveryOperation;
    clearTimeout(this.timer);
    this.pending = undefined;
    this.token = undefined;
    this.broadcasts = [];
    this.seen.clear();
    this.failures = 0;
    this.authFailures = 0;
    this.state = disconnectedYoutube(this.state.configured);
  }
}
