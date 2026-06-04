import type { HttpClient } from '../ports/http-client.js';
import type { ProviderAdapter, GenerateOptions } from './types.js';
import { ProviderError } from './errors.js';
import { parseSseData } from './streaming.js';
import { safeErrorBody } from './util.js';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicStreamEvent {
  readonly type?: string;
  readonly delta?: { readonly type?: string; readonly text?: string };
}

/** Extrait le texte d'un événement SSE Anthropic (`content_block_delta` / `text_delta`). */
function extractDelta(data: string): string | null {
  try {
    const event = JSON.parse(data) as AnthropicStreamEvent;
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      return event.delta.text ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Adaptateur Anthropic (Messages API, streaming SSE).
 * Compatible navigateur via le header `anthropic-dangerous-direct-browser-access` (D2) :
 * c'est ce qui permet à Anthropic de fonctionner en web ET desktop, contrairement à OpenAI.
 */
export class AnthropicAdapter implements ProviderAdapter {
  readonly type = 'anthropic' as const;

  constructor(private readonly http: HttpClient) {}

  async *generate(prompt: string, options: GenerateOptions): AsyncIterable<string> {
    if (!options.apiKey) {
      throw new ProviderError('missing_api_key', 'Clé API Anthropic manquante.');
    }

    const base = options.baseUrl ?? DEFAULT_BASE_URL;
    const response = await this.http.send({
      url: `${base}/v1/messages`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens ?? 1024,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const detail = await safeErrorBody(response);
      throw new ProviderError(
        'http_error',
        `Anthropic a renvoyé le statut ${response.status}${detail ? ` : ${detail}` : ''}`,
        response.status,
      );
    }

    for await (const data of parseSseData(response.stream())) {
      if (data === '[DONE]') break;
      const text = extractDelta(data);
      if (text) yield text;
    }
  }
}
