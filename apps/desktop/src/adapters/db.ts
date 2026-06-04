import Database from '@tauri-apps/plugin-sql';

let dbPromise: Promise<Database> | null = null;

/** Charge la base SQLite locale et crée les tables au besoin (historique + catégories utilisateur). */
export function getDb(): Promise<Database> {
  if (dbPromise) return dbPromise;
  const loading = Database.load('sqlite:promptforge.db').then(async (db) => {
    await db.execute(
      `CREATE TABLE IF NOT EXISTS generations (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        template_version INTEGER NOT NULL,
        user_intent TEXT NOT NULL,
        output_prompt TEXT NOT NULL,
        provider_used TEXT NOT NULL,
        model_name TEXT NOT NULL,
        token_estimate INTEGER,
        rating TEXT,
        created_at TEXT NOT NULL
      )`,
    );
    await db.execute(
      `CREATE TABLE IF NOT EXISTS custom_categories (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      )`,
    );
    return db;
  });
  dbPromise = loading;
  return loading;
}
