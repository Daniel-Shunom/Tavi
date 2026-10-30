import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { z } from 'zod';
import { decisionSchema, decisionJsonSchema, type Decision } from '../../shared/decision.js';
import { extractJson, systemPrompt, userPrompt } from './prompt.js';
import { ProviderError, type DecisionContext, type DecisionProvider } from './types.js';
import { createChatGPTStore, type ChatGPTStore } from './chatgpt-store.js';

class SignInError extends Error {}
const issuer = 'https://auth.openai.com';
const resource = 'https://api.openai.com/v1';
const scope = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const jwks = createRemoteJWKSet(new URL(issuer + '/.well-known/jwks.json'));
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  id_token: z.string().min(1),
  expires_in: z.number().positive(),
  scope: z.string(),
  token_type: z.literal('Bearer'),
});
const recordSchema = tokenSchema.extend({
  clientId: z.string().min(1),
  subject: z.string().min(1),
  email: z.string(),
  expiresAt: z.number(),
  model: z.string(),
});
type Record = z.infer<typeof recordSchema>;
const modelsSchema = z.object({
  models: z
    .array(z.object({ slug: z.string().min(1), display_name: z.string(), visibility: z.string() }))
    .max(500),
});
export type ChatGPTStatus = {
  phase: 'disconnected' | 'authorizing' | 'connected' | 'error';
  email: string | null;
  models: { id: string; name: string }[];
  error: string | null;
};
type Options = {
  store?: ChatGPTStore;
  request?: typeof fetch;
  verify?: (token: string, clientId: string) => Promise<JWTPayload>;
  onConnected?: () => Promise<void>;
};
type Attempt = {
  state: string;
  nonce: string;
  verifier: string;
  redirect: string;
  clientId: string | null;
  subject: string | null;
  generation: number;
  server: Server;
  timer: ReturnType<typeof setTimeout>;
};
const isAborted = (signal: AbortSignal) => signal.aborted;
const random = () => randomBytes(32).toString('base64url');
function matches(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Public-client OAuth. No app API key, client secret, or ChatGPT backend-api endpoints. */
export class ChatGPTConnection implements DecisionProvider {
  private record: Record | null = null;
  private usable = false;
  private attempt: Attempt | null = null;
  private generation = 0;
  private refresh: Promise<void> | null = null;
  private writes: Promise<void> = Promise.resolve();
  private persist(operation: () => Promise<void>) {
    const job = this.writes.then(operation);
    this.writes = job.catch(() => undefined);
    return job;
  }
  private readonly store: ChatGPTStore;
  private readonly request: typeof fetch;
  private state: ChatGPTStatus = { phase: 'disconnected', email: null, models: [], error: null };
  constructor(private readonly options: Options = {}) {
    this.store = options.store ?? createChatGPTStore();
    this.request = options.request ?? fetch;
  }
  get info() {
    return {
      id: 'chatgpt',
      kind: 'ai',
      label: 'ChatGPT: ' + (this.record?.model ?? 'not connected'),
      model: this.record?.model ?? '',
    } as const;
  }
  get configured() {
    return this.usable && !!this.record;
  }
  status(): ChatGPTStatus {
    return structuredClone(this.state);
  }
  async initialize() {
    try {
      const saved = await this.store.load();
      if (!saved) return;
      this.record = recordSchema.parse(JSON.parse(saved));
      await this.catalog();
      this.usable = true;
      this.state = { ...this.state, phase: 'connected', email: this.record.email, error: null };
    } catch {
      this.usable = false;
      this.state = {
        phase: 'error',
        email: null,
        models: [],
        error: 'Reconnect ChatGPT to restore access.',
      };
    }
  }
  private async verify(token: string, clientId: string) {
    if (this.options.verify) return this.options.verify(token, clientId);
    return (
      await jwtVerify(token, jwks, {
        issuer,
        audience: clientId,
        algorithms: ['RS256'],
        requiredClaims: ['exp', 'sub'],
      })
    ).payload;
  }
  private async exchange(params: URLSearchParams) {
    const response = await this.request(issuer + '/api/accounts/oauth/token', {
      method: 'POST',
      body: params,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new SignInError(
        `OpenAI rejected the sign-in code (HTTP ${String(response.status)}). Start a fresh sign-in.`,
      );
    return tokenSchema.parse(await response.json());
  }
  private stopAttempt() {
    const attempt = this.attempt;
    this.attempt = null;
    if (attempt) {
      clearTimeout(attempt.timer);
      attempt.server.close();
    }
  }
  async connect() {
    if (this.state.phase === 'authorizing') throw new Error('Sign-in is already in progress.');
    try {
      return await this.beginConnect();
    } catch {
      if (!this.attempt && this.status().phase === 'authorizing')
        this.state = {
          ...this.state,
          phase: this.configured ? 'connected' : 'error',
          error: 'Could not start sign-in. Try again.',
        };
      throw new Error('Could not start ChatGPT sign-in.');
    }
  }
  private async beginConnect() {
    this.state = { ...this.state, phase: 'authorizing', error: null };
    this.stopAttempt();
    const generation = ++this.generation;
    const host = await this.store.host();
    if (generation !== this.generation) throw new Error('Sign-in cancelled.');
    const state = random(),
      nonce = random(),
      verifier = random();
    const server = createServer((req, res) => {
      void this.callback(req.url ?? '', req.method ?? '', res);
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    if (generation !== this.generation) {
      server.close();
      throw new Error('Sign-in cancelled.');
    }
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Could not start sign-in callback.');
    }
    const redirect = `http://127.0.0.1:${String(address.port)}/auth/callback`;
    const timer = setTimeout(() => {
      this.stopAttempt();
      this.state.phase = this.configured ? 'connected' : 'error';
      this.state.error = 'Sign-in expired. Try again.';
    }, 300000);
    timer.unref();
    this.attempt = {
      state,
      nonce,
      verifier,
      redirect,
      clientId: this.record?.clientId ?? null,
      subject: this.record?.subject ?? null,
      generation,
      server,
      timer,
    };
    this.state = { ...this.state, phase: 'authorizing', error: null };
    const url = new URL(issuer + '/api/accounts/authorize');
    const params = {
      client_id: this.record?.clientId ?? 'dynamic_agent_client',
      ext_agent_host_id: host,
      response_type: 'code',
      redirect_uri: redirect,
      scope,
      resource,
      state,
      nonce,
      code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    };
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (this.record) url.searchParams.set('id_token_hint', this.record.id_token);
    else url.searchParams.set('agent_name_hint', 'Tavi');
    return { authorizationUrl: url.href };
  }
  private async callback(
    raw: string,
    method: string,
    response: import('node:http').ServerResponse,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('Referrer-Policy', 'no-referrer');
    let url: URL;
    try {
      url = new URL(raw, 'http://127.0.0.1');
    } catch {
      response.statusCode = 400;
      response.end('Invalid sign-in callback.');
      return;
    }
    const attempt = this.attempt;
    if (
      method !== 'GET' ||
      url.pathname !== '/auth/callback' ||
      !attempt ||
      !matches(url.searchParams.get('state') ?? '', attempt.state)
    ) {
      response.statusCode = 400;
      response.end('Invalid sign-in callback.');
      return;
    }
    this.stopAttempt();
    let failure = 'OpenAI did not return a complete account registration. Start a fresh sign-in.';
    try {
      if (url.searchParams.has('error'))
        throw new SignInError(
          'ChatGPT sign-in was not approved. Continue again and approve plan access.',
        );
      const code = url.searchParams.get('code');
      const clientId = url.searchParams.get('client_id') ?? attempt.clientId;
      if (
        !code ||
        !clientId ||
        clientId === 'dynamic_agent_client' ||
        (attempt.clientId && clientId !== attempt.clientId)
      )
        throw new Error('Incomplete ChatGPT registration.');
      failure =
        'Could not exchange the sign-in code with OpenAI. Check your connection and start a fresh sign-in.';
      const token = await this.exchange(
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          code,
          code_verifier: attempt.verifier,
          redirect_uri: attempt.redirect,
          resource,
        }),
      );
      failure = 'Could not verify the ChatGPT account identity. Check your PC clock and try again.';
      const claims = await this.verify(token.id_token, clientId);
      if (
        claims['nonce'] !== attempt.nonce ||
        !claims.sub ||
        (attempt.subject && claims.sub !== attempt.subject)
      )
        throw new Error('ChatGPT identity did not match this sign-in.');
      failure = 'ChatGPT plan access was not granted. Continue again and approve plan usage.';
      if (!token.scope.split(' ').includes('chatgpt.tokens.use.direct'))
        throw new Error('Approve ChatGPT plan usage to power Tavi.');
      if (attempt.generation !== this.generation) throw new Error('Sign-in was cancelled.');
      failure = 'Could not load eligible ChatGPT models. Check plan access and your connection.';
      const models = await this.loadModels(token.access_token);
      const model = models[0]?.id;
      if (!model)
        throw new SignInError(
          'This ChatGPT account returned no eligible models. Check your plan or workspace permissions.',
        );
      const next = {
        ...token,
        clientId,
        subject: claims.sub,
        email: typeof claims['email'] === 'string' ? claims['email'] : 'ChatGPT account',
        expiresAt: Date.now() + token.expires_in * 1000,
        model,
      };
      failure =
        'Windows could not securely save your account. Check access to Tavi�s data folder and retry.';
      await this.persist(async () => {
        if (attempt.generation !== this.generation) throw new Error('Sign-in cancelled.');
        await this.store.save(JSON.stringify(next));
        if (attempt.generation !== this.generation) throw new Error('Sign-in cancelled.');
        this.record = next;
        this.usable = true;
        this.state = { phase: 'connected', email: next.email, models, error: null };
      });
      if (attempt.generation !== this.generation) throw new Error('Sign-in cancelled.');
      failure =
        'ChatGPT connected, but Tavi could not save the provider selection. Select ChatGPT in Studio.';
      await this.options.onConnected?.();
      response.end('ChatGPT connected. Return to Tavi.');
    } catch (error) {
      const message = error instanceof SignInError ? error.message : failure;
      if (attempt.generation === this.generation)
        this.state = {
          ...this.state,
          phase: this.configured ? 'connected' : 'error',
          error: message,
        };
      response.statusCode = 400;
      response.end(message + ' Return to Tavi.');
    }
  }
  async selectModel(model: string) {
    if (!this.record || !this.state.models.some((entry) => entry.id === model))
      throw new Error('Choose an available ChatGPT model.');
    const generation = this.generation;
    await this.persist(async () => {
      if (!this.record || generation !== this.generation) throw new Error('Connection changed.');
      const next = { ...this.record, model };
      await this.store.save(JSON.stringify(next));
      if (generation === this.generation) this.record = next;
    });
  }
  private currentRecord() {
    return this.record;
  }
  private async access() {
    if (!this.record) throw new ProviderError('Connect ChatGPT first.');
    if (this.record.expiresAt > Date.now() + 60000) return this.record.access_token;
    this.refresh ??= this.refreshAccess().finally(() => {
      this.refresh = null;
    });
    await this.refresh;
    const refreshed = this.currentRecord();
    if (!refreshed) throw new ProviderError('Reconnect ChatGPT.');
    return refreshed.access_token;
  }
  private async refreshAccess() {
    const saved = this.record;
    const generation = this.generation;
    if (!saved) throw new ProviderError('Reconnect ChatGPT.');
    try {
      const token = await this.exchange(
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: saved.clientId,
          refresh_token: saved.refresh_token,
          resource,
        }),
      );
      const claims = await this.verify(token.id_token, saved.clientId);
      if (
        claims.sub !== saved.subject ||
        !token.scope.split(' ').includes('chatgpt.tokens.use.direct')
      )
        throw new Error('Access changed.');
      if (generation !== this.generation) throw new Error('Connection changed.');
      await this.persist(async () => {
        if (generation !== this.generation) throw new Error('Connection changed.');
        const next = {
          ...saved,
          ...token,
          model: this.record?.model ?? saved.model,
          expiresAt: Date.now() + token.expires_in * 1000,
        };
        await this.store.save(JSON.stringify(next));
        if (generation === this.generation) this.record = next;
      });
    } catch {
      if (generation === this.generation) {
        this.usable = false;
        this.state = {
          phase: 'error',
          email: null,
          models: [],
          error: 'Reconnect ChatGPT to restore access.',
        };
      }
      throw new ProviderError('Reconnect ChatGPT to restore access.');
    }
  }
  private async catalog() {
    const token = await this.access();
    this.state.models = await this.loadModels(token);
    if (this.record && !this.state.models.some((model) => model.id === this.record?.model))
      this.record.model = this.state.models[0]?.id ?? '';
    if (!this.record?.model) throw new Error('No eligible ChatGPT models.');
  }
  private async loadModels(token: string) {
    const response = await this.request(resource + '/models', {
      headers: { authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new SignInError(
        `OpenAI could not provide models (HTTP ${String(response.status)}). Check plan access and try again.`,
      );
    const result = modelsSchema.parse(await response.json());
    return result.models
      .filter((model) => model.visibility === 'list')
      .map((model) => ({ id: model.slug, name: model.display_name }));
  }
  async disconnect() {
    ++this.generation;
    this.stopAttempt();
    const saved = this.record;
    this.record = null;
    this.usable = false;
    this.state = { phase: 'disconnected', email: null, models: [], error: null };
    await this.persist(() => this.store.clear());
    if (saved) {
      try {
        await this.request(issuer + '/api/accounts/oauth/revoke', {
          method: 'POST',
          body: new URLSearchParams({
            client_id: saved.clientId,
            token: saved.refresh_token,
            token_type_hint: 'refresh_token',
          }),
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        /* Local credentials have been removed. */
      }
    }
  }
  close() {
    ++this.generation;
    this.stopAttempt();
  }
  async decide(context: DecisionContext, signal: AbortSignal): Promise<Decision> {
    const generation = this.generation;
    if (!this.configured) throw new ProviderError('Reconnect ChatGPT.');
    const token = await this.access();
    if (generation !== this.generation || signal.aborted)
      throw new ProviderError('Connection changed.');
    const response = await this.request(resource + '/responses', {
      method: 'POST',
      signal,
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.record?.model,
        instructions: systemPrompt(context),
        input: [{ role: 'user', content: userPrompt(context) }],
        store: false,
        stream: true,
        text: {
          format: {
            type: 'json_schema',
            name: 'tavi_reaction',
            strict: true,
            schema: decisionJsonSchema(context.character),
          },
        },
      }),
    });
    if ((response.status === 401 || response.status === 403) && generation === this.generation) {
      this.usable = false;
      this.state = { ...this.state, phase: 'error', error: 'Reconnect ChatGPT to restore access.' };
    }
    if (!response.ok || !response.body)
      throw new ProviderError('ChatGPT request unavailable. Check your plan allowance.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '',
      text = '',
      completed = false,
      size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1000000) throw new ProviderError('ChatGPT response exceeded limits.');
        buffer = (buffer + decoder.decode(chunk.value, { stream: true })).replace(/\r\n/g, '\n');
        let end: number;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const raw = frame
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n');
          if (!raw || raw === '[DONE]') continue;
          const event = z
            .object({ type: z.string(), delta: z.string().optional() })
            .loose()
            .parse(JSON.parse(raw));
          if (event.type === 'response.output_text.delta') text += event.delta ?? '';
          if (
            event.type === 'response.failed' ||
            event.type === 'response.incomplete' ||
            event.type === 'error'
          )
            throw new ProviderError(
              'ChatGPT could not complete this reaction. Check your plan allowance.',
            );
          if (event.type === 'response.completed') completed = true;
        }
      }
    } finally {
      await reader.cancel();
    }
    if (!completed || generation !== this.generation || isAborted(signal))
      throw new ProviderError('ChatGPT response was interrupted.');
    return decisionSchema(context.character).parse(extractJson(text));
  }
}
