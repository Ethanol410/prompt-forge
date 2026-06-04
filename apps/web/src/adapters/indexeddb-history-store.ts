import type { HistoryStore, Generation, Rating } from '@promptforge/core';
import { idbGet, idbPut, idbGetAll, idbClear, STORE_HISTORY } from '../lib/idb.js';

/** HistoryStore web : historique local dans IndexedDB (NF-C1). `clear()` couvre le RGPD (NF-C3). */
export class IndexedDbHistoryStore implements HistoryStore {
  async add(generation: Generation): Promise<void> {
    await idbPut(STORE_HISTORY, generation);
  }

  async list(): Promise<readonly Generation[]> {
    const all = await idbGetAll<Generation>(STORE_HISTORY);
    return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string): Promise<Generation | null> {
    return (await idbGet<Generation>(STORE_HISTORY, id)) ?? null;
  }

  async setRating(id: string, rating: Rating): Promise<void> {
    const existing = await this.get(id);
    if (!existing) return;
    // Mise à jour immuable : nouvel objet, pas de mutation.
    await idbPut(STORE_HISTORY, { ...existing, rating });
  }

  async clear(): Promise<void> {
    await idbClear(STORE_HISTORY);
  }
}
