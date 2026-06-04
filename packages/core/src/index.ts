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

// Utilitaires
export { slugify } from './util/slug.js';

// Implémentations agnostiques de plateforme
export { NoopAnalytics } from './analytics/noop-analytics.js';
