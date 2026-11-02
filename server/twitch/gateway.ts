import { z } from 'zod';
import { ApiClient } from '@twurple/api';
import { StaticAuthProvider } from '@twurple/auth';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { TWITCH_SCOPES, type ChatMessage } from '../../shared/twitch.js';
import { mischiefFor, type StreamEvent, type StreamEventBody } from '../../shared/streamEvents.js';
const deviceSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' && url.hostname === 'www.twitch.tv' && url.pathname === '/activate'
    );
  }),
  expires_in: z.number().positive(),
  interval: z.number().positive(),
});
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
  scope: z.array(z.string()),
});
const identitySchema = z.object({
  client_id: z.string(),
  login: z.string(),
  user_id: z.string(),
  scopes: z.array(z.string()),
  expires_in: z.number().nonnegative(),
});
export type DeviceGrant = z.infer<typeof deviceSchema>;
export type Token = z.infer<typeof tokenSchema>;
export type Identity = z.infer<typeof identitySchema>;
export type PollResult = { kind: 'pending' | 'slow_down' } | { kind: 'token'; token: Token };
export type ChatChange =
  | { type: 'message'; message: ChatMessage }
  | { type: 'delete'; id: string }
  | { type: 'clearUser'; userId: string }
  | { type: 'clear' }
  /** Follows, raids, subs, gifts, cheers, hype trains, channel-point redemptions. */
  | { type: 'event'; event: StreamEvent };
export type ListenerInput = {
  clientId: string;
  token: Token;
  identity: Identity;
  onChange: (event: ChatChange) => void;
  onStatus: (status: 'connected' | 'reconnecting' | 'revoked' | 'failed') => void;
};
export interface TwitchGateway {
  device(clientId: string): Promise<DeviceGrant>;
  poll(clientId: string, deviceCode: string): Promise<PollResult>;
  validate(accessToken: string): Promise<Identity>;
  refresh(clientId: string, refreshToken: string): Promise<Token>;
  revoke(clientId: string, accessToken: string): Promise<void>;
  listen(input: ListenerInput): () => void;
}
export class TwitchRequestError extends Error {
  constructor(
    readonly kind: 'denied' | 'expired' | 'invalid_token' | 'unavailable' | 'invalid_client',
  ) {
    super(kind);
  }
}
export function createTwitchGateway(request: typeof fetch = fetch): TwitchGateway {
  async function post(path: string, values: Record<string, string>) {
    return request('https://id.twitch.tv/oauth2/' + path, {
      method: 'POST',
      body: new URLSearchParams(values),
      signal: AbortSignal.timeout(10000),
    });
  }
  async function tokenResponse(response: Response): Promise<Token> {
    if (!response.ok)
      throw new TwitchRequestError(
        response.status === 400 || response.status === 401 ? 'invalid_token' : 'unavailable',
      );
    return tokenSchema.parse(await response.json());
  }
  return {
    async device(clientId) {
      const response = await post('device', {
        client_id: clientId,
        scopes: TWITCH_SCOPES.join(' '),
      });
      if (!response.ok)
        throw new TwitchRequestError(response.status === 400 ? 'invalid_client' : 'unavailable');
      return deviceSchema.parse(await response.json());
    },
    async poll(clientId, deviceCode) {
      const response = await post('token', {
        client_id: clientId,
        device_code: deviceCode,
        scopes: TWITCH_SCOPES.join(' '),
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });
      if (response.ok) return { kind: 'token', token: tokenSchema.parse(await response.json()) };
      const body = z
        .object({ message: z.string().optional(), error: z.string().optional() })
        .parse(await response.json());
      const message = (body.message ?? body.error ?? '').toLowerCase();
      if (message.includes('authorization_pending')) return { kind: 'pending' };
      if (message.includes('slow_down')) return { kind: 'slow_down' };
      if (message.includes('access_denied')) throw new TwitchRequestError('denied');
      if (message.includes('expired') || message.includes('invalid device code'))
        throw new TwitchRequestError('expired');
      throw new TwitchRequestError('unavailable');
    },
    async validate(accessToken) {
      const response = await request('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: 'OAuth ' + accessToken },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw new TwitchRequestError(response.status === 401 ? 'invalid_token' : 'unavailable');
      return identitySchema.parse(await response.json());
    },
    async refresh(clientId, refreshToken) {
      return tokenResponse(
        await post('token', {
          client_id: clientId,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      );
    },
    async revoke(clientId, accessToken) {
      const response = await post('revoke', { client_id: clientId, token: accessToken });
      if (!response.ok) throw new TwitchRequestError('unavailable');
    },
    listen({ clientId, token, identity, onChange, onStatus }) {
      const authProvider = new StaticAuthProvider(clientId, token.access_token, token.scope);
      const apiClient = new ApiClient({ authProvider, logger: { minLevel: 'critical' } });
      const listener = new EventSubWsListener({ apiClient, logger: { minLevel: 'critical' } });
      let active = true;
      let chatSubscribed = false;
      listener.onSubscriptionCreateSuccess((subscription) => {
        if (subscription === chatSubscription) {
          chatSubscribed = true;
          if (active) onStatus('connected');
        }
      });
      listener.onSubscriptionCreateFailure((subscription) => {
        // Only chat is required. Stream events may be unavailable (subs, cheers, channel
        // points and hype trains need an affiliate channel); Tavi simply does not see them.
        if (active && subscription === chatSubscription) onStatus('failed');
      });
      listener.onUserSocketDisconnect(() => {
        if (active) onStatus('reconnecting');
      });
      listener.onUserSocketConnect(() => {
        if (active && chatSubscribed) onStatus('connected');
      });
      listener.onRevoke(() => {
        if (active) onStatus('revoked');
      });
      const chatSubscription = listener.onChannelChatMessage(
        identity.user_id,
        identity.user_id,
        (event) => {
          if (active)
            onChange({
              type: 'message',
              message: {
                id: event.messageId,
                userId: event.chatterId,
                author: event.chatterDisplayName.slice(0, 100),
                text: event.messageText.slice(0, 500),
                receivedAt: Date.now(),
              },
            });
        },
      );
      listener.onChannelChatMessageDelete(identity.user_id, identity.user_id, (event) => {
        if (active) onChange({ type: 'delete', id: event.messageId });
      });
      listener.onChannelChatClearUserMessages(identity.user_id, identity.user_id, (event) => {
        if (active) onChange({ type: 'clearUser', userId: event.userId });
      });
      listener.onChannelChatClear(identity.user_id, identity.user_id, () => {
        if (active) onChange({ type: 'clear' });
      });
      const emit = (id: string, body: StreamEventBody) => {
        if (active) onChange({ type: 'event', event: { ...body, id, receivedAt: Date.now() } });
      };
      const me = identity.user_id;
      listener.onChannelFollow(me, me, (event) => {
        emit(`follow:${event.userId}`, { kind: 'follow', user: event.userDisplayName });
      });
      listener.onChannelRaidTo(me, (event) => {
        emit(`raid:${event.raidingBroadcasterId}:${String(Date.now())}`, {
          kind: 'raid',
          from: event.raidingBroadcasterDisplayName,
          viewers: event.viewers,
        });
      });
      listener.onChannelSubscription(me, (event) => {
        emit(`sub:${event.userId}:${String(Date.now())}`, {
          kind: 'subscription',
          user: event.userDisplayName,
          tier: event.tier,
          gifted: event.isGift,
        });
      });
      listener.onChannelSubscriptionGift(me, (event) => {
        emit(`gift:${event.gifterId ?? 'anon'}:${String(Date.now())}`, {
          kind: 'gift',
          user: event.isAnonymous ? null : event.gifterDisplayName,
          count: Math.max(1, Math.min(1000, event.amount)),
        });
      });
      listener.onChannelCheer(me, (event) => {
        emit(`cheer:${event.userId ?? 'anon'}:${String(Date.now())}`, {
          kind: 'cheer',
          user: event.isAnonymous ? null : event.userDisplayName,
          bits: event.bits,
        });
      });
      listener.onChannelRedemptionAdd(me, (event) => {
        emit(`redeem:${event.id}`, {
          kind: 'redemption',
          user: event.userDisplayName,
          reward: event.rewardTitle.slice(0, 100),
          mischief: mischiefFor(event.rewardTitle),
        });
      });
      const level = (value: number) => Math.max(1, Math.min(100, value));
      listener.onChannelHypeTrainBeginV2(me, (event) => {
        emit(`hype:${event.id}:begin`, {
          kind: 'hype-train',
          phase: 'begin',
          level: level(event.level),
        });
      });
      listener.onChannelHypeTrainProgressV2(me, (event) => {
        emit(`hype:${event.id}:${String(event.level)}`, {
          kind: 'hype-train',
          phase: 'progress',
          level: level(event.level),
        });
      });
      listener.onChannelHypeTrainEndV2(me, (event) => {
        emit(`hype:${event.id}:end`, {
          kind: 'hype-train',
          phase: 'end',
          level: level(event.level),
        });
      });
      listener.start();
      return () => {
        active = false;
        listener.stop();
      };
    },
  };
}
