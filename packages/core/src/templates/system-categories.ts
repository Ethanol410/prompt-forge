import type { CategoryBundle } from '../models/category-bundle.js';

/**
 * Les 4 catégories système du MVP (D4 : figées, non éditables au MVP).
 * Chaque catégorie a un `skeleton` (structure paramétrable, placeholder `{{intent}}`) servant
 * aussi de fallback déterministe, et un `metaPrompt` (instruction d'optimisation LLM).
 *
 * NOTE QUALITÉ (R3) : ces contenus sont la principale source de valeur du produit ; ils sont
 * destinés à être itérés sur la base du feedback 👍/👎. Première version ci-dessous.
 */
export type SystemCategory = CategoryBundle;

const META_PROMPT_COMMON =
  'Tu es un expert en prompt engineering. À partir de l’intention et de la structure de référence, ' +
  'produis LE prompt optimal, prêt à coller dans un assistant IA. Le prompt final doit : ' +
  '(1) assigner un rôle clair et expert ; (2) rappeler le contexte utile ; ' +
  '(3) découper la tâche en étapes ordonnées ; (4) lister des contraintes explicites et vérifiables ; ' +
  '(5) spécifier précisément le format de sortie attendu ; ' +
  '(6) lever les ambiguïtés et indiquer quoi faire en cas d’information manquante (poser des questions ou marquer [HYPOTHÈSE]). ' +
  'Reste fidèle à l’intention sans inventer de faits. ' +
  'Réponds UNIQUEMENT avec le prompt final — aucun préambule, aucun commentaire, aucune balise de code. ' +
  'Écris dans la langue de l’intention de l’utilisateur.';

function def(
  slug: string,
  name: string,
  skeleton: string,
  metaPromptIntro: string,
): SystemCategory {
  const categoryId = `cat-${slug}`;
  const templateId = `tpl-${slug}`;
  return {
    category: {
      id: categoryId,
      name,
      slug,
      isBuiltin: true,
      templateId,
      owner: 'system',
    },
    template: {
      id: templateId,
      categoryId,
      version: 1,
      skeleton: skeleton.trim(),
      metaPrompt: `${metaPromptIntro} ${META_PROMPT_COMMON}`,
      paramsSchema: null,
      isBuiltin: true,
    },
  };
}

export const SYSTEM_CATEGORIES: readonly SystemCategory[] = [
  def(
    'prd-technique',
    'PRD technique',
    `
Tu es un Product Manager technique senior. Rédige un PRD clair, structuré et actionnable.

# Intention
{{intent}}

# Structure attendue
1. Problème & vision
2. Personas & cas d'usage
3. Objectifs & KPIs mesurables
4. User stories
5. Exigences fonctionnelles (priorisation MoSCoW)
6. Exigences non-fonctionnelles (performance, sécurité, confidentialité)
7. Risques, hypothèses & dépendances
8. Jalons / roadmap

# Contraintes
- Chaque exigence doit être formulée de façon testable.
- Marque toute affirmation non confirmée par « [HYPOTHÈSE] ».
`,
    "À partir de l'intention de l'utilisateur et de la structure de PRD de référence, rédige le meilleur prompt prêt à l'emploi qui produira un PRD technique d'excellente qualité.",
  ),
  def(
    'code',
    'Code / Code review',
    `
Tu es un ingénieur logiciel senior. Produis du code ou une revue de code de haute qualité.

# Intention
{{intent}}

# Structure attendue
1. Contexte & objectif
2. Stack & contraintes techniques
3. Tâche précise à réaliser
4. Critères d'acceptation (tests, edge cases)
5. Contraintes de qualité (style, sécurité, performance)
6. Format de sortie attendu (fichiers, diffs, explications)

# Contraintes
- Privilégier les solutions testables et maintenables.
- Expliciter les hypothèses sur l'environnement et les dépendances.
`,
    "À partir de l'intention de l'utilisateur et de la structure de référence, rédige le meilleur prompt prêt à l'emploi pour un agent de codage (type Claude Code / Cursor) afin de produire un code ou une revue de code de qualité.",
  ),
  def(
    'email-comms',
    'Email / Comms',
    `
Tu es un expert en communication écrite professionnelle. Rédige un message percutant et adapté.

# Intention
{{intent}}

# Structure attendue
1. Objectif du message
2. Audience cible & contexte
3. Ton souhaité (formel, direct, chaleureux…)
4. Points clés à faire passer
5. Objections anticipées & réponses
6. Appel à l'action clair
7. Format & longueur attendus

# Contraintes
- Message clair, sans jargon inutile, orienté valeur pour le destinataire.
`,
    "À partir de l'intention de l'utilisateur et de la structure de référence, rédige le meilleur prompt prêt à l'emploi qui produira un email ou un message de communication efficace et adapté à sa cible.",
  ),
  def(
    'design-ux',
    'Design / UX',
    `
Tu es un designer produit / UX senior. Produis un brief créatif riche et exploitable.

# Intention
{{intent}}

# Structure attendue
1. Contexte produit & problème utilisateur
2. Utilisateurs cibles & besoins
3. Objectifs d'expérience (UX) et de marque
4. Contraintes esthétiques & références (style, ton, inspirations)
5. Livrables attendus (écrans, composants, flux)
6. Critères de réussite
7. Format de sortie attendu

# Contraintes
- Donner des contraintes concrètes (couleurs, typographie, ton) plutôt que vagues.
`,
    "À partir de l'intention de l'utilisateur et de la structure de référence, rédige le meilleur prompt prêt à l'emploi qui produira un brief de design / UX riche, contraint et exploitable.",
  ),
  def(
    'reseaux-sociaux',
    'Réseaux sociaux',
    `
Tu es un expert en réseaux sociaux. Rédige un post percutant et adapté à la plateforme.

# Intention
{{intent}}

# Structure attendue
1. Plateforme cible & format (LinkedIn, X, Instagram…)
2. Accroche (1ère ligne qui stoppe le scroll)
3. Corps : valeur claire, ton adapté
4. Appel à l'action
5. Hashtags pertinents (si adapté)

# Contraintes
- Adapter longueur et ton à la plateforme.
- Accroche forte, pas de jargon inutile.
`,
    "À partir de l'intention de l'utilisateur et de la structure de référence, rédige le meilleur prompt prêt à l'emploi pour produire un post de réseau social percutant et adapté à sa plateforme.",
  ),
  def(
    'resume-synthese',
    'Résumé & synthèse',
    `
Tu es un expert en synthèse. Produis un résumé fidèle, clair et structuré.

# Intention
{{intent}}

# Structure attendue
1. Type de source & objectif du résumé
2. Points clés (liste hiérarchisée)
3. Niveau de détail / longueur cible
4. Format de sortie (TL;DR, puces, paragraphe)

# Contraintes
- Rester fidèle à la source, ne rien inventer.
- Hiérarchiser l'essentiel avant les détails.
`,
    "À partir de l'intention de l'utilisateur et de la structure de référence, rédige le meilleur prompt prêt à l'emploi pour produire un résumé / une synthèse fidèle, clair et bien structuré.",
  ),
  def(
    'apprentissage',
    'Apprentissage & explication',
    `
Tu es un pédagogue expert. Explique de façon claire et adaptée au niveau visé.

# Intention
{{intent}}

# Structure attendue
1. Sujet & niveau de l'apprenant
2. Explication progressive (du simple au complexe)
3. Analogies et exemples concrets
4. Pièges fréquents à éviter
5. Vérification de compréhension (questions)

# Contraintes
- Adapter le vocabulaire au niveau indiqué.
- Privilégier exemples et analogies aux définitions abstraites.
`,
    "À partir de l'intention de l'utilisateur et de la structure de référence, rédige le meilleur prompt prêt à l'emploi pour obtenir une explication pédagogique claire, progressive et adaptée au niveau de l'apprenant.",
  ),
  def(
    'ideation',
    'Idéation & brainstorming',
    `
Tu es un facilitateur d'idéation. Génère des idées variées puis aide à les trier.

# Intention
{{intent}}

# Structure attendue
1. Problème / objectif & contraintes
2. Angles d'exploration
3. Génération divergente (beaucoup d'idées variées)
4. Critères d'évaluation
5. Sélection des meilleures idées + justification

# Contraintes
- D'abord diverger (quantité), puis converger (tri).
- Idées concrètes et actionnables.
`,
    "À partir de l'intention de l'utilisateur et de la structure de référence, rédige le meilleur prompt prêt à l'emploi pour générer des idées variées (divergence) puis les évaluer et sélectionner (convergence).",
  ),
];

/** Renvoie la définition système pour un slug, ou `undefined`. */
export function getSystemCategoryBySlug(slug: string): SystemCategory | undefined {
  return SYSTEM_CATEGORIES.find((c) => c.category.slug === slug);
}

/**
 * Exemples d'intention par catégorie système (chips de démarrage, F-onboarding).
 * Aident l'utilisateur (surtout non-technique) à savoir quoi écrire. Cliquer = pré-remplir.
 */
export const SYSTEM_CATEGORY_EXAMPLES: Readonly<Record<string, readonly string[]>> = {
  'prd-technique': [
    'Une app mobile de suivi de dépenses partagées entre colocataires',
    'Un module de notifications push multi-canal pour un SaaS B2B',
    'Une marketplace de cours en ligne avec paiement et avis',
  ],
  code: [
    'Une fonction TypeScript qui valide et normalise un numéro de téléphone FR',
    'Faire la revue de ce composant React pour la perf et l’accessibilité',
    'Un script Python qui dédoublonne un CSV et exporte un rapport',
  ],
  'email-comms': [
    'Relancer un prospect B2B resté silencieux après une démo',
    'Annoncer une hausse de prix à mes clients en limitant le churn',
    'Email de bienvenue chaleureux pour de nouveaux inscrits',
  ],
  'design-ux': [
    'Refondre l’écran d’onboarding d’une app de méditation',
    'Un design system minimaliste pour un dashboard analytique',
    'Améliorer le tunnel de paiement d’un site e-commerce',
  ],
  'reseaux-sociaux': [
    'Un post LinkedIn pour annoncer une levée de fonds',
    'Un thread X sur 5 erreurs de débutant en JavaScript',
    'Une légende Instagram pour le lancement d’un produit',
  ],
  'resume-synthese': [
    'Résumer cet article de 10 pages en 5 points clés',
    'Synthétiser les décisions d’une réunion d’équipe',
    'Un TL;DR d’un rapport trimestriel',
  ],
  apprentissage: [
    'Explique-moi les closures en JavaScript',
    'Comprendre la TVA pour un auto-entrepreneur',
    'Les bases du machine learning pour un débutant',
  ],
  ideation: [
    '10 idées de noms pour une app de cuisine',
    'Des angles pour une campagne marketing écolo',
    'Idées de fonctionnalités pour un SaaS RH',
  ],
};

/** Exemples d'intention pour un slug de catégorie (liste vide si inconnu / template perso). */
export function getCategoryExamples(slug: string): readonly string[] {
  return SYSTEM_CATEGORY_EXAMPLES[slug] ?? [];
}
