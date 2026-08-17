import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { listProjects } from '@/lib/projects/queries';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-success text-paper',
  ON_HOLD: 'bg-cream-2 text-ink-50',
  COMPLETED: 'bg-ink text-cream',
  CANCELLED: 'bg-error text-paper',
};

export default async function ProjectsPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const workspace = await prisma.workspace.findUnique({ where: { slug: params.workspace } });
  if (!workspace) notFound();
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
  });
  if (!membership) notFound();

  const [projects] = await Promise.all([
    listProjects(workspace.id),
  ]);

  return (
    <div className="p-8">
      <div className="text-xs font-mono font-bold tracking-[0.2em] text-orange-d uppercase mb-5 flex items-center gap-3">
        <span className="w-8 h-8 bg-orange text-white rounded-full inline-flex items-center justify-center font-black text-sm">
          5
        </span>
        Projects
      </div>
      <h1 className="text-display-lg mb-4">
        The <span className="font-serif italic text-orange-d">build,</span> end to end.
      </h1>
      <p className="text-base text-ink-70 max-w-xl mb-7">
        Each project is a budget, a schedule, and a series of pay apps. Click a project to manage
        its schedule of values and generate the next draw.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.length === 0 ? (
          <div className="md:col-span-3 bg-paper border-2 border-dashed border-line p-12 text-center">
            <p className="text-ink-50 mb-4">No projects yet.</p>
            <Link
              href={`/w/${params.workspace}/projects/new`}
              className="inline-block px-5 py-3 bg-orange text-paper border-2 border-orange font-extrabold uppercase tracking-[0.12em] text-xs"
            >
              + Create your first project
            </Link>
          </div>
        ) : (
          projects.map((p) => (
            <Link
              key={p.id}
              href={`/w/${params.workspace}/projects/${p.id}`}
              className="bg-paper border-2 border-line p-5 hover:border-ink transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-[9px] font-mono text-ink-50 tracking-[0.1em] uppercase mb-1">
                    {p.code ?? p.id.slice(0, 6).toUpperCase()}
                  </div>
                  <div className="font-extrabold text-base leading-tight">{p.name}</div>
                </div>
                <span
                  className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] ${
                    STATUS_COLOR[p.status] ?? 'bg-cream-2 text-ink-50'
                  }`}
                >
                  {STATUS_LABELS[p.status]}
                </span>
              </div>
              <div className="text-[12px] text-ink-50 mb-3">
                {p.client?.name ?? 'No client'}
              </div>
              {p.contractValue ? (
                <div className="font-black text-2xl mb-3">
                  ${Number(p.contractValue).toLocaleString()}
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-line-soft">
                <div>
                  <div className="text-[9px] font-mono text-ink-50 tracking-[0.1em] uppercase">
                    DIVISIONS
                  </div>
                  <div className="font-extrabold text-base">{p._count.divisions}</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-ink-50 tracking-[0.1em] uppercase">
                    PAY APPS
                  </div>
                  <div className="font-extrabold text-base">{p._count.payApps}</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-ink-50 tracking-[0.1em] uppercase">
                    TASKS
                  </div>
                  <div className="font-extrabold text-base">{p._count.tasks}</div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
