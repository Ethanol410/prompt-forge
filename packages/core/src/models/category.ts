/** Propriétaire d'une catégorie : système (figée au MVP) ou créée par l'utilisateur (Jalon 2). */
export type CategoryOwner = 'system' | 'user';

/** Slugs des 4 catégories système du MVP (D4 : non éditables au MVP). */
export type SystemCategorySlug = 'prd-technique' | 'code' | 'email-comms' | 'design-ux';

/** Catégorie de tâche. Relation 1—1 avec un Template (PRD §9). */
export interface Category {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly isBuiltin: boolean;
  readonly templateId: string;
  readonly owner: CategoryOwner;
}
