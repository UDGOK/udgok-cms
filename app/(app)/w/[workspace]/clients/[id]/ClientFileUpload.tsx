'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function ClientFileUpload({
  clientId,
}: {
  clientId: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  function onPick() {
    fileInputRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large (max 50 MB)');
      return;
    }
    setError(null);
    setProgress('Uploading…');
    start(async () => {
      try {
        const fd = new FormData();
        fd.set('file', file);
        fd.set('clientId', clientId);
        const res = await fetch('/api/clients/files', {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setProgress('Uploaded ✓');
        if (fileInputRef.current) fileInputRef.current.value = '';
        router.refresh();
        setTimeout(() => setProgress(null), 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        setProgress(null);
      }
    });
  }

  return (
    <div className="px-5 py-4 border-b border-line bg-cream-2">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          onChange={onChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={onPick}
          disabled={pending}
          className="px-4 py-2 bg-ink text-cream border-2 border-ink text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-ink-2 disabled:opacity-50"
        >
          {pending ? 'Uploading…' : '+ Upload file'}
        </button>
        {progress ? (
          <span className="text-[11px] font-mono text-ink-70">{progress}</span>
        ) : null}
        {error ? (
          <span className="text-[11px] font-mono text-error">{error}</span>
        ) : null}
        <span className="text-[10px] font-mono text-ink-30 uppercase tracking-[0.1em] ml-auto">
          Max 50 MB · PDF, DOCX, XLSX, images
        </span>
      </div>
    </div>
  );
}
