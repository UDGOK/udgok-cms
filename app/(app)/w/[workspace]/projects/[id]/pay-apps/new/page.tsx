import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { NewPayAppForm } from './NewPayAppForm';

export default async function NewPayAppPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const workspace = await prisma.workspace.findUnique({ where: { slug: params.workspace } });
  if (!workspace) notFound();
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
  });
  if (!membership) notFound();

  const project = await prisma.project.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    include: {
      divisions: { orderBy: { sortOrder: 'asc' } },
      payApps: { orderBy: { drawNumber: 'desc' }, take: 1, include: { divisions: true } },
    },
  });
  if (!project) notFound();

  if (project.divisions.length === 0) {
    return (
      <div className="p-8">
        <p className="text-ink-50">Add at least one division first.</p>
      </div>
    );
  }

  const lastPayApp = project.payApps[0];
  const lastLines = lastPayApp?.divisions ?? [];

  return (
    <div className="p-8 max-w-5xl">
      <div className="label-eyebrow mb-4">{'// New pay app'}</div>
      <h1 className="text-display-lg mb-4">
        Draw <span className="font-serif italic text-orange-d">#{(lastPayApp?.drawNumber ?? 0) + 1}</span>
      </h1>
      <p className="text-base text-ink-70 mb-7">
        For <b className="text-ink">{project.name}</b>. Enter the amount you want to bill for each
        line this period. Previous billed + this draw + remaining = budget.
      </p>
      <NewPayAppForm
        workspaceSlug={params.workspace}
        projectId={project.id}
        divisions={project.divisions.map((d) => {
          const prev = lastLines.find((l) => l.projectDivisionId === d.id);
          return {
            id: d.id,
            code: d.code,
            trade: d.trade,
            subcontractorName: d.subcontractorName,
            budget: Number(d.budget),
            previous: prev ? Number(prev.balanceAfter) : 0,
          };
        })}
      />
    </div>
  );
}
