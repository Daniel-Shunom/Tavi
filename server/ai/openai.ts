// OpenAI-compatible Chat Completions adapter. Works with OpenAI, OpenRouter, LM Studio, Ollama
// (/v1), vLLM and similar servers by changing the base URL and model.
import { decisionJsonSchema, decisionSchema, type Decision } from '../../shared/decision.js';
import { extractJson, systemPrompt, userPrompt } from './prompt.js';
import { ProviderError, type DecisionContext, type DecisionProvider } from './types.js';

export interface OpenAIOptions {
  baseUrl: string;
  model: string;
  apiKey?: string | undefined;
  /**
   * json_schema: strict structured output (OpenAI, OpenRouter, LM Studio, recent Ollama).
   * json_object: JSON mode only. none: prompt-only, for servers without either.
   */
  structured?: 'json_schema' | 'json_object' | 'none';
  maxTokens?: number;
  fetch?: typeof fetch;
}
export class OpenAICompatibleProvider implements DecisionProvider {
  readonly info;
  constructor(private readonly options: OpenAIOptions) {
    this.info = {
      id: 'openai',
      kind: 'ai',
      label: `OpenAI-compatible: ${options.model}`,
      model: options.model,
    } as const;
  }
  async decide(context: DecisionContext, signal: AbortSignal): Promise<Decision> {
    const mode = this.options.structured ?? 'json_schema';
    const body: Record<string, unknown> = {
      model: this.options.model,
      max_tokens: this.options.maxTokens ?? 600,
      messages: [
        { role: 'system', content: systemPrompt(context) },
        { role: 'user', content: userPrompt(context) },
      ],
    };
    if (mode === 'json_schema')
      body['response_format'] = {
        type: 'json_schema',
        json_schema: {
          name: 'tavi_reaction',
          strict: true,
          schema: decisionJsonSchema(context.character),
        },
      };
    else if (mode === 'json_object') body['response_format'] = { type: 'json_object' };
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.options.apiKey) headers['authorization'] = `Bearer ${this.options.apiKey}`;
    const request = this.options.fetch ?? fetch;
    const response = await request(`${this.options.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      // Never echo response bodies verbatim: they can contain request details.
      throw new ProviderError(
        `Provider returned HTTP ${String(response.status)}`,
        response.status === 429 || response.status >= 500,
      );
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string | null; refusal?: string | null } }[];
    };
    const message = payload.choices?.[0]?.message;
    if (message?.refusal) throw new ProviderError('Provider declined to answer.');
    if (!message?.content) throw new ProviderError('Provider returned no content.');
    const parsed = decisionSchema(context.character).safeParse(extractJson(message.content));
    if (!parsed.success)
      throw new ProviderError('Provider output did not match the expression schema.');
    return parsed.data;
  }
}
