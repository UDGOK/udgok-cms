import { prisma } from '@/lib/db/client';
import { listWorkspaceFiles } from '@/lib/files/queries';
import { requireMembership } from '@/lib/auth/require-membership';
import { UploadForm } from './UploadForm';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const fileIcon = (mime: string) => {
  if (mime.startsWith('image/')) return '🖼';
  if (mime === 'application/pdf') return '📄';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜';
  return '📎';
};

export default async function FilesPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const [files, clients, projects] = await Promise.all([
    listWorkspaceFiles(workspace.id),
    prisma.client.findMany({
      where: { workspaceId: workspace.id, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="p-8">
      <div className="text-xs font-mono font-bold tracking-[0.2em] text-orange-d uppercase mb-5 flex items-center gap-3">
        <span className="w-8 h-8 bg-orange text-white rounded-full inline-flex items-center justify-center font-black text-sm">
          8
        </span>
        Files
      </div>
      <h1 className="text-display-lg mb-4">
        The <span className="font-serif italic text-orange-d">library,</span> searchable.
      </h1>
      <p className="text-base text-ink-70 max-w-xl mb-7">
        Upload contracts, drawings, photos, and anything else. Files are scoped to clients and projects.
      </p>

      <UploadForm workspaceSlug={params.workspace} clients={clients} projects={projects} />

      <div className="bg-paper border border-line">
        <div className="grid grid-cols-[1fr_120px_140px_180px_80px] gap-3 px-5 py-3 bg-cream-2 border-b border-line text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50">
          <div>File</div>
          <div>Size</div>
          <div>Category</div>
          <div>Linked to</div>
          <div className="text-right">Action</div>
        </div>
        {files.length === 0 ? (
          <div className="px-5 py-12 text-center text-ink-50">No files yet. Upload one above.</div>
        ) : (
          files.map((f) => (
            <div
              key={f.id}
              className="grid grid-cols-[1fr_120px_140px_180px_80px] gap-3 px-5 py-3.5 border-b border-line-soft last:border-0 items-center hover:bg-cream-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl">{fileIcon(f.mimeType)}</span>
                <div className="min-w-0">
                  <div className="font-extrabold text-[13px] truncate">{f.filename}</div>
                  <div className="text-[10px] text-ink-50 font-mono uppercase tracking-[0.1em]">
                    {f.uploader.name ?? 'Unknown'} · {f.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
              <div className="font-mono text-[11px] text-ink-50">{formatSize(f.size)}</div>
              <div>
                {f.category ? (
                  <span className="inline-block px-2 py-0.5 bg-cream-2 text-ink-50 text-[10px] font-mono uppercase tracking-[0.1em]">
                    {f.category}
                  </span>
                ) : '—'}
              </div>
              <div className="text-[12px] text-ink-70 truncate">
                {f.client?.name ?? f.project?.name ?? '—'}
              </div>
              <div className="text-right">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-70 hover:text-orange-d"
                >
                  OPEN ↗
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
