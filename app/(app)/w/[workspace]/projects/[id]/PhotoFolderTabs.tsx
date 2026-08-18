'use client';

import Link from 'next/link';
import { CreatePhotoFolderButton } from './CreatePhotoFolderButton';
import { PhotoFolderActions } from './PhotoFolderActions';

interface Folder {
  id: string;
  name: string;
  color: string;
  description: string | null;
  _count: { photos: number };
}

const COLOR_BG: Record<string, string> = {
  orange: 'bg-orange',
  ink: 'bg-ink',
  'ink-30': 'bg-ink-30',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  'cream-2': 'bg-cream-2 border border-ink',
  line: 'bg-line',
};

const COLOR_BAR: Record<string, string> = {
  orange: 'bg-orange',
  ink: 'bg-ink',
  'ink-30': 'bg-ink-30',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  'cream-2': 'bg-ink-30',
  line: 'bg-ink-30',
};

export function PhotoFolderTabs({
  workspaceSlug,
  projectId,
  folders,
  activeFolderId,
  totalPhotos,
}: {
  workspaceSlug: string;
  projectId: string;
  folders: Folder[];
  activeFolderId: string | null;
  totalPhotos: number;
}) {
  const baseHref = `/w/${workspaceSlug}/projects/${projectId}/photos`;

  return (
    <div className="bg-paper border-2 border-ink mb-4">
      <div className="px-4 py-2.5 border-b-2 border-ink flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 flex items-center gap-1.5">
          <span aria-hidden>📁</span>
          Folders
        </div>
        <CreatePhotoFolderButton workspaceSlug={workspaceSlug} projectId={projectId} />
      </div>
      <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto">
        {/* All photos chip */}
        <Link
          href={baseHref}
          className={`group flex-shrink-0 px-3 py-2 border-2 flex items-center gap-2 transition-colors ${
            activeFolderId === null
              ? 'border-ink bg-ink text-cream'
              : 'border-line text-ink hover:border-ink'
          }`}
        >
          <span className="w-2 h-2 bg-ink flex-shrink-0" />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.1em]">All</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 ${
            activeFolderId === null ? 'bg-cream text-ink' : 'bg-cream-2 text-ink-50'
          }`}>{totalPhotos}</span>
        </Link>

        {folders.map((f) => {
          const isActive = activeFolderId === f.id;
          return (
            <div
              key={f.id}
              className={`group flex-shrink-0 border-2 flex items-center transition-colors ${
                isActive
                  ? 'border-ink bg-cream-2'
                  : 'border-line hover:border-ink'
              }`}
            >
              <Link
                href={`${baseHref}?folder=${f.id}`}
                className="flex items-center gap-2 px-3 py-2"
              >
                <span className={`w-2 h-2 flex-shrink-0 ${COLOR_BG[f.color] ?? 'bg-ink'}`} />
                <span className={`text-[11px] font-extrabold uppercase tracking-[0.1em] ${isActive ? 'text-ink' : 'text-ink-70'}`}>
                  {f.name}
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 ${
                  isActive ? 'bg-paper text-ink' : 'bg-cream-2 text-ink-50'
                }`}>{f._count.photos}</span>
              </Link>
              {/* Delete button — only on hover */}
              {f._count.photos === 0 ? (
                <div className="pr-2">
                  <PhotoFolderActions
                    workspaceSlug={workspaceSlug}
                    projectId={projectId}
                    folderId={f.id}
                    folderName={f.name}
                    photoCount={f._count.photos}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Active folder description */}
      {activeFolderId ? (
        (() => {
          const active = folders.find((f) => f.id === activeFolderId);
          if (active?.description) {
            return (
              <div className="px-4 py-2 border-t border-line text-[12px] text-ink-70 bg-cream-2 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 ${COLOR_BAR[active.color] ?? 'bg-ink-30'}`} />
                {active.description}
              </div>
            );
          }
          return null;
        })()
      ) : null}
    </div>
  );
}
