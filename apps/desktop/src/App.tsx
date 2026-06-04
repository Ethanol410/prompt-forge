import type { ReactElement } from 'react';
import { PromptForgeApp, type ProviderChoice, type AppDeps } from '@promptforge/ui';
import { NoopAnalytics } from '@promptforge/core';
import { KeychainSecretStore } from './adapters/keychain-secret-store.js';
import { TauriHttpClient } from './adapters/tauri-http-client.js';
import { SqliteHistoryStore } from './adapters/sqlite-history-store.js';
import { SqliteTemplateStore } from './adapters/sqlite-template-store.js';

// Adapters desktop injectés (BYOK direct ; clé dans le keychain OS).
const deps: AppDeps = {
  secretStore: new KeychainSecretStore(),
  httpClient: new TauriHttpClient(),
  historyStore: new SqliteHistoryStore(),
  templateStore: new SqliteTemplateStore(),
  analytics: new NoopAnalytics(),
};

// Sur desktop : tous les providers, OpenAI inclus (HTTP natif Rust → pas de blocage CORS, D2).
const DESKTOP_PROVIDERS: readonly ProviderChoice[] = [
  {
    type: 'anthropic',
    label: 'Anthropic (cloud)',
    needsKey: true,
    isLocal: false,
    defaultModel: 'claude-3-5-sonnet-latest',
    defaultBaseUrl: '',
  },
  {
    type: 'openai',
    label: 'OpenAI (cloud)',
    needsKey: true,
    isLocal: false,
    defaultModel: 'gpt-4o-mini',
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
  {
    type: 'mistral',
    label: 'Mistral (cloud)',
    needsKey: true,
    isLocal: false,
    defaultModel: 'mistral-small-latest',
    defaultBaseUrl: '',
  },
  {
    type: 'gemini',
    label: 'Gemini (cloud)',
    needsKey: true,
    isLocal: false,
    defaultModel: 'gemini-1.5-flash',
    defaultBaseUrl: '',
  },
];

export function App(): ReactElement {
  return <PromptForgeApp deps={deps} providers={DESKTOP_PROVIDERS} platformLabel="desktop" />;
}
