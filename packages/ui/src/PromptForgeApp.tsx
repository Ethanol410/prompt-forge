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
  defaultParamValues,
  missingRequiredParams,
  scorePrompt,
  estimateCost,
  validateApiKeyFormat,
  buildLlmChatUrl,
  LLM_TARGETS,
  type LlmTarget,
  type ExportFormat,
  type ProviderType,
  type Generation,
  type CategoryBundle,
  type TemplateParam,
  type SecretStore,
  type HttpClient,
  type HistoryStore,
  type TemplateStore,
  type PrefsStore,
  type Analytics,
} from '@promptforge/core';

/** Ports injectés par la plateforme (web ou desktop) — c'est ici que vit l'inversion de dépendance. */
export interface AppDeps {
  readonly secretStore: SecretStore;
  readonly httpClient: HttpClient;
  readonly historyStore: HistoryStore;
  readonly templateStore: TemplateStore;
  readonly prefsStore: PrefsStore;
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
  readonly providerType: ProviderType;
  readonly providerLabel: string;
  readonly model: string;
  readonly rating: 'up' | 'down' | null;
}

interface Toast {
  readonly id: number;
  readonly message: string;
  readonly action?: { readonly label: string; readonly onClick: () => void };
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
  /**
   * Si fourni (web uniquement), affiche un encart « Télécharger l'app desktop » en bas de la
   * barre latérale, pointant vers cette URL d'installeur. Omis sur desktop.
   */
  readonly desktopDownloadUrl?: string;
  /**
   * Si fourni (web uniquement), affiche un lien « ← Accueil » qui ramène à la landing.
   * Omis sur desktop (pas de landing).
   */
  readonly onNavigateHome?: () => void;
}

const secretRef = (type: ProviderType): string => `provider:${type}`;

export function PromptForgeApp({
  deps,
  providers,
  platformLabel,
  desktopDownloadUrl,
  onNavigateHome,
}: PromptForgeAppProps): ReactElement {
  const selectableProviders = useMemo(() => providers.filter((p) => !p.disabled), [providers]);
  const [categories, setCategories] = useState<readonly CategoryBundle[]>(SYSTEM_CATEGORIES);
  const [categoryId, setCategoryId] = useState(SYSTEM_CATEGORIES[0]!.category.id);
  const selectedCategory = useMemo(
    () => findCategoryById(categories, categoryId) ?? categories[0]!,
    [categories, categoryId],
  );
  const [intent, setIntent] = useState('');

  // Valeurs des variables du template sélectionné (F-C3).
  const [paramValues, setParamValues] = useState<Record<string, string>>(() =>
    defaultParamValues(SYSTEM_CATEGORIES[0]!.template.paramsSchema),
  );

  // Éditeur de templates personnalisés (F-S1) + variables (F-C3).
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formSkeleton, setFormSkeleton] = useState(DEFAULT_SKELETON);
  const [formMeta, setFormMeta] = useState(DEFAULT_META_PROMPT);
  const [formParams, setFormParams] = useState<readonly TemplateParam[]>([]);
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
  const [threadIntent, setThreadIntent] = useState<string | null>(null);
  const [history, setHistory] = useState<readonly Generation[]>([]);
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const toastSeq = useRef(0);

  function showToast(message: string, action?: Toast['action']): void {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((prev) => [...prev, { id, message, action }]);
    window.setTimeout(
      () => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      },
      action ? 6000 : 2500,
    );
  }

  const reducedMotion = usePrefersReducedMotion();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hydratedRef = useRef(false);

  // Comparaison A/B brut ↔ optimisé (F-S5).
  const [abMode, setAbMode] = useState(false);
  const [abRaw, setAbRaw] = useState('');
  const [abOptimized, setAbOptimized] = useState('');

  useEffect(() => {
    void refreshHistory();
    void refreshCategories();
    // Restaure les préférences (dernière catégorie / provider).
    void (async () => {
      const lastCategory = await deps.prefsStore.get<string>('lastCategoryId');
      if (lastCategory) setCategoryId(lastCategory);
      const lastProvider = await deps.prefsStore.get<ProviderType>('lastProviderType');
      if (lastProvider && selectableProviders.some((p) => p.type === lastProvider)) {
        setProviderType(lastProvider);
      }
      hydratedRef.current = true;
    })();
  }, []);

  // Sauvegarde des préférences (après hydratation, pour ne pas écraser avec les défauts).
  useEffect(() => {
    if (hydratedRef.current) void deps.prefsStore.set('lastCategoryId', categoryId);
  }, [categoryId]);
  useEffect(() => {
    if (hydratedRef.current) void deps.prefsStore.set('lastProviderType', providerType);
  }, [providerType]);

  // Auto-scroll du fil quand le contenu change (comme un chat).
  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [versions, draft, genStatus, reducedMotion]);

  // Échap ferme la modale d'édition de template ; focus le 1er champ à l'ouverture (a11y).
  useEffect(() => {
    if (!editorOpen) return;
    nameInputRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setEditorOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editorOpen]);

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

  // Réinitialise les valeurs des variables aux défauts quand on change de catégorie (F-C3).
  useEffect(() => {
    setParamValues(defaultParamValues(selectedCategory.template.paramsSchema));
  }, [selectedCategory]);

  async function refreshCategories(): Promise<void> {
    const custom = await deps.templateStore.list();
    setCategories(allCategories(custom));
  }

  function openNewTemplate(): void {
    setEditingId(null);
    setFormName('');
    setFormSkeleton(DEFAULT_SKELETON);
    setFormMeta(DEFAULT_META_PROMPT);
    setFormParams([]);
    setFormError(null);
    setEditorOpen(true);
  }

  function openEditTemplate(bundle: CategoryBundle): void {
    setEditingId(bundle.category.id);
    setFormName(bundle.category.name);
    setFormSkeleton(bundle.template.skeleton);
    setFormMeta(bundle.template.metaPrompt);
    setFormParams(bundle.template.paramsSchema?.params ?? []);
    setFormError(null);
    setEditorOpen(true);
  }

  function addFormParam(): void {
    setFormParams((prev) => [
      ...prev,
      { key: '', label: '', type: 'text', required: false, defaultValue: '' },
    ]);
  }

  function updateFormParam(index: number, patch: Partial<TemplateParam>): void {
    setFormParams((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function removeFormParam(index: number): void {
    setFormParams((prev) => prev.filter((_, i) => i !== index));
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
        params: formParams,
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
    const validation = validateApiKeyFormat(provider.type, keyInput);
    await deps.secretStore.set(secretRef(provider.type), keyInput.trim());
    setKeyInput('');
    setKeySaved(true);
    deps.analytics.track({ name: 'provider_configured', provider: provider.type });
    showToast(validation.ok ? 'Clé enregistrée ✓' : `Enregistrée — ${validation.message}`);
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
    return {
      id,
      label,
      prompt,
      tokens,
      fallback,
      providerType: provider.type,
      providerLabel: provider.label,
      model,
      rating: null,
    };
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

    const missing = missingRequiredParams(sys.template.paramsSchema, paramValues);
    if (missing.length > 0) {
      setError(`Renseigne les variables requises : ${missing.map((p) => p.label).join(', ')}.`);
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

    setThreadIntent(intentTrim);
    setBusy(true);
    setGenStatus('thinking');
    const controller = new AbortController();
    abortRef.current = controller;
    const base = buildBasePrompt(sys.template, intentTrim, paramValues);
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
    let aborted = false;
    try {
      const adapter = createProviderAdapter(provider.type, deps.httpClient);
      const options = {
        model,
        ...(apiKey ? { apiKey } : {}),
        ...(provider.isLocal && baseUrl ? { baseUrl } : {}),
        signal: controller.signal,
      };
      try {
        for await (const chunk of optimizeStream({
          template: sys.template,
          intent: intentTrim,
          adapter,
          options,
          vars: paramValues,
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
        if (controller.signal.aborted) {
          aborted = true;
        } else {
          accumulated = base;
          fallback = true;
          sink(accumulated);
          setError(`${describeProviderError(cause)} (prompt déterministe affiché)`);
        }
      }

      deps.analytics.track({ name: 'prompt_generated', category: sys.category.slug, provider: provider.type });

      if (abMode) {
        setGenStatus('done');
        return;
      }

      // Interruption sans aucun texte reçu : annulation propre, pas de version.
      if (aborted && accumulated.trim().length === 0) {
        setDraft(null);
        setGenStatus('idle');
        return;
      }

      const label = aborted ? 'Prompt généré (interrompu)' : 'Prompt généré';
      const version = await commitVersion(label, accumulated, fallback, intentTrim);
      setVersions([version]);
      setDraft(null);
      setGenStatus('done');
    } finally {
      setBusy(false);
      abortRef.current = null;
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
    const controller = new AbortController();
    abortRef.current = controller;
    const current = last.prompt;
    let accumulated = '';
    let firstChunk = true;
    let fallback = false;
    let aborted = false;
    try {
      const adapter = createProviderAdapter(provider.type, deps.httpClient);
      const options = {
        model,
        ...(apiKey ? { apiKey } : {}),
        ...(provider.isLocal && baseUrl ? { baseUrl } : {}),
        signal: controller.signal,
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
        if (controller.signal.aborted) {
          aborted = true;
        } else {
          accumulated = current;
          fallback = true;
          setDraft({ label, text: accumulated });
          setError(`${describeProviderError(cause)} (affinage indisponible)`);
        }
      }

      if (aborted && accumulated.trim().length === 0) {
        setDraft(null);
        setGenStatus('idle');
        return;
      }

      const version = await commitVersion(
        aborted ? `${label} (interrompu)` : label,
        accumulated,
        fallback,
        `[affinage] ${intent.trim()}`,
      );
      setVersions((prev) => [...prev, version]);
      setDraft(null);
      setGenStatus('done');
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function handleStop(): void {
    abortRef.current?.abort();
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

  async function handleOpenInLlm(target: LlmTarget, prompt: string): Promise<void> {
    const info = LLM_TARGETS.find((t) => t.target === target);
    const label = info?.label ?? target;
    // On copie toujours : indispensable pour Gemini (pas de pré-remplissage d'URL) et filet de
    // sécurité si l'URL tronque un prompt long pour ChatGPT/Claude.
    let copied = false;
    try {
      await navigator.clipboard.writeText(prompt);
      copied = true;
    } catch {
      /* presse-papier indisponible : on ouvre quand même la discussion */
    }
    window.open(buildLlmChatUrl(target, prompt), '_blank', 'noopener,noreferrer');
    deps.analytics.track({ name: 'prompt_exported', target });
    showToast(
      info?.prefills
        ? `Ouverture de ${label}…`
        : copied
          ? `Prompt copié — colle-le dans ${label} (Ctrl+V)`
          : `Ouverture de ${label} — copie le prompt manuellement`,
    );
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
    setThreadIntent(null);
    setError(null);
    setKeySaved(false);
  }

  /** Démarre une nouvelle « conversation » : vide le fil courant (sans toucher à l'historique). */
  function handleNewThread(): void {
    setVersions([]);
    setDraft(null);
    setGenStatus('idle');
    setThreadIntent(null);
    setError(null);
    setIntent('');
  }

  /** Recharge une génération de l'historique dans le fil courant (consultation/réutilisation). */
  function handleLoadHistory(g: Generation): void {
    setVersions([
      {
        id: g.id,
        label: 'Depuis l’historique',
        prompt: g.outputPrompt,
        tokens: g.tokenEstimate ?? estimateTokens(g.outputPrompt),
        fallback: false,
        providerType: g.providerUsed,
        providerLabel: g.providerUsed,
        model: g.modelName,
        rating: g.rating,
      },
    ]);
    setDraft(null);
    setGenStatus('idle');
    setThreadIntent(g.userIntent);
    setError(null);
  }

  /** Supprime une seule entrée de l'historique. */
  async function handleDeleteHistory(g: Generation): Promise<void> {
    await deps.historyStore.delete(g.id);
    await refreshHistory();
    showToast('Entrée supprimée', {
      label: 'Annuler',
      onClick: () => {
        void (async () => {
          await deps.historyStore.add(g);
          await refreshHistory();
        })();
      },
    });
  }

  const templateParams = selectedCategory.template.paramsSchema?.params ?? [];

  return (
    <div className="flex h-screen flex-col bg-paper text-ink md:flex-row">
      <HandDrawnDefs />

      {/* Barre latérale : titre, actions, historique */}
      <aside className="flex w-full shrink-0 flex-col gap-3 border-b-2 border-ink/15 p-4 md:max-h-screen md:w-72 md:border-b-0 md:border-r-2">
        {onNavigateHome && (
          <button
            onClick={onNavigateHome}
            className="self-start font-hand text-base text-ink/60 hover:text-ink"
          >
            ← Accueil
          </button>
        )}
        <div>
          <h1 ref={titleRef} className="inline-block font-hand text-3xl font-bold leading-none text-ink">
            PromptForge
          </h1>
          {platformLabel && (
            <span className="ml-1 font-hand text-sm text-ink/50">· {platformLabel}</span>
          )}
        </div>

        <button
          className="rounded-lg border-2 border-ink bg-accent px-3 py-2 font-hand text-lg text-ink shadow-sketch-sm"
          onClick={handleNewThread}
        >
          + Nouvelle conversation
        </button>
        <button
          className="rounded-lg border-2 border-ink bg-paper px-3 py-1 font-hand text-base shadow-sketch-sm"
          onClick={openNewTemplate}
        >
          + Nouveau template
        </button>

        <div className="mt-2 flex items-center justify-between">
          <h2 className="font-hand text-lg">Historique ({history.length})</h2>
          {history.length > 0 && (
            <button className="font-hand text-xs text-danger" onClick={() => void handleClearAll()}>
              Tout effacer
            </button>
          )}
        </div>
        <ul className="flex-1 space-y-1 overflow-y-auto font-body text-xs text-ink/70">
          {history.length === 0 && <li className="text-ink/40">Aucune génération pour l'instant.</li>}
          {history.slice(0, 40).map((g) => (
            <li key={g.id} className="flex items-center gap-1">
              <button
                className="block min-w-0 flex-1 truncate rounded px-1 py-1 text-left hover:bg-ink/5"
                onClick={() => handleLoadHistory(g)}
                title={g.userIntent}
              >
                <span className="text-ink/40">{g.createdAt.slice(0, 10)}</span> · {g.userIntent}
              </button>
              <button
                className="shrink-0 rounded px-1 text-ink/40 hover:text-danger"
                onClick={() => void handleDeleteHistory(g)}
                aria-label="supprimer cette entrée"
                title="Supprimer cette entrée"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        {desktopDownloadUrl && (
          <a
            href={desktopDownloadUrl}
            className="mt-auto block rounded-lg border-2 border-ink bg-paper p-3 shadow-sketch-sm transition hover:-translate-y-0.5"
          >
            <div className="font-hand text-base leading-tight">⤓ App desktop</div>
            <div className="font-body text-xs text-ink/60">
              Windows · OpenAI &amp; tous providers, clés dans le keychain OS.
            </div>
          </a>
        )}
      </aside>

      {/* Zone principale */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <Doodle name="star" className="pointer-events-none absolute right-3 top-3 h-7 w-7 opacity-60" />

        {/* Bandeau : catégorie + provider + réglages */}
        <div className="shrink-0 border-b-2 border-ink/15 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-hand text-base">Catégorie</label>
              <div className="flex items-center gap-2">
                <div ref={categoryRef} className="min-w-0 flex-1">
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
                {selectedCategory.category.owner === 'user' && (
                  <>
                    <button
                      className="shrink-0 font-hand text-sm text-accent2"
                      onClick={() => openEditTemplate(selectedCategory)}
                    >
                      Éditer
                    </button>
                    <button
                      className="shrink-0 font-hand text-sm text-danger"
                      onClick={() => void handleDeleteTemplate(selectedCategory.category.id)}
                    >
                      Suppr.
                    </button>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block font-hand text-base">Provider</label>
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
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              className="w-40 rounded-lg border-2 border-ink bg-paper p-1.5 font-body text-sm"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="modèle"
              aria-label="modèle"
            />
            {provider.isLocal && (
              <input
                className="w-52 rounded-lg border-2 border-ink bg-paper p-1.5 font-body text-sm"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="base URL"
                aria-label="base URL"
              />
            )}
            {provider.needsKey && (
              <>
                <input
                  className="min-w-40 flex-1 rounded-lg border-2 border-ink bg-paper p-1.5 font-body text-sm"
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={keySaved ? 'clé enregistrée (chiffrée) — saisir pour remplacer' : 'clé API'}
                  aria-label="clé API"
                />
                <button
                  className="shrink-0 rounded-lg border-2 border-ink bg-ink px-3 py-1.5 font-hand text-sm text-paper shadow-sketch-sm disabled:opacity-50"
                  onClick={() => void handleSaveKey()}
                  disabled={!keyInput.trim()}
                >
                  {keySaved ? 'Remplacer' : 'Enregistrer'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Fil de génération */}
        <div ref={threadRef} className="flex-1 overflow-y-auto p-4" role="log" aria-live="polite">
          {!threadIntent && versions.length === 0 && !draft && !abMode && (
            <p className="mt-16 text-center font-hand text-2xl text-ink/40">
              Décris ton besoin en bas pour forger un prompt ✶
            </p>
          )}

          {threadIntent && (
            <div className="mb-4 flex justify-end">
              <div className="animate-pf-in card-sketch max-w-[80%] px-4 py-2 font-body text-sm">
              {threadIntent}
            </div>
            </div>
          )}

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
                  Choisir le brut ✓
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
                  Choisir l'optimisé ✓
                </button>
              </SketchBox>
            </section>
          )}

          {!abMode &&
            versions.map((v, index) => {
              const quality = scorePrompt(v.prompt);
              const qualityColor =
                quality.score >= 80
                  ? 'text-success'
                  : quality.score >= 50
                    ? 'text-accent'
                    : 'text-danger';
              const failed = quality.checks.filter((c) => !c.passed);
              const cost = estimateCost(v.providerType, v.model, v.tokens);
              const costLabel = cost.free
                ? 'gratuit (local)'
                : cost.amountUsd !== null
                  ? `~$${cost.amountUsd.toFixed(cost.amountUsd < 0.01 ? 5 : 3)} (est.)`
                  : null;
              return (
                <SketchBox key={v.id} className="animate-pf-in mb-4 p-4">
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
                      <span className="ml-1 self-center font-hand text-base text-ink/50">
                        Ouvrir dans →
                      </span>
                      {LLM_TARGETS.map((t) => (
                        <button
                          key={t.target}
                          className="rounded-lg border-2 border-ink bg-accent2 px-2 py-1 font-hand text-base text-paper shadow-sketch-sm"
                          onClick={() => void handleOpenInLlm(t.target, v.prompt)}
                          title={
                            t.prefills
                              ? `Ouvre une nouvelle discussion ${t.label} avec ce prompt`
                              : `Copie le prompt et ouvre ${t.label} (colle avec Ctrl+V)`
                          }
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border-2 border-ink/20 bg-paper/60 p-3 font-mono text-sm text-ink">
                    {v.prompt}
                  </pre>
                  <p className="mt-2 font-body text-xs text-ink/60">
                    Généré par <strong>{v.providerLabel}</strong>
                    {v.model ? ` · ${v.model}` : ''} · ~{v.tokens} tokens
                    {costLabel ? ` · ${costLabel}` : ''}
                  </p>
                  <p className={`mt-1 font-hand text-base ${qualityColor}`}>
                    Qualité : {quality.score}/100
                    {failed.length > 0 && (
                      <span className="font-body text-xs text-ink/60">
                        {' '}
                        — à améliorer : {failed.map((c) => c.hint).join(' ')}
                      </span>
                    )}
                  </p>
                </SketchBox>
              );
            })}

          {!abMode && draft && (
            <SketchBox className="animate-pf-in mb-4 p-4" color="#3b82a0">
              <div className="mb-2 font-hand text-xl">{draft.label}</div>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border-2 border-ink/20 bg-paper/60 p-3 font-mono text-sm text-ink">
                {draft.text || '…'}
              </pre>
            </SketchBox>
          )}

          {!abMode && versions.length > 0 && !draft && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
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
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t-2 border-ink/15 p-4">
          {templateParams.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-3">
              {templateParams.map((p) => (
                <div key={p.key} className="flex items-center gap-1">
                  <span className="font-body text-xs text-ink/60">
                    {p.label}
                    {p.required ? ' *' : ''}
                  </span>
                  {p.type === 'select' && p.options && p.options.length > 0 ? (
                    <select
                      className="rounded border-2 border-ink bg-paper p-1 font-body text-xs"
                      value={paramValues[p.key] ?? ''}
                      onChange={(e) => setParamValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
                      aria-label={p.label}
                    >
                      {p.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="w-32 rounded border-2 border-ink bg-paper p-1 font-body text-xs"
                      value={paramValues[p.key] ?? ''}
                      onChange={(e) => setParamValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
                      aria-label={p.label}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              className="h-20 flex-1 rounded-lg border-2 border-ink bg-paper p-2 font-body"
              value={intent}
              maxLength={8000}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  if (!busy && intent.trim()) void handleGenerate();
                }
              }}
              placeholder="Décris ton besoin…  (Ctrl/Cmd+Entrée pour générer)"
              aria-label="Décris ton besoin"
            />
            {busy ? (
              <button
                className="shrink-0 rounded-lg border-2 border-ink bg-paper px-4 py-2 font-hand text-xl text-danger shadow-sketch"
                onClick={handleStop}
              >
                Arrêter ◼
              </button>
            ) : (
              <button
                className="wonk shrink-0 rounded-lg border-2 border-ink bg-accent px-4 py-2 font-hand text-xl text-ink shadow-sketch transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                onClick={() => void handleGenerate()}
                disabled={!intent.trim()}
              >
                Générer ✶
              </button>
            )}
          </div>
          <label className="mt-2 flex items-center gap-2 font-hand text-sm text-ink/70">
            <input type="checkbox" checked={abMode} onChange={(e) => setAbMode(e.target.checked)} />
            Comparer brut ↔ optimisé
          </label>
        </div>
      </main>

      {/* Modale : éditeur de template */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/30 p-4"
          onClick={() => setEditorOpen(false)}
        >
          <div
            className="card-sketch max-h-[90vh] w-full max-w-2xl overflow-y-auto p-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? 'Éditer le template' : 'Nouveau template'}
          >
            <h3 className="mb-2 font-hand text-xl">
              {editingId ? 'Éditer le template' : 'Nouveau template'}
            </h3>
            <input
              ref={nameInputRef}
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

            <div className="mb-2 rounded-lg border-2 border-ink/30 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-hand text-base">Variables (optionnel)</span>
                <button className="font-hand text-sm text-accent" onClick={addFormParam}>
                  + ajouter
                </button>
              </div>
              {formParams.length === 0 && (
                <p className="font-body text-xs text-ink/50">
                  {'Aucune variable. Référence {{clé}} dans le squelette pour la rendre saisissable.'}
                </p>
              )}
              {formParams.map((p, i) => (
                <div key={i} className="mb-1 grid grid-cols-2 gap-1 sm:grid-cols-6">
                  <input
                    className="rounded border-2 border-ink bg-paper p-1 font-mono text-xs"
                    placeholder="clé"
                    value={p.key}
                    onChange={(e) => updateFormParam(i, { key: e.target.value })}
                    aria-label="clé variable"
                  />
                  <input
                    className="rounded border-2 border-ink bg-paper p-1 font-body text-xs"
                    placeholder="libellé"
                    value={p.label}
                    onChange={(e) => updateFormParam(i, { label: e.target.value })}
                    aria-label="libellé variable"
                  />
                  <select
                    className="rounded border-2 border-ink bg-paper p-1 font-body text-xs"
                    value={p.type}
                    onChange={(e) =>
                      updateFormParam(i, { type: e.target.value as TemplateParam['type'] })
                    }
                    aria-label="type variable"
                  >
                    <option value="text">texte</option>
                    <option value="select">choix</option>
                  </select>
                  <input
                    className="rounded border-2 border-ink bg-paper p-1 font-body text-xs"
                    placeholder={p.type === 'select' ? 'options (a, b, c)' : 'défaut'}
                    value={p.type === 'select' ? (p.options?.join(', ') ?? '') : p.defaultValue}
                    onChange={(e) =>
                      p.type === 'select'
                        ? updateFormParam(i, { options: e.target.value.split(',').map((s) => s.trim()) })
                        : updateFormParam(i, { defaultValue: e.target.value })
                    }
                    aria-label="options ou valeur par défaut"
                  />
                  <label className="flex items-center gap-1 font-body text-xs">
                    <input
                      type="checkbox"
                      checked={p.required}
                      onChange={(e) => updateFormParam(i, { required: e.target.checked })}
                    />
                    requis
                  </label>
                  <button
                    className="rounded border-2 border-danger px-1 font-body text-xs text-danger"
                    onClick={() => removeFormParam(i)}
                    aria-label="supprimer variable"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

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
        </div>
      )}

      {/* Toasts */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-pf-in card-sketch pointer-events-auto flex items-center gap-3 px-4 py-2 font-hand text-lg text-ink"
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                className="font-hand text-base text-accent2 underline"
                onClick={() => {
                  t.action?.onClick();
                  setToasts((prev) => prev.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
