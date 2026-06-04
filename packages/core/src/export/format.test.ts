import { describe, it, expect } from 'vitest';
import { buildExport } from './format.js';

const input = { categoryName: 'PRD technique', intent: 'faire X', prompt: 'Le prompt final.' };

describe('buildExport', () => {
  it('markdown : structure + contexte, extension .md', () => {
    const file = buildExport(input, 'markdown');
    expect(file.filename).toBe('prd-technique.md');
    expect(file.mimeType).toBe('text/markdown');
    expect(file.content).toContain('# Prompt — PRD technique');
    expect(file.content).toContain('Intention : faire X');
    expect(file.content).toContain('Le prompt final.');
  });

  it('text : prompt brut, extension .txt', () => {
    const file = buildExport(input, 'text');
    expect(file.filename).toBe('prd-technique.txt');
    expect(file.mimeType).toBe('text/plain');
    expect(file.content.trim()).toBe('Le prompt final.');
  });
});
