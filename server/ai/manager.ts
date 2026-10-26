// Chooses the active provider, enforces timeouts, cancellation and a usage budget, and falls back
// to deterministic rules. Reports honestly which one actually decided.
import { connectionMethods, type AiStatus, type Selection } from '../../shared/ai.js';
import type { Decision } from '../../shared/decision.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAICompatibleProvider } from './openai.js';
import { RulesProvider } from './rules.js';
import type { DecisionContext, DecisionProvider, ProviderInfo } from './types.js';

export interface AiSettings {
  openai: {
    baseUrl: string;
    model: string;
    apiKey?: string | undefined;
    structured: 'json_schema' | 'json_object' | 'none';
  };
  anthropic: {
    model: string;
    apiKey?: string | undefined;
    baseURL?: string | undefined;
    effort: 'low' | 'medium' | 'high';
  };
  /** Which provider to use. Keys never leave the service. */
  active: 'rules' | 'openai' | 'anthropic';
  timeoutMs: number;
  maxPerMinute: number;
  maxPerSession: number;
}
export { providerIds, selectionSchema, type Selection } from '../../shared/ai.js';

export function settingsFromEnv(env: NodeJS.ProcessEnv = process.env): AiSettings {
  const number = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  const structured = env['TAVI_OPENAI_STRUCTURED'];
  const effort = env['TAVI_ANTHROPIC_EFFORT'];
  const active = env['TAVI_AI_PROVIDER'];
  return {
    openai: {
      baseUrl: env['TAVI_OPENAI_BASE_URL'] ?? 'https://api.openai.com/v1',
      model: env['TAVI_OPENAI_MODEL'] ?? 'gpt-4o-mini',
      apiKey: env['TAVI_OPENAI_API_KEY'] ?? env['OPENAI_API_KEY'],
      structured:
        structured === 'json_object' || structured === 'none' ? structured : 'json_schema',
    },
    anthropic: {
      model: env['TAVI_ANTHROPIC_MODEL'] ?? 'claude-opus-5-5',
      apiKey: env['ANTHROPIC_API_KEY'],
      baseURL: env['ANTHROPIC_BASE_URL'],
      effort: effort === 'medium' || effort === 'high' ? effort : 'low',
    },
    active: active === 'openai' || active === 'anthropic' ? active : 'rules',
    timeoutMs: number(env['TAVI_AI_TIMEOUT_MS'], 8000),
    maxPerMinute: number(env['TAVI_AI_MAX_PER_MINUTE'], 8),
    maxPerSession: number(env['TAVI_AI_MAX_PER_SESSION'], 400),
  };
}

export interface DecisionResult {
  decision: Decision;
  by: ProviderInfo;
  /** Present when an AI provider was skipped or failed and rules decided instead. */
  fallbackReason?: string;
}
export type ProviderFactory = (
  id: 'openai' | 'anthropic',
  settings: AiSettings,
) => DecisionProvider;
const defaultFactory: ProviderFactory = (id, settings) =>
  id === 'openai'
    ? new OpenAICompatibleProvider(settings.openai)
    : new AnthropicProvider(settings.anthropic);

export class AiManager {
  readonly rules = new RulesProvider();
  private provider: DecisionProvider | null = null;
  private calls: number[] = [];
  private total = 0;
  private last: AiStatus['last'] = null;
  constructor(
    private settings: AiSettings = settingsFromEnv(),
    private readonly factory: ProviderFactory = defaultFactory,
    private readonly now: () => number = Date.now,
  ) {
    this.rebuild();
  }
  private configured(id: 'openai' | 'anthropic') {
    if (id === 'anthropic') return !!this.settings.anthropic.apiKey;
    // Local servers (LM Studio, Ollama) need no key.
    return !!this.settings.openai.apiKey || !/api\.openai\.com/.test(this.settings.openai.baseUrl);
  }
  private rebuild() {
    const id = this.settings.active;
    this.provider = id === 'rules' || !this.configured(id) ? null : this.factory(id, this.settings);
  }
  select(selection: Selection) {
    const settings = structuredClone(this.settings);
    settings.active = selection.provider;
    if (selection.provider === 'openai') {
      if (selection.model) settings.openai.model = selection.model;
      if (selection.baseUrl) settings.openai.baseUrl = selection.baseUrl;
    }
    if (selection.provider === 'anthropic' && selection.model)
      settings.anthropic.model = selection.model;
    settings.openai.apiKey = this.settings.openai.apiKey;
    settings.anthropic.apiKey = this.settings.anthropic.apiKey;
    this.settings = settings;
    this.rebuild();
    return this.status();
  }
  /** Non-secret selection for persistence. */
  selection(): Selection & { openaiModel: string; anthropicModel: string; openaiBaseUrl: string } {
    return {
      provider: this.settings.active,
      openaiModel: this.settings.openai.model,
      anthropicModel: this.settings.anthropic.model,
      openaiBaseUrl: this.settings.openai.baseUrl,
    };
  }
  get active(): ProviderInfo {
    return this.provider?.info ?? this.rules.info;
  }
  status(): AiStatus {
    const now = this.now();
    this.calls = this.calls.filter((at) => now - at < 60_000);
    return {
      active: this.active,
      connections: [...connectionMethods],
      providers: [
        { id: 'rules', label: 'Rules (not AI)', configured: true },
        {
          id: 'openai',
          label: 'OpenAI-compatible',
          configured: this.configured('openai'),
          model: this.settings.openai.model,
          baseUrl: this.settings.openai.baseUrl,
          hint: 'Set TAVI_OPENAI_API_KEY (or a local TAVI_OPENAI_BASE_URL) for the service.',
        },
        {
          id: 'anthropic',
          label: 'Anthropic',
          configured: this.configured('anthropic'),
          model: this.settings.anthropic.model,
          hint: 'Set ANTHROPIC_API_KEY for the service.',
        },
      ],
      calls: this.total,
      budget: {
        perMinute: this.settings.maxPerMinute,
        perSession: this.settings.maxPerSession,
        remainingSession: Math.max(0, this.settings.maxPerSession - this.total),
      },
      last: this.last,
    };
  }
  /**
   * Decide with the active provider, bounded by timeout, cancellation and budget. Falls back to
   * rules on any failure. Throws only if `signal` was aborted by the caller (superseded).
   */
  async decide(context: DecisionContext, signal: AbortSignal): Promise<DecisionResult> {
    const started = this.now();
    const provider = this.provider;
    const fallback = async (reason: string): Promise<DecisionResult> => {
      const decision = await this.rules.decide(context);
      this.last = {
        by: this.rules.info,
        latencyMs: this.now() - started,
        outcome: 'fallback',
        error: reason,
        at: this.now(),
      };
      return { decision, by: this.rules.info, fallbackReason: reason };
    };
    if (!provider) {
      const decision = await this.rules.decide(context);
      this.last = {
        by: this.rules.info,
        latencyMs: this.now() - started,
        outcome: decision.react ? 'reaction' : 'no-reaction',
        at: this.now(),
      };
      return { decision, by: this.rules.info };
    }
    this.calls = this.calls.filter((at) => started - at < 60_000);
    if (this.total >= this.settings.maxPerSession) return fallback('Session AI budget used up.');
    if (this.calls.length >= this.settings.maxPerMinute)
      return fallback('AI rate budget reached; using rules for now.');
    this.calls.push(started);
    this.total++;
    const controller = new AbortController();
    const abort = () => {
      controller.abort(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => {
      controller.abort(new Error('timeout'));
    }, this.settings.timeoutMs);
    try {
      const decision = await provider.decide(context, controller.signal);
      this.last = {
        by: provider.info,
        latencyMs: this.now() - started,
        outcome: decision.react ? 'reaction' : 'no-reaction',
        at: this.now(),
      };
      return { decision, by: provider.info };
    } catch (error) {
      if (signal.aborted) throw error;
      const reason = controller.signal.aborted
        ? `${provider.info.label} timed out.`
        : error instanceof Error
          ? error.message.slice(0, 160)
          : 'Provider failed.';
      return await fallback(reason);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }
}
