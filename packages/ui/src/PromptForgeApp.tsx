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

  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  const [lastProviderLabel, setLastProviderLabel] = useState<string | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [lastTokens, setLastTokens] = useState(0);
  const [lastRating, setLastRating] = useState<'up' | 'down' | null>(null);
  const [history, setHistory] = useState<readonly Generation[]>([]);

  const reducedMotion = usePrefersReducedMotion();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

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

  async function handleGenerate(): Promise<void> {
    setError(null);
    setOutput('');
    setUsedFallback(false);
    setLastId(null);

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
    let accumulated = '';
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
          setOutput(accumulated);
        }
        if (!accumulated.trim()) {
          accumulated = buildBasePrompt(sys.template, intentTrim);
          setOutput(accumulated);
          setUsedFallback(true);
        }
      } catch (cause) {
        accumulated = buildBasePrompt(sys.template, intentTrim);
        setOutput(accumulated);
        setUsedFallback(true);
        setError(`${describeProviderError(cause)} (prompt déterministe affiché)`);
      }

      const tokenEstimate = estimateTokens(accumulated);
      const generation: Generation = {
        id: crypto.randomUUID(),
        categoryId: sys.category.id,
        templateVersion: sys.template.version,
        userIntent: intentTrim,
        outputPrompt: accumulated,
        providerUsed: provider.type,
        modelName: model,
        tokenEstimate,
        rating: null,
        createdAt: new Date().toISOString(),
      };
      await deps.historyStore.add(generation);
      setLastId(generation.id);
      setLastProviderLabel(provider.label);
      setLastModel(model);
      setLastTokens(tokenEstimate);
      setLastRating(null);
      deps.analytics.track({ name: 'prompt_generated', category: sys.category.slug, provider: provider.type });
      await refreshHistory();
    } finally {
      setBusy(false);
    }
  }

  async function handleRefine(instruction: string): Promise<void> {
    if (!output) return;
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
    const current = output;
    let accumulated = '';
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
          setOutput(accumulated);
        }
        if (!accumulated.trim()) {
          accumulated = current;
          setOutput(accumulated);
        }
      } catch (cause) {
        accumulated = current;
        setOutput(accumulated);
        setError(`${describeProviderError(cause)} (affinage indisponible)`);
      }

      const tokenEstimate = estimateTokens(accumulated);
      const generation: Generation = {
        id: crypto.randomUUID(),
        categoryId: selectedCategory.category.id,
        templateVersion: selectedCategory.template.version,
        userIntent: `[affinage] ${intent.trim()}`,
        outputPrompt: accumulated,
        providerUsed: provider.type,
        modelName: model,
        tokenEstimate,
        rating: null,
        createdAt: new Date().toISOString(),
      };
      await deps.historyStore.add(generation);
      setLastId(generation.id);
      setLastTokens(tokenEstimate);
      setLastRating(null);
      await refreshHistory();
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy(): Promise<void> {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    deps.analytics.track({ name: 'prompt_copied', category: selectedCategory.category.slug });
  }

  function handleExport(format: ExportFormat): void {
    if (!output) return;
    const file = buildExport(
      { categoryName: selectedCategory.category.name, intent: intent.trim(), prompt: output },
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
  }

  async function handleRate(rating: 'up' | 'down'): Promise<void> {
    if (!lastId) return;
    setLastRating(rating);
    await deps.historyStore.setRating(lastId, rating);
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
    setOutput('');
    setError(null);
    setUsedFallback(false);
    setLastId(null);
    setLastProviderLabel(null);
    setLastModel(null);
    setLastTokens(0);
    setLastRating(null);
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

      <button
        className="wonk mb-5 rounded-lg border-2 border-ink bg-accent px-5 py-2 font-hand text-2xl text-ink shadow-sketch transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        onClick={() => void handleGenerate()}
        disabled={busy || !intent.trim()}
      >
        {busy ? 'Génération…' : 'Générer le prompt ✶'}
      </button>

      {error && (
        <p className="mb-4 rounded-lg border-2 border-danger bg-paper p-3 font-body text-sm text-danger">
          {error}
        </p>
      )}

      {output && (
        <SketchBox className="mb-6 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="font-hand text-xl">
              Prompt généré{' '}
              {usedFallback && (
                <em className="font-body text-sm text-accent">(fallback déterministe)</em>
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-hand text-base shadow-sketch-sm"
                onClick={() => void handleCopy()}
                title="Copie le prompt brut — format prêt pour Claude Code"
              >
                Copier
              </button>
              <button
                className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-hand text-base shadow-sketch-sm"
                onClick={() => handleExport('markdown')}
                title="Télécharger en Markdown"
              >
                .md
              </button>
              <button
                className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-hand text-base shadow-sketch-sm"
                onClick={() => handleExport('text')}
                title="Télécharger en texte brut"
              >
                .txt
              </button>
              <button
                className={`rounded-lg border-2 border-ink px-2 py-1 font-hand text-base shadow-sketch-sm disabled:opacity-40 ${
                  lastRating === 'up' ? 'bg-success text-paper' : 'bg-paper'
                }`}
                onClick={() => void handleRate('up')}
                disabled={!lastId}
                aria-label="pouce en haut"
                aria-pressed={lastRating === 'up'}
              >
                👍
              </button>
              <button
                className={`rounded-lg border-2 border-ink px-2 py-1 font-hand text-base shadow-sketch-sm disabled:opacity-40 ${
                  lastRating === 'down' ? 'bg-danger text-paper' : 'bg-paper'
                }`}
                onClick={() => void handleRate('down')}
                disabled={!lastId}
                aria-label="pouce en bas"
                aria-pressed={lastRating === 'down'}
              >
                👎
              </button>
            </div>
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border-2 border-ink/20 bg-paper/60 p-3 font-mono text-sm text-ink">
            {output}
          </pre>
          {(lastProviderLabel !== null || lastTokens > 0) && (
            <p className="mt-2 font-body text-xs text-ink/60">
              {lastProviderLabel && (
                <>
                  Généré par <strong>{lastProviderLabel}</strong>
                  {lastModel ? ` · ${lastModel}` : ''}
                </>
              )}
              {lastTokens > 0 && <> · ~{lastTokens} tokens (estimation)</>}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="self-center font-hand text-base text-ink/70">Affiner :</span>
            <button
              className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-hand text-base shadow-sketch-sm disabled:opacity-40"
              onClick={() => void handleRefine(REFINEMENTS.shorter)}
              disabled={busy}
            >
              Plus court
            </button>
            <button
              className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-hand text-base shadow-sketch-sm disabled:opacity-40"
              onClick={() => void handleRefine(REFINEMENTS.more_technical)}
              disabled={busy}
            >
              Plus technique
            </button>
            <button
              className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-hand text-base shadow-sketch-sm disabled:opacity-40"
              onClick={() => void handleRefine(REFINEMENTS.more_formal)}
              disabled={busy}
            >
              Plus formel
            </button>
          </div>
        </SketchBox>
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
    </div>
  );
}
