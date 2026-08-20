import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the vendor cache on ProductCatalogItem. We verify:
 *   1. UPCitemdb's `brand` field is mapped to `vendor` when
 *      no `manufacturer` is provided.
 *   2. UPCitemdb's `manufacturer` field is used as `vendor`
 *      when `brand` is missing.
 *   3. brand takes precedence over manufacturer when both
 *      are present (brand is the more user-facing label).
 *   4. Both vendor and brand are persisted to the
 *      ProductCatalogItem cache on the first successful
 *      online lookup, so the next scan returns the vendor
 *      without a network round-trip.
 *   5. A cache hit returns the persisted vendor without
 *      calling the network at all.
 *   6. Open Food Facts maps `brands` to `vendor` and
 *      persists it.
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

describe('lookupProduct — vendor caching', () => {
  it('pulls vendor from UPCitemdb brand field on first successful lookup', async () => {
    stubFetch([
      {
        url: 'https://api.upcitemdb.com/prod/trial/lookup?upc=012345678905',
        body: {
          code: '012345678905',
          total: 1,
          items: [
            {
              title: 'Drywall screws, 1-5/8"',
              brand: 'Grip-Rite',
              category: 'Hardware > Fasteners > Screws',
            },
          ],
        },
      },
    ]);

    const res = await lookupProduct('ws_1', '012345678905');
    expect(res.kind).toBe('found');
    if (res.kind !== 'found') return;
    expect(res.product.brand).toBe('Grip-Rite');
    expect(res.product.vendor).toBe('Grip-Rite');
    expect(res.product.manufacturer).toBeNull();
  });

  it('falls back to manufacturer when brand is missing', async () => {
    stubFetch([
      {
        url: 'https://api.upcitemdb.com/prod/trial/lookup?upc=012345678905',
        body: {
          code: '012345678905',
          total: 1,
          items: [
            {
              title: 'Concrete mix',
              manufacturer: 'Quikrete',
              category: 'Building Materials',
            },
          ],
        },
      },
    ]);

    const res = await lookupProduct('ws_1', '012345678905');
    expect(res.kind).toBe('found');
    if (res.kind !== 'found') return;
    expect(res.product.brand).toBeNull();
    expect(res.product.vendor).toBe('Quikrete');
    expect(res.product.manufacturer).toBe('Quikrete');
  });

  it('brand takes precedence over manufacturer for vendor', async () => {
    stubFetch([
      {
        url: 'https://api.upcitemdb.com/prod/trial/lookup?upc=012345678905',
        body: {
          code: '012345678905',
          total: 1,
          items: [
            {
              title: 'Branded product',
              brand: 'BrandX',
              manufacturer: 'ParentCo',
            },
          ],
        },
      },
    ]);

    const res = await lookupProduct('ws_1', '012345678905');
    expect(res.kind).toBe('found');
    if (res.kind !== 'found') return;
    expect(res.product.brand).toBe('BrandX');
    expect(res.product.vendor).toBe('BrandX');
    expect(res.product.manufacturer).toBe('ParentCo');
  });

  it('vendor is null when neither brand nor manufacturer is provided', async () => {
    stubFetch([
      {
        url: 'https://api.upcitemdb.com/prod/trial/lookup?upc=012345678905',
        body: {
          code: '012345678905',
          total: 1,
          items: [
            {
              title: 'Generic widget',
              // no brand, no manufacturer
            },
          ],
        },
      },
    ]);

    const res = await lookupProduct('ws_1', '012345678905');
    expect(res.kind).toBe('found');
    if (res.kind !== 'found') return;
    expect(res.product.brand).toBeNull();
    expect(res.product.vendor).toBeNull();
  });

  it('persists vendor AND brand to ProductCatalogItem on first online lookup', async () => {
    stubFetch([
      {
        url: 'https://api.upcitemdb.com/prod/trial/lookup?upc=012345678905',
        body: {
          code: '012345678905',
          total: 1,
          items: [
            {
              title: 'Drywall screws, 1-5/8"',
              brand: 'Grip-Rite',
              manufacturer: 'Grip-Rite Fasteners Inc.',
              category: 'Hardware',
            },
          ],
        },
      },
    ]);

    await lookupProduct('ws_1', '012345678905');
    expect(productUpsert).toHaveBeenCalledTimes(1);
    const upsertCall = productUpsert.mock.calls[0][0] as {
      create: { vendor: string | null; brand: string | null; manufacturer: string | null };
      update: { vendor: string | null; brand: string | null; manufacturer: string | null };
    };
    // On first insert, vendor + brand + manufacturer are all
    // written from the API response.
    expect(upsertCall.create.vendor).toBe('Grip-Rite');
    expect(upsertCall.create.brand).toBe('Grip-Rite');
    expect(upsertCall.create.manufacturer).toBe('Grip-Rite Fasteners Inc.');
  });

  it('returns the cached vendor on a subsequent scan (no network call)', async () => {
    productFindUnique.mockResolvedValue({
      id: 'p1',
      workspaceId: 'ws_1',
      code: '012345678905',
      name: 'Drywall screws',
      description: null,
      brand: 'Grip-Rite',
      vendor: 'Grip-Rite',
      manufacturer: null,
      category: 'Hardware',
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
    expect(res.product.vendor).toBe('Grip-Rite');
    expect(res.product.brand).toBe('Grip-Rite');
    expect(res.product.source).toBe('cache');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Open Food Facts: vendor mirrors brand from `brands` field', async () => {
    stubFetch([
      // UPCitemdb miss
      {
        url: 'https://api.upcitemdb.com/prod/trial/lookup?upc=012345678905',
        body: { code: '012345678905', total: 0, items: [] },
      },
      // Open Food Facts hit
      {
        url: 'https://world.openfoodfacts.org/api/v0/product/012345678905.json',
        body: {
          status: 1,
          product: {
            product_name: 'Test Bar',
            brands: 'BrandA, BrandB',
          },
        },
      },
    ]);

    const res = await lookupProduct('ws_1', '012345678905');
    expect(res.kind).toBe('found');
    if (res.kind !== 'found') return;
    expect(res.product.brand).toBe('BrandA');
    expect(res.product.vendor).toBe('BrandA');
    expect(res.product.source).toBe('openfoodfacts');
  });

  it('Open Food Facts: vendor is persisted to ProductCatalogItem', async () => {
    stubFetch([
      {
        url: 'https://api.upcitemdb.com/prod/trial/lookup?upc=012345678905',
        body: { code: '012345678905', total: 0, items: [] },
      },
      {
        url: 'https://world.openfoodfacts.org/api/v0/product/012345678905.json',
        body: {
          status: 1,
          product: {
            product_name: 'Test Bar',
            brands: 'BrandA, BrandB',
          },
        },
      },
    ]);

    await lookupProduct('ws_1', '012345678905');
    expect(productUpsert).toHaveBeenCalled();
    const upsertCall = productUpsert.mock.calls[0][0] as {
      create: { vendor: string | null; brand: string | null; source: string };
    };
    expect(upsertCall.create.vendor).toBe('BrandA');
    expect(upsertCall.create.brand).toBe('BrandA');
    expect(upsertCall.create.source).toBe('openfoodfacts');
  });
});
