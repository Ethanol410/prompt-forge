import type { ReactElement } from 'react';

export type DoodleName = 'star' | 'arrow' | 'squiggle';

export interface DoodleProps {
  readonly name: DoodleName;
  readonly className?: string;
  readonly color?: string;
}

const PATHS: Record<DoodleName, ReactElement> = {
  // Étincelle 4 branches
  star: (
    <path
      d="M16 2 C18 10 22 14 30 16 C22 18 18 22 16 30 C14 22 10 18 2 16 C10 14 14 10 16 2 Z"
      fill="currentColor"
    />
  ),
  // Petite flèche courbe
  arrow: (
    <path
      d="M3 20 C10 6 22 4 29 10 M29 10 L22 9 M29 10 L27 17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  // Soulignement gribouillé
  squiggle: (
    <path
      d="M2 16 C8 8 12 24 18 16 C24 8 28 24 34 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  ),
};

/**
 * Doodle décoratif (§7) : non interactif, contraste discret. Placé librement en décor.
 */
export function Doodle({ name, className = '', color = '#e8743b' }: DoodleProps): ReactElement {
  return (
    <svg
      viewBox="0 0 32 32"
      className={`pointer-events-none select-none ${className}`}
      style={{ color }}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
