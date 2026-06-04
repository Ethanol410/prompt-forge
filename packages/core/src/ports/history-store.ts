import type { Generation, Rating } from '../models/generation.js';

/**
 * Port d'historique local (repository pattern). Implémentations :
 * - desktop : SQLite (via Tauri) ; web : IndexedDB.
 * Tout est local (NF-C1). `clear()` couvre le droit à l'effacement RGPD (NF-C3).
 */
export interface HistoryStore {
  add(generation: Generation): Promise<void>;
  /** Renvoie les générations, des plus récentes aux plus anciennes. */
  list(): Promise<readonly Generation[]>;
  get(id: string): Promise<Generation | null>;
  setRating(id: string, rating: Rating): Promise<void>;
  /** Supprime une seule entrée d'historique (no-op si absente). */
  delete(id: string): Promise<void>;
  /** Purge tout l'historique local. */
  clear(): Promise<void>;
}
