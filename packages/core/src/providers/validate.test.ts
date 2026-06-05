import { describe, it, expect } from 'vitest';
import { validateApiKeyFormat } from './validate.js';

describe('validateApiKeyFormat', () => {
  it('rejette une clé vide ou trop courte', () => {
    expect(validateApiKeyFormat('openai', '').ok).toBe(false);
    expect(validateApiKeyFormat('openai', 'sk-abc').ok).toBe(false);
  });

  it('valide le préfixe Anthropic', () => {
    expect(validateApiKeyFormat('anthropic', 'sk-ant-0123456789abcdef').ok).toBe(true);
    expect(validateApiKeyFormat('anthropic', 'sk-0123456789abcdef').ok).toBe(false);
  });

  it('valide le préfixe OpenAI / OpenRouter', () => {
    expect(validateApiKeyFormat('openai', 'sk-0123456789abcdef').ok).toBe(true);
    expect(validateApiKeyFormat('openrouter', 'sk-or-0123456789abcdef').ok).toBe(true);
    expect(validateApiKeyFormat('openrouter', 'sk-0123456789abcdef').ok).toBe(false);
  });

  it('accepte les providers sans préfixe imposé (longueur suffisante)', () => {
    expect(validateApiKeyFormat('mistral', '0123456789abcdef0123').ok).toBe(true);
    expect(validateApiKeyFormat('gemini', '0123456789abcdef0123').ok).toBe(true);
  });
});
