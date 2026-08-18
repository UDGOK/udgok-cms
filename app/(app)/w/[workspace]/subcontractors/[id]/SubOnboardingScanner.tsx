'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { compressImage, formatBytes } from '@/lib/images/compress';

type DocKind = 'ID_CARD' | 'W9' | 'INSURANCE' | 'LICENSE' | 'OTHER';

const KIND_LABEL: Record<DocKind, string> = {
  ID_CARD: 'ID card',
  W9: 'W-9',
  INSURANCE: 'Insurance',
  LICENSE: 'License',
  OTHER: 'Other',
};

const KIND_INSTRUCTION: Record<DocKind, string> = {
  ID_CARD: "Hold the sub's driver's license or government ID inside the frame. We'll store a high-res photo.",
  W9: "Hold the W-9 form flat. We'll store a photo of the signed form.",
  INSURANCE: 'Photograph the insurance certificate (COI).',
  LICENSE: 'Photograph the contractor license (front and back if needed).',
  OTHER: 'Photograph the document you want to store.',
};

const KIND_ICON: Record<DocKind, string> = {
  ID_CARD: '🪪',
  W9: '📄',
  INSURANCE: '🛡️',
  LICENSE: '🏛️',
  OTHER: '📁',
};

interface ExistingDoc {
  id: string;
  url: string;
  filename: string;
  category: string | null;
  uploadedAt: string;
}

export function SubOnboardingScanner({
  workspaceSlug,
  subId,
  initialIdScanned,
  initialIdScannedAt,
  initialW9Scanned,
  initialW9ScannedAt,
  initialDocuments,
}: {
  workspaceSlug: string;
  subId: string;
  initialIdScanned: boolean;
  initialIdScannedAt: string | null;
  initialW9Scanned: boolean;
  initialW9ScannedAt: string | null;
  initialDocuments: ExistingDoc[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeKind, setActiveKind] = useState<DocKind | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [idScanned, setIdScanned] = useState(initialIdScanned);
  const [idScannedAt, setIdScannedAt] = useState(initialIdScannedAt);
  const [w9Scanned, setW9Scanned] = useState(initialW9Scanned);
  const [w9ScannedAt, setW9ScannedAt] = useState(initialW9ScannedAt);

  function startScan(kind: DocKind) {
    setActiveKind(kind);
    setError(null);
    setStatus(null);
    setPreview(null);
    fileInputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeKind) return;
    if (file.size > 50 * 1024 * 1024) {
      setError('Photo too large (max 50 MB)');
      return;
    }
    // Show a local preview while uploading
    const url = URL.createObjectURL(file);
    setPreview(url);
    setStatus('Compressing…');

    const kind = activeKind;
    start(async () => {
      try {
        // Compress phone-camera photos (5-10 MB) so the upload fits
        // the 4.5 MB Vercel function payload limit. ID-card / W-9
        // images stay readable at 2048 px JPEG q=0.85.
        const compressed = await compressImage(file);
        const wasCompressed = compressed.size < file.size;
        setStatus(
          wasCompressed
            ? `Uploading ${formatBytes(compressed.size)} (was ${formatBytes(file.size)})…`
            : `Uploading ${formatBytes(file.size)}…`,
        );

        const fd = new FormData();
        fd.set('file', compressed);
        fd.set('kind', kind);
        const res = await fetch(
          `/api/subs/${subId}/documents?workspace=${encodeURIComponent(workspaceSlug)}`,
          { method: 'POST', body: fd },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const now = new Date().toISOString();
        if (kind === 'ID_CARD') {
          setIdScanned(true);
          setIdScannedAt(now);
        } else if (kind === 'W9') {
          setW9Scanned(true);
          setW9ScannedAt(now);
        }
        setStatus(`${KIND_LABEL[kind]} uploaded ✓`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const idDocs = initialDocuments.filter((d) => d.category === 'ID_CARD');
  const w9Docs = initialDocuments.filter((d) => d.category === 'W9');
  const otherDocs = initialDocuments.filter(
    (d) => d.category !== 'ID_CARD' && d.category !== 'W9',
  );

  return (
    <div className="bg-paper border-2 border-ink p-5 md:p-7 mb-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        // Phone camera capture attribute — opens the rear camera directly
        // on iOS/Android. The user just snaps the photo, the file gets
        // uploaded, and we save it to Vercel Blob.
        capture="environment"
        onChange={onFile}
        className="hidden"
      />

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-orange-d font-extrabold">
          {'// Onboard this sub'}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] ${
              idScanned ? 'bg-success text-paper' : 'bg-ink-30 text-ink'
            }`}
          >
            {idScanned ? '✓ ID' : '○ ID'}
          </span>
          <span
            className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] ${
              w9Scanned ? 'bg-success text-paper' : 'bg-ink-30 text-ink'
            }`}
          >
            {w9Scanned ? '✓ W-9' : '○ W-9'}
          </span>
        </div>
      </div>

      <p className="text-[13px] text-ink-70 mb-5">
        Scan the sub&apos;s ID card and W-9 form using your phone. The rear camera
        opens automatically. Photos are stored securely in Vercel Blob and
        marked on the sub&apos;s compliance record.
      </p>

      {/* Primary action cards — ID + W-9 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {/* ID Card */}
        <button
          type="button"
          onClick={() => startScan('ID_CARD')}
          disabled={pending}
          className="text-left bg-cream-2 border-2 border-line hover:border-ink p-4 transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange text-paper flex items-center justify-center text-lg flex-shrink-0">
              🪪
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-[14px]">Scan ID card</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
                {idScanned
                  ? `✓ Scanned ${idScannedAt ? new Date(idScannedAt).toLocaleDateString() : ''}`
                  : 'Not scanned yet'}
              </div>
            </div>
          </div>
          <p className="text-[12px] text-ink-70">
            {KIND_INSTRUCTION.ID_CARD}
          </p>
        </button>

        {/* W-9 */}
        <button
          type="button"
          onClick={() => startScan('W9')}
          disabled={pending}
          className="text-left bg-cream-2 border-2 border-line hover:border-ink p-4 transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-ink text-paper flex items-center justify-center text-lg flex-shrink-0">
              📄
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-[14px]">Scan W-9</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
                {w9Scanned
                  ? `✓ On file ${w9ScannedAt ? new Date(w9ScannedAt).toLocaleDateString() : ''}`
                  : 'Not on file'}
              </div>
            </div>
          </div>
          <p className="text-[12px] text-ink-70">
            {KIND_INSTRUCTION.W9}
          </p>
        </button>
      </div>

      {/* Secondary scans — Insurance / License / Other */}
      <details className="text-[12px]">
        <summary className="cursor-pointer font-extrabold text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 hover:text-ink py-2">
          + Scan insurance, license, or other document
        </summary>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {(['INSURANCE', 'LICENSE', 'OTHER'] as DocKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => startScan(k)}
              disabled={pending}
              className="px-3 py-3 bg-paper border-2 border-line hover:border-ink flex flex-col items-center gap-1 disabled:opacity-50"
            >
              <span className="text-xl">{KIND_ICON[k]}</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.1em]">
                {KIND_LABEL[k]}
              </span>
            </button>
          ))}
        </div>
      </details>

      {/* Status row */}
      {(status || error) && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          {status ? (
            <span className="text-[11px] font-mono text-success">{status}</span>
          ) : null}
          {error ? (
            <span className="text-[11px] font-mono text-error">{error}</span>
          ) : null}
        </div>
      )}

      {/* Live preview while uploading */}
      {preview ? (
        <div className="mt-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-2">
            Preview
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Upload preview"
            className="max-h-48 border-2 border-line"
          />
        </div>
      ) : null}

      {/* Existing documents list */}
      {initialDocuments.length > 0 ? (
        <div className="mt-6 border-t-2 border-line pt-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-3">
            On file · {initialDocuments.length} document
            {initialDocuments.length === 1 ? '' : 's'}
          </div>
          {idDocs.length > 0 ? (
            <Section title="ID cards" docs={idDocs} />
          ) : null}
          {w9Docs.length > 0 ? (
            <Section title="W-9 forms" docs={w9Docs} />
          ) : null}
          {otherDocs.length > 0 ? (
            <Section title="Other documents" docs={otherDocs} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, docs }: { title: string; docs: ExistingDoc[] }) {
  return (
    <div className="mb-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
        {title}
      </div>
      <ul className="space-y-1">
        {docs.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-3 px-3 py-2 bg-cream-2 border border-line"
          >
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-extrabold text-[12px] hover:text-orange-d truncate flex-1 min-w-0"
            >
              {d.filename}
            </a>
            <span className="text-[10px] font-mono text-ink-50 uppercase tracking-[0.1em]">
              {new Date(d.uploadedAt).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
