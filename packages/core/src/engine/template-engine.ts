import type { Template } from '../models/template.js';
import { EngineError } from './errors.js';

/** Longueur maximale d'intention acceptée (garde-fou, PRD §8.4 « longueur max »). */
export const MAX_INTENT_LENGTH = 8000;

/** Remplace les placeholders `{{clé}}` du squelette par les valeurs fournies (clé absente → ''). */
export function renderSkeleton(skeleton: string, vars: Readonly<Record<string, string>>): string {
  return skeleton.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? '');
}

/** Valide et normalise l'intention utilisateur. Lève EngineError si vide. */
export function normalizeIntent(intent: string): string {
  const trimmed = intent.trim();
  if (trimmed.length === 0) {
    throw new EngineError('empty_intent', "L'intention ne peut pas être vide.");
  }
  return trimmed.slice(0, MAX_INTENT_LENGTH);
}

/**
 * Construit le prompt déterministe (template paramétré seul). C'est aussi le FALLBACK
 * retourné si l'appel LLM échoue — l'app reste utile hors-ligne / sans quota (PRD §8.4).
 */
export function buildBasePrompt(template: Template, intent: string): string {
  return renderSkeleton(template.skeleton, { intent: normalizeIntent(intent) });
}

/**
 * Construit le méta-prompt envoyé au LLM lors de l'OptimizationPass : l'instruction
 * d'optimisation de la catégorie + le template de référence paramétré.
 */
export function buildMetaPrompt(template: Template, intent: string): string {
  const reference = buildBasePrompt(template, intent);
  return `${template.metaPrompt}\n\n--- TEMPLATE DE RÉFÉRENCE ---\n${reference}`;
}
