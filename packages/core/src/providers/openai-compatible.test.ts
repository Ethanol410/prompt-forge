import { describe, it, expect } from 'vitest';
import { OpenAiCompatibleAdapter } from './openai-compatible.js';
import { createProviderAdapter, OPENAI_BASE_URL, LM_STUDIO_BASE_URL } from './factory.js';
import { fakeResponse, recordingHttpClient, collect } from './fake-http.js';

function sse(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`;
}

describe('OpenAiCompatibleAdapter', () => {
  it('OpenAI: streame le contenu et envoie le header Authorization', async () => {
    const response = fakeResponse({ chunks: [sse('Hel'), sse('lo'), 'data: [DONE]\n'] });
    const { client, calls } = recordingHttpClient(response);
    const adapter = new OpenAiCompatibleAdapter('openai', client, OPENAI_BASE_URL, true);

    const out = await collect(adapter.generate('x', { model: 'gpt', apiKey: 'sk-1' }));

    expect(out).toBe('Hello');
    expect(calls[0]!.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(calls[0]!.headers['authorization']).toBe('Bearer sk-1');
  });

  it('OpenAI: lève missing_api_key sans clé', async () => {
    const { client } = recordingHttpClient(fakeResponse());
    const adapter = new OpenAiCompatibleAdapter('openai', client, OPENAI_BASE_URL, true);
    await expect(collect(adapter.generate('x', { model: 'gpt' }))).rejects.toMatchObject({
      code: 'missing_api_key',
    });
  });

  it('LM Studio: fonctionne sans clé d’API sur localhost', async () => {
    const response = fakeResponse({ chunks: [sse('hi'), 'data: [DONE]\n'] });
    const { client, calls } = recordingHttpClient(response);
    const adapter = new OpenAiCompatibleAdapter('lmstudio', client, LM_STUDIO_BASE_URL, false);

    const out = await collect(adapter.generate('x', { model: 'local' }));

    expect(out).toBe('hi');
    expect(calls[0]!.url).toBe('http://localhost:1234/v1/chat/completions');
    expect(calls[0]!.headers['authorization']).toBeUndefined();
  });
});

describe('createProviderAdapter', () => {
  it('fabrique le bon type pour chaque provider', () => {
    const { client } = recordingHttpClient(fakeResponse());
    expect(createProviderAdapter('anthropic', client).type).toBe('anthropic');
    expect(createProviderAdapter('ollama', client).type).toBe('ollama');
    expect(createProviderAdapter('openai', client).type).toBe('openai');
    expect(createProviderAdapter('lmstudio', client).type).toBe('lmstudio');
    expect(createProviderAdapter('mistral', client).type).toBe('mistral');
    expect(createProviderAdapter('openrouter', client).type).toBe('openrouter');
    expect(createProviderAdapter('gemini', client).type).toBe('gemini');
  });

  it('Mistral et OpenRouter pointent vers les bonnes URLs', async () => {
    const { client: c1, calls: calls1 } = recordingHttpClient(fakeResponse({ chunks: ['data: [DONE]\n'] }));
    await collect(createProviderAdapter('mistral', c1).generate('x', { model: 'm', apiKey: 'k' }));
    expect(calls1[0]!.url).toBe('https://api.mistral.ai/v1/chat/completions');

    const { client: c2, calls: calls2 } = recordingHttpClient(fakeResponse({ chunks: ['data: [DONE]\n'] }));
    await collect(createProviderAdapter('openrouter', c2).generate('x', { model: 'm', apiKey: 'k' }));
    expect(calls2[0]!.url).toBe('https://openrouter.ai/api/v1/chat/completions');
  });
});
