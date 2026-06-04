import type { CategoryBundle } from '../models/category-bundle.js';
import type { ParamsSchema, TemplateParam } from '../models/template.js';
import { slugify } from '../util/slug.js';
import { SYSTEM_CATEGORIES } from './system-categories.js';

export type UserCategoryErrorCode =
  | 'empty_name'
  | 'empty_skeleton'
  | 'missing_intent_placeholder'
  | 'empty_meta_prompt'
  | 'invalid_param_key'
  | 'duplicate_param_key';

const PARAM_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export class UserCategoryError extends Error {
  readonly code: UserCategoryErrorCode;
  constructor(code: UserCategoryErrorCode, message: string) {
    super(message);
    this.name = 'UserCategoryError';
    this.code = code;
  }
}

export interface UserCategoryInput {
  /** uuid de la catégorie (généré par l'appelant). */
  readonly id: string;
  /** uuid du template. */
  readonly templateId: string;
  readonly name: string;
  readonly skeleton: string;
  readonly metaPrompt: string;
  /** Version du template (incrémentée à l'édition). Défaut 1. */
  readonly version?: number;
  /** Variables du template (F-C3). */
  readonly params?: readonly TemplateParam[];
}

/** Valide et normalise les variables d'un template (clés uniques, identifiant valide, ≠ intent). */
function buildParamsSchema(params: readonly TemplateParam[] | undefined): ParamsSchema | null {
  if (!params || params.length === 0) return null;
  const seen = new Set<string>();
  const cleaned: TemplateParam[] = [];
  for (const param of params) {
    const key = param.key.trim();
    if (!PARAM_KEY_PATTERN.test(key) || key === 'intent') {
      throw new UserCategoryError(
        'invalid_param_key',
        `Clé de variable invalide : « ${param.key} » (lettres/chiffres/_, ne commence pas par un chiffre, ≠ « intent »).`,
      );
    }
    if (seen.has(key)) {
      throw new UserCategoryError('duplicate_param_key', `Variable en double : « ${key} ».`);
    }
    seen.add(key);
    const options = param.type === 'select'
      ? param.options?.map((o) => o.trim()).filter((o) => o.length > 0) ?? []
      : undefined;
    cleaned.push({
      key,
      label: param.label.trim() || key,
      type: param.type,
      required: param.required,
      defaultValue: param.defaultValue,
      ...(options ? { options } : {}),
    });
  }
  return { params: cleaned };
}

/**
 * Construit et VALIDE une catégorie utilisateur (F-S1). Garantit notamment que le squelette
 * contient `{{intent}}` (sinon l'intention de l'utilisateur ne serait jamais injectée).
 */
export function buildUserCategory(input: UserCategoryInput): CategoryBundle {
  const name = input.name.trim();
  if (name.length === 0) throw new UserCategoryError('empty_name', 'Le nom de la catégorie est requis.');

  const skeleton = input.skeleton.trim();
  if (skeleton.length === 0) throw new UserCategoryError('empty_skeleton', 'Le squelette est requis.');
  if (!skeleton.includes('{{intent}}')) {
    throw new UserCategoryError(
      'missing_intent_placeholder',
      'Le squelette doit contenir le placeholder {{intent}}.',
    );
  }

  const metaPrompt = input.metaPrompt.trim();
  if (metaPrompt.length === 0) {
    throw new UserCategoryError('empty_meta_prompt', "L'instruction d'optimisation (méta-prompt) est requise.");
  }

  const paramsSchema = buildParamsSchema(input.params);

  return {
    category: {
      id: input.id,
      name,
      slug: slugify(name, 'categorie'),
      isBuiltin: false,
      templateId: input.templateId,
      owner: 'user',
    },
    template: {
      id: input.templateId,
      categoryId: input.id,
      version: input.version ?? 1,
      skeleton,
      metaPrompt,
      paramsSchema,
      isBuiltin: false,
    },
  };
}

/** Fusionne les catégories système (figées) et utilisateur, système en premier. */
export function allCategories(custom: readonly CategoryBundle[]): readonly CategoryBundle[] {
  return [...SYSTEM_CATEGORIES, ...custom];
}

/** Retrouve un bundle par `category.id` dans une liste fusionnée. */
export function findCategoryById(
  all: readonly CategoryBundle[],
  id: string,
): CategoryBundle | undefined {
  return all.find((bundle) => bundle.category.id === id);
}
