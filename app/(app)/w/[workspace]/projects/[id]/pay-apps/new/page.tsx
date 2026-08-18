import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { NewPayAppForm } from './NewPayAppForm';

export default async function NewPayAppPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const project = await prisma.project.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    include: {
      divisions: {
        orderBy: { sortOrder: 'asc' },
        include: {
          payAppLines: { select: { thisDrawAmount: true, payApp: { select: { status: true, drawNumber: true } } } },
        },
      },
      payApps: { orderBy: { drawNumber: 'desc' }, take: 1, select: { drawNumber: true } },
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
  const nextDrawNumber = (lastPayApp?.drawNumber ?? 0) + 1;

  return (
    <div className="p-8 max-w-5xl">
      <div className="label-eyebrow mb-4">{'// New pay app'}</div>
      <h1 className="text-display-lg mb-4">
        Draw <span className="font-serif italic text-orange-d">#{nextDrawNumber}</span>
      </h1>
      <p className="text-base text-ink-70 mb-7">
        For <b className="text-ink">{project.name}</b>. Enter the amount you want to bill for each
        line this period. Previous billed + this draw + remaining = budget.
      </p>
      <NewPayAppForm
        workspaceSlug={params.workspace}
        projectId={project.id}
        divisions={project.divisions.map((d) => {
          // Compute cumulative previously-billed from ALL prior pay apps
          // (draft, sent, viewed, acknowledged, paid — anything not deleted)
          const previous = d.payAppLines.reduce(
            (acc, line) => acc + Number(line.thisDrawAmount),
            0,
          );
          const lastBilledDraw = d.payAppLines.length > 0
            ? Math.max(...d.payAppLines.map((l) => l.payApp.drawNumber))
            : null;
          return {
            id: d.id,
            code: d.code,
            trade: d.trade,
            subcontractorName: d.subcontractorName,
            budget: Number(d.budget),
            previous,
            lastBilledDraw,
          };
        })}
      />
    </div>
  );
}
