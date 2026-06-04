export type ProviderErrorCode =
  | 'missing_api_key'
  | 'http_error'
  | 'network'
  | 'invalid_response'
  | 'unsupported';

/**
 * Erreur normalisée d'un provider, pour une gestion d'erreurs claire côté UI (F-M10).
 * Le message NE doit JAMAIS contenir la clé d'API.
 */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly status: number | undefined;

  constructor(code: ProviderErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Traduit une erreur en message clair pour l'utilisateur (F-M10).
 * Ne contient jamais la clé. Couvre clé invalide (401/403), quota (429), provider injoignable, etc.
 */
export function describeProviderError(error: unknown): string {
  if (error instanceof ProviderError) {
    switch (error.code) {
      case 'missing_api_key':
        return 'Clé API manquante. Renseigne ta clé pour ce provider.';
      case 'network':
        return 'Provider injoignable : vérifie ta connexion, le modèle local (Ollama / LM Studio) ou les restrictions CORS.';
      case 'invalid_response':
        return 'Réponse inattendue du provider.';
      case 'unsupported':
        return 'Opération non supportée par ce provider.';
      case 'http_error': {
        const status = error.status;
        if (status === 401 || status === 403) return 'Clé API invalide ou non autorisée.';
        if (status === 429) return 'Quota dépassé ou trop de requêtes — réessaie plus tard.';
        if (status !== undefined && status >= 500) return `Erreur serveur du provider (statut ${status}).`;
        return status !== undefined
          ? `Le provider a renvoyé le statut ${status}.`
          : 'Erreur du provider.';
      }
    }
  }
  return 'Une erreur inattendue est survenue.';
}
