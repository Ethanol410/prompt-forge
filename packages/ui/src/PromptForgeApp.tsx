import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { annotate } from 'rough-notation';
import { SketchBox } from './components/SketchBox.js';
import { HandDrawnDefs } from './components/HandDrawnDefs.js';
import { Doodle } from './components/Doodle.js';
import { usePrefersReducedMotion } from './hooks/use-prefers-reduced-motion.js';
import {
  SYSTEM_CATEGORIES,
  allCategories,
  findCategoryById,
  buildUserCategory,
  UserCategoryError,
  createProviderAdapter,
  optimizeStream,
  refineStream,
  REFINEMENTS,
  buildBasePrompt,
  buildExport,
  estimateTokens,
  describeProviderError,
  type ExportFormat,
  type ProviderType,
  type Generation,
  type CategoryBundle,
  type SecretStore,
  type HttpClient,
  type HistoryStore,
  type TemplateStore,
  type Analytics,
} from '@promptforge/core';

/** Ports injectés par la plateforme (web ou desktop) — c'est ici que vit l'inversion de dépendance. */
export interface AppDeps {
  readonly secretStore: SecretStore;
  readonly httpClient: HttpClient;
  readonly historyStore: HistoryStore;
  readonly templateStore: TemplateStore;
  readonly analytics: Analytics;
}

const DEFAULT_SKELETON = `Tu es un expert. Produis un résultat de haute qualité.

# Intention
{{intent}}

# Contraintes
- Sois précis et actionnable.`;

const DEFAULT_META_PROMPT =
  "À partir de l'intention de l'utilisateur et de la structure de référence, rédige le meilleur prompt prêt à l'emploi. Réponds uniquement avec le prompt final, sans préambule. Écris dans la langue de l'intention.";

/** Une version de prompt affichée dans la pile (génération initiale puis affinages successifs). */
interface PromptVersion {
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
  readonly tokens: number;
  readonly fallback: boolean;
  readonly providerLabel: string;
  readonly model: string;
  readonly rating: 'up' | 'down' | null;
}

type GenStatus = 'idle' | 'thinking' | 'writing' | 'done';

const STATUS_LABEL: Record<Exclude<GenStatus, 'idle'>, string> = {
  thinking: 'Le modèle réfléchit…',
  writing: 'Le modèle écrit…',
  done: 'Le modèle a fini ✓',
};

/** Choix de provider proposé par la plateforme (la politique D2 s'exprime via cette liste). */
export interface ProviderChoice {
  readonly type: ProviderType;
  readonly label: string;
  readonly needsKey: boolean;
  readonly isLocal: boolean;
  readonly defaultModel: string;
  readonly defaultBaseUrl: string;
  /** Si vrai, l'option est affichée mais non sélectionnable (ex. OpenAI sur web — D2). */
  readonly disabled?: boolean;
  readonly disabledNote?: string;
}

export interface PromptForgeAppProps {
  readonly deps: AppDeps;
  readonly providers: readonly ProviderChoice[];
  readonly platformLabel?: string;
}

const secretRef = (type: ProviderType): string => `provider:${type}`;

export function PromptForgeApp({ deps, providers, platformLabel }: PromptForgeAppProps): ReactElement {
  const selectableProviders = useMemo(() => providers.filter((p) => !p.disabled), [providers]);
  const [categories, setCategories] = useState<readonly CategoryBundle[]>(SYSTEM_CATEGORIES);
  const [categoryId, setCategoryId] = useState(SYSTEM_CATEGORIES[0]!.category.id);
  const selectedCategory = useMemo(
    () => findCategoryById(categories, categoryId) ?? categories[0]!,
    [categories, categoryId],
  );
  const [intent, setIntent] = useState('');

  // Éditeur de templates personnalisés (F-S1).
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formSkeleton, setFormSkeleton] = useState(DEFAULT_SKELETON);
  const [formMeta, setFormMeta] = useState(DEFAULT_META_PROMPT);
  const [formError, setFormError] = useState<string | null>(null);
  const [providerType, setProviderType] = useState<ProviderType>(selectableProviders[0]!.type);
  const provider = useMemo(
    () => selectableProviders.find((p) => p.type === providerType) ?? selectableProviders[0]!,
    [selectableProviders, providerType],
  );

  const [model, setModel] = useState(provider.defaultModel);
  const [baseUrl, setBaseUrl] = useState(provider.defaultBaseUrl);
  const [keyInput, setKeyInput] = useState('');
  const [keySaved, setKeySaved] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<readonly PromptVersion[]>([]);
  const [draft, setDraft] = useState<{ readonly label: string; readonly text: string } | null>(null);
  const [genStatus, setGenStatus] = useState<GenStatus>('idle');
  const [history, setHistory] = useState<readonly Generation[]>([]);
  const [toasts, setToasts] = useState<readonly { readonly id: number; readonly message: string }[]>([]);
  const toastSeq = useRef(0);

  function showToast(message: string): void {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }

  const reducedMotion = usePrefersReducedMotion();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  // Comparaison A/B brut ↔ optimisé (F-S5).
  const [abMode, setAbMode] = useState(false);
  const [abRaw, setAbRaw] = useState('');
  const [abOptimized, setAbOptimized] = useState('');

  useEffect(() => {
    void refreshHistory();
    void refreshCategories();
  }, []);

  // rough-notation : souligner le titre (une fois, au montage).
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const annotation = annotate(el, {
      type: 'underline',
      color: '#e8743b',
      strokeWidth: 2,
      padding: 2,
      animate: !reducedMotion,
      animationDuration: reducedMotion ? 0 : 700,
    });
    annotation.show();
    return () => annotation.remove();
  }, [reducedMotion]);

  // rough-notation : entourer la catégorie sélectionnée (re-trace au changement).
  useEffect(() => {
    const el = categoryRef.current;
    if (!el) return;
    const annotation = annotate(el, {
      type: 'box',
      color: '#3b82a0',
      strokeWidth: 1.5,
      padding: 6,
      animate: !reducedMotion,
      animationDuration: reducedMotion ? 0 : 600,
    });
    annotation.show();
    return () => annotation.remove();
  }, [categoryId, reducedMotion]);

  async function refreshCategories(): Promise<void> {
    const custom = await deps.templateStore.list();
    setCategories(allCategories(custom));
  }

  function openNewTemplate(): void {
    setEditingId(null);
    setFormName('');
    setFormSkeleton(DEFAULT_SKELETON);
    setFormMeta(DEFAULT_META_PROMPT);
    setFormError(null);
    setEditorOpen(true);
  }

  function openEditTemplate(bundle: CategoryBundle): void {
    setEditingId(bundle.category.id);
    setFormName(bundle.category.name);
    setFormSkeleton(bundle.template.skeleton);
    setFormMeta(bundle.template.metaPrompt);
    setFormError(null);
    setEditorOpen(true);
  }

  async function handleSaveTemplate(): Promise<void> {
    setFormError(null);
    const existing = editingId ? findCategoryById(categories, editingId) : undefined;
    try {
      const bundle = buildUserCategory({
        id: editingId ?? crypto.randomUUID(),
        templateId: existing?.template.id ?? crypto.randomUUID(),
        name: formName,
        skeleton: formSkeleton,
        metaPrompt: formMeta,
        version: existing ? existing.template.version + 1 : 1,
      });
      await deps.templateStore.save(bundle);
      await refreshCategories();
      setCategoryId(bundle.category.id);
      setEditorOpen(false);
    } catch (error) {
      if (error instanceof UserCategoryError) {
        setFormError(error.message);
      } else {
        setFormError('Impossible d’enregistrer le template.');
      }
    }
  }

  async function handleDeleteTemplate(id: string): Promise<void> {
    if (!window.confirm('Supprimer ce template personnalisé ?')) return;
    await deps.templateStore.delete(id);
    if (categoryId === id) setCategoryId(SYSTEM_CATEGORIES[0]!.category.id);
    if (editingId === id) setEditorOpen(false);
    await refreshCategories();
  }

  useEffect(() => {
    setModel(provider.defaultModel);
    setBaseUrl(provider.defaultBaseUrl);
    setKeySaved(false);
    void deps.secretStore.has(secretRef(provider.type)).then(setKeySaved);
  }, [provider, deps.secretStore]);

  async function refreshHistory(): Promise<void> {
    setHistory(await deps.historyStore.list());
  }

  async function handleSaveKey(): Promise<void> {
    if (!keyInput.trim()) return;
    await deps.secretStore.set(secretRef(provider.type), keyInput.trim());
    setKeyInput('');
    setKeySaved(true);
    deps.analytics.track({ name: 'provider_configured', provider: provider.type });
  }

  /** Persiste un prompt en historique et renvoie la version d'affichage correspondante. */
  async function commitVersion(
    label: string,
    prompt: string,
    fallback: boolean,
    intentForHistory: string,
  ): Promise<PromptVersion> {
    const tokens = estimateTokens(prompt);
    const id = crypto.randomUUID();
    const generation: Generation = {
      id,
      categoryId: selectedCategory.category.id,
      templateVersion: selectedCategory.template.version,
      userIntent: intentForHistory,
      outputPrompt: prompt,
      providerUsed: provider.type,
      modelName: model,
      tokenEstimate: tokens,
      rating: null,
      createdAt: new Date().toISOString(),
    };
    await deps.historyStore.add(generation);
    await refreshHistory();
    return { id, label, prompt, tokens, fallback, providerLabel: provider.label, model, rating: null };
  }

  async function handleGenerate(): Promise<void> {
    setError(null);
    setVersions([]);
    setGenStatus('idle');

    const sys = selectedCategory;
    const intentTrim = intent.trim();
    if (!intentTrim) {
      setError("Décris d'abord ton besoin.");
      return;
    }

    let apiKey: string | undefined;
    if (provider.needsKey) {
      apiKey = (await deps.secretStore.get(secretRef(provider.type))) ?? undefined;
      if (!apiKey) {
        setError(`Renseigne et enregistre ta clé ${provider.label} ci-dessus.`);
        return;
      }
    }

    setBusy(true);
    setGenStatus('thinking');
    const base = buildBasePrompt(sys.template, intentTrim);
    if (abMode) {
      setAbRaw(base);
      setAbOptimized('');
    } else {
      setDraft({ label: 'Prompt généré', text: '' });
    }
    const sink = (text: string): void => {
      if (abMode) setAbOptimized(text);
      else setDraft({ label: 'Prompt généré', text });
    };
    let accumulated = '';
    let firstChunk = true;
    let fallback = false;
    try {
      const adapter = createProviderAdapter(provider.type, deps.httpClient);
      const options = {
        model,
        ...(apiKey ? { apiKey } : {}),
        ...(provider.isLocal && baseUrl ? { baseUrl } : {}),
      };
      try {
        for await (const chunk of optimizeStream({
          template: sys.template,
          intent: intentTrim,
          adapter,
          options,
        })) {
          accumulated += chunk;
          if (firstChunk) {
            firstChunk = false;
            setGenStatus('writing');
          }
          sink(accumulated);
        }
        if (!accumulated.trim()) {
          accumulated = base;
          fallback = true;
          sink(accumulated);
        }
      } catch (cause) {
        accumulated = base;
        fallback = true;
        sink(accumulated);
        setError(`${describeProviderError(cause)} (prompt déterministe affiché)`);
      }

      deps.analytics.track({ name: 'prompt_generated', category: sys.category.slug, provider: provider.type });

      if (abMode) {
        setGenStatus('done');
        return;
      }

      const version = await commitVersion('Prompt généré', accumulated, fallback, intentTrim);
      setVersions([version]);
      setDraft(null);
      setGenStatus('done');
    } finally {
      setBusy(false);
    }
  }

  async function handleAbChoose(choice: 'raw' | 'optimized'): Promise<void> {
    const chosen = choice === 'raw' ? abRaw : abOptimized;
    if (!chosen) return;
    deps.analytics.track({ name: 'ab_compared', chosen: choice });
    const label = choice === 'raw' ? 'Brut (choisi)' : 'Optimisé (choisi)';
    const version = await commitVersion(label, chosen, false, intent.trim());
    setVersions([version]);
    setAbMode(false);
    setAbRaw('');
    setAbOptimized('');
    setGenStatus('done');
  }

  /** Affinage : AJOUTE une nouvelle version sous la dernière (on garde la trace, on n'efface rien). */
  async function handleRefine(instruction: string, label: string): Promise<void> {
    const last = versions[versions.length - 1];
    if (!last) return;
    setError(null);

    let apiKey: string | undefined;
    if (provider.needsKey) {
      apiKey = (await deps.secretStore.get(secretRef(provider.type))) ?? undefined;
      if (!apiKey) {
        setError(`Renseigne et enregistre ta clé ${provider.label} ci-dessus.`);
        return;
      }
    }

    setBusy(true);
    setGenStatus('thinking');
    setDraft({ label, text: '' });
    const current = last.prompt;
    let accumulated = '';
    let firstChunk = true;
    let fallback = false;
    try {
      const adapter = createProviderAdapter(provider.type, deps.httpClient);
      const options = {
        model,
        ...(apiKey ? { apiKey } : {}),
        ...(provider.isLocal && baseUrl ? { baseUrl } : {}),
      };
      try {
        for await (const chunk of refineStream({ current, instruction, adapter, options })) {
          accumulated += chunk;
          if (firstChunk) {
            firstChunk = false;
            setGenStatus('writing');
          }
          setDraft({ label, text: accumulated });
        }
        if (!accumulated.trim()) {
          accumulated = current;
          fallback = true;
          setDraft({ label, text: accumulated });
        }
      } catch (cause) {
        accumulated = current;
        fallback = true;
        setDraft({ label, text: accumulated });
        setError(`${describeProviderError(cause)} (affinage indisponible)`);
      }

      const version = await commitVersion(label, accumulated, fallback, `[affinage] ${intent.trim()}`);
      setVersions((prev) => [...prev, version]);
      setDraft(null);
      setGenStatus('done');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy(prompt: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(prompt);
      deps.analytics.track({ name: 'prompt_copied', category: selectedCategory.category.slug });
      showToast('Prompt copié ✓');
    } catch {
      showToast('Copie impossible (presse-papier bloqué)');
    }
  }

  function handleExport(format: ExportFormat, prompt: string): void {
    const file = buildExport(
      { categoryName: selectedCategory.category.name, intent: intent.trim(), prompt },
      format,
    );
    const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast(`${file.filename} téléchargé ✓`);
  }

  async function handleRate(id: string, rating: 'up' | 'down'): Promise<void> {
    setVersions((prev) => prev.map((v) => (v.id === id ? { ...v, rating } : v)));
    await deps.historyStore.setRating(id, rating);
    deps.analytics.track({ name: 'feedback_given', rating });
    await refreshHistory();
  }

  async function handleClearAll(): Promise<void> {
    const ok = window.confirm(
      'Tout effacer : historique local ET clés enregistrées de tous les providers. Action irréversible. Continuer ?',
    );
    if (!ok) return;
    await deps.historyStore.clear();
    await Promise.all(providers.map((p) => deps.secretStore.delete(secretRef(p.type))));
    setHistory([]);
    setVersions([]);
    setDraft(null);
    setGenStatus('idle');
    setError(null);
    setKeySaved(false);
  }

  return (
    <div className="relative mx-auto max-w-3xl p-6">
      <HandDrawnDefs />
      <Doodle name="star" className="absolute right-3 top-4 h-9 w-9 opacity-70" />

      <header className="mb-8">
        <h1 ref={titleRef} className="inline-block font-hand text-5xl font-bold leading-none text-ink">
          PromptForge{' '}
          {platformLabel && <span className="text-2xl font-normal text-ink/50">· {platformLabel}</span>}
        </h1>
        <p className="mt-2 font-body text-sm text-ink/70">
          Génère le meilleur prompt pour ta tâche — avec ta propre clé ou un modèle local.
        </p>
      </header>

      <section className="mb-5">
        <div className="mb-1 flex items-center justify-between">
          <label className="block font-hand text-xl">Catégorie</label>
          <button className="font-hand text-base text-accent" onClick={openNewTemplate}>
            + Nouveau template
          </button>
        </div>
        <div ref={categoryRef} className="block w-full">
          <select
            className="w-full rounded-lg border-2 border-ink bg-paper p-2 font-body"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map(({ category }) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.owner === 'user' ? ' (perso)' : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedCategory.category.owner === 'user' && !editorOpen && (
          <div className="mt-1 flex gap-4 font-hand text-base">
            <button className="text-accent2" onClick={() => openEditTemplate(selectedCategory)}>
              Éditer
            </button>
            <button
              className="text-danger"
              onClick={() => void handleDeleteTemplate(selectedCategory.category.id)}
            >
              Supprimer
            </button>
          </div>
        )}

        {editorOpen && (
          <div className="card-sketch mt-4 p-4">
            <h3 className="mb-2 font-hand text-xl">
              {editingId ? 'Éditer le template' : 'Nouveau template'}
            </h3>
            <input
              className="mb-2 w-full rounded-lg border-2 border-ink bg-paper p-2 font-body"
              placeholder="Nom de la catégorie"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              aria-label="nom du template"
            />
            <textarea
              className="mb-2 h-28 w-full rounded-lg border-2 border-ink bg-paper p-2 font-mono text-xs"
              placeholder="Squelette — doit contenir {{intent}}"
              value={formSkeleton}
              onChange={(e) => setFormSkeleton(e.target.value)}
              aria-label="squelette"
            />
            <textarea
              className="mb-2 h-20 w-full rounded-lg border-2 border-ink bg-paper p-2 font-body text-xs"
              placeholder="Méta-prompt — instruction d'optimisation LLM"
              value={formMeta}
              onChange={(e) => setFormMeta(e.target.value)}
              aria-label="méta-prompt"
            />
            {formError && (
              <p className="mb-2 rounded-lg border-2 border-danger bg-paper p-2 font-body text-xs text-danger">
                {formError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                className="rounded-lg border-2 border-ink bg-ink px-3 py-1 font-hand text-base text-paper shadow-sketch-sm"
                onClick={() => void handleSaveTemplate()}
              >
                Enregistrer
              </button>
              <button
                className="rounded-lg border-2 border-ink bg-paper px-3 py-1 font-hand text-base shadow-sketch-sm"
                onClick={() => setEditorOpen(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mb-5">
        <label className="mb-1 block font-hand text-xl">Provider</label>
        <select
          className="w-full rounded-lg border-2 border-ink bg-paper p-2 font-body"
          value={providerType}
          onChange={(e) => setProviderType(e.target.value as ProviderType)}
        >
          {providers.map((p) => (
            <option key={p.type} value={p.type} disabled={p.disabled}>
              {p.label}
              {p.disabled && p.disabledNote ? ` — ${p.disabledNote}` : ''}
            </option>
          ))}
        </select>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            className="rounded-lg border-2 border-ink bg-paper p-2 font-body"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="modèle"
            aria-label="modèle"
          />
          {provider.isLocal && (
            <input
              className="rounded-lg border-2 border-ink bg-paper p-2 font-body"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="base URL"
              aria-label="base URL"
            />
          )}
        </div>

        {provider.needsKey && (
          <div className="mt-2 flex gap-2">
            <input
              className="flex-1 rounded-lg border-2 border-ink bg-paper p-2 font-body"
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={keySaved ? 'clé enregistrée (chiffrée) — saisir pour remplacer' : 'clé API'}
              aria-label="clé API"
            />
            <button
              className="rounded-lg border-2 border-ink bg-ink px-3 py-2 font-hand text-base text-paper shadow-sketch-sm disabled:opacity-50"
              onClick={() => void handleSaveKey()}
              disabled={!keyInput.trim()}
            >
              {keySaved ? 'Remplacer' : 'Enregistrer'}
            </button>
          </div>
        )}
      </section>

      <section className="mb-5">
        <label className="mb-1 block font-hand text-xl">Décris ton besoin</label>
        <textarea
          className="h-32 w-full rounded-lg border-2 border-ink bg-paper p-2 font-body"
          value={intent}
          maxLength={8000}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="Ex. : un prompt pour générer une API REST en Node avec tests…"
        />
      </section>

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <button
          className="wonk rounded-lg border-2 border-ink bg-accent px-5 py-2 font-hand text-2xl text-ink shadow-sketch transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          onClick={() => void handleGenerate()}
          disabled={busy || !intent.trim()}
        >
          {busy ? 'Génération…' : 'Générer le prompt ✶'}
        </button>
        <label className="flex items-center gap-2 font-hand text-base">
          <input
            type="checkbox"
            checked={abMode}
            onChange={(e) => setAbMode(e.target.checked)}
          />
          Comparer brut ↔ optimisé
        </label>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border-2 border-danger bg-paper p-3 font-body text-sm text-danger">
          {error}
        </p>
      )}

      {genStatus !== 'idle' && (
        <div className="mb-4 flex items-center gap-3 font-hand text-lg text-ink/80">
          {(genStatus === 'thinking' || genStatus === 'writing') && (
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink border-t-transparent"
              aria-hidden="true"
            />
          )}
          <span aria-live="polite">{STATUS_LABEL[genStatus]}</span>
        </div>
      )}

      {abMode && (abRaw !== '' || abOptimized !== '') && (
        <section className="mb-6 grid gap-4 md:grid-cols-2">
          <SketchBox className="p-4" color="#3b82a0">
            <h3 className="mb-2 font-hand text-xl">Brut (template)</h3>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border-2 border-ink/20 bg-paper/60 p-3 font-mono text-xs text-ink">
              {abRaw}
            </pre>
            <button
              className="mt-2 w-full rounded-lg border-2 border-ink bg-paper px-2 py-1 font-hand text-base shadow-sketch-sm"
              onClick={() => void handleAbChoose('raw')}
            >
              Choisir le brut 👍
            </button>
          </SketchBox>
          <SketchBox className="p-4" color="#e8743b">
            <h3 className="mb-2 font-hand text-xl">Optimisé (LLM)</h3>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border-2 border-ink/20 bg-paper/60 p-3 font-mono text-xs text-ink">
              {abOptimized || (busy ? '…' : '')}
            </pre>
            <button
              className="mt-2 w-full rounded-lg border-2 border-ink bg-accent px-2 py-1 font-hand text-base text-ink shadow-sketch-sm disabled:opacity-40"
              onClick={() => void handleAbChoose('optimized')}
              disabled={!abOptimized}
            >
              Choisir l'optimisé 👍
            </button>
          </SketchBox>
        </section>
      )}

      {!abMode &&
        versions.map((v, index) => (
          <SketchBox key={v.id} className="mb-4 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-hand text-xl">
                {v.label}
                {v.fallback && (
                  <em className="font-body text-sm text-accent"> (fallback déterministe)</em>
                )}
                {index > 0 && (
                  <span className="font-body text-xs text-ink/40"> · version {index + 1}</span>
                )}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-hand text-base shadow-sketch-sm"
                  onClick={() => void handleCopy(v.prompt)}
                  title="Copie le prompt brut — format prêt pour Claude Code"
                >
                  Copier
                </button>
                <button
                  className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-hand text-base shadow-sketch-sm"
                  onClick={() => handleExport('markdown', v.prompt)}
                  title="Télécharger en Markdown"
                >
                  .md
                </button>
                <button
                  className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-hand text-base shadow-sketch-sm"
                  onClick={() => handleExport('text', v.prompt)}
                  title="Télécharger en texte brut"
                >
                  .txt
                </button>
                <button
                  className={`rounded-lg border-2 border-ink px-2 py-1 font-hand text-base shadow-sketch-sm ${
                    v.rating === 'up' ? 'bg-success text-paper' : 'bg-paper'
                  }`}
                  onClick={() => void handleRate(v.id, 'up')}
                  aria-label="pouce en haut"
                  aria-pressed={v.rating === 'up'}
                >
                  👍
                </button>
                <button
                  className={`rounded-lg border-2 border-ink px-2 py-1 font-hand text-base shadow-sketch-sm ${
                    v.rating === 'down' ? 'bg-danger text-paper' : 'bg-paper'
                  }`}
                  onClick={() => void handleRate(v.id, 'down')}
                  aria-label="pouce en bas"
                  aria-pressed={v.rating === 'down'}
                >
                  👎
                </button>
              </div>
            </div>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border-2 border-ink/20 bg-paper/60 p-3 font-mono text-sm text-ink">
              {v.prompt}
            </pre>
            <p className="mt-2 font-body text-xs text-ink/60">
              Généré par <strong>{v.providerLabel}</strong>
              {v.model ? ` · ${v.model}` : ''} · ~{v.tokens} tokens (estimation)
            </p>
          </SketchBox>
        ))}

      {!abMode && draft && (
        <SketchBox className="mb-4 p-4" color="#3b82a0">
          <div className="mb-2 font-hand text-xl">{draft.label}</div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border-2 border-ink/20 bg-paper/60 p-3 font-mono text-sm text-ink">
            {draft.text || '…'}
          </pre>
        </SketchBox>
      )}

      {!abMode && versions.length > 0 && !draft && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="self-center font-hand text-base text-ink/70">
            Affiner (ajoute une version) :
          </span>
          <button
            className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-hand text-base shadow-sketch-sm disabled:opacity-40"
            onClick={() => void handleRefine(REFINEMENTS.shorter, 'Plus court')}
            disabled={busy}
          >
            Plus court
          </button>
          <button
            className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-hand text-base shadow-sketch-sm disabled:opacity-40"
            onClick={() => void handleRefine(REFINEMENTS.more_technical, 'Plus technique')}
            disabled={busy}
          >
            Plus technique
          </button>
          <button
            className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-hand text-base shadow-sketch-sm disabled:opacity-40"
            onClick={() => void handleRefine(REFINEMENTS.more_formal, 'Plus formel')}
            disabled={busy}
          >
            Plus formel
          </button>
        </div>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-hand text-2xl">Historique ({history.length})</h2>
          {history.length > 0 && (
            <button
              className="rounded-lg border-2 border-danger bg-paper px-2 py-1 font-hand text-base text-danger shadow-sketch-sm"
              onClick={() => void handleClearAll()}
            >
              Tout effacer
            </button>
          )}
        </div>
        <ul className="space-y-1 font-body text-sm text-ink/70">
          {history.slice(0, 10).map((g) => (
            <li key={g.id} className="truncate">
              <span className="text-ink/40">{g.createdAt.slice(0, 10)}</span> · {g.providerUsed} ·{' '}
              {g.userIntent}
            </li>
          ))}
        </ul>
      </section>

      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <div key={t.id} className="card-sketch px-4 py-2 font-hand text-lg text-ink">
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
