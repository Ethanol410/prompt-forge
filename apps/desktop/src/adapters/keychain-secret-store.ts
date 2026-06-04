import type { SecretStore } from '@promptforge/core';
import { invoke } from '@tauri-apps/api/core';

/**
 * SecretStore desktop : délègue au keychain de l'OS via des commandes Rust (keyring-rs).
 * Sur Windows → Credential Manager / DPAPI. La clé n'est jamais écrite en fichier clair
 * (règle de sécurité non négociable). Le JS ne reçoit la valeur qu'au moment de l'appel.
 */
export class KeychainSecretStore implements SecretStore {
  async set(ref: string, value: string): Promise<void> {
    await invoke('secret_set', { reference: ref, value });
  }

  async get(ref: string): Promise<string | null> {
    return invoke<string | null>('secret_get', { reference: ref });
  }

  async delete(ref: string): Promise<void> {
    await invoke('secret_delete', { reference: ref });
  }

  async has(ref: string): Promise<boolean> {
    return invoke<boolean>('secret_has', { reference: ref });
  }
}
