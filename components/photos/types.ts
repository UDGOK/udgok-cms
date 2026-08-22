/**
 * Shared types for the project photos client.
 *
 * These are hoisted out of ProjectPhotosClient.tsx so the
 * extracted components (PhotoCard, PhotoLightbox, etc.) can
 * import them without circular references back to the main
 * file. They are otherwise unchanged from their previous
 * home in ProjectPhotosClient.
 */

import type { ProjectPhotoListItem } from '@/lib/photos/queries';

/** Photo folder as rendered in the project tab. */
export interface PhotoFolder {
  id: string;
  name: string;
  color: string;
  description: string | null;
  _count: { photos: number };
}

/**
 * Can the current user edit/delete a given photo? Photos are
 * editable by their uploader, or by workspace OWNER/ADMIN.
 */
export function userCanEdit(
  photo: ProjectPhotoListItem,
  currentUserId: string,
  canDeleteAny: boolean,
): boolean {
  return canDeleteAny || photo.uploaderId === currentUserId;
}
