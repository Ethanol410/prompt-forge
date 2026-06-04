import type { CategoryBundle } from '../models/category-bundle.js';

/**
 * Port de persistance des catégories/templates UTILISATEUR (F-S1, Jalon 2).
 * Les catégories système restent en dur (non stockées ici). Implémentations :
 * - web : IndexedDB ; desktop : SQLite. Tout est local (NF-C1).
 * La clé est `category.id`.
 */
export interface TemplateStore {
  list(): Promise<readonly CategoryBundle[]>;
  get(categoryId: string): Promise<CategoryBundle | null>;
  /** Crée ou met à jour (upsert) une catégorie utilisateur et son template. */
  save(bundle: CategoryBundle): Promise<void>;
  delete(categoryId: string): Promise<void>;
}
