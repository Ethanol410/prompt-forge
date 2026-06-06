/**
 * Ouverture d'une nouvelle discussion dans un LLM grand public avec le prompt généré.
 *
 * - ChatGPT / Claude : le prompt est pré-rempli via un paramètre de requête.
 * - Gemini : aucun paramètre d'URL public n'existe → on ouvre une discussion vide ; l'appelant
 *   met le prompt dans le presse-papier pour un collage manuel.
 *
 * Aucune clé ni appel d'inférence ici : on construit seulement une URL de navigation.
 */
export type LlmTarget = 'chatgpt' | 'claude' | 'gemini';

export interface LlmTargetInfo {
  readonly target: LlmTarget;
  readonly label: string;
  /** Vrai si l'URL pré-remplit le prompt ; faux si l'utilisateur doit le coller (Gemini). */
  readonly prefills: boolean;
}

export const LLM_TARGETS: readonly LlmTargetInfo[] = [
  { target: 'chatgpt', label: 'ChatGPT', prefills: true },
  { target: 'claude', label: 'Claude', prefills: true },
  { target: 'gemini', label: 'Gemini', prefills: false },
];

/**
 * Construit l'URL d'ouverture d'une nouvelle discussion dans le LLM cible.
 * Pour ChatGPT/Claude, `prompt` est encodé dans l'URL ; pour Gemini il est ignoré (cf. ci-dessus).
 */
export function buildLlmChatUrl(target: LlmTarget, prompt: string): string {
  switch (target) {
    case 'chatgpt':
      return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
    case 'claude':
      return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    case 'gemini':
      return 'https://gemini.google.com/app';
  }
}
