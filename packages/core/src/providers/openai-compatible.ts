import type { ProviderType } from '../models/provider-config.js';
import type { HttpClient } from '../ports/http-client.js';
import type { ProviderAdapter, GenerateOptions } from './types.js';
import { ProviderError } from './errors.js';
import { parseSseData } from './streaming.js';
import { safeErrorBody } from './util.js';

interface OpenAiStreamChunk {
  readonly choices?: ReadonlyArray<{ readonly delta?: { readonly content?: string } }>;
}

/** Extrait le token d'un événement SSE OpenAI (`choices[0].delta.content`). */
function extractToken(data: string): string | null {
  try {
    const chunk = JSON.parse(data) as OpenAiStreamChunk;
    return chunk.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}

/**
 * Adaptateur compatible OpenAI (Chat Completions, streaming SSE).
 * Sert pour OpenAI ET LM Studio (même protocole, base URL différente — PRD §7.4).
 *
 * Important (D2) : OpenAI bloque les appels navigateur (CORS). En web, l'adaptateur de transport
 * (`FetchHttpClient`) échouera donc pour `openai` — c'est attendu et géré par l'UI (« dispo sur desktop »).
 * Sur desktop, le transport Tauri (HTTP natif Rust) contourne le CORS.
 */
export class OpenAiCompatibleAdapter implements ProviderAdapter {
  readonly type: ProviderType;
  private readonly defaultBaseUrl: string;
  private readonly requiresApiKey: boolean;

  constructor(
    type: ProviderType,
    private readonly http: HttpClient,
    defaultBaseUrl: string,
    requiresApiKey: boolean,
  ) {
    this.type = type;
    this.defaultBaseUrl = defaultBaseUrl;
    this.requiresApiKey = requiresApiKey;
  }

  async *generate(prompt: string, options: GenerateOptions): AsyncIterable<string> {
    if (this.requiresApiKey && !options.apiKey) {
      throw new ProviderError('missing_api_key', `Clé API ${this.type} manquante.`);
    }

    const base = options.baseUrl ?? this.defaultBaseUrl;
    const response = await this.http.send({
      url: `${base}/v1/chat/completions`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(options.apiKey && { authorization: `Bearer ${options.apiKey}` }),
      },
      body: JSON.stringify({
        model: options.model,
        ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
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
        `${this.type} a renvoyé le statut ${response.status}${detail ? ` : ${detail}` : ''}`,
        response.status,
      );
    }

    for await (const data of parseSseData(response.stream())) {
      if (data === '[DONE]') break;
      const token = extractToken(data);
      if (token) yield token;
    }
  }
}
