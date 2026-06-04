export type LicenseTier = 'free' | 'premium';

/** Mode de chiffrement des clés côté web (D1). Sans objet sur desktop (keychain OS). */
export type EncryptionMode = 'passphrase' | 'webcrypto_nonextractable';

/** Préférences utilisateur, locales (PRD §9). */
export interface UserPrefs {
  readonly activeProviderId: string | null;
  readonly licenseTier: LicenseTier;
  readonly analyticsOptIn: boolean;
  readonly encryptionMode: EncryptionMode;
}
