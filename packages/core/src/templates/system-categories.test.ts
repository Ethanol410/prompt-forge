import { describe, it, expect } from 'vitest';
import { SYSTEM_CATEGORIES, getSystemCategoryBySlug } from './system-categories.js';

describe('SYSTEM_CATEGORIES', () => {
  it('contient exactement les 4 catégories système du MVP', () => {
    const slugs = SYSTEM_CATEGORIES.map((c) => c.category.slug);
    expect(slugs).toEqual(['prd-technique', 'code', 'email-comms', 'design-ux']);
  });

  it('a des slugs et ids uniques', () => {
    const slugs = new Set(SYSTEM_CATEGORIES.map((c) => c.category.slug));
    const ids = new Set(SYSTEM_CATEGORIES.map((c) => c.category.id));
    expect(slugs.size).toBe(4);
    expect(ids.size).toBe(4);
  });

  it('relie correctement category.templateId et template.id, tout est builtin/system', () => {
    for (const { category, template } of SYSTEM_CATEGORIES) {
      expect(category.templateId).toBe(template.id);
      expect(template.categoryId).toBe(category.id);
      expect(category.isBuiltin).toBe(true);
      expect(category.owner).toBe('system');
      expect(template.isBuiltin).toBe(true);
    }
  });

  it('chaque squelette expose le placeholder {{intent}} et un méta-prompt non vide', () => {
    for (const { template } of SYSTEM_CATEGORIES) {
      expect(template.skeleton).toContain('{{intent}}');
      expect(template.metaPrompt.length).toBeGreaterThan(0);
    }
  });
});

describe('getSystemCategoryBySlug', () => {
  it('retrouve une catégorie existante', () => {
    expect(getSystemCategoryBySlug('code')?.category.name).toBe('Code / Code review');
  });

  it('renvoie undefined pour un slug inconnu', () => {
    expect(getSystemCategoryBySlug('inconnu')).toBeUndefined();
  });
});
