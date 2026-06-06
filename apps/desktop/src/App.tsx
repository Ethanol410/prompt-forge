import { useEffect, type ReactElement } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PromptForgeApp, type ProviderChoice, type AppDeps } from '@promptforge/ui';
import { NoopAnalytics } from '@promptforge/core';
import { checkForUpdates } from './updater.js';
import { KeychainSecretStore } from './adapters/keychain-secret-store.js';
import { TauriHttpClient } from './adapters/tauri-http-client.js';
import { SqliteHistoryStore } from './adapters/sqlite-history-store.js';
import { SqliteTemplateStore } from './adapters/sqlite-template-store.js';
import { SqlitePrefsStore } from './adapters/sqlite-prefs-store.js';

// Adapters desktop injectés (BYOK direct ; clé dans le keychain OS).
const deps: AppDeps = {
  secretStore: new KeychainSecretStore(),
  httpClient: new TauriHttpClient(),
  historyStore: new SqliteHistoryStore(),
  templateStore: new SqliteTemplateStore(),
  prefsStore: new SqlitePrefsStore(),
  analytics: new NoopAnalytics(),
  // Ouvre l'export (ChatGPT/Claude/Gemini) dans le navigateur système, pas dans la webview Tauri.
  openExternal: (url: string) => void invoke('open_external', { url }),
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
    helpUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    type: 'openai',
    label: 'OpenAI (cloud)',
    needsKey: true,
    isLocal: false,
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: '',
    helpUrl: 'https://platform.openai.com/api-keys',
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
  {
    type: 'mistral',
    label: 'Mistral (cloud)',
    needsKey: true,
    isLocal: false,
    defaultModel: 'mistral-small-latest',
    defaultBaseUrl: '',
    helpUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    type: 'gemini',
    label: 'Gemini (cloud)',
    needsKey: true,
    isLocal: false,
    defaultModel: 'gemini-1.5-flash',
    defaultBaseUrl: '',
    helpUrl: 'https://aistudio.google.com/app/apikey',
  },
];

export function App(): ReactElement {
  useEffect(() => {
    void checkForUpdates();
  }, []);
  return <PromptForgeApp deps={deps} providers={DESKTOP_PROVIDERS} platformLabel="desktop" />;
}
