import { describe, it, expect } from 'vitest';
import {
  buildUserCategory,
  allCategories,
  findCategoryById,
  UserCategoryError,
} from './user-category.js';
import { SYSTEM_CATEGORIES } from './system-categories.js';

const valid = {
  id: 'cat-user-1',
  templateId: 'tpl-user-1',
  name: 'Mon template',
  skeleton: 'Rôle.\n# Intention\n{{intent}}',
  metaPrompt: 'Optimise.',
};

describe('buildUserCategory', () => {
  it('construit un bundle utilisateur valide (owner user, non builtin)', () => {
    const bundle = buildUserCategory(valid);
    expect(bundle.category).toMatchObject({ id: 'cat-user-1', owner: 'user', isBuiltin: false });
    expect(bundle.template).toMatchObject({ id: 'tpl-user-1', categoryId: 'cat-user-1', isBuiltin: false, version: 1 });
    expect(bundle.category.templateId).toBe(bundle.template.id);
  });

  it('slugifie le nom (accents retirés)', () => {
    expect(buildUserCategory({ ...valid, name: 'Idée Géniale' }).category.slug).toBe('idee-geniale');
  });

  it('rejette un nom vide', () => {
    expect(() => buildUserCategory({ ...valid, name: '  ' })).toThrow(UserCategoryError);
  });

  it('rejette un squelette sans {{intent}}', () => {
    const error = (() => {
      try {
        buildUserCategory({ ...valid, skeleton: 'pas de placeholder' });
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(UserCategoryError);
    expect((error as UserCategoryError).code).toBe('missing_intent_placeholder');
  });

  it('rejette un méta-prompt vide', () => {
    expect(() => buildUserCategory({ ...valid, metaPrompt: '' })).toThrow(UserCategoryError);
  });

  it('utilise la version fournie', () => {
    expect(buildUserCategory({ ...valid, version: 3 }).template.version).toBe(3);
  });

  it('construit un paramsSchema à partir des variables', () => {
    const bundle = buildUserCategory({
      ...valid,
      params: [{ key: 'ton', label: 'Ton', type: 'text', required: true, defaultValue: 'formel' }],
    });
    expect(bundle.template.paramsSchema?.params[0]).toMatchObject({ key: 'ton', required: true });
  });

  it('paramsSchema null si aucune variable', () => {
    expect(buildUserCategory(valid).template.paramsSchema).toBeNull();
  });

  it('rejette une clé de variable invalide ou réservée', () => {
    expect(() =>
      buildUserCategory({
        ...valid,
        params: [{ key: 'intent', label: 'x', type: 'text', required: false, defaultValue: '' }],
      }),
    ).toThrow(UserCategoryError);
    expect(() =>
      buildUserCategory({
        ...valid,
        params: [{ key: '2bad', label: 'x', type: 'text', required: false, defaultValue: '' }],
      }),
    ).toThrow(UserCategoryError);
  });

  it('rejette les clés de variables en double', () => {
    expect(() =>
      buildUserCategory({
        ...valid,
        params: [
          { key: 'a', label: 'A', type: 'text', required: false, defaultValue: '' },
          { key: 'a', label: 'A2', type: 'text', required: false, defaultValue: '' },
        ],
      }),
    ).toThrow(UserCategoryError);
  });
});

describe('allCategories / findCategoryById', () => {
  it('place les catégories système avant les custom', () => {
    const custom = buildUserCategory(valid);
    const all = allCategories([custom]);
    expect(all).toHaveLength(SYSTEM_CATEGORIES.length + 1);
    expect(all[0]!.category.owner).toBe('system');
    expect(all[all.length - 1]!.category.id).toBe('cat-user-1');
  });

  it('retrouve par id', () => {
    const custom = buildUserCategory(valid);
    const all = allCategories([custom]);
    expect(findCategoryById(all, 'cat-user-1')?.category.name).toBe('Mon template');
    expect(findCategoryById(all, 'inconnu')).toBeUndefined();
  });
});
