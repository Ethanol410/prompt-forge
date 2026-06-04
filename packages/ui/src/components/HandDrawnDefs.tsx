import type { ReactElement } from 'react';

/**
 * Définitions SVG globales à monter une seule fois (STYLE_hand-drawn.md §6).
 * Filtre `#hand-drawn-wobble` : léger tremblé organique des traits (classe utilitaire `.wobble`).
 * `scale` faible (2.5) pour rester lisible — à réserver aux bordures/traits, pas au texte.
 */
export function HandDrawnDefs(): ReactElement {
  return (
    <svg width="0" height="0" aria-hidden="true" className="absolute">
      <filter id="hand-drawn-wobble">
        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" />
      </filter>
    </svg>
  );
}
