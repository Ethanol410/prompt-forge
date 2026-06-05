import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IndexedDbPrefsStore } from './indexeddb-prefs-store.js';
import { idbClear, STORE_PREFS } from '../lib/idb.js';

describe('IndexedDbPrefsStore', () => {
  beforeEach(async () => {
    await idbClear(STORE_PREFS);
  });

  it('renvoie null pour une clé absente', async () => {
    expect(await new IndexedDbPrefsStore().get('x')).toBeNull();
  });

  it('persiste et relit une valeur', async () => {
    const store = new IndexedDbPrefsStore();
    await store.set('provider', 'ollama');
    expect(await store.get<string>('provider')).toBe('ollama');
    expect(await new IndexedDbPrefsStore().get<string>('provider')).toBe('ollama');
  });

  it('écrase la valeur existante', async () => {
    const store = new IndexedDbPrefsStore();
    await store.set('k', { a: 1 });
    await store.set('k', { a: 2 });
    expect(await store.get<{ a: number }>('k')).toEqual({ a: 2 });
  });
});
