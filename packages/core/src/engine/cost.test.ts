import { describe, it, expect } from 'vitest';
import { estimateCost } from './cost.js';

describe('estimateCost', () => {
  it('gratuit pour les providers locaux', () => {
    expect(estimateCost('ollama', 'llama3.1', 1000)).toEqual({ amountUsd: 0, free: true });
    expect(estimateCost('lmstudio', 'local', 1000)).toEqual({ amountUsd: 0, free: true });
  });

  it('calcule un coût pour un modèle connu', () => {
    const r = estimateCost('openai', 'gpt-4o-mini', 1_000_000);
    expect(r.free).toBe(false);
    expect(r.amountUsd).toBeCloseTo(0.6, 5);
  });

  it('proportionnel au nombre de tokens', () => {
    expect(estimateCost('anthropic', 'claude-3-5-sonnet-latest', 500_000).amountUsd).toBeCloseTo(7.5, 5);
  });

  it('renvoie null pour un modèle inconnu (cloud)', () => {
    expect(estimateCost('openrouter', 'un-modele-inconnu-xyz', 1000).amountUsd).toBeNull();
  });
});
