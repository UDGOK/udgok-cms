import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { listProjectPhotos, getProjectPhotoFacets } from '@/lib/photos/queries';
import { listProjectPhotoFolders, seedDefaultPhotoFolders } from '@/lib/photos/folder-queries';
import { ProjectPhotosClient } from '@/components/photos/ProjectPhotosClient';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function ProjectPhotosPage({
  params,
  searchParams,
}: {
  params: { workspace: string; id: string };
  searchParams: { folder?: string };
}) {
  const { userId, membership } = await requireMembership(params.workspace);

  // OWNER/ADMIN can edit/delete any photo in the workspace
  // (the backend actions already enforce this; this just
  // surfaces the buttons in the UI). Other roles (PM,
  // ESTIMATOR, FIELD) can only act on photos they uploaded.
  const canDeleteAny = membership?.role === 'OWNER' || membership?.role === 'ADMIN';

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      code: true,
      workspaceId: true,
      status: true,
      _count: { select: { tasks: true, payApps: true, subAssignments: true } },
    },
  });
  if (!project) notFound();

  // Auto-seed the default folders on first visit
  await seedDefaultPhotoFolders(project.id, project.workspaceId);

  // Determine which folder is active (default to 'all' for null/undefined)
  const activeFolderId = searchParams.folder === undefined ? null : searchParams.folder;

  const [photos, facets, folders] = await Promise.all([
    listProjectPhotos(project.id, { folderId: activeFolderId ?? undefined }),
    getProjectPhotoFacets(project.id),
    listProjectPhotoFolders(project.id),
  ]);

  return (
    <div>
      <MobilePageHeader
        title="Photos"
        subtitle={project.name}
        backHref={`/w/${params.workspace}/projects/${params.id}`}
      />
      <div className="hidden md:block p-8 pb-0 max-w-6xl">
        <PageHeader
          title="Project photos"
          subtitle={`${project.name} · ${facets.totalCount} photo${facets.totalCount === 1 ? '' : 's'} across ${folders.length} folder${folders.length === 1 ? '' : 's'}`}
        />
      </div>

      <div className="p-4 md:px-8">
        <ProjectPhotosClient
          workspaceSlug={params.workspace}
          projectId={project.id}
          initialPhotos={photos}
          initialFacets={facets}
          initialFolders={folders}
          activeFolderId={activeFolderId}
          currentUserId={userId}
          canDeleteAny={canDeleteAny}
        />
      </div>
    </div>
  );
}
