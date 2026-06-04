import { describe, it, expect } from 'vitest';
import { estimateTokens } from './token.js';

describe('estimateTokens', () => {
  it('renvoie 0 pour une chaîne vide ou blanche', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('   ')).toBe(0);
  });

  it('estime ~1 token pour 4 caractères', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('croît avec la longueur', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });
});
