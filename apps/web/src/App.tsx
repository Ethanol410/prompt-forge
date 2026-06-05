import type { ReactElement } from 'react';
import { PromptForgeApp, type ProviderChoice, type AppDeps } from '@promptforge/ui';
import { NoopAnalytics } from '@promptforge/core';
import { WebCryptoSecretStore } from './adapters/webcrypto-secret-store.js';
import { getOrCreateMasterKey } from './adapters/key-vault.js';
import { FetchHttpClient } from './adapters/fetch-http-client.js';
import { IndexedDbHistoryStore } from './adapters/indexeddb-history-store.js';
import { IndexedDbTemplateStore } from './adapters/indexeddb-template-store.js';
import { IndexedDbPrefsStore } from './adapters/indexeddb-prefs-store.js';
import { DESKTOP_DOWNLOAD_URL } from './config.js';

// Adapters web injectés (BYOK direct, aucun backend éditeur).
const deps: AppDeps = {
  secretStore: new WebCryptoSecretStore(getOrCreateMasterKey),
  httpClient: new FetchHttpClient(),
  historyStore: new IndexedDbHistoryStore(),
  templateStore: new IndexedDbTemplateStore(),
  prefsStore: new IndexedDbPrefsStore(),
  analytics: new NoopAnalytics(),
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
  },
  {
    type: 'ollama',
    label: 'Ollama (local)',
    needsKey: false,
    isLocal: true,
    defaultModel: 'llama3.1',
    defaultBaseUrl: 'http://localhost:11434',
  },
  {
    type: 'lmstudio',
    label: 'LM Studio (local)',
    needsKey: false,
    isLocal: true,
    defaultModel: 'local-model',
    defaultBaseUrl: 'http://localhost:1234',
  },
  {
    type: 'openrouter',
    label: 'OpenRouter (cloud)',
    needsKey: true,
    isLocal: false,
    defaultModel: 'openai/gpt-4o-mini',
    defaultBaseUrl: '',
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
  },
];

export interface AppProps {
  /** Retour vers la landing (fourni par le routeur web). */
  readonly onNavigateHome?: () => void;
}

export function App({ onNavigateHome }: AppProps = {}): ReactElement {
  return (
    <PromptForgeApp
      deps={deps}
      providers={WEB_PROVIDERS}
      platformLabel="web"
      desktopDownloadUrl={DESKTOP_DOWNLOAD_URL}
      onNavigateHome={onNavigateHome}
    />
  );
}
