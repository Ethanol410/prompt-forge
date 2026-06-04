import type { ParamsSchema, TemplateParam } from '../models/template.js';

/** Valeurs par défaut des variables d'un schéma (clé → valeur par défaut). */
export function defaultParamValues(schema: ParamsSchema | null): Record<string, string> {
  const values: Record<string, string> = {};
  if (!schema) return values;
  for (const param of schema.params) values[param.key] = param.defaultValue;
  return values;
}

/** Variables requises non renseignées (pour bloquer la génération avec un message clair). */
export function missingRequiredParams(
  schema: ParamsSchema | null,
  values: Readonly<Record<string, string>>,
): readonly TemplateParam[] {
  if (!schema) return [];
  return schema.params.filter((p) => p.required && (values[p.key] ?? '').trim().length === 0);
}
