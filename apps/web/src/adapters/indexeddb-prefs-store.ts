import type { PrefsStore } from '@promptforge/core';
import { idbGet, idbPut, STORE_PREFS } from '../lib/idb.js';

/** PrefsStore web : préférences locales (clé→valeur) dans IndexedDB. */
export class IndexedDbPrefsStore implements PrefsStore {
  async get<T>(key: string): Promise<T | null> {
    return (await idbGet<T>(STORE_PREFS, key)) ?? null;
  }

  async set(key: string, value: unknown): Promise<void> {
    await idbPut(STORE_PREFS, value, key);
  }
}
