import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { SketchBox, Doodle, HandDrawnDefs, usePrefersReducedMotion } from '@promptforge/ui';
import { SYSTEM_CATEGORIES } from '@promptforge/core';

export interface LandingProps {
  /** Lance l'app web (navigue vers /app). */
  readonly onLaunch: () => void;
  /** Lien direct vers l'installeur Windows. */
  readonly downloadUrl: string;
  /** Page des releases (toutes versions / formats). */
  readonly releasesUrl: string;
  /** Dépôt GitHub (open source). */
  readonly repoUrl: string;
  /** Version desktop affichée. */
  readonly version: string;
}

/** Noms des catégories système, dérivés du cœur (reste en phase quand on en ajoute). */
const CATEGORIES: readonly string[] = SYSTEM_CATEGORIES.map((c) => c.category.name);

const BADGES = ['Gratuit', 'Sans compte', 'Open source', 'Clés chiffrées', 'Web + Desktop'] as const;

const FEATURES: ReadonlyArray<{ readonly title: string; readonly body: string }> = [
  { title: 'Génération hybride', body: 'Template structurant + une passe d’optimisation par le modèle.' },
  { title: 'Ouvre dans ChatGPT / Claude / Gemini', body: 'Un clic : ton prompt s’ouvre dans une nouvelle discussion.' },
  { title: '« Améliorer encore »', body: 'Le modèle critique ton prompt puis le réécrit. Diff entre versions.' },
  { title: 'Templates & variables', body: 'Crée tes catégories, ajoute des variables, importe / exporte en JSON.' },
  { title: 'Historique & favoris', body: 'Recherche, filtre et épingle tes meilleurs prompts. 100 % local.' },
  { title: 'BYOK ou 100 % local', body: 'Ta clé (chiffrée) ou Ollama / LM Studio hors-ligne. Aucun backend éditeur.' },
];

const STEPS: ReadonlyArray<{ readonly n: string; readonly title: string; readonly body: string }> = [
  { n: '1', title: 'Choisis une catégorie', body: 'PRD, code, email, design, réseaux sociaux… le squelette s’adapte à ta tâche.' },
  { n: '2', title: 'Décris ton besoin', body: 'En langage naturel (ou clique un exemple), sans connaître le « prompt engineering ».' },
  { n: '3', title: 'Ouvre-le où tu veux', body: 'Un prompt structuré, à ouvrir en 1 clic dans ChatGPT, Claude ou Gemini — ou à copier.' },
];

const FAQ: ReadonlyArray<{ readonly q: string; readonly a: string }> = [
  {
    q: 'C’est vraiment gratuit ?',
    a: 'Oui, entièrement. Pas de compte, pas d’abonnement. Tu utilises ta propre clé d’API (tu paies directement le provider) ou un modèle local, gratuit.',
  },
  {
    q: 'Mes clés d’API sont-elles en sécurité ?',
    a: 'Oui. Sur le web, elles sont chiffrées en AES-GCM (WebCrypto) avant stockage local ; sur desktop, dans le keychain de l’OS. Elles ne sont jamais envoyées à un serveur de l’éditeur.',
  },
  {
    q: 'Quels modèles puis-je utiliser ?',
    a: 'Anthropic, OpenAI, Mistral, Gemini, OpenRouter, et en local Ollama / LM Studio. Sur le web, OpenAI / Mistral / Gemini sont réservés au desktop (restrictions CORS du navigateur).',
  },
  {
    q: 'Web ou desktop ?',
    a: 'Le web pour démarrer sans rien installer. Le desktop pour tous les providers et les modèles locaux 100 % hors-ligne.',
  },
  {
    q: 'Mes données quittent-elles mon appareil ?',
    a: 'Tes intentions et tes prompts ne vont qu’au provider que TU choisis (ou restent 100 % locaux). L’analytics est anonyme, sans aucun contenu, et désactivable.',
  },
];

/** Révèle ses enfants au scroll (désactivé si l'utilisateur préfère moins d'animations). */
function Reveal({ children, className = '' }: { children: ReactNode; className?: string }): ReactElement {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
}

function CtaButtons({
  onLaunch,
  downloadUrl,
  version,
}: Pick<LandingProps, 'onLaunch' | 'downloadUrl' | 'version'>): ReactElement {
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
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
    <SketchBox className={`h-full transition duration-200 hover:-translate-y-1 ${className}`}>
      <div className="p-5">{children}</div>
    </SketchBox>
  );
}

/**
 * Page vitrine du web : présente le produit et donne les deux accès (web direct / desktop).
 * Réutilise le thème dessiné (SketchBox, Doodle, polices Caveat/Nunito).
 */
export function Landing({ onLaunch, downloadUrl, releasesUrl, repoUrl, version }: LandingProps): ReactElement {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <HandDrawnDefs />

      {/* Barre haute */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="font-hand text-3xl font-bold">PromptForge</div>
        <nav className="flex items-center gap-4 font-hand text-xl">
          <a href={repoUrl} className="hidden text-ink/70 hover:text-ink sm:inline">
            GitHub
          </a>
          <a href={releasesUrl} className="hidden text-ink/70 hover:text-ink sm:inline">
            Desktop
          </a>
          <button onClick={onLaunch} className="text-ink/70 hover:text-ink">
            Ouvrir l’app
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        {/* Hero */}
        <section className="relative py-12 text-center md:py-20">
          <Doodle name="star" className="animate-float absolute left-1/2 top-2 h-8 w-8 -translate-x-16 opacity-70" />
          <h1 className="mx-auto max-w-3xl font-hand text-5xl font-bold leading-tight md:text-6xl">
            Transforme une idée en <span className="marker">meilleur prompt</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl font-body text-lg text-ink/80">
            PromptForge structure ton intention en un prompt optimisé, clair et réutilisable — avec ta
            propre clé d’API ou un modèle local. Le livrable, c’est le prompt : tu l’emportes où tu veux.
          </p>
          <div className="mt-8">
            <CtaButtons onLaunch={onLaunch} downloadUrl={downloadUrl} version={version} />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {BADGES.map((b) => (
              <span
                key={b}
                className="rounded-full border-2 border-ink/30 bg-paper px-3 py-1 font-body text-xs text-ink/70"
              >
                {b}
              </span>
            ))}
          </div>
        </section>

        {/* Pourquoi */}
        <Reveal>
          <section className="border-y-2 border-ink/10 py-8 text-center">
            <p className="mx-auto max-w-3xl font-hand text-2xl leading-snug text-ink/80">
              Un bon résultat = un bon prompt. La plupart des prompts sont vagues → des réponses
              décevantes. <span className="marker">PromptForge fait la structuration à ta place.</span>
            </p>
          </section>
        </Reveal>

        {/* Avant → Après */}
        <Reveal>
          <section className="py-12">
            <h2 className="text-center font-hand text-3xl">Avant → Après</h2>
            <div className="mt-6 grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
              <SketchBox className="h-full" color="#d1495b">
                <div className="p-5">
                  <div className="mb-2 font-hand text-xl text-danger">Ton idée brute</div>
                  <p className="font-mono text-sm text-ink/70">
                    « écris un mail pour relancer un prospect b2b »
                  </p>
                </div>
              </SketchBox>

              <div className="flex items-center justify-center">
                <Doodle name="arrow" className="h-8 w-8 rotate-90 opacity-70 md:rotate-0" />
              </div>

              <SketchBox className="h-full" fill="#fce38a">
                <div className="p-5">
                  <div className="mb-2 font-hand text-xl">Le prompt forgé</div>
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink/80">
{`Rôle : commercial B2B, ton concis et orienté valeur.
Contexte : prospect vu en démo il y a 10 jours, sans réponse.
Objectif : relancer sans paraître insistant, obtenir un créneau.
Étapes : 1) rappeler la valeur 2) lever une objection 3) CTA unique.
Contraintes : < 120 mots, 1 seul appel à l'action, zéro jargon.
Format : objet + corps + signature.`}
                  </pre>
                </div>
              </SketchBox>
            </div>
          </section>
        </Reveal>

        {/* Fonctionnalités clés */}
        <Reveal>
          <section className="py-10">
            <h2 className="text-center font-hand text-3xl">Tout ce qu’il te faut</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
              {FEATURES.map((f) => (
                <Card key={f.title}>
                  <h3 className="font-hand text-xl">{f.title}</h3>
                  <p className="mt-2 font-body text-sm text-ink/75">{f.body}</p>
                </Card>
              ))}
            </div>
          </section>
        </Reveal>

        {/* Catégories */}
        <Reveal>
          <section className="py-6">
            <h2 className="font-hand text-3xl">{CATEGORIES.length} catégories prêtes à l’emploi</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {CATEGORIES.map((c) => (
                <span
                  key={c}
                  className="inline-block rounded-full border-2 border-ink bg-paper px-4 py-2 font-hand text-lg shadow-sketch-sm transition duration-200 hover:-translate-y-0.5 hover:-rotate-2 hover:bg-highlight"
                >
                  {c}
                </span>
              ))}
            </div>
          </section>
        </Reveal>

        {/* Comment ça marche */}
        <Reveal>
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
        </Reveal>

        {/* Web vs Desktop */}
        <Reveal>
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
        </Reveal>

        {/* FAQ */}
        <Reveal>
          <section className="py-10">
            <h2 className="font-hand text-3xl">Questions fréquentes</h2>
            <div className="mt-5 space-y-2">
              {FAQ.map((item) => (
                <details
                  key={item.q}
                  className="rounded-lg border-2 border-ink/30 bg-paper p-3 [&_summary]:cursor-pointer"
                >
                  <summary className="font-hand text-xl">{item.q}</summary>
                  <p className="mt-2 font-body text-sm text-ink/75">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </Reveal>

        {/* CTA final */}
        <Reveal>
          <section className="py-12 text-center">
            <h2 className="font-hand text-4xl">Prêt à forger ton prompt ?</h2>
            <div className="mt-6">
              <CtaButtons onLaunch={onLaunch} downloadUrl={downloadUrl} version={version} />
            </div>
          </section>
        </Reveal>
      </main>

      <footer className="mx-auto max-w-5xl px-5 py-10 font-body text-sm text-ink/55">
        <Doodle name="squiggle" className="mb-3 h-5 w-20 opacity-60" />
        <p>
          PromptForge — BYOK / modèle local, open source. Aucune clé ni intention envoyée à un serveur
          de l’éditeur.
        </p>
        <p className="mt-1">
          <a href={repoUrl} className="underline hover:text-ink">
            GitHub
          </a>{' '}
          ·{' '}
          <a href={releasesUrl} className="underline hover:text-ink">
            Téléchargements desktop
          </a>{' '}
          · v{version}
        </p>
      </footer>
    </div>
  );
}
