import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { WebCryptoSecretStore } from './webcrypto-secret-store.js';
import { idbGet, idbClear, STORE_SECRETS } from '../lib/idb.js';

async function makeStore(): Promise<WebCryptoSecretStore> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  return new WebCryptoSecretStore(() => Promise.resolve(key));
}

describe('WebCryptoSecretStore', () => {
  beforeEach(async () => {
    await idbClear(STORE_SECRETS);
  });

  it('chiffre puis déchiffre une valeur (roundtrip)', async () => {
    const store = await makeStore();
    await store.set('provider:anthropic', 'sk-secret-123');
    expect(await store.get('provider:anthropic')).toBe('sk-secret-123');
  });

  it('ne persiste JAMAIS la valeur en clair dans IndexedDB (NF-S1)', async () => {
    const store = await makeStore();
    await store.set('provider:anthropic', 'sk-PLAINTEXT-XYZ');
    const raw = await idbGet<{ iv: Uint8Array; ciphertext: Uint8Array }>(
      STORE_SECRETS,
      'provider:anthropic',
    );
    expect(raw).toBeDefined();
    const decoded = new TextDecoder().decode(raw!.ciphertext);
    expect(decoded).not.toContain('sk-PLAINTEXT-XYZ');
    expect(JSON.stringify(Array.from(raw!.ciphertext))).not.toContain('PLAINTEXT');
  });

  it('renvoie null pour une référence absente', async () => {
    const store = await makeStore();
    expect(await store.get('absent')).toBeNull();
  });

  it('has et delete fonctionnent', async () => {
    const store = await makeStore();
    await store.set('k', 'v');
    expect(await store.has('k')).toBe(true);
    await store.delete('k');
    expect(await store.has('k')).toBe(false);
    expect(await store.get('k')).toBeNull();
  });

  it('isole les secrets de plusieurs providers', async () => {
    const store = await makeStore();
    await store.set('a', 'va');
    await store.set('b', 'vb');
    expect(await store.get('a')).toBe('va');
    expect(await store.get('b')).toBe('vb');
  });
});
