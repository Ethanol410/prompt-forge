/**
 * Port de préférences locales (clé→valeur JSON). Non secret (pas de clé d'inférence) :
 * mémorise par ex. la dernière catégorie / le dernier provider / modèle utilisés.
 * Implémentations : web IndexedDB, desktop SQLite.
 */
export interface PrefsStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
}
