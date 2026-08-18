/**
 * Client-side image compression. iPhone photos are routinely 5-10 MB
 * (HEIC, 4032×3024, etc.) and the Vercel serverless function payload
 * limit is 4.5 MB. Uploading an uncompressed phone photo therefore
 * 413s.
 *
 * This utility resizes to `maxDim` (default 2048 px on the long edge)
 * and re-encodes as JPEG at `quality` (default 0.85). A 4032×3024
 * iPhone photo becomes ~400-700 KB — fits easily under the limit
 * while still being high-res for site documentation.
 *
 * Usage:
 *   const compressed = await compressImage(file);
 *   const form = new FormData();
 *   form.set('file', compressed);
 *   await fetch('/api/...', { method: 'POST', body: form });
 *
 * Non-image files (PDF, DOCX, etc.) are returned unchanged. HEIC files
 * (iPhone's default) are decoded by the browser via <img>, then
 * re-encoded as JPEG — modern Safari/Chrome both support HEIC
 * decoding in <img>.
 */
export interface CompressOptions {
  /** Max dimension on the long edge. Default 2048. */
  maxDim?: number;
  /** JPEG quality 0-1. Default 0.85. */
  quality?: number;
  /** Output MIME type. Default 'image/jpeg'. */
  mimeType?: string;
}

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const { maxDim = 2048, quality = 0.85, mimeType = 'image/jpeg' } = options;

  // Non-image files: return as-is
  if (!file.type.startsWith('image/')) return file;
  // SVGs and GIFs: return as-is (no benefit from re-encoding)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  // Already small: return as-is (saves CPU)
  if (file.size < 800 * 1024 && mimeType === 'image/jpeg') return file;

  // Load the image into a canvas
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await createImageBitmapSafe(file);
  } catch {
    // Browser couldn't decode (uncommon formats, broken file)
    return file;
  }

  const { width, height } = computeResized(bitmap.width, bitmap.height, maxDim);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);
  if ('close' in bitmap && typeof bitmap.close === 'function') {
    bitmap.close();
  }

  // Re-encode as JPEG (or whatever mimeType the caller wants)
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), mimeType, quality);
  });
  if (!blob) return file;

  // Build a new File with a sensible name (swap .heic/.png for .jpg)
  const newName = file.name.replace(/\.(heic|heif|png|webp)$/i, '.jpg');
  return new File([blob], newName, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

function computeResized(srcW: number, srcH: number, maxDim: number): { width: number; height: number } {
  if (srcW <= maxDim && srcH <= maxDim) {
    return { width: srcW, height: srcH };
  }
  if (srcW >= srcH) {
    return { width: maxDim, height: Math.round((srcH * maxDim) / srcW) };
  }
  return { width: Math.round((srcW * maxDim) / srcH), height: maxDim };
}

async function createImageBitmapSafe(file: File): Promise<ImageBitmap> {
  // createImageBitmap is the modern, fast path. It works for JPEG, PNG,
  // WebP, and most browsers' HEIC support. Fall back to <img>+drawImage
  // if it's not available.
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  // Fallback: load via <img> and use as the source
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      URL.revokeObjectURL(url);
      resolve(i);
    };
    i.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    i.src = url;
  });
  // Wrap the <img> as an ImageBitmap-like object by drawing it onto a
  // canvas. This guarantees drawImage below accepts it.
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas context');
  ctx.drawImage(img, 0, 0);
  return await createImageBitmap(canvas);
}

/**
 * Format a file size for human display (1.2 MB, 540 KB, etc.)
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
