import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IndexedDbHistoryStore } from './indexeddb-history-store.js';
import { idbClear, STORE_HISTORY } from '../lib/idb.js';
import type { Generation, Rating } from '@promptforge/core';

function gen(id: string, createdAt: string, rating: Rating = null): Generation {
  return {
    id,
    categoryId: 'cat',
    templateVersion: 1,
    userIntent: 'intention',
    outputPrompt: 'prompt',
    providerUsed: 'anthropic',
    modelName: 'model',
    tokenEstimate: null,
    rating,
    createdAt,
  };
}

describe('IndexedDbHistoryStore', () => {
  beforeEach(async () => {
    await idbClear(STORE_HISTORY);
  });

  it('ajoute et liste du plus récent au plus ancien', async () => {
    const store = new IndexedDbHistoryStore();
    await store.add(gen('1', '2026-01-01T00:00:00.000Z'));
    await store.add(gen('2', '2026-06-01T00:00:00.000Z'));
    const list = await store.list();
    expect(list.map((g) => g.id)).toEqual(['2', '1']);
  });

  it('get renvoie la génération ou null', async () => {
    const store = new IndexedDbHistoryStore();
    await store.add(gen('1', '2026-01-01T00:00:00.000Z'));
    expect((await store.get('1'))?.id).toBe('1');
    expect(await store.get('x')).toBeNull();
  });

  it('setRating met à jour sans muter l’objet original', async () => {
    const store = new IndexedDbHistoryStore();
    const original = gen('1', '2026-01-01T00:00:00.000Z');
    await store.add(original);
    await store.setRating('1', 'up');
    expect((await store.get('1'))?.rating).toBe('up');
    expect(original.rating).toBeNull();
  });

  it('delete supprime une seule entrée', async () => {
    const store = new IndexedDbHistoryStore();
    await store.add(gen('1', '2026-01-01T00:00:00.000Z'));
    await store.add(gen('2', '2026-06-01T00:00:00.000Z'));
    await store.delete('1');
    const list = await store.list();
    expect(list.map((g) => g.id)).toEqual(['2']);
    expect(await store.get('1')).toBeNull();
  });

  it('clear purge tout l’historique (RGPD)', async () => {
    const store = new IndexedDbHistoryStore();
    await store.add(gen('1', '2026-01-01T00:00:00.000Z'));
    await store.clear();
    expect(await store.list()).toEqual([]);
  });
});
