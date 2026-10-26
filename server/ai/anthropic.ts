// Anthropic Messages adapter using the official SDK with structured outputs
// (output_config.format), then the shared Zod validation.
import Anthropic from '@anthropic-ai/sdk';
import { decisionJsonSchema, decisionSchema, type Decision } from '../../shared/decision.js';
import { extractJson, systemPrompt, userPrompt } from './prompt.js';
import { ProviderError, type DecisionContext, type DecisionProvider } from './types.js';

export interface AnthropicOptions {
  model: string;
  apiKey?: string | undefined;
  baseURL?: string | undefined;
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  /** For tests: inject a client with the same messages.create surface. */
  client?: Pick<Anthropic, 'messages'>;
}
export class AnthropicProvider implements DecisionProvider {
  readonly info;
  private readonly client: Pick<Anthropic, 'messages'>;
  constructor(private readonly options: AnthropicOptions) {
    this.info = {
      id: 'anthropic',
      kind: 'ai',
      label: `Anthropic: ${options.model}`,
      model: options.model,
    } as const;
    this.client =
      options.client ??
      new Anthropic({
        ...(options.apiKey ? { apiKey: options.apiKey } : {}),
        ...(options.baseURL ? { baseURL: options.baseURL } : {}),
        // The decision manager owns timeouts and fallback; do not retry slow reactions.
        maxRetries: 0,
      });
  }
  async decide(context: DecisionContext, signal: AbortSignal): Promise<Decision> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create(
        {
          model: this.options.model,
          max_tokens: this.options.maxTokens ?? 4000,
          // A stable system prompt keeps the prefix cacheable across reactions.
          system: [
            { type: 'text', text: systemPrompt(context), cache_control: { type: 'ephemeral' } },
          ],
          messages: [{ role: 'user', content: userPrompt(context) }],
          output_config: {
            effort: this.options.effort ?? 'low',
            format: {
              type: 'json_schema',
              schema: decisionJsonSchema(context.character) as unknown as Record<string, unknown>,
            },
          },
        },
        { signal },
      );
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError)
        throw new ProviderError('Anthropic rate limit reached.', true);
      if (error instanceof Anthropic.AuthenticationError)
        throw new ProviderError('Anthropic API key was rejected.');
      if (error instanceof Anthropic.BadRequestError)
        throw new ProviderError('Anthropic rejected the request.');
      if (error instanceof Anthropic.APIError)
        throw new ProviderError(`Anthropic error ${String(error.status)}.`, true);
      throw error;
    }
    if (response.stop_reason === 'refusal') throw new ProviderError('Model declined to answer.');
    if (response.stop_reason === 'max_tokens')
      throw new ProviderError('Model ran out of output tokens.');
    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');
    const parsed = decisionSchema(context.character).safeParse(extractJson(text));
    if (!parsed.success)
      throw new ProviderError('Model output did not match the expression schema.');
    return parsed.data;
  }
}
