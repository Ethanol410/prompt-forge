/**
 * Template d'une catégorie (versionné). `skeleton` = structure + placeholders ;
 * `metaPrompt` = instruction d'optimisation LLM (OptimizationPass). PRD §9.
 */
export interface Template {
  readonly id: string;
  readonly categoryId: string;
  readonly version: number;
  readonly skeleton: string;
  readonly metaPrompt: string;
  /** Schéma de variables réutilisables (Could, F-C3). `null` au MVP. */
  readonly paramsSchema: Readonly<Record<string, unknown>> | null;
  readonly isBuiltin: boolean;
}
