/**
 * Estimation heuristique du nombre de tokens (~4 caractères par token).
 * Approximation volontairement simple et locale (NF-CO2 : « estimation quand dispo »),
 * affichée comme indicative — pas un comptage exact (qui dépend du tokenizer du provider).
 */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return Math.ceil(trimmed.length / 4);
}
