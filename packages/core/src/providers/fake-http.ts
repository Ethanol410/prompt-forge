import type { HttpClient, HttpRequest, HttpResponse } from '../ports/http-client.js';

/** Spécification d'une réponse simulée pour les tests. */
export interface FakeResponseSpec {
  readonly status?: number;
  /** Chunks de texte émis par `stream()` (simule des frontières de streaming arbitraires). */
  readonly chunks?: readonly string[];
  /** Corps complet pour `text()`/`json()`. Par défaut, la concaténation des chunks. */
  readonly body?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** Construit une `HttpResponse` simulée. */
export function fakeResponse(spec: FakeResponseSpec = {}): HttpResponse {
  const status = spec.status ?? 200;
  const chunks = spec.chunks ?? (spec.body !== undefined ? [spec.body] : []);
  const body = spec.body ?? chunks.join('');
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: spec.headers ?? {},
    async text() {
      return body;
    },
    async json<T = unknown>() {
      return JSON.parse(body) as T;
    },
    async *stream() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

/** `HttpClient` qui renvoie une réponse fixe et enregistre les requêtes reçues. */
export function recordingHttpClient(response: HttpResponse): {
  readonly client: HttpClient;
  readonly calls: HttpRequest[];
} {
  const calls: HttpRequest[] = [];
  const client: HttpClient = {
    async send(request) {
      calls.push(request);
      return response;
    },
  };
  return { client, calls };
}

/** Collecte un flux de chunks en une seule chaîne (utilitaire de test). */
export async function collect(stream: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const chunk of stream) out += chunk;
  return out;
}
