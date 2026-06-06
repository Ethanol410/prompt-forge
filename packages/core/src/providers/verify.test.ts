import { describe, it, expect } from 'vitest';
import { verifyApiKey, providerIsLocal } from './verify.js';
import type { HttpClient, HttpRequest, HttpResponse } from '../ports/http-client.js';

function mockHttp(handler: (req: HttpRequest) => { status: number } | 'throw'): HttpClient {
  return {
    async send(req: HttpRequest): Promise<HttpResponse> {
      const r = handler(req);
      if (r === 'throw') throw new Error('network');
      return {
        status: r.status,
        ok: r.status >= 200 && r.status < 300,
        headers: {},
        text: async () => '',
        json: async () => ({}) as never,
        async *stream() {
          /* vide */
        },
      };
    },
  };
}

describe('verifyApiKey', () => {
  it('Anthropic 200 → clé valide, envoie le header x-api-key', async () => {
    let seenHeader = '';
    const http = mockHttp((req) => {
      seenHeader = (req.headers as Record<string, string>)['x-api-key'] ?? '';
      return { status: 200 };
    });
    const res = await verifyApiKey('anthropic', 'sk-ant-xxx', http);
    expect(res.ok).toBe(true);
    expect(res.message).toContain('valide');
    expect(seenHeader).toBe('sk-ant-xxx');
  });

  it('401 → clé invalide', async () => {
    const res = await verifyApiKey('openai', 'bad', mockHttp(() => ({ status: 401 })));
    expect(res.ok).toBe(false);
    expect(res.message).toContain('invalide');
  });

  it('réseau KO → injoignable', async () => {
    const res = await verifyApiKey('mistral', 'k', mockHttp(() => 'throw'));
    expect(res.ok).toBe(false);
    expect(res.message).toContain('injoignable');
  });

  it('clé vide (cloud) → demande une clé, sans appel réseau', async () => {
    let called = false;
    const http = mockHttp(() => {
      called = true;
      return { status: 200 };
    });
    const res = await verifyApiKey('openai', '   ', http);
    expect(res.ok).toBe(false);
    expect(called).toBe(false);
  });

  it('local (ollama) 200 → endpoint joignable, sans clé', async () => {
    const res = await verifyApiKey('ollama', '', mockHttp(() => ({ status: 200 })), 'http://localhost:11434');
    expect(res.ok).toBe(true);
    expect(providerIsLocal('ollama')).toBe(true);
  });
});
