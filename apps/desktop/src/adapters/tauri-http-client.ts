import type { HttpClient, HttpRequest, HttpResponse } from '@promptforge/core';
import { ProviderError } from '@promptforge/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { Channel, invoke } from '@tauri-apps/api/core';

/**
 * Transport HTTP desktop.
 *
 * - **Cloud** (Anthropic / OpenAI / …) : plugin-http natif Rust → pas de blocage CORS (D2).
 * - **Local** (Ollama / LM Studio) : commande native `local_http_request` (reqwest), car le
 *   plugin-http force `Origin: http://tauri.localhost`, rejeté en 403 par Ollama. reqwest n'ajoute
 *   aucun `Origin` → modèle local fonctionnel sans configuration (NF-R1).
 *
 * Dans les deux cas, les appels vont directement client → provider ; aucun backend de l'éditeur.
 */
export class TauriHttpClient implements HttpClient {
  async send(request: HttpRequest): Promise<HttpResponse> {
    return isLocalUrl(request.url) ? sendLocal(request) : sendViaPluginHttp(request);
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

/** Vrai si l'URL pointe vers un endpoint local (modèle local). */
function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

// ── Cloud : plugin-http ───────────────────────────────────────────────────────

async function sendViaPluginHttp(request: HttpRequest): Promise<HttpResponse> {
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
  return wrapFetchResponse(response);
}

function wrapFetchResponse(response: Response): HttpResponse {
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

// ── Local : commande native reqwest, streamée via Channel ──────────────────────

type HttpStreamEvent =
  | { type: 'data'; chunk: string }
  | { type: 'end' }
  | { type: 'error'; message: string };

interface HttpResponseMeta {
  readonly status: number;
  readonly headers: Record<string, string>;
}

/**
 * File de fragments alimentée par le `Channel` Rust et consommée comme un async-iterable.
 * Consommateur unique (le corps est lu soit via `stream()`, soit via `text()`, jamais les deux).
 */
class ChunkQueue {
  private readonly buffer: string[] = [];
  private done = false;
  private failure: ProviderError | null = null;
  private waiters: Array<() => void> = [];

  push(chunk: string): void {
    this.buffer.push(chunk);
    this.wake();
  }

  finish(): void {
    this.done = true;
    this.wake();
  }

  fail(message: string): void {
    this.failure = new ProviderError('network', message);
    this.done = true;
    this.wake();
  }

  private wake(): void {
    const pending = this.waiters;
    this.waiters = [];
    for (const resolve of pending) resolve();
  }

  async *iterate(): AsyncIterable<string> {
    for (;;) {
      while (this.buffer.length > 0) {
        yield this.buffer.shift() as string;
      }
      if (this.failure) throw this.failure;
      if (this.done) return;
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
  }
}

async function sendLocal(request: HttpRequest): Promise<HttpResponse> {
  const queue = new ChunkQueue();
  const channel = new Channel<HttpStreamEvent>();
  channel.onmessage = (event) => {
    if (event.type === 'data') queue.push(event.chunk);
    else if (event.type === 'end') queue.finish();
    else queue.fail(event.message);
  };

  // Arrêt utilisateur (bouton Stop) : on cesse de consommer le flux.
  request.signal?.addEventListener('abort', () => queue.finish(), { once: true });

  let meta: HttpResponseMeta;
  try {
    meta = await invoke<HttpResponseMeta>('local_http_request', {
      url: request.url,
      method: request.method,
      headers: { ...request.headers },
      body: request.body ?? null,
      onEvent: channel,
    });
  } catch {
    throw new ProviderError('network', 'Échec de la requête réseau : provider injoignable.');
  }

  return buildLocalResponse(meta, queue);
}

function buildLocalResponse(meta: HttpResponseMeta, queue: ChunkQueue): HttpResponse {
  let cachedText: string | null = null;
  const readAll = async (): Promise<string> => {
    if (cachedText !== null) return cachedText;
    let acc = '';
    for await (const chunk of queue.iterate()) acc += chunk;
    cachedText = acc;
    return acc;
  };

  return {
    status: meta.status,
    ok: meta.status >= 200 && meta.status < 300,
    headers: meta.headers,
    text: readAll,
    async json<T = unknown>(): Promise<T> {
      return JSON.parse(await readAll()) as T;
    },
    stream(): AsyncIterable<string> {
      return queue.iterate();
    },
  };
}
