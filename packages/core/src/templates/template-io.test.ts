import { describe, it, expect } from 'vitest';
import { exportTemplate, parseTemplateImport, TemplateImportError } from './template-io.js';
import { buildUserCategory } from './user-category.js';
import type { CategoryBundle } from '../models/category-bundle.js';

const bundle: CategoryBundle = buildUserCategory({
  id: 'c1',
  templateId: 't1',
  name: 'Mon template',
  skeleton: 'Rôle expert.\n\n# Intention\n{{intent}}\n\nLangue : {{lang}}',
  metaPrompt: 'Optimise ce prompt.',
  params: [{ key: 'lang', label: 'Langue', type: 'text', required: false, defaultValue: 'FR' }],
});

describe('template-io', () => {
  it('round-trip export → import préserve les champs', () => {
    const json = exportTemplate(bundle);
    const imported = parseTemplateImport(json);
    expect(imported.name).toBe('Mon template');
    expect(imported.skeleton).toContain('{{intent}}');
    expect(imported.metaPrompt).toBe('Optimise ce prompt.');
    expect(imported.params?.[0]?.key).toBe('lang');
  });

  it('réimporte vers un bundle valide via buildUserCategory', () => {
    const imported = parseTemplateImport(exportTemplate(bundle));
    const rebuilt = buildUserCategory({ id: 'c2', templateId: 't2', ...imported });
    expect(rebuilt.category.name).toBe('Mon template');
    expect(rebuilt.template.paramsSchema?.params.length).toBe(1);
  });

  it('rejette un JSON illisible', () => {
    expect(() => parseTemplateImport('{nope')).toThrow(TemplateImportError);
  });

  it('rejette un format étranger', () => {
    expect(() => parseTemplateImport(JSON.stringify({ format: 'autre', name: 'x' }))).toThrow(
      TemplateImportError,
    );
  });

  it('rejette des champs requis manquants', () => {
    expect(() =>
      parseTemplateImport(JSON.stringify({ format: 'promptforge-template', name: 'x' })),
    ).toThrow(TemplateImportError);
  });
});
