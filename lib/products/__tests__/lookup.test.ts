import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the product catalog lookup. We mock both Prisma
 * (so we can control cache hits) and global fetch (so we can
 * control UPCitemdb / Open Food Facts responses).
 *
 * The flow we're testing:
 *   1. lookupLocal — find in the workspace's ProductCatalogItem
 *   2. lookupUPCitemdb — online general-purpose
 *   3. lookupOpenFoodFacts — online food-only
 *
 * Each step short-circuits the next on a hit, so we test the
 * short-circuit logic with mocked fetch counts.
 */

const productFindUnique = vi.fn();
const productUpsert = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    productCatalogItem: {
      findUnique: (...a: unknown[]) => productFindUnique(...a),
      upsert: (...a: unknown[]) => productUpsert(...a),
    },
  },
}));

import { lookupProduct } from '../lookup';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no local cache, no upsert
  productFindUnique.mockResolvedValue(null);
  productUpsert.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(responses: Array<{ url: string | RegExp; status?: number; body?: unknown }>) {
  const fetchMock = vi.fn(async (url: string) => {
    const match = responses.find((r) =>
      typeof r.url === 'string' ? r.url === url : r.url.test(url),
    );
    if (!match) {
      return new Response('not stubbed', { status: 500 });
    }
    return new Response(JSON.stringify(match.body ?? {}), {
      status: match.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('lookupProduct', () => {
  it('returns not_found for an empty code', async () => {
    const res = await lookupProduct('ws_1', '   ');
    expect(res.kind).toBe('not_found');
    expect(productFindUnique).not.toHaveBeenCalled();
  });

  it('returns the cached product on a local hit, no API call', async () => {
    productFindUnique.mockResolvedValue({
      id: 'p1',
      workspaceId: 'ws_1',
      code: '012345678905',
      name: 'Cached Item',
      description: null,
      brand: 'Acme',
      manufacturer: null,
      category: null,
      imageUrl: null,
      source: 'upcitemdb',
      sourceMetadata: null,
      lastFetchedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const fetchSpy = stubFetch([]);

    const res = await lookupProduct('ws_1', '012345678905');
    expect(res.kind).toBe('found');
    if (res.kind !== 'found') return;
    expect(res.product.name).toBe('Cached Item');
    expect(res.product.source).toBe('cache');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls through to UPCitemdb on a cache miss', async () => {
    const fetchSpy = stubFetch([
      {
        url: 'https://api.upcitemdb.com/prod/trial/lookup?upc=012345678905',
        body: {
          code: '012345678905',
          total: 1,
          items: [
            {
              title: 'Planters Cocktail Peanuts',
              description: 'Salted, 16 oz',
              brand: 'Planters',
              category: 'Food > Snack Foods > Nuts',
              images: ['https://images.example.com/planters.jpg'],
            },
          ],
        },
      },
    ]);

    const res = await lookupProduct('ws_1', '012345678905');
    expect(res.kind).toBe('found');
    if (res.kind !== 'found') return;
    expect(res.product.name).toBe('Planters Cocktail Peanuts');
    expect(res.product.brand).toBe('Planters');
    expect(res.product.imageUrl).toBe('https://images.example.com/planters.jpg');
    expect(res.product.source).toBe('upcitemdb');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Should persist to local catalog for next time
    expect(productUpsert).toHaveBeenCalledTimes(1);
  });

  it('falls through to Open Food Facts if UPCitemdb returns nothing', async () => {
    const fetchSpy = stubFetch([
      // UPCitemdb returns 0 items
      {
        url: 'https://api.upcitemdb.com/prod/trial/lookup?upc=012345678905',
        body: { code: '012345678905', total: 0, items: [] },
      },
      // Open Food Facts has it
      {
        url: 'https://world.openfoodfacts.org/api/v0/product/012345678905.json',
        body: {
          status: 1,
          product: {
            product_name: 'Test Bar',
            brands: 'BrandA, BrandB',
            categories: 'Snacks',
            image_url: 'https://images.example.com/test.jpg',
          },
        },
      },
    ]);

    const res = await lookupProduct('ws_1', '012345678905');
    expect(res.kind).toBe('found');
    if (res.kind !== 'found') return;
    expect(res.product.name).toBe('Test Bar');
    expect(res.product.brand).toBe('BrandA'); // first brand only
    expect(res.product.source).toBe('openfoodfacts');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns not_found if every source returns nothing', async () => {
    stubFetch([
      { url: /upcitemdb/, body: { total: 0, items: [] } },
      { url: /openfoodfacts/, status: 404, body: { status: 0 } },
    ]);

    const res = await lookupProduct('ws_1', '0000000000');
    expect(res.kind).toBe('not_found');
  });

  it('returns not_found on UPCitemdb network error (no crash)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))));
    const res = await lookupProduct('ws_1', '012345678905');
    expect(res.kind).toBe('not_found');
  });

  it('returns not_found on UPCitemdb 429 rate-limit (graceful)', async () => {
    stubFetch([
      { url: /upcitemdb/, status: 429, body: { error: 'rate limited' } },
      { url: /openfoodfacts/, status: 404, body: { status: 0 } },
    ]);
    const res = await lookupProduct('ws_1', '012345678905');
    expect(res.kind).toBe('not_found');
  });

  it('does NOT persist to catalog on a cache hit (no need to overwrite)', async () => {
    productFindUnique.mockResolvedValue({
      id: 'p1', workspaceId: 'ws_1', code: 'X', name: 'Cached', description: null,
      brand: null, manufacturer: null, category: null, imageUrl: null,
      source: 'upcitemdb', sourceMetadata: null, lastFetchedAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    });
    stubFetch([]);
    await lookupProduct('ws_1', 'X');
    expect(productUpsert).not.toHaveBeenCalled();
  });

  it('handles UPCitemdb 200 with malformed JSON as not_found', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response('not json{', { status: 200, headers: { 'content-type': 'application/json' } }),
    ));
    const res = await lookupProduct('ws_1', 'X');
    expect(res.kind).toBe('not_found');
  });
});
