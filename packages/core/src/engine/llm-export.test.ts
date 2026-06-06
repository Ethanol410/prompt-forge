import { describe, it, expect } from 'vitest';
import { buildLlmChatUrl, LLM_TARGETS } from './llm-export.js';

describe('buildLlmChatUrl', () => {
  const prompt = 'Rôle : expert. Écris un test & vérifie = ok?';

  it('ChatGPT : prompt encodé dans ?q=', () => {
    const url = buildLlmChatUrl('chatgpt', prompt);
    expect(url.startsWith('https://chatgpt.com/?q=')).toBe(true);
    expect(url).toContain(encodeURIComponent(prompt));
  });

  it('Claude : nouvelle discussion avec ?q=', () => {
    const url = buildLlmChatUrl('claude', prompt);
    expect(url.startsWith('https://claude.ai/new?q=')).toBe(true);
    expect(url).toContain(encodeURIComponent(prompt));
  });

  it('Gemini : pas de pré-remplissage (URL fixe, prompt non inclus)', () => {
    const url = buildLlmChatUrl('gemini', prompt);
    expect(url).toBe('https://gemini.google.com/app');
    expect(url).not.toContain(encodeURIComponent(prompt));
  });

  it('encode les caractères spéciaux (pas d’injection dans l’URL)', () => {
    const url = buildLlmChatUrl('chatgpt', 'a b&c=d#e');
    expect(url).not.toContain(' ');
    expect(url).not.toContain('#e');
    expect(url).toContain('a%20b%26c%3Dd%23e');
  });

  it('métadonnées : 3 cibles, Gemini sans pré-remplissage', () => {
    expect(LLM_TARGETS.map((t) => t.target)).toEqual(['chatgpt', 'claude', 'gemini']);
    expect(LLM_TARGETS.find((t) => t.target === 'gemini')?.prefills).toBe(false);
    expect(LLM_TARGETS.find((t) => t.target === 'chatgpt')?.prefills).toBe(true);
  });
});
