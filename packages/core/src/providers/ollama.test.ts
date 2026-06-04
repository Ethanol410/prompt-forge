import { describe, it, expect } from 'vitest';
import { OllamaAdapter } from './ollama.js';
import { ProviderError } from './errors.js';
import { fakeResponse, recordingHttpClient, collect } from './fake-http.js';

function ndjson(response: string, done = false): string {
  return `${JSON.stringify({ response, done })}\n`;
}

describe('OllamaAdapter', () => {
  it('streame les tokens NDJSON sans clé d’API, sur localhost par défaut', async () => {
    const response = fakeResponse({ chunks: [ndjson('Hello'), ndjson(' world'), ndjson('', true)] });
    const { client, calls } = recordingHttpClient(response);
    const adapter = new OllamaAdapter(client);

    const out = await collect(adapter.generate('intention', { model: 'llama3' }));

    expect(out).toBe('Hello world');
    expect(calls[0]!.url).toBe('http://localhost:11434/api/generate');
    expect(calls[0]!.headers['x-api-key']).toBeUndefined();
    const body = JSON.parse(calls[0]!.body!);
    expect(body).toMatchObject({ model: 'llama3', prompt: 'intention', stream: true });
  });

  it('réassemble un objet NDJSON coupé entre deux chunks', async () => {
    const full = ndjson('ok');
    const split = Math.floor(full.length / 2);
    const response = fakeResponse({ chunks: [full.slice(0, split), full.slice(split)] });
    const { client } = recordingHttpClient(response);
    const adapter = new OllamaAdapter(client);
    expect(await collect(adapter.generate('x', { model: 'm' }))).toBe('ok');
  });

  it('lève http_error si Ollama est injoignable (statut non-OK)', async () => {
    const { client } = recordingHttpClient(fakeResponse({ status: 404, body: 'model not found' }));
    const adapter = new OllamaAdapter(client);
    const error = await collect(adapter.generate('x', { model: 'absent' })).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ code: 'http_error', status: 404 });
  });
});
