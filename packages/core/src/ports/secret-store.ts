/**
 * Port de stockage des secrets (clés d'API). Implémentations :
 * - desktop : keychain OS (keyring-rs) ;
 * - web : valeur chiffrée AES-GCM (WebCrypto) avant IndexedDB.
 *
 * Contrat de sécurité (non négociable) : aucune implémentation ne doit logger la valeur,
 * ni la persister en clair, ni l'exposer à un backend de l'éditeur (NF-S1/NF-S2).
 * La valeur n'est lue (`get`) qu'au moment de l'appel d'inférence, puis libérée.
 */
export interface SecretStore {
  /** Associe `ref` (ex. "provider:anthropic") à un secret. Écrase si `ref` existe déjà. */
  set(ref: string, value: string): Promise<void>;
  /** Renvoie le secret pour `ref`, ou `null` si absent. */
  get(ref: string): Promise<string | null>;
  /** Supprime le secret référencé par `ref` (no-op si absent). */
  delete(ref: string): Promise<void>;
  has(ref: string): Promise<boolean>;
}
