import type { ProviderType } from '../models/provider-config.js';

/** Estimation de coût (très approximative, indicative). `free` pour les modèles locaux. */
export interface CostEstimate {
  readonly amountUsd: number | null;
  readonly free: boolean;
}

/**
 * Tarifs indicatifs $/1M tokens de SORTIE, par fragment de nom de modèle (ordre = priorité).
 * Volontairement approximatif (les prix évoluent) — sert à donner un ordre de grandeur (NF-CO2).
 */
const OUTPUT_PRICE_PER_MTOK: ReadonlyArray<readonly [string, number]> = [
  ['gpt-4o-mini', 0.6],
  ['gpt-4o', 10],
  ['o1-mini', 4],
  ['o1', 60],
  ['gpt-4', 30],
  ['gpt-3.5', 1.5],
  ['claude-3-5-haiku', 4],
  ['claude-3-haiku', 1.25],
  ['claude-3-5-sonnet', 15],
  ['claude-3-7-sonnet', 15],
  ['claude-3-opus', 75],
  ['sonnet', 15],
  ['haiku', 1.25],
  ['opus', 75],
  ['gemini-1.5-flash', 0.3],
  ['gemini-2.0-flash', 0.4],
  ['gemini-1.5-pro', 10],
  ['mistral-small', 0.6],
  ['mistral-large', 6],
];

const LOCAL_PROVIDERS: readonly ProviderType[] = ['ollama', 'lmstudio'];

/** Estime le coût d'une génération en $ d'après le provider, le modèle et le nombre de tokens. */
export function estimateCost(
  providerType: ProviderType,
  model: string,
  tokens: number,
): CostEstimate {
  if (LOCAL_PROVIDERS.includes(providerType)) {
    return { amountUsd: 0, free: true };
  }
  const lower = model.toLowerCase();
  const match = OUTPUT_PRICE_PER_MTOK.find(([fragment]) => lower.includes(fragment));
  if (!match) return { amountUsd: null, free: false };
  return { amountUsd: (tokens / 1_000_000) * match[1], free: false };
}
