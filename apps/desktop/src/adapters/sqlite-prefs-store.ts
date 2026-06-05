import type { PrefsStore } from '@promptforge/core';
import { getDb } from './db.js';

interface Row {
  readonly value: string;
}

/** PrefsStore desktop : préférences locales (clé→valeur JSON) en SQLite. */
export class SqlitePrefsStore implements PrefsStore {
  async get<T>(key: string): Promise<T | null> {
    const db = await getDb();
    const rows = await db.select<Row[]>('SELECT value FROM prefs WHERE key = $1', [key]);
    if (!rows[0]) return null;
    try {
      return JSON.parse(rows[0].value) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    const db = await getDb();
    await db.execute('INSERT OR REPLACE INTO prefs (key, value) VALUES ($1, $2)', [
      key,
      JSON.stringify(value),
    ]);
  }
}
