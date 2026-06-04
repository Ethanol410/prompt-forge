import { describe, it, expect, vi, afterEach } from 'vitest';
import { FetchHttpClient } from './fetch-http-client.js';
import { ProviderError } from '@promptforge/core';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FetchHttpClient', () => {
  it('stream() décode et réassemble le corps en chunks de texte', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hel'));
        controller.enqueue(new TextEncoder().encode('lo'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));

    const client = new FetchHttpClient();
    const response = await client.send({ url: 'http://x', method: 'GET', headers: {} });

    let out = '';
    for await (const chunk of response.stream()) out += chunk;
    expect(out).toBe('hello');
    expect(response.ok).toBe(true);
  });

  it('transmet méthode, headers et body à fetch', async () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new FetchHttpClient();
    await client.send({
      url: 'http://x/y',
      method: 'POST',
      headers: { 'x-test': '1' },
      body: '{"a":1}',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://x/y',
      expect.objectContaining({ method: 'POST', body: '{"a":1}' }),
    );
  });

  it('mappe un échec réseau/CORS vers ProviderError(network)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const client = new FetchHttpClient();
    const error = await client.send({ url: 'http://x', method: 'GET', headers: {} }).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ code: 'network' });
  });
});
