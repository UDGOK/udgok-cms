'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';
import { useBlobUpload } from '@/lib/blob/client-upload';
import { Button } from '@/components/ui';
import { GeoPhotoCapture } from '@/components/files/GeoPhotoCapture';
import { formatBytes } from '@/lib/images/compress';

const CATEGORIES = [
  { id: 'brochures',   label: 'Brochures' },
  { id: 'marketing',   label: 'Marketing' },
  { id: 'floorplans',  label: 'Floorplans' },
  { id: 'contracts',   label: 'Contracts' },
  { id: 'site_photos', label: 'Site Photos' },
  { id: 'submittals',  label: 'Submittals' },
  { id: 'invoices',    label: 'Invoices' },
  { id: 'drawings',    label: 'Drawings' },
  { id: 'other',       label: 'Other' },
];

interface PendingFile {
  file: File;
  meta: { latitude?: number; longitude?: number; takenAt?: Date };
}

export function UploadForm({
  workspaceId,
  userId,
  clients,
  projects,
  defaultCategory,
}: {
  workspaceId: string;
  userId: string;
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  defaultCategory?: string;
}) {
  const router = useRouter();
  const { upload, state, reset } = useBlobUpload({
    handleUploadUrl: '/api/files/upload',
  });
  const [category, setCategory] = useState(defaultCategory ?? '');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clear the "Uploaded ✓" message after a moment
  useEffect(() => {
    if (state.phase === 'done') {
      setError(null);
      const t = setTimeout(() => {
        reset();
        if (fileInputRef.current) fileInputRef.current.value = '';
        setPendingFile(null);
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [state.phase, reset]);

  async function handleSubmit() {
    if (!category) {
      setError('Pick a category first');
      return;
    }
    const file = pendingFile?.file ?? fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Pick a file first');
      return;
    }
    setError(null);
    const meta = pendingFile?.meta ?? {};
    try {
      await upload(file, {
        workspaceId,
        uploaderId: userId,
        category,
        clientId: clientId || '',
        projectId: projectId || '',
        dealId: '',
        latitude: meta.latitude != null ? String(meta.latitude) : '',
        longitude: meta.longitude != null ? String(meta.longitude) : '',
        takenAt: meta.takenAt ? meta.takenAt.toISOString() : '',
      });
      router.refresh();
    } catch (e) {
      // The hook already populated state.error; mirror it
      setError(state.error ?? (e instanceof Error ? e.message : 'Upload failed'));
    }
  }

  return (
    <div className="bg-paper border-2 border-ink p-6">
      <div className="text-[9px] font-mono font-extrabold tracking-[0.18em] text-ink-50 uppercase mb-4">
        {'// Upload a new file'}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[10px] font-mono font-extrabold tracking-[0.12em] text-ink-50 uppercase mb-1.5">
            File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            onChange={() => setPendingFile(null)}
            className="block w-full px-3 py-2 bg-paper border border-line text-ink text-sm file:mr-3 file:py-1.5 file:px-3 file:border-0 file:bg-ink file:text-cream file:font-extrabold file:uppercase file:tracking-[0.1em] file:text-[10px]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono font-extrabold tracking-[0.12em] text-ink-50 uppercase mb-1.5">
            Or take a GPS-tagged photo
          </label>
          <GeoPhotoCapture
            onCapture={(file, meta) => {
              setPendingFile({ file, meta });
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            label="Open camera"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono font-extrabold tracking-[0.12em] text-ink-50 uppercase mb-1.5">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="block w-full px-3 py-2 bg-paper border border-line text-ink text-sm"
          >
            <option value="">— Pick a category —</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono font-extrabold tracking-[0.12em] text-ink-50 uppercase mb-1.5">
            Link to client
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="block w-full px-3 py-2 bg-paper border border-line text-ink text-sm"
          >
            <option value="">— None —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono font-extrabold tracking-[0.12em] text-ink-50 uppercase mb-1.5">
            Link to project
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="block w-full px-3 py-2 bg-paper border border-line text-ink text-sm"
          >
            <option value="">— None —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {pendingFile ? (
        <div className="mb-3 p-3 bg-cream-2 border border-line">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Photo ready to upload
          </div>
          <div className="text-[12px] font-semibold truncate">{pendingFile.file.name}</div>
          {pendingFile.meta.latitude ? (
            <div className="text-[10px] font-mono text-success mt-1">
              📍 {pendingFile.meta.latitude.toFixed(5)}, {pendingFile.meta.longitude?.toFixed(5)}
              {pendingFile.meta.takenAt ? ` · ${pendingFile.meta.takenAt.toLocaleTimeString()}` : ''}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Progress bar — shows during upload */}
      {state.phase === 'uploading' ? (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span>Uploading… {formatBytes(state.uploadedBytes)} / {formatBytes(state.totalBytes)}</span>
            <span>{state.progress}%</span>
          </div>
          <div className="h-1.5 bg-line">
            <div className="h-full bg-ink transition-[width] duration-100" style={{ width: `${state.progress}%` }} />
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="copper"
          onClick={handleSubmit}
          disabled={state.isUploading}
        >
          {state.isUploading ? `Uploading… ${state.progress}%` : 'Upload file'}
        </Button>
      </div>

      {error ? <p className="text-sm text-error font-semibold mt-2">⚠ {error}</p> : null}
      {state.phase === 'done' ? <p className="text-sm text-success font-semibold mt-2">Uploaded ✓</p> : null}
    </div>
  );
}
