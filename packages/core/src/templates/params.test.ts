import { describe, it, expect } from 'vitest';
import { defaultParamValues, missingRequiredParams } from './params.js';
import type { ParamsSchema } from '../models/template.js';

const schema: ParamsSchema = {
  params: [
    { key: 'ton', label: 'Ton', type: 'select', required: true, defaultValue: 'formel', options: ['formel', 'direct'] },
    { key: 'public', label: 'Public', type: 'text', required: false, defaultValue: 'développeurs' },
  ],
};

describe('defaultParamValues', () => {
  it('renvoie les valeurs par défaut par clé', () => {
    expect(defaultParamValues(schema)).toEqual({ ton: 'formel', public: 'développeurs' });
  });
  it('renvoie {} si pas de schéma', () => {
    expect(defaultParamValues(null)).toEqual({});
  });
});

describe('missingRequiredParams', () => {
  it('liste les variables requises non renseignées', () => {
    const missing = missingRequiredParams(schema, { ton: '  ', public: 'x' });
    expect(missing.map((p) => p.key)).toEqual(['ton']);
  });
  it('vide si tout est rempli', () => {
    expect(missingRequiredParams(schema, { ton: 'direct', public: '' })).toEqual([]);
  });
});
