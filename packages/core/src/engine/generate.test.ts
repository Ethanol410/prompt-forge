import { describe, it, expect } from 'vitest';
import { generateHybrid, optimizeStream } from './generate.js';
import { EngineError } from './errors.js';
import { ProviderError } from '../providers/errors.js';
import type { ProviderAdapter } from '../providers/types.js';
import type { Template } from '../models/template.js';

const template: Template = {
  id: 'tpl-x',
  categoryId: 'cat-x',
  version: 1,
  skeleton: '# Intention\n{{intent}}',
  metaPrompt: 'Optimise.',
  paramsSchema: null,
  isBuiltin: true,
};

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

describe('optimizeStream', () => {
  it('émet les chunks du prompt optimisé', async () => {
    const adapter = streamingAdapter(['Bon', 'jour']);
    let out = '';
    for await (const c of optimizeStream({ template, intent: 'x', adapter, options })) out += c;
    expect(out).toBe('Bonjour');
  });
});

describe('generateHybrid', () => {
  it('retourne le prompt optimisé quand le LLM réussit', async () => {
    const adapter = streamingAdapter(['  Prompt optimisé  ']);
    const result = await generateHybrid({ template, intent: 'faire X', adapter, options });
    expect(result).toEqual({ prompt: 'Prompt optimisé', usedFallback: false });
  });

  it('retombe sur le template déterministe si le LLM échoue (fallback)', async () => {
    const adapter = throwingAdapter();
    const result = await generateHybrid({ template, intent: 'faire X', adapter, options });
    expect(result.usedFallback).toBe(true);
    expect(result.prompt).toContain('# Intention\nfaire X');
  });

  it('retombe sur le fallback si la sortie LLM est vide', async () => {
    const adapter = streamingAdapter(['   ']);
    const result = await generateHybrid({ template, intent: 'faire X', adapter, options });
    expect(result.usedFallback).toBe(true);
  });

  it("propage EngineError pour une intention vide (pas de fallback silencieux)", async () => {
    const adapter = streamingAdapter(['x']);
    await expect(generateHybrid({ template, intent: '   ', adapter, options })).rejects.toBeInstanceOf(
      EngineError,
    );
  });
});
