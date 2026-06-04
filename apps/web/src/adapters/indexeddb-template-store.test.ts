import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IndexedDbTemplateStore } from './indexeddb-template-store.js';
import { idbClear, STORE_TEMPLATES } from '../lib/idb.js';
import { buildUserCategory } from '@promptforge/core';

function bundle(id: string, name = 'Mon template') {
  return buildUserCategory({
    id,
    templateId: `tpl-${id}`,
    name,
    skeleton: '# Intention\n{{intent}}',
    metaPrompt: 'Optimise.',
  });
}

describe('IndexedDbTemplateStore', () => {
  beforeEach(async () => {
    await idbClear(STORE_TEMPLATES);
  });

  it('enregistre et liste les bundles', async () => {
    const store = new IndexedDbTemplateStore();
    await store.save(bundle('a'));
    await store.save(bundle('b'));
    const list = await store.list();
    expect(list.map((b) => b.category.id).sort()).toEqual(['a', 'b']);
  });

  it('get renvoie le bundle ou null', async () => {
    const store = new IndexedDbTemplateStore();
    await store.save(bundle('a'));
    expect((await store.get('a'))?.category.id).toBe('a');
    expect(await store.get('x')).toBeNull();
  });

  it('save fait un upsert (même id écrase)', async () => {
    const store = new IndexedDbTemplateStore();
    await store.save(bundle('a', 'Version 1'));
    await store.save(bundle('a', 'Version 2'));
    expect((await store.get('a'))?.category.name).toBe('Version 2');
    expect(await store.list()).toHaveLength(1);
  });

  it('delete supprime', async () => {
    const store = new IndexedDbTemplateStore();
    await store.save(bundle('a'));
    await store.delete('a');
    expect(await store.get('a')).toBeNull();
  });
});
