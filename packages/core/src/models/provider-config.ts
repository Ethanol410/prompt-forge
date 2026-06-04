/** Providers d'inférence supportés. Ajouter un provider = ajouter une valeur + un adaptateur. */
export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'lmstudio'
  | 'mistral'
  | 'openrouter'
  | 'gemini';

/**
 * Configuration d'un provider. Ne contient JAMAIS la clé : seulement `secretRef`,
 * une référence opaque vers le secret stocké (keychain / IndexedDB chiffré).
 * Règle de sécurité non négociable (PRD §9, §7).
 */
export interface ProviderConfig {
  readonly id: string;
  readonly type: ProviderType;
  /** URL de base (modèles locaux / endpoints compatibles). `null` = endpoint par défaut du provider. */
  readonly baseUrl: string | null;
  readonly defaultModel: string;
  /** RÉFÉRENCE vers le secret, jamais la valeur. */
  readonly secretRef: string;
  readonly isLocal: boolean;
}
