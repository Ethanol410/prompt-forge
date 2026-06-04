import type { HttpClient } from '../ports/http-client.js';
import type { ProviderAdapter, GenerateOptions } from './types.js';
import { ProviderError } from './errors.js';
import { splitLines } from './streaming.js';
import { safeErrorBody } from './util.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';

interface OllamaStreamChunk {
  readonly response?: string;
  readonly done?: boolean;
}

/** Extrait le token d'une ligne NDJSON Ollama (`{"response":"...","done":false}`). */
function extractToken(line: string): string | null {
  try {
    const chunk = JSON.parse(line) as OllamaStreamChunk;
    return chunk.response ?? null;
  } catch {
    return null;
  }
}

/**
 * Adaptateur Ollama (modèle local, 100 % hors-ligne — NF-R1). Pas de clé d'API.
 * Le flux est du NDJSON (un objet JSON par ligne), pas du SSE.
 */
export class OllamaAdapter implements ProviderAdapter {
  readonly type = 'ollama' as const;

  constructor(private readonly http: HttpClient) {}

  async *generate(prompt: string, options: GenerateOptions): AsyncIterable<string> {
    const base = options.baseUrl ?? DEFAULT_BASE_URL;
    const response = await this.http.send({
      url: `${base}/api/generate`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        prompt,
        stream: true,
        ...(options.temperature !== undefined && { options: { temperature: options.temperature } }),
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const detail = await safeErrorBody(response);
      throw new ProviderError(
        'http_error',
        `Ollama a renvoyé le statut ${response.status}${detail ? ` : ${detail}` : ''}`,
        response.status,
      );
    }

    for await (const line of splitLines(response.stream())) {
      if (line.trim().length === 0) continue;
      const token = extractToken(line);
      if (token) yield token;
    }
  }
}
