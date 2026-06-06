import type { CategoryBundle } from '../models/category-bundle.js';
import type { TemplateParam } from '../models/template.js';

/**
 * Échange de templates personnalisés par fichier JSON (partage sans backend).
 * Enveloppe versionnée et auto-descriptive ; ne contient AUCUNE donnée sensible (ni clé, ni intention).
 */
const FORMAT = 'promptforge-template';
const FORMAT_VERSION = 1;

export interface TemplateExport {
  readonly format: typeof FORMAT;
  readonly version: number;
  readonly name: string;
  readonly skeleton: string;
  readonly metaPrompt: string;
  readonly params?: readonly TemplateParam[];
}

/** Champs prêts à passer à `buildUserCategory` (qui fait la validation métier complète). */
export interface ImportedTemplate {
  readonly name: string;
  readonly skeleton: string;
  readonly metaPrompt: string;
  readonly params?: readonly TemplateParam[];
}

export class TemplateImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateImportError';
  }
}

/** Sérialise un bundle en JSON exportable (indenté). */
export function exportTemplate(bundle: CategoryBundle): string {
  const payload: TemplateExport = {
    format: FORMAT,
    version: FORMAT_VERSION,
    name: bundle.category.name,
    skeleton: bundle.template.skeleton,
    metaPrompt: bundle.template.metaPrompt,
    ...(bundle.template.paramsSchema ? { params: bundle.template.paramsSchema.params } : {}),
  };
  return JSON.stringify(payload, null, 2);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

/**
 * Parse et valide la FORME d'un fichier de template exporté. La validation métier (présence de
 * `{{intent}}`, clés de variables, etc.) est laissée à `buildUserCategory`.
 */
export function parseTemplateImport(json: string): ImportedTemplate {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new TemplateImportError('Fichier illisible : JSON invalide.');
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new TemplateImportError('Format invalide : objet attendu.');
  }
  const obj = raw as Record<string, unknown>;
  if (obj.format !== FORMAT) {
    throw new TemplateImportError('Ce fichier n’est pas un template PromptForge.');
  }
  if (!isString(obj.name) || !isString(obj.skeleton) || !isString(obj.metaPrompt)) {
    throw new TemplateImportError('Champs requis manquants (name, skeleton, metaPrompt).');
  }
  let params: readonly TemplateParam[] | undefined;
  if (obj.params !== undefined) {
    if (!Array.isArray(obj.params)) {
      throw new TemplateImportError('Le champ « params » doit être une liste.');
    }
    params = obj.params as readonly TemplateParam[];
  }
  return {
    name: obj.name,
    skeleton: obj.skeleton,
    metaPrompt: obj.metaPrompt,
    ...(params ? { params } : {}),
  };
}
