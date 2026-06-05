import type { ProviderType } from '../models/provider-config.js';

export interface KeyValidation {
  readonly ok: boolean;
  readonly message: string;
}

/** Préfixes attendus par provider (validation de FORMAT, locale et instantanée — pas un appel réseau). */
const KEY_PREFIX: Partial<Record<ProviderType, RegExp>> = {
  anthropic: /^sk-ant-/,
  openai: /^sk-/,
  openrouter: /^sk-or-/,
};

/**
 * Vérifie le FORMAT d'une clé d'API (sans appel facturé ni requête réseau).
 * Donne un retour immédiat « format plausible » ; ce n'est pas une preuve de validité côté provider.
 */
export function validateApiKeyFormat(type: ProviderType, key: string): KeyValidation {
  const k = key.trim();
  if (k.length === 0) return { ok: false, message: 'Clé vide.' };
  if (k.length < 16) return { ok: false, message: 'Clé trop courte — format inattendu.' };
  const prefix = KEY_PREFIX[type];
  if (prefix && !prefix.test(k)) {
    return { ok: false, message: `Préfixe inattendu pour ${type} — vérifie la clé.` };
  }
  return { ok: true, message: 'Format de clé plausible ✓' };
}
