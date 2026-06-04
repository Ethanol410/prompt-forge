import type { ProviderType } from './provider-config.js';

/** Note de satisfaction post-génération (KPI 👍/👎, PRD §3). */
export type Rating = 'up' | 'down' | null;

/**
 * Entrée d'historique. `userIntent` reste LOCAL — jamais envoyé à l'éditeur (NF-C1/NF-C2).
 * `createdAt` est une date ISO 8601 (string) pour rester sérialisable et immuable.
 */
export interface Generation {
  readonly id: string;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly userIntent: string;
  readonly outputPrompt: string;
  readonly providerUsed: ProviderType;
  readonly modelName: string;
  readonly tokenEstimate: number | null;
  readonly rating: Rating;
  readonly createdAt: string;
}
