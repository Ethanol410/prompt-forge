import type { Category } from './category.js';
import type { Template } from './template.js';

/**
 * Paire Catégorie + Template (relation 1—1, PRD §9). Sert aussi bien pour les catégories
 * système (figées) que pour les catégories utilisateur (F-S1, Jalon 2).
 */
export interface CategoryBundle {
  readonly category: Category;
  readonly template: Template;
}
