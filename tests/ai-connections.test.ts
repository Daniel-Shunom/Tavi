import { describe, expect, it } from 'vitest';
import { aiStatusSchema } from '../shared/ai';
import { AiManager } from '../server/ai/manager';

describe('provider account connection options', () => {
  it('keeps the account-auth requirements explicit without exposing credentials', () => {
    const status = aiStatusSchema.parse(new AiManager().status());
    expect(status.connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'openai', method: 'api-key', availability: 'supported' }),
        expect.objectContaining({
          id: 'anthropic',
          method: 'api-key',
          availability: 'supported',
        }),
        expect.objectContaining({
          id: 'google-gemini',
          method: 'oauth',
          availability: 'setup-required',
        }),
        expect.objectContaining({ id: 'local', method: 'local', availability: 'supported' }),
      ]),
    );
    expect(JSON.stringify(status)).not.toContain('apiKey');
    expect(JSON.stringify(status)).not.toContain('clientSecret');
  });
});
