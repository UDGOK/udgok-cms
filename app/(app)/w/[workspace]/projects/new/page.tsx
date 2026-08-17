import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { NewProjectForm } from './NewProjectForm';

export default async function NewProjectPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const clients = await prisma.client.findMany({
    where: { workspaceId: workspace.id, status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return (
    <div className="p-8 max-w-2xl">
      <div className="label-eyebrow mb-4">{'// New project'}</div>
      <h1 className="text-display-lg mb-4">
        Start a <span className="font-serif italic text-orange-d">project.</span>
      </h1>
      <p className="text-base text-ink-70 mb-7">
        Each project gets its own budget, schedule of values, and pay app history.
      </p>
      <NewProjectForm workspaceSlug={params.workspace} clients={clients} />
    </div>
  );
}
