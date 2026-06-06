import { describe, it, expect } from 'vitest';
import { listModels } from './list-models.js';
import type { HttpClient, HttpRequest, HttpResponse } from '../ports/http-client.js';

function mockHttp(handler: (req: HttpRequest) => { status: number; body: unknown } | 'throw'): HttpClient {
  return {
    async send(req: HttpRequest): Promise<HttpResponse> {
      const r = handler(req);
      if (r === 'throw') throw new Error('network');
      return {
        status: r.status,
        ok: r.status >= 200 && r.status < 300,
        headers: {},
        text: async () => JSON.stringify(r.body),
        json: async () => r.body as never,
        async *stream() {
          /* vide */
        },
      };
    },
  };
}

describe('listModels', () => {
  it('Ollama : parse models[].name, trié et dédupliqué', async () => {
    const http = mockHttp((req) => {
      expect(req.url).toContain('/api/tags');
      return { status: 200, body: { models: [{ name: 'gemma3:latest' }, { name: 'llama3.2' }, { name: 'gemma3:latest' }] } };
    });
    const models = await listModels('ollama', '', http, 'http://localhost:11434');
    expect(models).toEqual(['gemma3:latest', 'llama3.2']);
  });

  it('OpenAI : parse data[].id', async () => {
    const http = mockHttp(() => ({ status: 200, body: { data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }] } }));
    const models = await listModels('openai', 'sk-x', http);
    expect(models).toEqual(['gpt-4o', 'gpt-4o-mini']);
  });

  it('Gemini : retire le préfixe "models/"', async () => {
    const http = mockHttp(() => ({ status: 200, body: { models: [{ name: 'models/gemini-1.5-flash' }] } }));
    const models = await listModels('gemini', 'key', http);
    expect(models).toEqual(['gemini-1.5-flash']);
  });

  it('OpenRouter : endpoint public /api/v1/models', async () => {
    let url = '';
    const http = mockHttp((req) => {
      url = req.url;
      return { status: 200, body: { data: [{ id: 'openai/gpt-4o-mini' }] } };
    });
    const models = await listModels('openrouter', '', http);
    expect(url).toBe('https://openrouter.ai/api/v1/models');
    expect(models).toEqual(['openai/gpt-4o-mini']);
  });

  it('échec réseau → liste vide (pas d’exception)', async () => {
    const models = await listModels('mistral', 'k', mockHttp(() => 'throw'));
    expect(models).toEqual([]);
  });

  it('statut non-ok → liste vide', async () => {
    const models = await listModels('openai', 'bad', mockHttp(() => ({ status: 401, body: {} })));
    expect(models).toEqual([]);
  });

  it('corps inattendu → liste vide', async () => {
    const models = await listModels('ollama', '', mockHttp(() => ({ status: 200, body: { nope: true } })));
    expect(models).toEqual([]);
  });
});
