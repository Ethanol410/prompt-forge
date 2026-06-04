import { describe, it, expect } from 'vitest';
import { GeminiAdapter } from './gemini.js';
import { ProviderError } from './errors.js';
import { fakeResponse, recordingHttpClient, collect } from './fake-http.js';

function sse(text: string): string {
  return `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n`;
}

describe('GeminiAdapter', () => {
  it('streame le texte des parts et met la clé dans x-goog-api-key (pas dans l’URL)', async () => {
    const response = fakeResponse({ chunks: [sse('Bon'), sse('jour')] });
    const { client, calls } = recordingHttpClient(response);
    const adapter = new GeminiAdapter(client);

    const out = await collect(adapter.generate('intention', { model: 'gemini-1.5-flash', apiKey: 'k-secret' }));

    expect(out).toBe('Bonjour');
    const req = calls[0]!;
    expect(req.url).toContain('/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse');
    expect(req.url).not.toContain('k-secret');
    expect(req.headers['x-goog-api-key']).toBe('k-secret');
    const body = JSON.parse(req.body!);
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'intention' }] }]);
  });

  it('lève missing_api_key sans clé', async () => {
    const { client } = recordingHttpClient(fakeResponse());
    const adapter = new GeminiAdapter(client);
    await expect(collect(adapter.generate('x', { model: 'm' }))).rejects.toMatchObject({
      code: 'missing_api_key',
    });
  });

  it('lève http_error avec statut sur réponse non-OK', async () => {
    const { client } = recordingHttpClient(fakeResponse({ status: 400, body: 'bad' }));
    const adapter = new GeminiAdapter(client);
    const error = await collect(adapter.generate('x', { model: 'm', apiKey: 'k' })).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ code: 'http_error', status: 400 });
  });
});
