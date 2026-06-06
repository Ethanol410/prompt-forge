/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Clé projet PostHog (token public d'ingestion, sûr côté client). */
  readonly VITE_PUBLIC_POSTHOG_KEY?: string;
  /** Host d'ingestion PostHog (US: https://us.i.posthog.com, EU: https://eu.i.posthog.com). */
  readonly VITE_PUBLIC_POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
