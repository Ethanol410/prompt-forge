/**
 * Journal des nouveautés affiché dans l'app (modale « Quoi de neuf »).
 * Ordre : la plus récente EN PREMIER. La version de `CHANGELOG[0]` sert de repère « courant ».
 * Pas de contenu utilisateur ; texte produit, traduisible plus tard.
 */
export interface ChangelogEntry {
  readonly version: string;
  readonly date: string;
  readonly items: readonly string[];
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: '0.1.3',
    date: '2026-06-06',
    items: [
      'Sélecteur de modèles : la liste se remplit automatiquement selon le provider (fini les fautes de frappe).',
      'App desktop : mises à jour automatiques.',
      'Les nouveautés s’affichent au lancement (cette fenêtre).',
    ],
  },
  {
    version: '0.1.2',
    date: '2026-06-06',
    items: [
      'Ouvre ton prompt dans ChatGPT, Claude ou Gemini en un clic.',
      '« Améliorer encore » : le modèle critique puis réécrit, avec un diff entre versions.',
      '4 nouvelles catégories, onboarding guidé, recherche / favoris dans l’historique.',
    ],
  },
];

/** Version la plus récente du journal (repère pour savoir s'il y a du nouveau à montrer). */
export const LATEST_CHANGELOG_VERSION: string = CHANGELOG[0]?.version ?? '';

/**
 * Entrées plus récentes que `since` (exclu). Si `since` est absent/inconnu, renvoie `[]`
 * (on n'embête pas un nouvel utilisateur : l'onboarding s'en charge).
 */
export function changelogSince(since: string | null | undefined): readonly ChangelogEntry[] {
  if (!since) return [];
  const index = CHANGELOG.findIndex((e) => e.version === since);
  return index === -1 ? [] : CHANGELOG.slice(0, index);
}
