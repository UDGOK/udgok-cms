import { listWorkspaceFiles } from '@/lib/files/queries';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { FilesPageClient } from './FilesPageClient';
import { FILE_CATEGORIES } from '@/lib/files/categories';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export default async function FilesPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const { userId } = await auth();
  if (!userId) throw new Error('Not signed in');

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

  // Pre-compute counts per category on the server
  const counts: Record<string, number> = { all: files.length };
  for (const c of FILE_CATEGORIES) {
    if (c.id === 'all') continue;
    counts[c.id] = files.filter((f) => f.category === c.id).length;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <FilesPageClient
        workspaceId={workspace.id}
        userId={userId}
        initialFiles={files.map((f) => ({
          id: f.id,
          url: f.url,
          filename: f.filename,
          mimeType: f.mimeType,
          size: f.size,
          category: f.category,
          createdAt: f.createdAt.toISOString(),
          uploader: f.uploader,
          client: f.client,
          project: f.project,
        }))}
        counts={counts}
        clients={clients}
        projects={projects}
      />
    </div>
  );
}
