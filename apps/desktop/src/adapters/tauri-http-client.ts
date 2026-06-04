import type { HttpClient, HttpRequest, HttpResponse } from '@promptforge/core';
import { ProviderError } from '@promptforge/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

/**
 * Transport HTTP desktop : passe par le HTTP natif Rust de Tauri (plugin-http), pas par le
 * `fetch` de la webview. Conséquence (D2) : aucun blocage CORS → OpenAI fonctionne sur desktop.
 * Les appels vont directement client → provider ; aucun backend de l'éditeur n'est sur le chemin.
 */
export class TauriHttpClient implements HttpClient {
  async send(request: HttpRequest): Promise<HttpResponse> {
    let response: Response;
    try {
      response = await tauriFetch(request.url, {
        method: request.method,
        headers: { ...request.headers },
        body: request.body,
        signal: request.signal,
      });
    } catch {
      throw new ProviderError('network', 'Échec de la requête réseau : provider injoignable.');
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
