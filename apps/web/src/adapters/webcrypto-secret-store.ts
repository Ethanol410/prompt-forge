import type { SecretStore } from '@promptforge/core';
import { idbGet, idbPut, idbDelete, STORE_SECRETS } from '../lib/idb.js';

/** Enregistrement chiffré stocké dans IndexedDB. Ne contient JAMAIS la valeur en clair. */
interface SecretRecord {
  readonly iv: Uint8Array<ArrayBuffer>;
  readonly ciphertext: Uint8Array<ArrayBuffer>;
}

/**
 * SecretStore web : chiffre la valeur via AES-GCM 256 (WebCrypto) AVANT de la persister
 * dans IndexedDB (règle de sécurité non négociable). La clé maître est fournie par injection
 * (`getKey`) — typiquement `getOrCreateMasterKey` (clé non-extractible, D1).
 */
export class WebCryptoSecretStore implements SecretStore {
  constructor(private readonly getKey: () => Promise<CryptoKey>) {}

  async set(ref: string, value: string): Promise<void> {
    const key = await this.getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(value),
    );
    const record: SecretRecord = { iv, ciphertext: new Uint8Array(encrypted) };
    await idbPut(STORE_SECRETS, record, ref);
  }

  async get(ref: string): Promise<string | null> {
    const record = await idbGet<SecretRecord>(STORE_SECRETS, ref);
    if (!record) return null;
    const key = await this.getKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: record.iv },
      key,
      record.ciphertext,
    );
    return new TextDecoder().decode(decrypted);
  }

  async delete(ref: string): Promise<void> {
    await idbDelete(STORE_SECRETS, ref);
  }

  async has(ref: string): Promise<boolean> {
    return (await idbGet<SecretRecord>(STORE_SECRETS, ref)) !== undefined;
  }
}
