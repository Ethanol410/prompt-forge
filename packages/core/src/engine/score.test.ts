import { describe, it, expect } from 'vitest';
import { scorePrompt } from './score.js';

describe('scorePrompt', () => {
  it('prompt vague et court → score faible', () => {
    const { score } = scorePrompt('écris un email');
    expect(score).toBeLessThan(50);
  });

  it('prompt riche (rôle + structure + contraintes + format + long) → score élevé', () => {
    const prompt = [
      'Tu es un expert en communication.',
      '# Structure attendue',
      '1. Objectif',
      '2. Audience',
      'Contraintes : ton formel, ne pas dépasser 200 mots.',
      'Format de sortie : markdown.',
      'Contexte détaillé : '.padEnd(220, 'x'),
    ].join('\n');
    const result = scorePrompt(prompt);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.checks).toHaveLength(5);
    expect(result.checks.every((c) => typeof c.passed === 'boolean')).toBe(true);
  });

  it('chaque critère échoué expose un conseil', () => {
    const { checks } = scorePrompt('court');
    const failed = checks.filter((c) => !c.passed);
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((c) => c.hint.length > 0)).toBe(true);
  });
});
