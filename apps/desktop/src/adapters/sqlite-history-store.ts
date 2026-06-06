import type { HistoryStore, Generation, Rating, ProviderType } from '@promptforge/core';
import { getDb } from './db.js';

interface Row {
  readonly id: string;
  readonly category_id: string;
  readonly template_version: number;
  readonly user_intent: string;
  readonly output_prompt: string;
  readonly provider_used: string;
  readonly model_name: string;
  readonly token_estimate: number | null;
  readonly rating: string | null;
  readonly favorite: number | null;
  readonly created_at: string;
}

function toGeneration(row: Row): Generation {
  return {
    id: row.id,
    categoryId: row.category_id,
    templateVersion: row.template_version,
    userIntent: row.user_intent,
    outputPrompt: row.output_prompt,
    providerUsed: row.provider_used as ProviderType,
    modelName: row.model_name,
    tokenEstimate: row.token_estimate,
    rating: (row.rating ?? null) as Rating,
    favorite: row.favorite === 1,
    createdAt: row.created_at,
  };
}

/** HistoryStore desktop : SQLite local via plugin-sql (PRD §8.2). `clear()` couvre le RGPD. */
export class SqliteHistoryStore implements HistoryStore {
  async add(generation: Generation): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT OR REPLACE INTO generations
        (id, category_id, template_version, user_intent, output_prompt, provider_used, model_name, token_estimate, rating, favorite, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        generation.id,
        generation.categoryId,
        generation.templateVersion,
        generation.userIntent,
        generation.outputPrompt,
        generation.providerUsed,
        generation.modelName,
        generation.tokenEstimate,
        generation.rating,
        generation.favorite ? 1 : 0,
        generation.createdAt,
      ],
    );
  }

  async list(): Promise<readonly Generation[]> {
    const db = await getDb();
    const rows = await db.select<Row[]>('SELECT * FROM generations ORDER BY created_at DESC');
    return rows.map(toGeneration);
  }

  async get(id: string): Promise<Generation | null> {
    const db = await getDb();
    const rows = await db.select<Row[]>('SELECT * FROM generations WHERE id = $1', [id]);
    return rows[0] ? toGeneration(rows[0]) : null;
  }

  async setRating(id: string, rating: Rating): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE generations SET rating = $1 WHERE id = $2', [rating, id]);
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE generations SET favorite = $1 WHERE id = $2', [favorite ? 1 : 0, id]);
  }

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM generations WHERE id = $1', [id]);
  }

  async clear(): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM generations');
  }
}
