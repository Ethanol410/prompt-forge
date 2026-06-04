import type { ProviderType } from '../models/provider-config.js';

/** Options d'un appel de génération. `apiKey` requis pour le cloud, absent pour le local. */
export interface GenerateOptions {
  readonly model: string;
  /** Clé d'API en clair, fournie au dernier moment puis libérée. Absente pour les providers locaux. */
  readonly apiKey?: string;
  /** Override de l'URL de base (endpoints locaux / compatibles). */
  readonly baseUrl?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly signal?: AbortSignal;
}

/**
 * Interface commune à tous les providers (PRD §7.5). `generate` renvoie un flux de chunks
 * de texte (streaming token-par-token, NF-P2). Ajouter un provider = implémenter cette interface.
 */
export interface ProviderAdapter {
  readonly type: ProviderType;
  generate(prompt: string, options: GenerateOptions): AsyncIterable<string>;
}
