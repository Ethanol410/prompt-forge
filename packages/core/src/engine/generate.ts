import type { Template } from '../models/template.js';
import type { ProviderAdapter, GenerateOptions } from '../providers/types.js';
import { buildBasePrompt, buildMetaPrompt } from './template-engine.js';

export interface HybridGenerateParams {
  readonly template: Template;
  readonly intent: string;
  readonly adapter: ProviderAdapter;
  readonly options: GenerateOptions;
  /** Valeurs des variables du template (F-C3), injectées dans le squelette via `{{key}}`. */
  readonly vars?: Readonly<Record<string, string>>;
}

export interface HybridResult {
  readonly prompt: string;
  /** `true` si l'OptimizationPass LLM a échoué et qu'on a retourné le template déterministe. */
  readonly usedFallback: boolean;
}

/**
 * OptimizationPass en streaming : UN SEUL appel LLM (NF-CO3) via le ProviderAdapter.
 * Émet les chunks du prompt optimisé au fil de l'eau (NF-P2). Lève si l'appel échoue.
 */
export async function* optimizeStream(params: HybridGenerateParams): AsyncIterable<string> {
  const metaPrompt = buildMetaPrompt(params.template, params.intent, params.vars ?? {});
  yield* params.adapter.generate(metaPrompt, params.options);
}

/**
 * Génération hybride complète avec garde-fou : tente l'OptimizationPass LLM ; en cas d'échec
 * (réseau, quota, clé invalide…) ou de sortie vide, retombe sur le prompt déterministe.
 * Ne lève jamais pour une erreur de provider — l'app reste utilisable (PRD §8.4).
 */
export async function generateHybrid(params: HybridGenerateParams): Promise<HybridResult> {
  const base = buildBasePrompt(params.template, params.intent, params.vars ?? {});
  try {
    let optimized = '';
    for await (const chunk of optimizeStream(params)) {
      optimized += chunk;
    }
    const trimmed = optimized.trim();
    if (trimmed.length === 0) {
      return { prompt: base, usedFallback: true };
    }
    return { prompt: trimmed, usedFallback: false };
  } catch {
    return { prompt: base, usedFallback: true };
  }
}
