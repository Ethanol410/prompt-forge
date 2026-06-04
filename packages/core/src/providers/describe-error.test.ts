import { describe, it, expect } from 'vitest';
import { ProviderError, describeProviderError } from './errors.js';

describe('describeProviderError', () => {
  it('clé manquante', () => {
    expect(describeProviderError(new ProviderError('missing_api_key', 'x'))).toContain('Clé API manquante');
  });

  it('401/403 → clé invalide', () => {
    expect(describeProviderError(new ProviderError('http_error', 'x', 401))).toContain('invalide');
    expect(describeProviderError(new ProviderError('http_error', 'x', 403))).toContain('invalide');
  });

  it('429 → quota', () => {
    expect(describeProviderError(new ProviderError('http_error', 'x', 429))).toContain('Quota');
  });

  it('5xx → erreur serveur', () => {
    expect(describeProviderError(new ProviderError('http_error', 'x', 503))).toContain('serveur');
  });

  it('network → injoignable', () => {
    expect(describeProviderError(new ProviderError('network', 'x'))).toContain('injoignable');
  });

  it('erreur non-ProviderError → message générique', () => {
    expect(describeProviderError(new Error('boom'))).toContain('inattendue');
    expect(describeProviderError('nope')).toContain('inattendue');
  });
});
