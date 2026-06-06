import { useState, type ReactElement } from 'react';
import { analytics } from './App.js';

const CONSENT_KEY = 'pf-analytics-consent';

/**
 * Bandeau de consentement analytics (web). Opt-out : la collecte (events anonymes, sans contenu)
 * est active par défaut ; l'utilisateur peut la refuser ici. Affiché une seule fois (choix mémorisé).
 */
export function ConsentBanner(): ReactElement | null {
  const [decided, setDecided] = useState(() => {
    try {
      return localStorage.getItem(CONSENT_KEY) !== null;
    } catch {
      return true; // pas de stockage → on n'affiche pas le bandeau
    }
  });

  if (decided) return null;

  const decide = (accept: boolean): void => {
    try {
      localStorage.setItem(CONSENT_KEY, accept ? 'in' : 'out');
    } catch {
      /* stockage indisponible */
    }
    if (!accept) analytics.optOut();
    setDecided(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">
      <div className="card-sketch flex max-w-2xl flex-col items-center gap-3 px-4 py-3 font-body text-sm text-ink sm:flex-row">
        <span>
          On utilise une analytics <strong>anonyme</strong> (aucun prompt ni clé envoyé) pour
          améliorer PromptForge.
        </span>
        <div className="flex shrink-0 gap-2">
          <button
            className="rounded-lg border-2 border-ink bg-paper px-3 py-1 font-hand shadow-sketch-sm"
            onClick={() => decide(false)}
          >
            Refuser
          </button>
          <button
            className="rounded-lg border-2 border-ink bg-accent px-3 py-1 font-hand text-ink shadow-sketch-sm"
            onClick={() => decide(true)}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
