import type { Analytics } from '../ports/analytics.js';

/**
 * Implémentation no-op de l'analytics (décision MVP : stub, vrai provider branché plus tard).
 * Ne fait strictement rien — aucune donnée ne sort de l'appareil.
 */
export class NoopAnalytics implements Analytics {
  track(): void {
    // Volontairement vide.
  }
}
