import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import rough from 'roughjs';

export interface SketchBoxProps {
  readonly children: ReactNode;
  readonly className?: string;
  /** Couleur du trait (défaut : encre). */
  readonly color?: string;
  /** Couleur de remplissage hachuré optionnelle. */
  readonly fill?: string;
}

/**
 * Encadre ses enfants d'un contour Rough.js (style croqué) dessiné dans un SVG en fond.
 * Le contour est redessiné uniquement au redimensionnement (ResizeObserver), pas à chaque frame (§8).
 */
export function SketchBox({ children, className = '', color = '#2b2b2b', fill }: SketchBoxProps): ReactElement {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const svg = svgRef.current;
    if (!wrapper || !svg) return;

    const draw = (): void => {
      const { width, height } = wrapper.getBoundingClientRect();
      if (width < 4 || height < 4) return;
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const rc = rough.svg(svg);
      const node = rc.rectangle(4, 4, width - 8, height - 8, {
        stroke: color,
        strokeWidth: 1.8,
        roughness: 1.6,
        bowing: 1.2,
        ...(fill ? { fill, fillStyle: 'hachure', fillWeight: 0.5, hachureGap: 6 } : {}),
      });
      svg.appendChild(node);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [color, fill]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <svg ref={svgRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative">{children}</div>
    </div>
  );
}
