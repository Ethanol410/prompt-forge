import type { ProviderType } from '../models/provider-config.js';

/**
 * Événements analytics ANONYMISÉS uniquement. Cette union fermée garantit, par construction,
 * qu'aucun contenu utilisateur (intention, prompt, clé) ne peut transiter (NF-C2, règle non négociable).
 * `category` est un slug système, `provider` un type — jamais du contenu libre.
 */
export type AnalyticsEvent =
  | { readonly name: 'prompt_generated'; readonly category: string; readonly provider: ProviderType }
  | { readonly name: 'prompt_copied'; readonly category: string }
  | { readonly name: 'prompt_exported'; readonly target: 'chatgpt' | 'claude' | 'gemini' }
  | { readonly name: 'history_opened' }
  | { readonly name: 'provider_configured'; readonly provider: ProviderType }
  | { readonly name: 'ab_compared'; readonly chosen: 'raw' | 'optimized' };

export interface Analytics {
  /** Enregistre un événement. No-op si l'utilisateur n'a pas opté (opt-out par défaut). */
  track(event: AnalyticsEvent): void;
}
