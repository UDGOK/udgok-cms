'use client';

import { useState, useMemo } from 'react';
import { UploadForm } from './UploadForm';

interface FileItem {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  category: string | null;
  createdAt: string;
  uploader: { name: string | null; id?: string; email: string };
  client: { name: string; id?: string } | null;
  project: { name: string; id?: string } | null;
}

const CATEGORIES = [
  { id: 'all',         label: 'All Files' },
  { id: 'brochures',   label: 'Brochures' },
  { id: 'marketing',   label: 'Marketing' },
  { id: 'floorplans',  label: 'Floorplans' },
  { id: 'contracts',   label: 'Contracts' },
  { id: 'site_photos', label: 'Site Photos' },
  { id: 'submittals',  label: 'Submittals' },
  { id: 'invoices',    label: 'Invoices' },
  { id: 'drawings',    label: 'Drawings' },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

function initials(name: string | null | undefined, email: string) {
  const n = name || email;
  return n
    .split(/[ @.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

interface FileTypeBadge {
  bg: string;     // tailwind bg class
  icon: 'pdf' | 'img' | 'video' | 'doc' | 'archive' | 'other';
  label: string;
}

function fileTypeBadge(mime: string, filename: string): FileTypeBadge {
  if (mime === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
    return { bg: 'bg-error/15', icon: 'pdf', label: 'PDF' };
  }
  if (mime.startsWith('image/')) {
    return { bg: 'bg-success/15', icon: 'img', label: 'IMG' };
  }
  if (mime.startsWith('video/')) {
    return { bg: 'bg-info/15', icon: 'video', label: 'VID' };
  }
  if (mime.includes('zip') || mime.includes('compressed') || filename.match(/\.(zip|rar|7z|tar|gz)$/i)) {
    return { bg: 'bg-warning/15', icon: 'archive', label: 'ZIP' };
  }
  if (mime.includes('officedocument') || mime.includes('msword') || filename.match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/i)) {
    return { bg: 'bg-ink-30/20', icon: 'doc', label: 'DOC' };
  }
  return { bg: 'bg-cream-2', icon: 'other', label: 'FILE' };
}

function FileTypeIcon({ kind }: { kind: FileTypeBadge['icon'] }) {
  if (kind === 'pdf') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-error">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" opacity="0.25" />
        <text x="12" y="17" textAnchor="middle" fontSize="6" fontWeight="900" fill="currentColor" className="text-error">PDF</text>
      </svg>
    );
  }
  if (kind === 'img') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-success">
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  }
  if (kind === 'video') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-info">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    );
  }
  if (kind === 'archive') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-warning">
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    );
  }
  if (kind === 'doc') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-ink-70">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" opacity="0.2" />
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-ink-50">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export function FilesPageClient({
  workspaceSlug,
  initialFiles,
  counts,
  clients,
  projects,
}: {
  workspaceSlug: string;
  initialFiles: FileItem[];
  counts: Record<string, number>;
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
}) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [uploader, setUploader] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let out = initialFiles;
    if (activeCategory !== 'all') {
      out = out.filter((f) => f.category === activeCategory);
    }
    if (uploader) {
      out = out.filter((f) => f.uploader.email === uploader);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (f) =>
          f.filename.toLowerCase().includes(q) ||
          f.uploader.name?.toLowerCase().includes(q) ||
          f.uploader.email.toLowerCase().includes(q) ||
          f.client?.name.toLowerCase().includes(q) ||
          f.project?.name.toLowerCase().includes(q),
      );
    }
    return out;
  }, [initialFiles, activeCategory, uploader, search]);

  const activeCategoryLabel = CATEGORIES.find((c) => c.id === activeCategory)?.label ?? 'All Files';

  // Unique uploaders for the filter
  const uploaders = useMemo(() => {
    const seen = new Map<string, { name: string | null; email: string }>();
    for (const f of initialFiles) {
      seen.set(f.uploader.email, f.uploader);
    }
    return Array.from(seen.values());
  }, [initialFiles]);

  return (
    <div className="grid grid-cols-[240px_1fr] gap-6">
      {/* Left sidebar — categories */}
      <aside>
        <div className="text-[9px] font-mono font-extrabold tracking-[0.18em] text-ink-50 uppercase px-3 pb-2">
          Categories
        </div>
        <ul className="space-y-0.5">
          {CATEGORIES.map((c) => {
            const count = counts[c.id] ?? 0;
            const isActive = activeCategory === c.id;
            return (
              <li key={c.id}>
                <button
                  onClick={() => setActiveCategory(c.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-[13px] font-extrabold transition-colors ${
                    isActive
                      ? 'bg-cream-2 text-ink'
                      : 'text-ink-70 hover:bg-cream-2'
                  }`}
                >
                  <span className={isActive ? 'text-orange-d' : ''}>{c.label}</span>
                  <span
                    className={`font-mono text-[11px] ${
                      isActive ? 'text-orange-d font-extrabold' : 'text-ink-50'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Main area */}
      <div>
        {/* Header bar */}
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{activeCategoryLabel.toUpperCase()}</h1>
            <span className="text-[11px] font-mono text-ink-50 uppercase tracking-[0.1em] ml-1">
              {filtered.length} {filtered.length === 1 ? 'file' : 'files'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const root = document.getElementById('upload-form');
                if (root) root.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3 py-2 border-2 border-ink text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-cream transition-colors"
            >
              Filter
            </button>
            <button
              onClick={() => {
                const root = document.getElementById('upload-form');
                if (root) root.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-4 py-2 bg-orange text-paper border-2 border-orange text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d transition-colors"
            >
              + Upload
            </button>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2 mb-5">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files…"
            className="flex-1 max-w-md px-3 py-2 bg-paper border border-line text-[12px] outline-none focus:border-ink"
          />
          {uploaders.length > 1 ? (
            <select
              value={uploader ?? ''}
              onChange={(e) => setUploader(e.target.value || null)}
              className="px-3 py-2 bg-paper border border-line text-[12px] outline-none focus:border-ink"
            >
              <option value="">All uploaders</option>
              {uploaders.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {/* File grid */}
        {filtered.length === 0 ? (
          <div className="bg-paper border-2 border-dashed border-line p-12 text-center">
            <div className="text-5xl mb-3">📁</div>
            <h3 className="font-extrabold text-[16px] mb-1">
              {initialFiles.length === 0
                ? 'No files yet'
                : `No files in ${activeCategoryLabel}`}
            </h3>
            <p className="text-[12px] text-ink-50">
              {initialFiles.length === 0
                ? 'Upload your first file using the form below.'
                : 'Try a different category or upload a new file in this one.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((f) => {
              const badge = fileTypeBadge(f.mimeType, f.filename);
              return (
                <a
                  key={f.id}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-paper border-2 border-line p-3 hover:border-ink transition-colors group"
                >
                  {/* File type icon (tinted square) */}
                  <div className={`w-full aspect-square ${badge.bg} flex items-center justify-center mb-3`}>
                    <FileTypeIcon kind={badge.icon} />
                  </div>
                  {/* Filename */}
                  <div className="font-extrabold text-[12px] leading-tight line-clamp-2 group-hover:text-orange-d mb-1.5" title={f.filename}>
                    {f.filename}
                  </div>
                  {/* Meta line */}
                  <div className="font-mono text-[10px] text-ink-50 uppercase tracking-[0.05em] flex items-center gap-1.5">
                    <span>{formatSize(f.size)}</span>
                    <span>·</span>
                    <span>{formatDate(f.createdAt)}</span>
                  </div>
                  <div className="font-mono text-[10px] text-ink-50 uppercase tracking-[0.05em] mt-0.5">
                    {initials(f.uploader.name, f.uploader.email)}
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* Upload form (scroll target) */}
        <div id="upload-form" className="mt-10 scroll-mt-8">
          <UploadForm workspaceSlug={workspaceSlug} clients={clients} projects={projects} />
        </div>
      </div>
    </div>
  );
}
