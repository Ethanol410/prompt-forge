import type { ProviderType } from '../models/provider-config.js';
import type { HttpClient, HttpRequest } from '../ports/http-client.js';

/**
 * Liste les modèles disponibles d'un provider (pour proposer un sélecteur au lieu d'un champ
 * texte libre). Appel GET gratuit. BYOK direct : la clé va au provider, jamais à l'éditeur.
 * En cas d'échec (provider injoignable, clé absente, CORS), renvoie `[]` → l'UI retombe sur la
 * saisie libre. Ne lève jamais.
 */
const ANTHROPIC_VERSION = '2023-06-01';

function buildModelsRequest(type: ProviderType, key: string, baseUrl: string | undefined): HttpRequest {
  switch (type) {
    case 'anthropic':
      return {
        url: 'https://api.anthropic.com/v1/models',
        method: 'GET',
        headers: {
          'x-api-key': key,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      };
    case 'openai':
      return { url: 'https://api.openai.com/v1/models', method: 'GET', headers: { authorization: `Bearer ${key}` } };
    case 'mistral':
      return { url: 'https://api.mistral.ai/v1/models', method: 'GET', headers: { authorization: `Bearer ${key}` } };
    case 'openrouter':
      // La liste des modèles OpenRouter est publique (pas besoin de clé).
      return { url: 'https://openrouter.ai/api/v1/models', method: 'GET', headers: {} };
    case 'gemini':
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
        method: 'GET',
        headers: {},
      };
    case 'ollama':
      return { url: `${baseUrl ?? 'http://localhost:11434'}/api/tags`, method: 'GET', headers: {} };
    case 'lmstudio':
      return { url: `${baseUrl ?? 'http://localhost:1234'}/v1/models`, method: 'GET', headers: {} };
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/** Extrait un champ string non vide d'un élément inconnu. */
function strField(item: unknown, field: string): string | null {
  const rec = asRecord(item);
  const val = rec?.[field];
  return typeof val === 'string' && val.length > 0 ? val : null;
}

function pick(list: unknown, field: string, transform?: (s: string) => string): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    const value = strField(item, field);
    if (value) out.push(transform ? transform(value) : value);
  }
  return out;
}

function dedupeSort(names: readonly string[]): readonly string[] {
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/** Normalise la réponse de chaque provider en une liste de noms de modèles. */
function parseModels(type: ProviderType, body: unknown): readonly string[] {
  const root = asRecord(body);
  if (!root) return [];
  if (type === 'ollama') return dedupeSort(pick(root.models, 'name'));
  if (type === 'gemini') {
    return dedupeSort(pick(root.models, 'name', (s) => s.replace(/^models\//, '')));
  }
  // openai / mistral / openrouter / lmstudio / anthropic : { data: [{ id }] }
  return dedupeSort(pick(root.data, 'id'));
}

export async function listModels(
  type: ProviderType,
  key: string,
  http: HttpClient,
  baseUrl?: string,
): Promise<readonly string[]> {
  try {
    const response = await http.send(buildModelsRequest(type, key, baseUrl));
    if (!response.ok) return [];
    return parseModels(type, await response.json());
  } catch {
    return [];
  }
}
