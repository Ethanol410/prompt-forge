/**
 * Port de transport HTTP. C'est l'abstraction clé qui implémente la décision D2 :
 * - sur web, l'adaptateur s'appuie sur `fetch` navigateur → OpenAI bloqué par CORS (attendu) ;
 * - sur desktop (Tauri), l'adaptateur passe par le HTTP natif Rust → OpenAI débloqué.
 * Le cœur (`providers`, `engine`) ne dépend QUE de ce port, jamais de `fetch` directement.
 */
export type HttpMethod = 'GET' | 'POST';

export interface HttpRequest {
  readonly url: string;
  readonly method: HttpMethod;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly signal?: AbortSignal;
}

export interface HttpResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: Readonly<Record<string, string>>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  /**
   * Flux de chunks de texte décodés (pour le streaming SSE token-par-token, NF-P2).
   * Pour une réponse non-stream, émet le corps en un seul chunk.
   */
  stream(): AsyncIterable<string>;
}

export interface HttpClient {
  send(request: HttpRequest): Promise<HttpResponse>;
}
