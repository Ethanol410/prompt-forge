import { describe, it, expect } from 'vitest';
import { AnthropicAdapter } from './anthropic.js';
import { ProviderError } from './errors.js';
import { fakeResponse, recordingHttpClient, collect } from './fake-http.js';

function sseDelta(text: string): string {
  return `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}\n`;
}

describe('AnthropicAdapter', () => {
  it('lève missing_api_key si la clé est absente', async () => {
    const { client } = recordingHttpClient(fakeResponse());
    const adapter = new AnthropicAdapter(client);
    await expect(collect(adapter.generate('salut', { model: 'claude-x' }))).rejects.toMatchObject({
      code: 'missing_api_key',
    });
  });

  it('streame le texte concaténé des deltas et envoie les bons headers', async () => {
    const response = fakeResponse({
      chunks: [sseDelta('Bon'), sseDelta('jour'), 'data: [DONE]\n'],
    });
    const { client, calls } = recordingHttpClient(response);
    const adapter = new AnthropicAdapter(client);

    const out = await collect(adapter.generate('intention', { model: 'claude-x', apiKey: 'sk-test' }));

    expect(out).toBe('Bonjour');
    expect(calls).toHaveLength(1);
    const req = calls[0]!;
    expect(req.url).toBe('https://api.anthropic.com/v1/messages');
    expect(req.method).toBe('POST');
    expect(req.headers['x-api-key']).toBe('sk-test');
    expect(req.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(req.headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(req.body!);
    expect(body.stream).toBe(true);
    expect(body.model).toBe('claude-x');
    expect(body.messages).toEqual([{ role: 'user', content: 'intention' }]);
  });

  it('respecte un baseUrl override (endpoint local/compatible)', async () => {
    const { client, calls } = recordingHttpClient(fakeResponse({ chunks: ['data: [DONE]\n'] }));
    const adapter = new AnthropicAdapter(client);
    await collect(adapter.generate('x', { model: 'm', apiKey: 'k', baseUrl: 'http://localhost:9999' }));
    expect(calls[0]!.url).toBe('http://localhost:9999/v1/messages');
  });

  it('lève http_error avec le statut en cas de réponse non-OK', async () => {
    const { client } = recordingHttpClient(fakeResponse({ status: 401, body: 'unauthorized' }));
    const adapter = new AnthropicAdapter(client);
    const error = await collect(adapter.generate('x', { model: 'm', apiKey: 'bad' })).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ code: 'http_error', status: 401 });
  });

  it('ne fait jamais fuiter la clé dans le message d’erreur', async () => {
    const { client } = recordingHttpClient(fakeResponse({ status: 500, body: 'boom' }));
    const adapter = new AnthropicAdapter(client);
    const error: unknown = await collect(adapter.generate('x', { model: 'm', apiKey: 'sk-secret' })).catch(
      (e) => e,
    );
    expect(String((error as Error).message)).not.toContain('sk-secret');
  });
});
