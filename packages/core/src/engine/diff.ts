/**
 * Diff mot-à-mot entre deux textes (pour visualiser les changements entre versions d'affinage).
 * Algorithme LCS sur des tokens « mot + espaces », 100 % local, sans dépendance.
 */
export type DiffOp = 'equal' | 'added' | 'removed';

export interface DiffSegment {
  readonly op: DiffOp;
  readonly text: string;
}

/** Découpe en tokens en conservant les espaces (pour reconstruire fidèlement le texte). */
function tokenize(text: string): readonly string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

/** Table LCS classique (longueurs des plus longues sous-séquences communes). */
function lcsLengths(a: readonly string[], b: readonly string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  return table;
}

/** Fusionne les segments consécutifs de même opération. */
function coalesce(segments: readonly DiffSegment[]): readonly DiffSegment[] {
  const merged: DiffSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && last.op === seg.op) merged[merged.length - 1] = { op: last.op, text: last.text + seg.text };
    else merged.push(seg);
  }
  return merged;
}

/**
 * Renvoie la séquence de segments transformant `before` en `after`.
 * `removed` = présent dans before seulement ; `added` = présent dans after seulement.
 */
export function diffWords(before: string, after: string): readonly DiffSegment[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const table = lcsLengths(a, b);
  const out: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ op: 'equal', text: a[i]! });
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      out.push({ op: 'removed', text: a[i]! });
      i++;
    } else {
      out.push({ op: 'added', text: b[j]! });
      j++;
    }
  }
  while (i < a.length) out.push({ op: 'removed', text: a[i++]! });
  while (j < b.length) out.push({ op: 'added', text: b[j++]! });
  return coalesce(out);
}
