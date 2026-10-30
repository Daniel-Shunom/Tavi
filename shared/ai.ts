// Public, non-secret AI provider status shared by the service and the studio.
import { z } from 'zod';

export const providerIds = ['rules', 'chatgpt', 'openai', 'anthropic'] as const;
export const chatgptStatusSchema = z.object({
  phase: z.enum(['disconnected', 'authorizing', 'connected', 'error']),
  email: z.string().nullable(),
  models: z.array(z.object({ id: z.string(), name: z.string() })),
  error: z.string().nullable(),
});
export type ChatGPTStatus = z.infer<typeof chatgptStatusSchema>;
/** Supported account connection paths; OAuth is listed only when the provider documents it. */
export const connectionMethods = [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    method: 'oauth',
    availability: 'supported',
    detail: 'Continue with ChatGPT. Uses your eligible plan allowance.',
  },
  {
    id: 'openai',
    label: 'OpenAI API',
    method: 'api-key',
    availability: 'supported',
    detail: 'Separate API billing with a service API key.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic API',
    method: 'api-key',
    availability: 'supported',
    detail: 'The model API uses Console credentials. Claude Code OAuth is not a Tavi connection.',
  },
  {
    id: 'google-gemini',
    label: 'Google Gemini API',
    method: 'oauth',
    availability: 'setup-required',
    detail:
      'Google documents OAuth for Gemini, but Tavi needs a registered OAuth client and Cloud project before account sign-in can be enabled.',
  },
  {
    id: 'local',
    label: 'Local model endpoint',
    method: 'local',
    availability: 'supported',
    detail: 'Connect an OpenAI-compatible local endpoint such as LM Studio or Ollama.',
  },
] as const;
const connectionMethodSchema = z.object({
  id: z.string(),
  label: z.string(),
  method: z.enum(['api-key', 'oauth', 'local']),
  availability: z.enum(['supported', 'setup-required']),
  detail: z.string(),
});
const providerInfo = z.object({
  id: z.string(),
  kind: z.enum(['rules', 'ai']),
  label: z.string(),
  model: z.string().optional(),
});
export const aiStatusSchema = z.object({
  active: providerInfo,
  connections: z.array(connectionMethodSchema),
  providers: z.array(
    z.object({
      id: z.enum(providerIds),
      label: z.string(),
      configured: z.boolean(),
      model: z.string().optional(),
      baseUrl: z.string().optional(),
      hint: z.string().optional(),
    }),
  ),
  calls: z.number(),
  budget: z.object({ perMinute: z.number(), perSession: z.number(), remainingSession: z.number() }),
  last: z
    .object({
      by: providerInfo,
      latencyMs: z.number(),
      outcome: z.enum(['reaction', 'no-reaction', 'fallback']),
      error: z.string().optional(),
      at: z.number(),
    })
    .nullable(),
});
export type AiStatus = z.infer<typeof aiStatusSchema>;
export const selectionSchema = z
  .object({
    provider: z.enum(providerIds),
    model: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[\w.:/@-]+$/)
      .optional(),
    baseUrl: z.url().max(200).optional(),
  })
  .strict();
export type Selection = z.infer<typeof selectionSchema>;
