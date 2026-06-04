import type { HttpResponse } from '../ports/http-client.js';

/** Lit le corps d'une réponse d'erreur sans jamais lever (pour enrichir un message d'erreur). */
export async function safeErrorBody(res: HttpResponse): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 500);
  } catch {
    return '';
  }
}
