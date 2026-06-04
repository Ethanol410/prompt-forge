import { slugify } from '../util/slug.js';

export type ExportFormat = 'markdown' | 'text';

export interface ExportInput {
  readonly categoryName: string;
  readonly intent: string;
  readonly prompt: string;
}

export interface ExportFile {
  readonly filename: string;
  readonly mimeType: string;
  readonly content: string;
}

/**
 * Construit un fichier exportable du prompt (F-S4). `markdown` ajoute un contexte structuré ;
 * `text` exporte le prompt brut. Le format « prêt pour Claude Code » = prompt brut copié tel quel
 * (géré par le bouton Copier de l'UI).
 */
export function buildExport(input: ExportInput, format: ExportFormat): ExportFile {
  const base = slugify(input.categoryName, 'prompt');
  if (format === 'markdown') {
    const content = `# Prompt — ${input.categoryName}\n\n> Intention : ${input.intent}\n\n${input.prompt}\n`;
    return { filename: `${base}.md`, mimeType: 'text/markdown', content };
  }
  return { filename: `${base}.txt`, mimeType: 'text/plain', content: `${input.prompt}\n` };
}
