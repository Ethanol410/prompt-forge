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

const CRITIQUE_META =
  'Tu es un expert en prompt engineering. Analyse le prompt ci-dessous et liste ses faiblesses ' +
  'les plus importantes sous forme de 3 à 6 puces courtes et actionnables (rôle, contexte, étapes, ' +
  'contraintes vérifiables, format de sortie, gestion des ambiguïtés). ' +
  'Réponds UNIQUEMENT avec la liste à puces, sans préambule ni conclusion.';

/** Construit le méta-prompt d'auto-critique (étape 1 de « Améliorer encore »). */
export function buildCritiqueMetaPrompt(current: string): string {
  return `${CRITIQUE_META}\n\n--- PROMPT À ANALYSER ---\n${current}`;
}

export interface CritiqueParams {
  readonly current: string;
  readonly adapter: ProviderAdapter;
  readonly options: GenerateOptions;
}

/** Étape 1 de « Améliorer encore » : streame une critique (liste de faiblesses) du prompt. */
export async function* critiqueStream(params: CritiqueParams): AsyncIterable<string> {
  yield* params.adapter.generate(buildCritiqueMetaPrompt(params.current), params.options);
}

/** Instruction de réécriture (étape 2) à passer à `refineStream` à partir d'une critique. */
export function improvementInstruction(critique: string): string {
  return (
    'Améliore le prompt en corrigeant spécifiquement les faiblesses identifiées ci-dessous, ' +
    'tout en restant fidèle à son intention :\n' +
    critique.trim()
  );
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
