/** Type d'une variable de template (F-C3). */
export type TemplateParamType = 'text' | 'select';

/** Une variable réutilisable, injectée dans le squelette via `{{key}}`. */
export interface TemplateParam {
  readonly key: string;
  readonly label: string;
  readonly type: TemplateParamType;
  readonly required: boolean;
  readonly defaultValue: string;
  /** Options proposées pour un type `select`. */
  readonly options?: readonly string[];
}

/** Schéma de variables d'un template (F-C3). */
export interface ParamsSchema {
  readonly params: readonly TemplateParam[];
}

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
  /** Schéma de variables réutilisables (F-C3). `null` si le template n'en a pas. */
  readonly paramsSchema: ParamsSchema | null;
  readonly isBuiltin: boolean;
}
