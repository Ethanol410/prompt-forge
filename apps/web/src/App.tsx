import type { ReactElement } from 'react';
import { PromptForgeApp, type ProviderChoice, type AppDeps } from '@promptforge/ui';
import { WebCryptoSecretStore } from './adapters/webcrypto-secret-store.js';
import { getOrCreateMasterKey } from './adapters/key-vault.js';
import { FetchHttpClient } from './adapters/fetch-http-client.js';
import { IndexedDbHistoryStore } from './adapters/indexeddb-history-store.js';
import { IndexedDbTemplateStore } from './adapters/indexeddb-template-store.js';
import { IndexedDbPrefsStore } from './adapters/indexeddb-prefs-store.js';
import { PostHogAnalytics } from './adapters/posthog-analytics.js';
import { DESKTOP_DOWNLOAD_URL } from './config.js';

/** Analytics PostHog (events anonymes only). Exposée pour le bandeau de consentement. */
export const analytics = new PostHogAnalytics();

// Adapters web injectés (BYOK direct, aucun backend éditeur).
const deps: AppDeps = {
  secretStore: new WebCryptoSecretStore(getOrCreateMasterKey),
  httpClient: new FetchHttpClient(),
  historyStore: new IndexedDbHistoryStore(),
  templateStore: new IndexedDbTemplateStore(),
  prefsStore: new IndexedDbPrefsStore(),
  analytics,
};

// Sur web : Anthropic (cloud) + modèles locaux. OpenAI affiché mais désactivé (D2 — CORS).
const WEB_PROVIDERS: readonly ProviderChoice[] = [
  {
    type: 'anthropic',
    label: 'Anthropic (cloud)',
    needsKey: true,
    isLocal: false,
    defaultModel: 'claude-3-5-sonnet-latest',
    defaultBaseUrl: '',
    helpUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    type: 'ollama',
    label: 'Ollama (local)',
    needsKey: false,
    isLocal: true,
    defaultModel: 'llama3.1',
    defaultBaseUrl: 'http://localhost:11434',
    helpUrl: 'https://ollama.com/download',
  },
  {
    type: 'lmstudio',
    label: 'LM Studio (local)',
    needsKey: false,
    isLocal: true,
    defaultModel: 'local-model',
    defaultBaseUrl: 'http://localhost:1234',
    helpUrl: 'https://lmstudio.ai',
  },
  {
    type: 'openrouter',
    label: 'OpenRouter (cloud)',
    needsKey: true,
    isLocal: false,
    defaultModel: 'openai/gpt-4o-mini',
    defaultBaseUrl: '',
    helpUrl: 'https://openrouter.ai/keys',
  },
  // CORS bloqué pour ces providers en navigateur (D2) → desktop-only.
  {
    type: 'openai',
    label: 'OpenAI',
    needsKey: true,
    isLocal: false,
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: '',
    disabled: true,
    disabledNote: 'disponible sur desktop',
    helpUrl: 'https://platform.openai.com/api-keys',
  },
  {
    type: 'mistral',
    label: 'Mistral',
    needsKey: true,
    isLocal: false,
    defaultModel: 'mistral-small-latest',
    defaultBaseUrl: '',
    disabled: true,
    disabledNote: 'disponible sur desktop',
    helpUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    type: 'gemini',
    label: 'Gemini',
    needsKey: true,
    isLocal: false,
    defaultModel: 'gemini-1.5-flash',
    defaultBaseUrl: '',
    disabled: true,
    disabledNote: 'disponible sur desktop',
    helpUrl: 'https://aistudio.google.com/app/apikey',
  },
];

/**
 * Vrai si la page est servie en HTTPS depuis un hôte distant (ex. Vercel).
 * Dans ce cas, le navigateur bloque les appels vers `http://localhost` (mixed content /
 * Private Network Access) : les modèles locaux ne sont accessibles que sur l'app desktop ou
 * en dev local (`http://localhost`). On les marque alors comme indisponibles, plutôt que de
 * laisser l'utilisateur tomber sur une erreur réseau confuse.
 */
function isRemoteHttps(): boolean {
  if (typeof window === 'undefined') return false;
  const { protocol, hostname } = window.location;
  const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  return protocol === 'https:' && !isLoopback;
}

const RESOLVED_WEB_PROVIDERS: readonly ProviderChoice[] = isRemoteHttps()
  ? WEB_PROVIDERS.map((p) =>
      p.isLocal ? { ...p, disabled: true, disabledNote: 'disponible sur desktop' } : p,
    )
  : WEB_PROVIDERS;

export interface AppProps {
  /** Retour vers la landing (fourni par le routeur web). */
  readonly onNavigateHome?: () => void;
}

export function App({ onNavigateHome }: AppProps = {}): ReactElement {
  return (
    <PromptForgeApp
      deps={deps}
      providers={RESOLVED_WEB_PROVIDERS}
      platformLabel="web"
      desktopDownloadUrl={DESKTOP_DOWNLOAD_URL}
      onNavigateHome={onNavigateHome}
    />
  );
}
