import type { HttpClient } from '../ports/http-client.js';
import type { ProviderAdapter, GenerateOptions } from './types.js';
import { ProviderError } from './errors.js';
import { parseSseData } from './streaming.js';
import { safeErrorBody } from './util.js';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';

interface GeminiStreamChunk {
  readonly candidates?: ReadonlyArray<{
    readonly content?: { readonly parts?: ReadonlyArray<{ readonly text?: string }> };
  }>;
}

/** Concatène le texte des parts d'un événement SSE Gemini. */
function extractText(data: string): string | null {
  try {
    const chunk = JSON.parse(data) as GeminiStreamChunk;
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (!parts) return null;
    const text = parts.map((p) => p.text ?? '').join('');
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Adaptateur Google Gemini (generativelanguage API, streaming SSE).
 * La clé passe par l'en-tête `x-goog-api-key` (jamais dans l'URL → pas de fuite en logs).
 *
 * D2 : l'API Gemini n'expose pas de CORS pour les appels navigateur → desktop-only sur web
 * (la liste des providers de l'app web ne l'expose donc pas).
 */
export class GeminiAdapter implements ProviderAdapter {
  readonly type = 'gemini' as const;

  constructor(private readonly http: HttpClient) {}

  async *generate(prompt: string, options: GenerateOptions): AsyncIterable<string> {
    if (!options.apiKey) {
      throw new ProviderError('missing_api_key', 'Clé API Gemini manquante.');
    }

    const base = options.baseUrl ?? DEFAULT_BASE_URL;
    const response = await this.http.send({
      url: `${base}/v1beta/models/${options.model}:streamGenerateContent?alt=sse`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': options.apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...((options.temperature !== undefined || options.maxTokens !== undefined) && {
          generationConfig: {
            ...(options.temperature !== undefined && { temperature: options.temperature }),
            ...(options.maxTokens !== undefined && { maxOutputTokens: options.maxTokens }),
          },
        }),
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const detail = await safeErrorBody(response);
      throw new ProviderError(
        'http_error',
        `Gemini a renvoyé le statut ${response.status}${detail ? ` : ${detail}` : ''}`,
        response.status,
      );
    }

    for await (const data of parseSseData(response.stream())) {
      if (data === '[DONE]') break;
      const text = extractText(data);
      if (text) yield text;
    }
  }
}
