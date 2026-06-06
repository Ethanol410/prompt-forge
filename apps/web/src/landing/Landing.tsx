import type { ReactElement, ReactNode } from 'react';
import { SketchBox, Doodle, HandDrawnDefs } from '@promptforge/ui';
import { SYSTEM_CATEGORIES } from '@promptforge/core';

export interface LandingProps {
  /** Lance l'app web (navigue vers /app). */
  readonly onLaunch: () => void;
  /** Lien direct vers l'installeur Windows. */
  readonly downloadUrl: string;
  /** Page des releases (toutes versions / formats). */
  readonly releasesUrl: string;
  /** Version desktop affichée. */
  readonly version: string;
}

/** Noms des catégories système, dérivés du cœur (reste en phase quand on en ajoute). */
const CATEGORIES: readonly string[] = SYSTEM_CATEGORIES.map((c) => c.category.name);

const STEPS: ReadonlyArray<{ readonly n: string; readonly title: string; readonly body: string }> = [
  { n: '1', title: 'Choisis une catégorie', body: 'PRD, code, email, design, réseaux sociaux… le squelette s’adapte à ta tâche.' },
  { n: '2', title: 'Décris ton besoin', body: 'En langage naturel (ou clique un exemple), sans connaître le « prompt engineering ».' },
  { n: '3', title: 'Ouvre-le où tu veux', body: 'Un prompt structuré, à ouvrir en 1 clic dans ChatGPT, Claude ou Gemini — ou à copier.' },
];

const VALUE_PROPS: ReadonlyArray<{ readonly icon: string; readonly title: string; readonly body: string }> = [
  {
    icon: '✦',
    title: 'Des prompts qui marchent',
    body: 'Template structurant + optimisation par le modèle. Puis affine-les ou clique « Améliorer encore » : le modèle critique et réécrit.',
  },
  {
    icon: '🔒',
    title: 'Tes clés restent chez toi',
    body: 'BYOK direct client → provider. Aucune clé envoyée à un serveur de l’éditeur. Chiffrement local (WebCrypto / keychain OS).',
  },
  {
    icon: '⚡',
    title: 'Cloud ou 100 % local',
    body: 'Anthropic en un clic, ou un modèle local (Ollama / LM Studio) entièrement hors-ligne. Tu gardes le contrôle des coûts.',
  },
];

function CtaButtons({ onLaunch, downloadUrl, version }: Omit<LandingProps, 'releasesUrl'>): ReactElement {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <button
        onClick={onLaunch}
        className="rounded-lg border-2 border-ink bg-accent px-6 py-3 font-hand text-2xl text-ink shadow-sketch transition hover:-translate-y-0.5"
      >
        Essayer sur le web →
      </button>
      <a
        href={downloadUrl}
        className="rounded-lg border-2 border-ink bg-paper px-6 py-3 text-center font-hand text-2xl text-ink shadow-sketch-sm transition hover:-translate-y-0.5"
      >
        ⤓ Télécharger pour Windows
      </a>
      <span className="font-body text-xs text-ink/50">v{version} · non signé</span>
    </div>
  );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }): ReactElement {
  return (
    <SketchBox className={`h-full ${className}`}>
      <div className="p-5">{children}</div>
    </SketchBox>
  );
}

/**
 * Page vitrine du web : présente le produit et donne les deux accès (web direct / desktop).
 * Réutilise le thème dessiné (SketchBox, Doodle, polices Caveat/Nunito).
 */
export function Landing({ onLaunch, downloadUrl, releasesUrl, version }: LandingProps): ReactElement {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <HandDrawnDefs />

      {/* Barre haute */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="font-hand text-3xl font-bold">PromptForge</div>
        <nav className="flex items-center gap-4 font-hand text-xl">
          <a href={releasesUrl} className="hidden text-ink/70 hover:text-ink sm:inline">
            Desktop
          </a>
          <button onClick={onLaunch} className="text-ink/70 hover:text-ink">
            Ouvrir l’app
          </button>
        </nav>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-5">
        <section className="relative grid gap-6 py-10 md:grid-cols-[1.2fr_1fr] md:items-center md:py-16">
          <Doodle name="star" className="absolute -left-2 -top-2 h-8 w-8 opacity-70" />
          <div>
            <h1 className="font-hand text-5xl font-bold leading-tight md:text-6xl">
              Transforme une idée en <span className="marker">meilleur prompt</span>.
            </h1>
            <p className="mt-5 max-w-xl font-body text-lg text-ink/80">
              PromptForge structure ton intention en un prompt optimisé, clair et réutilisable —
              avec ta propre clé d’API ou un modèle local. Le livrable, c’est le prompt : tu
              l’emportes où tu veux.
            </p>
            <div className="mt-8">
              <CtaButtons onLaunch={onLaunch} downloadUrl={downloadUrl} version={version} />
            </div>
            <p className="mt-4 font-body text-sm text-ink/55">
              Gratuit · sans compte · tes intentions et tes clés ne quittent jamais ton appareil.
            </p>
          </div>

          <div className="wonk-r">
            <SketchBox fill="#fce38a">
              <div className="space-y-3 p-5 font-body text-sm">
                <div className="font-hand text-xl">Aperçu</div>
                <p className="text-ink/70">« écris un mail pour relancer un prospect b2b »</p>
                <Doodle name="arrow" className="h-6 w-6 opacity-70" />
                <div className="rounded-md border-2 border-ink/20 bg-paper p-3 font-mono text-xs leading-relaxed text-ink/80">
                  Rôle : commercial B2B expérimenté…
                  <br />
                  Objectif : relancer sans relancer « à vide »…
                  <br />
                  Contraintes : ton concis, 1 CTA clair…
                </div>
              </div>
            </SketchBox>
          </div>
        </section>

        {/* Valeur */}
        <section className="grid gap-5 py-6 md:grid-cols-3">
          {VALUE_PROPS.map((v) => (
            <Card key={v.title}>
              <div className="mb-2 text-2xl">{v.icon}</div>
              <h3 className="font-hand text-2xl">{v.title}</h3>
              <p className="mt-2 font-body text-sm text-ink/75">{v.body}</p>
            </Card>
          ))}
        </section>

        {/* Comment ça marche */}
        <section className="py-10">
          <h2 className="font-hand text-3xl">Comment ça marche</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-accent font-hand text-xl">
                  {s.n}
                </div>
                <div>
                  <h3 className="font-hand text-xl">{s.title}</h3>
                  <p className="font-body text-sm text-ink/75">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Catégories */}
        <section className="py-6">
          <h2 className="font-hand text-3xl">{CATEGORIES.length} catégories prêtes à l’emploi</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {CATEGORIES.map((c) => (
              <span
                key={c}
                className="rounded-full border-2 border-ink bg-paper px-4 py-2 font-hand text-lg shadow-sketch-sm"
              >
                {c}
              </span>
            ))}
          </div>
        </section>

        {/* Web vs Desktop */}
        <section className="grid gap-5 py-10 md:grid-cols-2">
          <Card>
            <h3 className="font-hand text-2xl">Sur le web</h3>
            <ul className="mt-3 space-y-1 font-body text-sm text-ink/75">
              <li>• Rien à installer, démarre tout de suite.</li>
              <li>• Anthropic (cloud) + modèles locaux (Ollama / LM Studio).</li>
              <li>• Clé chiffrée localement (WebCrypto), jamais en clair.</li>
            </ul>
            <button onClick={onLaunch} className="mt-4 font-hand text-xl text-accent2 hover:underline">
              Lancer l’app web →
            </button>
          </Card>
          <Card>
            <h3 className="font-hand text-2xl">Sur desktop</h3>
            <ul className="mt-3 space-y-1 font-body text-sm text-ink/75">
              <li>• Tous les providers, OpenAI inclus (pas de blocage CORS).</li>
              <li>• Clés dans le keychain de l’OS (Credential Manager).</li>
              <li>• Modèle local 100 % hors-ligne.</li>
            </ul>
            <a href={downloadUrl} className="mt-4 inline-block font-hand text-xl text-accent2 hover:underline">
              ⤓ Télécharger pour Windows →
            </a>
          </Card>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-5 py-10 font-body text-sm text-ink/55">
        <Doodle name="squiggle" className="mb-3 h-5 w-20 opacity-60" />
        <p>
          PromptForge — BYOK / modèle local. Aucune clé ni intention envoyée à un serveur de
          l’éditeur. ·{' '}
          <a href={releasesUrl} className="underline hover:text-ink">
            Téléchargements desktop
          </a>
        </p>
      </footer>
    </div>
  );
}
