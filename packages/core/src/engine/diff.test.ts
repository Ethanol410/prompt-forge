import { describe, it, expect } from 'vitest';
import { diffWords, type DiffSegment } from './diff.js';

const text = (segs: readonly DiffSegment[], op: 'equal' | 'added' | 'removed'): string =>
  segs.filter((s) => s.op === op).map((s) => s.text).join('');

describe('diffWords', () => {
  it('textes identiques → tout equal', () => {
    const d = diffWords('le chat dort', 'le chat dort');
    expect(d.every((s) => s.op === 'equal')).toBe(true);
    expect(text(d, 'equal')).toBe('le chat dort');
  });

  it('détecte un ajout', () => {
    const d = diffWords('le chat', 'le gros chat');
    expect(text(d, 'added')).toContain('gros');
    expect(text(d, 'removed')).toBe('');
  });

  it('détecte une suppression', () => {
    const d = diffWords('le gros chat', 'le chat');
    expect(text(d, 'removed')).toContain('gros');
  });

  it('reconstruit before (equal+removed) et after (equal+added)', () => {
    const before = 'rends ce prompt plus court';
    const after = 'rends ce prompt vraiment plus clair';
    const d = diffWords(before, after);
    const rebuiltBefore = d.filter((s) => s.op !== 'added').map((s) => s.text).join('');
    const rebuiltAfter = d.filter((s) => s.op !== 'removed').map((s) => s.text).join('');
    expect(rebuiltBefore).toBe(before);
    expect(rebuiltAfter).toBe(after);
  });

  it('un seul mot changé → 1 removed + 1 added, le reste equal', () => {
    const d = diffWords('un deux trois', 'un quatre trois');
    expect(text(d, 'removed')).toBe('deux');
    expect(text(d, 'added')).toBe('quatre');
    expect(text(d, 'equal')).toContain('un');
    expect(text(d, 'equal')).toContain('trois');
  });
});
