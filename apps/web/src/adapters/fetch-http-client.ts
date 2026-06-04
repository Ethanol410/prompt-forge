import type { HttpClient, HttpRequest, HttpResponse } from '@promptforge/core';
import { ProviderError } from '@promptforge/core';

/**
 * Transport HTTP web basé sur `fetch` du navigateur. Les appels vont DIRECTEMENT au provider
 * (client → provider), jamais via un backend de l'éditeur (règle non négociable).
 * Conséquence D2 : pour OpenAI, `fetch` échoue (CORS) → erreur `network` ; l'UI guide vers le desktop.
 */
export class FetchHttpClient implements HttpClient {
  async send(request: HttpRequest): Promise<HttpResponse> {
    let response: Response;
    try {
      response = await fetch(request.url, {
        method: request.method,
        headers: { ...request.headers },
        body: request.body,
        signal: request.signal,
      });
    } catch {
      throw new ProviderError(
        'network',
        'Échec de la requête réseau : provider injoignable ou bloqué par CORS (OpenAI est réservé au desktop).',
      );
    }
    return wrapResponse(response);
  }
}

function wrapResponse(response: Response): HttpResponse {
  return {
    status: response.status,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
    text() {
      return response.text();
    },
    json<T = unknown>() {
      return response.json() as Promise<T>;
    },
    async *stream(): AsyncIterable<string> {
      const body = response.body;
      if (!body) {
        const text = await response.text();
        if (text) yield text;
        return;
      }
      const reader = body.getReader();
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) yield decoder.decode(value, { stream: true });
        }
        const tail = decoder.decode();
        if (tail) yield tail;
      } finally {
        reader.releaseLock();
      }
    },
  };
}
