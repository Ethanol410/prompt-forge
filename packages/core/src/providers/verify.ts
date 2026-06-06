import type { ProviderType } from '../models/provider-config.js';
import type { HttpClient, HttpRequest } from '../ports/http-client.js';

/**
 * Vérifie une clé d'API (ou la joignabilité d'un endpoint local) via un appel GET GRATUIT
 * (liste de modèles), sans consommer de tokens. BYOK direct : la clé va au provider, jamais à l'éditeur.
 */
export interface KeyVerification {
  readonly ok: boolean;
  readonly message: string;
}

const ANTHROPIC_VERSION = '2023-06-01';

/** Construit la requête GET de vérification pour un provider donné. */
function buildVerifyRequest(
  type: ProviderType,
  key: string,
  baseUrl: string | undefined,
): HttpRequest {
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
      return {
        url: 'https://api.openai.com/v1/models',
        method: 'GET',
        headers: { authorization: `Bearer ${key}` },
      };
    case 'mistral':
      return {
        url: 'https://api.mistral.ai/v1/models',
        method: 'GET',
        headers: { authorization: `Bearer ${key}` },
      };
    case 'openrouter':
      return {
        url: 'https://openrouter.ai/api/v1/auth/key',
        method: 'GET',
        headers: { authorization: `Bearer ${key}` },
      };
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

/** Vrai si le provider est local (pas de clé, on teste la joignabilité). */
export function providerIsLocal(type: ProviderType): boolean {
  return type === 'ollama' || type === 'lmstudio';
}

/**
 * Teste une clé / un endpoint. Renvoie un verdict lisible pour l'UI (jamais la clé dans le message).
 */
export async function verifyApiKey(
  type: ProviderType,
  key: string,
  http: HttpClient,
  baseUrl?: string,
): Promise<KeyVerification> {
  if (!providerIsLocal(type) && key.trim().length === 0) {
    return { ok: false, message: 'Saisis une clé avant de la tester.' };
  }
  let status: number;
  try {
    const response = await http.send(buildVerifyRequest(type, key, baseUrl));
    if (response.ok) {
      return { ok: true, message: providerIsLocal(type) ? 'Endpoint joignable ✓' : 'Clé valide ✓' };
    }
    status = response.status;
  } catch {
    return {
      ok: false,
      message: providerIsLocal(type)
        ? 'Endpoint local injoignable (le service est-il lancé ?).'
        : 'Provider injoignable (connexion ou CORS).',
    };
  }
  if (status === 401 || status === 403) return { ok: false, message: 'Clé invalide ou non autorisée.' };
  if (status === 429) return { ok: false, message: 'Trop de requêtes — réessaie plus tard.' };
  return { ok: false, message: `Réponse inattendue du provider (statut ${status}).` };
}
