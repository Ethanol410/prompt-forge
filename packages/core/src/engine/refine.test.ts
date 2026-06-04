import { describe, it, expect } from 'vitest';
import { refineStream, refineHybrid, REFINEMENTS } from './refine.js';
import { ProviderError } from '../providers/errors.js';
import type { ProviderAdapter } from '../providers/types.js';

function streamingAdapter(chunks: readonly string[]): ProviderAdapter {
  return {
    type: 'ollama',
    async *generate() {
      for (const c of chunks) yield c;
    },
  };
}

function throwingAdapter(): ProviderAdapter {
  return {
    type: 'ollama',
    // eslint-disable-next-line require-yield
    async *generate() {
      throw new ProviderError('http_error', 'boom', 500);
    },
  };
}

const options = { model: 'm' };

describe('refineStream', () => {
  it('streame le prompt affiné', async () => {
    const adapter = streamingAdapter(['Plus ', 'court']);
    let out = '';
    for await (const c of refineStream({ current: 'long', instruction: REFINEMENTS.shorter, adapter, options })) {
      out += c;
    }
    expect(out).toBe('Plus court');
  });
});

describe('refineHybrid', () => {
  it('retourne le prompt affiné si succès', async () => {
    const adapter = streamingAdapter(['  affiné  ']);
    const result = await refineHybrid({ current: 'original', instruction: 'x', adapter, options });
    expect(result).toEqual({ prompt: 'affiné', usedFallback: false });
  });

  it('retourne le prompt courant inchangé si le LLM échoue', async () => {
    const adapter = throwingAdapter();
    const result = await refineHybrid({ current: 'original', instruction: 'x', adapter, options });
    expect(result).toEqual({ prompt: 'original', usedFallback: true });
  });

  it('retourne le prompt courant si sortie vide', async () => {
    const adapter = streamingAdapter(['   ']);
    const result = await refineHybrid({ current: 'original', instruction: 'x', adapter, options });
    expect(result).toEqual({ prompt: 'original', usedFallback: true });
  });
});
