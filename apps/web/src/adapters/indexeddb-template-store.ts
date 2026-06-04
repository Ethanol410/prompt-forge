import type { TemplateStore, CategoryBundle } from '@promptforge/core';
import { idbGet, idbPut, idbDelete, idbGetAll, STORE_TEMPLATES } from '../lib/idb.js';

/** TemplateStore web : catégories/templates utilisateur dans IndexedDB, clé = `category.id` (F-S1). */
export class IndexedDbTemplateStore implements TemplateStore {
  async list(): Promise<readonly CategoryBundle[]> {
    return idbGetAll<CategoryBundle>(STORE_TEMPLATES);
  }

  async get(categoryId: string): Promise<CategoryBundle | null> {
    return (await idbGet<CategoryBundle>(STORE_TEMPLATES, categoryId)) ?? null;
  }

  async save(bundle: CategoryBundle): Promise<void> {
    await idbPut(STORE_TEMPLATES, bundle, bundle.category.id);
  }

  async delete(categoryId: string): Promise<void> {
    await idbDelete(STORE_TEMPLATES, categoryId);
  }
}
