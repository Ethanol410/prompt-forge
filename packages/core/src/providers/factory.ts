import type { ProviderType } from '../models/provider-config.js';
import type { HttpClient } from '../ports/http-client.js';
import type { ProviderAdapter } from './types.js';
import { AnthropicAdapter } from './anthropic.js';
import { OllamaAdapter } from './ollama.js';
import { OpenAiCompatibleAdapter } from './openai-compatible.js';
import { GeminiAdapter } from './gemini.js';

export const OPENAI_BASE_URL = 'https://api.openai.com';
export const LM_STUDIO_BASE_URL = 'http://localhost:1234';
export const MISTRAL_BASE_URL = 'https://api.mistral.ai';
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api';

/**
 * Fabrique l'adaptateur correspondant à un type de provider, branché sur le port HttpClient.
 * Le choix du transport (web vs Tauri) est fait par l'appelant en injectant le bon `HttpClient`.
 */
export function createProviderAdapter(type: ProviderType, http: HttpClient): ProviderAdapter {
  switch (type) {
    case 'anthropic':
      return new AnthropicAdapter(http);
    case 'ollama':
      return new OllamaAdapter(http);
    case 'openai':
      return new OpenAiCompatibleAdapter('openai', http, OPENAI_BASE_URL, true);
    case 'lmstudio':
      return new OpenAiCompatibleAdapter('lmstudio', http, LM_STUDIO_BASE_URL, false);
    case 'mistral':
      return new OpenAiCompatibleAdapter('mistral', http, MISTRAL_BASE_URL, true);
    case 'openrouter':
      return new OpenAiCompatibleAdapter('openrouter', http, OPENROUTER_BASE_URL, true);
    case 'gemini':
      return new GeminiAdapter(http);
  }
}
