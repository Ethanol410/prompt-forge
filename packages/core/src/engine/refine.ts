import type { ProviderAdapter, GenerateOptions } from '../providers/types.js';
import type { HybridResult } from './generate.js';

/** Directives d'affinage guidé prédéfinies (F-S2). */
export const REFINEMENTS = {
  shorter: 'Rends ce prompt plus court et concis, sans perdre l’essentiel.',
  more_technical: 'Rends ce prompt plus technique, précis et rigoureux.',
  more_formal: 'Rends ce prompt plus formel dans le ton.',
} as const;

export type RefinementKey = keyof typeof REFINEMENTS;

export interface RefineParams {
  /** Prompt actuel à affiner. */
  readonly current: string;
  /** Instruction d'affinage (ex. REFINEMENTS.shorter ou un texte libre). */
  readonly instruction: string;
  readonly adapter: ProviderAdapter;
  readonly options: GenerateOptions;
}

function buildRefineMetaPrompt(current: string, instruction: string): string {
  return (
    `${instruction}\n` +
    'Réécris le prompt ci-dessous en conséquence. Réponds UNIQUEMENT avec le prompt final, ' +
    'sans préambule ni commentaire.\n\n--- PROMPT ACTUEL ---\n' +
    current
  );
}

/** Affinage en streaming : UN SEUL appel LLM (NF-CO3). Lève si l'appel échoue. */
export async function* refineStream(params: RefineParams): AsyncIterable<string> {
  const metaPrompt = buildRefineMetaPrompt(params.current, params.instruction);
  yield* params.adapter.generate(metaPrompt, params.options);
}

/**
 * Affinage avec garde-fou : en cas d'échec LLM ou de sortie vide, retourne le prompt courant
 * inchangé (l'utilisateur ne perd jamais son prompt).
 */
export async function refineHybrid(params: RefineParams): Promise<HybridResult> {
  try {
    let refined = '';
    for await (const chunk of refineStream(params)) {
      refined += chunk;
    }
    const trimmed = refined.trim();
    if (trimmed.length === 0) {
      return { prompt: params.current, usedFallback: true };
    }
    return { prompt: trimmed, usedFallback: false };
  } catch {
    return { prompt: params.current, usedFallback: true };
  }
}
