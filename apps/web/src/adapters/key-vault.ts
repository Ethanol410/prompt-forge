import { idbGet, idbPut, STORE_KEYS } from '../lib/idb.js';

const MASTER_KEY_ID = 'master-aes-gcm';

/**
 * Récupère (ou crée) la clé maître AES-GCM 256 (D1, mode par défaut).
 * `extractable: false` → la clé ne peut JAMAIS être exportée en clair (même par notre propre code).
 * Elle est persistée telle quelle dans IndexedDB : le navigateur stocke un handle opaque, pas d'octets.
 *
 * (Mode passphrase Argon2id = option « sécurité renforcée », prévu plus tard — D1.)
 */
export async function getOrCreateMasterKey(): Promise<CryptoKey> {
  const existing = await idbGet<CryptoKey>(STORE_KEYS, MASTER_KEY_ID);
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  await idbPut(STORE_KEYS, key, MASTER_KEY_ID);
  return key;
}
