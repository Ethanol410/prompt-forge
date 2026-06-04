import type { TemplateStore, CategoryBundle } from '@promptforge/core';
import { getDb } from './db.js';

interface Row {
  readonly data: string;
}

/** TemplateStore desktop : catégories/templates utilisateur en SQLite (JSON sérialisé), clé `category.id`. */
export class SqliteTemplateStore implements TemplateStore {
  async list(): Promise<readonly CategoryBundle[]> {
    const db = await getDb();
    const rows = await db.select<Row[]>('SELECT data FROM custom_categories ORDER BY id');
    return rows.map((row) => JSON.parse(row.data) as CategoryBundle);
  }

  async get(categoryId: string): Promise<CategoryBundle | null> {
    const db = await getDb();
    const rows = await db.select<Row[]>('SELECT data FROM custom_categories WHERE id = $1', [categoryId]);
    return rows[0] ? (JSON.parse(rows[0].data) as CategoryBundle) : null;
  }

  async save(bundle: CategoryBundle): Promise<void> {
    const db = await getDb();
    await db.execute('INSERT OR REPLACE INTO custom_categories (id, data) VALUES ($1, $2)', [
      bundle.category.id,
      JSON.stringify(bundle),
    ]);
  }

  async delete(categoryId: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM custom_categories WHERE id = $1', [categoryId]);
  }
}
