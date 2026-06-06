// Modèles de domaine (PRD §9)
export * from './models/index.js';

// Ports (interfaces plateforme)
export * from './ports/index.js';

// Providers (adaptateurs d'inférence)
export * from './providers/index.js';

// Moteur de génération hybride
export * from './engine/index.js';

// Catégories système (templates MVP)
export * from './templates/index.js';

// Export de prompts (F-S4)
export { buildExport } from './export/format.js';
export type { ExportFormat, ExportInput, ExportFile } from './export/format.js';

// Journal des nouveautés (modale « Quoi de neuf »)
export { CHANGELOG, LATEST_CHANGELOG_VERSION, changelogSince } from './changelog.js';
export type { ChangelogEntry } from './changelog.js';

// Utilitaires
export { slugify } from './util/slug.js';

// Implémentations agnostiques de plateforme
export { NoopAnalytics } from './analytics/noop-analytics.js';
