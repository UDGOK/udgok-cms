'use client';

/**
 * Shared hooks for the photo components.
 */

import { useMemo } from 'react';
import type { ProjectPhotoListItem } from '@/lib/photos/queries';

/**
 * Find the ProjectPhoto whose URL matches `url`, or null.
 * Re-evaluates whenever the photos list changes (after
 * router.refresh()). Used by the upload sheet to identify
 * the newly-arrived row from its just-uploaded URL.
 */
export function useLatestPhotoIdForUrl(
  photos: ProjectPhotoListItem[],
  url: string | null,
): string | null {
  return useMemo(() => {
    if (!url) return null;
    const match = photos.find((p) => p.url === url);
    return match?.id ?? null;
  }, [photos, url]);
}
