import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { listProjectPhotos, getProjectPhotoFacets } from '@/lib/photos/queries';
import { ProjectPhotosClient } from '@/components/photos/ProjectPhotosClient';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function ProjectPhotosPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace, userId } = await requireMembership(params.workspace);

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, code: true },
  });
  if (!project) notFound();

  const [photos, facets, membership] = await Promise.all([
    listProjectPhotos(params.id),
    getProjectPhotoFacets(params.id),
    prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
    }),
  ]);

  const isAdmin = membership?.role === 'OWNER' || membership?.role === 'ADMIN';

  return (
    <div>
      <MobilePageHeader
        title="Photos"
        subtitle={project.name}
        backHref={`/w/${params.workspace}/projects/${params.id}`}
      />
      <div className="hidden md:block p-8 max-w-6xl">
        <PageHeader
          title="Project photos"
          subtitle={`${project.name} · ${facets.totalCount} photo${facets.totalCount === 1 ? '' : 's'} (${facets.roughInCount} rough-in · ${facets.finalCount} final)`}
        />
      </div>

      <div className="p-4 md:px-8">
        <ProjectPhotosClient
          workspaceSlug={params.workspace}
          projectId={params.id}
          initialPhotos={photos}
          initialFacets={facets}
          canDelete={(uploaderId) => isAdmin || uploaderId === userId}
        />
      </div>
    </div>
  );
}
