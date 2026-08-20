/**
 * Helpers for building the clientPayload sent to the
 * project-photo upload route. The shape mirrors the
 * `clientPayloadSchema` in
 * `app/api/projects/[id]/photos/upload/route.ts` — keep them
 * in sync.
 *
 * Extracted from the React form so the payload shape is
 * unit-testable without rendering the component. The form
 * collects form fields, passes them in here, then forwards
 * the result to `useBlobUpload`'s `upload(file, payload)`.
 *
 * All string fields use empty string (not undefined) so the
 * server's zod schema can distinguish "user left it blank"
 * from "field was never sent". The server's `.optional()
 * .nullable()` modifiers turn the empty string into null
 * when persisting.
 */
export interface PhotoUploadFormFields {
  projectId: string;
  uploaderId: string;
  folderId?: string | null;
  room?: string | null;
  area?: string | null;
  phase?: 'ROUGH_IN' | 'FINAL' | string;
  caption?: string | null;
  takenAt?: Date | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

/**
 * Build the clientPayload object that gets JSON-stringified
 * and sent through Vercel Blob's handleUpload flow. Every
 * field is a string (even numeric / date ones) because the
 * payload is a JSON object passed through the Vercel Blob
 * client; on the server we parse strings back to numbers /
 * Dates in onUploadCompleted.
 */
export function buildPhotoUploadPayload(
  fields: PhotoUploadFormFields,
): Record<string, string> {
  return {
    projectId: fields.projectId,
    uploaderId: fields.uploaderId,
    folderId: fields.folderId ?? '',
    room: fields.room ?? '',
    area: fields.area ?? '',
    phase: fields.phase ?? 'ROUGH_IN',
    caption: fields.caption ?? '',
    takenAt: serializeDate(fields.takenAt),
    latitude: serializeNumber(fields.latitude),
    longitude: serializeNumber(fields.longitude),
  };
}

function serializeDate(value: Date | string | null | undefined): string {
  if (value == null) return '';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    return value.toISOString();
  }
  // Already a string — validate it's parseable, otherwise
  // the server will reject it.
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

function serializeNumber(value: number | string | null | undefined): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    const n = Number(value);
    return isFinite(n) ? String(n) : '';
  }
  if (typeof value === 'number' && isFinite(value)) return String(value);
  return '';
}

/**
 * 50 MB cap for project photos. Mirrors MAX_PHOTO_SIZE in
 * lib/photos/actions.ts and MAX_BYTES in the upload route.
 * Centralized here so the form's pre-flight size check and
 * the route's token-time cap use the same constant.
 */
export const MAX_PHOTO_BYTES = 50 * 1024 * 1024;

/**
 * Allowed MIME types for project photos. Mirrors
 * `allowedContentTypes` in the upload route.
 */
export const ALLOWED_PHOTO_MIME = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'image/gif',
] as const;

/**
 * Pre-flight validation for a photo upload. Returns
 * `{ ok: true }` if the file is acceptable, or
 * `{ ok: false, reason: '...' }` if it should be rejected
 * before any bytes leave the device.
 *
 * The size check runs FIRST so the user gets an instant
 * error before the upload phase changes (matches the
 * `useBlobUpload` hook's behavior of short-circuiting on
 * oversize before flipping `phase: 'uploading'`).
 */
export interface PreFlightOk {
  ok: true;
}
export interface PreFlightFail {
  ok: false;
  reason: string;
}
export type PreFlightResult = PreFlightOk | PreFlightFail;

export function preflightPhoto(file: File): PreFlightResult {
  if (file.size === 0) {
    return { ok: false, reason: 'Empty file' };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return { ok: false, reason: `Photo too large (${mb} MB > 50 MB cap)` };
  }
  if (!file.type.startsWith('image/')) {
    return { ok: false, reason: `File must be an image (got ${file.type || 'unknown'})` };
  }
  if (!(ALLOWED_PHOTO_MIME as readonly string[]).includes(file.type)) {
    // Some browsers report `image/jpg` for old JPEGs; allow
    // the common variants. Anything else gets rejected.
    if (file.type !== 'image/jpg' && file.type !== 'image/pjpeg') {
      return {
        ok: false,
        reason: `Unsupported image type (${file.type}). Allowed: JPEG, PNG, HEIC, WebP, GIF.`,
      };
    }
  }
  return { ok: true };
}
