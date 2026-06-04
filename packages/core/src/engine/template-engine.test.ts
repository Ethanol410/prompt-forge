import { describe, it, expect } from 'vitest';
import {
  renderSkeleton,
  normalizeIntent,
  buildBasePrompt,
  buildMetaPrompt,
  MAX_INTENT_LENGTH,
} from './template-engine.js';
import { EngineError } from './errors.js';
import type { Template } from '../models/template.js';

const template: Template = {
  id: 'tpl-x',
  categoryId: 'cat-x',
  version: 1,
  skeleton: 'Rôle.\n# Intention\n{{intent}}\nFin.',
  metaPrompt: 'Optimise ce prompt.',
  paramsSchema: null,
  isBuiltin: true,
};

describe('renderSkeleton', () => {
  it('remplace les placeholders connus', () => {
    expect(renderSkeleton('a {{x}} b', { x: '42' })).toBe('a 42 b');
  });

  it('remplace les placeholders inconnus par une chaîne vide', () => {
    expect(renderSkeleton('a {{y}} b', { x: '42' })).toBe('a  b');
  });
});

describe('normalizeIntent', () => {
  it('rogne les espaces', () => {
    expect(normalizeIntent('  salut  ')).toBe('salut');
  });

  it('lève EngineError empty_intent pour une intention vide', () => {
    expect(() => normalizeIntent('   ')).toThrow(EngineError);
  });

  it('tronque au-delà de la longueur maximale', () => {
    const long = 'a'.repeat(MAX_INTENT_LENGTH + 100);
    expect(normalizeIntent(long)).toHaveLength(MAX_INTENT_LENGTH);
  });
});

describe('buildBasePrompt', () => {
  it("injecte l'intention normalisée dans le squelette", () => {
    expect(buildBasePrompt(template, '  faire X  ')).toContain('# Intention\nfaire X');
  });

  it('injecte les variables et garde intent prioritaire', () => {
    const tpl = { ...template, skeleton: 'Ton: {{ton}}\n{{intent}}' };
    const out = buildBasePrompt(tpl, 'faire X', { ton: 'direct', intent: 'IGNORÉ' });
    expect(out).toContain('Ton: direct');
    expect(out).toContain('faire X');
    expect(out).not.toContain('IGNORÉ');
  });
});

describe('buildMetaPrompt', () => {
  it("contient l'instruction d'optimisation et le template de référence", () => {
    const meta = buildMetaPrompt(template, 'faire X');
    expect(meta).toContain('Optimise ce prompt.');
    expect(meta).toContain('TEMPLATE DE RÉFÉRENCE');
    expect(meta).toContain('faire X');
  });
});
