/**
 * Évaluation heuristique d'un prompt (F-C4). 100 % local, déterministe, sans appel LLM —
 * un indicateur de qualité indicatif (pas une vérité absolue) qui guide l'utilisateur.
 */
export interface PromptCheck {
  readonly key: string;
  readonly label: string;
  readonly passed: boolean;
  /** Conseil affiché si le critère n'est pas rempli. */
  readonly hint: string;
}

export interface PromptScore {
  /** Score global 0–100. */
  readonly score: number;
  readonly checks: readonly PromptCheck[];
}

interface Heuristic {
  readonly key: string;
  readonly label: string;
  readonly weight: number;
  readonly test: (prompt: string) => boolean;
  readonly hint: string;
}

const HEURISTICS: readonly Heuristic[] = [
  {
    key: 'role',
    label: 'Rôle / persona défini',
    weight: 20,
    test: (p) => /(tu es|vous êtes|you are|act as|agis comme|en tant que|ton rôle)/i.test(p),
    hint: 'Précise un rôle (« Tu es un… »).',
  },
  {
    key: 'structure',
    label: 'Structure (sections / listes)',
    weight: 20,
    test: (p) => /(^|\n)\s*(#{1,6}\s|\d+\.\s|[-*]\s)/.test(p),
    hint: 'Ajoute des sections ou une liste numérotée.',
  },
  {
    key: 'constraints',
    label: 'Contraintes explicites',
    weight: 20,
    test: (p) => /(contrainte|ne pas|évite|limite|maximum|obligatoire|exigence|doit)/i.test(p),
    hint: 'Donne des contraintes claires (ce qu’il faut / ne faut pas).',
  },
  {
    key: 'format',
    label: 'Format de sortie précisé',
    weight: 20,
    test: (p) => /(format|markdown|json|tableau|liste|étapes|sortie attendue|réponds (uniquement|en))/i.test(p),
    hint: 'Indique le format de sortie attendu.',
  },
  {
    key: 'length',
    label: 'Longueur suffisante',
    weight: 20,
    test: (p) => p.trim().length >= 200,
    hint: 'Le prompt est court : ajoute du contexte et des détails.',
  },
];

export function scorePrompt(prompt: string): PromptScore {
  const checks = HEURISTICS.map((h) => ({
    key: h.key,
    label: h.label,
    passed: h.test(prompt),
    hint: h.hint,
  }));
  const score = HEURISTICS.reduce((sum, h, i) => sum + (checks[i]!.passed ? h.weight : 0), 0);
  return { score, checks };
}
