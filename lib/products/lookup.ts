/**
 * Product catalog lookup. The flow when a barcode is scanned:
 *
 *   1. Local cache (ProductCatalogItem) — same workspace, same code.
 *      Hit on a previous scan? Return immediately. No API call.
 *
 *   2. UPCitemdb (https://www.upcitemdb.com/api) — general-purpose
 *      product database. Free trial tier is 100 requests/day with
 *      no API key. Returns product name, brand, description,
 *      category, images. We persist the result to the local
 *      catalog so step 1 hits on the next scan of the same code.
 *
 *   3. Open Food Facts (https://world.openfoodfacts.org/api) — only
 *      for food products (UPCs that start with 0-3 typically).
 *      Completely free, no rate limit, no key. Fallback if
 *      UPCitemdb didn't find anything.
 *
 * We deliberately stop at step 2/3 if both return nothing. We do
 * NOT scrape eBay/Amazon/etc — those terms forbid it, and a
 * 100/day free tier is more than enough for an internal CMS
 * when combined with local caching.
 */

import { prisma } from '@/lib/db/client';

export interface ProductInfo {
  code: string;
  name: string;
  description: string | null;
  brand: string | null;
  manufacturer: string | null;
  category: string | null;
  imageUrl: string | null;
  source: 'upcitemdb' | 'openfoodfacts' | 'manual' | 'cache';
  /** Confidence: 'high' (cache hit or full API match) vs 'low' (partial match). */
  confidence: 'high' | 'low';
}

export type LookupResult =
  | { kind: 'found'; product: ProductInfo }
  | { kind: 'not_found' };

/**
 * Main entry: look up a product across the local cache + online
 * sources. Returns the highest-confidence result.
 */
export async function lookupProduct(
  workspaceId: string,
  code: string,
): Promise<LookupResult> {
  const trimmed = code.trim();
  if (!trimmed) return { kind: 'not_found' };

  // 1. Local catalog (cache hit — fastest, no network)
  const local = await lookupLocal(workspaceId, trimmed);
  if (local) return { kind: 'found', product: { ...local, source: 'cache' } };

  // 2. UPCitemdb (general-purpose)
  const upcResult = await lookupUPCitemdb(trimmed);
  if (upcResult) {
    await persistToCatalog(workspaceId, upcResult);
    return { kind: 'found', product: upcResult };
  }

  // 3. Open Food Facts (food only, last-resort)
  const offResult = await lookupOpenFoodFacts(trimmed);
  if (offResult) {
    await persistToCatalog(workspaceId, offResult);
    return { kind: 'found', product: offResult };
  }

  return { kind: 'not_found' };
}

async function lookupLocal(workspaceId: string, code: string): Promise<ProductInfo | null> {
  const row = await prisma.productCatalogItem.findUnique({
    where: {
      product_per_workspace: { workspaceId, code },
    },
  });
  if (!row) return null;
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    brand: row.brand,
    manufacturer: row.manufacturer,
    category: row.category,
    imageUrl: row.imageUrl,
    source: 'cache',
    confidence: 'high',
  };
}

/**
 * UPCitemdb free trial endpoint. No API key required. Capped at
 * 100 requests/day. Returns 0 items when the code is unknown.
 *
 * Sample response (abridged):
 *   {
 *     "code": "0028400090520",
 *     "items": [{
 *       "title": "Planters Cocktail Peanuts",
 *       "description": "...",
 *       "brand": "Planters",
 *       "category": "Food, Beverages & Tobacco > Food Items > ...",
 *       "images": ["https://..."]
 *     }]
 *   }
 */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function lookupUPCitemdb(code: string): Promise<ProductInfo | null> {
  const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`;
  // Retry transient failures (429/5xx/timeout) up to 2 times with
  // exponential backoff. Capped at 3 total attempts so the scan
  // UX doesn't hang longer than ~6s worst case.
  const BACKOFFS = [600, 1200];
  for (let attempt = 0; attempt <= BACKOFFS.length; attempt++) {
    let resp: Response;
    try {
      resp = await fetch(url, {
        // 4.5s timeout — UPCitemdb's trial is usually <2s but we
        // don't want a slow API call to block the scan UX forever.
        signal: AbortSignal.timeout(4500),
      });
    } catch (err) {
      // Network error / timeout / DNS. Retry if we have attempts left.
      console.warn('[product-lookup] UPCitemdb network error:', err instanceof Error ? err.message : err);
      if (attempt < BACKOFFS.length) {
        await sleep(BACKOFFS[attempt]);
        continue;
      }
      return null;
    }
    if (!resp.ok) {
      const retryable = resp.status === 429 || resp.status >= 500;
      if (retryable && attempt < BACKOFFS.length) {
        console.warn(`[product-lookup] UPCitemdb ${resp.status}, retrying in ${BACKOFFS[attempt]}ms`);
        await sleep(BACKOFFS[attempt]);
        continue;
      }
      // 404 = code not in their DB, 4xx (other) = bad request. Not retryable.
      console.warn(`[product-lookup] UPCitemdb returned ${resp.status}`);
      return null;
    }
    let data: UPCitemdbResponse;
    try {
      data = await resp.json();
    } catch {
      return null;
    }
    return parseUPCitemdbResponse(code, data);
  }
  return null;
}

function parseUPCitemdbResponse(code: string, data: UPCitemdbResponse): ProductInfo | null {
  if (!data) return null;
  if (!data.items || data.items.length === 0) return null;
  const it = data.items[0];
  if (!it.title) return null;
  return {
    code,
    name: it.title,
    description: it.description || null,
    brand: it.brand || null,
    manufacturer: it.manufacturer || null,
    category: it.category || null,
    imageUrl: Array.isArray(it.images) && it.images.length > 0 ? it.images[0] : null,
    source: 'upcitemdb',
    confidence: 'high',
  };
}

/**
 * Open Food Facts. Open API, no key, no rate limit. Limited to
 * food products — useful for grocery stores, restaurants, food
 * trucks on a job site. Mostly returns 404 for hardware UPCs.
 */
async function lookupOpenFoodFacts(code: string): Promise<ProductInfo | null> {
  const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      signal: AbortSignal.timeout(4500),
    });
  } catch {
    return null;
  }
  if (resp.status === 404) return null;
  if (!resp.ok) return null;
  let data: OpenFoodFactsResponse;
  try {
    data = await resp.json();
  } catch {
    return null;
  }
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  if (!p.product_name) return null;
  return {
    code,
    name: p.product_name,
    description: p.generic_name || p.ingredients_text || null,
    brand: (p.brands || null)?.split(',')[0]?.trim() ?? null,
    manufacturer: null, // OFF doesn't expose manufacturer directly
    category: p.categories || null,
    imageUrl: p.image_url || null,
    source: 'openfoodfacts',
    confidence: 'high',
  };
}

/**
 * Save (or update) a product in the workspace catalog. Updates
 * rather than creates when the row already exists — barcodes
 * don't change, so the same (workspace, code) row is just
 * refreshed with newer API data each time.
 */
async function persistToCatalog(workspaceId: string, product: ProductInfo): Promise<void> {
  try {
    await prisma.productCatalogItem.upsert({
      where: {
        product_per_workspace: { workspaceId, code: product.code },
      },
      create: {
        workspaceId,
        code: product.code,
        name: product.name,
        description: product.description,
        brand: product.brand,
        manufacturer: product.manufacturer,
        category: product.category,
        imageUrl: product.imageUrl,
        source: product.source,
        lastFetchedAt: new Date(),
      },
      update: {
        name: product.name,
        description: product.description,
        brand: product.brand,
        manufacturer: product.manufacturer,
        category: product.category,
        imageUrl: product.imageUrl,
        source: product.source,
        lastFetchedAt: new Date(),
      },
    });
  } catch (err) {
    // Non-fatal. The user got the product info; we just couldn't
    // cache it. Log and move on.
    console.error('[product-lookup] failed to persist to catalog:', err);
  }
}

// -- API response shapes (private, not exported) --

interface UPCitemdbResponse {
  code: string;
  total: number;
  items?: Array<{
    title?: string;
    description?: string;
    brand?: string;
    manufacturer?: string;
    category?: string;
    images?: string[];
  }>;
}

interface OpenFoodFactsResponse {
  status: 0 | 1;
  product?: {
    product_name?: string;
    generic_name?: string;
    ingredients_text?: string;
    brands?: string;
    categories?: string;
    image_url?: string;
  };
}
