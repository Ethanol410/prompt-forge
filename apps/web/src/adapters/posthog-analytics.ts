import posthog from 'posthog-js';
import type { Analytics, AnalyticsEvent } from '@promptforge/core';

/**
 * Analytics PostHog — événements ANONYMISÉS uniquement (NF-C2) : aucun contenu utilisateur
 * (intention, prompt, clé) n'est jamais envoyé. Autocapture, pageviews et session replay
 * désactivés (« events only »). Opt-out par défaut activé (capture ON), désinscription possible.
 */
// Token PostHog : fourni UNIQUEMENT par variable d'env (jamais commité). Si absent, l'analytics
// est désactivée (no-op). Le token reste néanmoins visible dans le bundle navigateur livré
// (inhérent à toute analytics client) — c'est un token public « write-only », pas un secret.
const KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

export class PostHogAnalytics implements Analytics {
  private ready = false;

  constructor() {
    if (!KEY) return;
    posthog.init(KEY, {
      api_host: HOST,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      // L'app n'envoie QUE les événements explicites définis ci-dessous.
    });
    this.ready = true;
  }

  track(event: AnalyticsEvent): void {
    if (!this.ready || posthog.has_opted_out_capturing()) return;
    const { name, ...props } = event;
    posthog.capture(name, props);
  }

  /** Désinscription (l'utilisateur refuse l'analytics). */
  optOut(): void {
    if (this.ready) posthog.opt_out_capturing();
  }

  /** Réinscription. */
  optIn(): void {
    if (this.ready) posthog.opt_in_capturing();
  }

  hasOptedOut(): boolean {
    return this.ready ? posthog.has_opted_out_capturing() : true;
  }
}
