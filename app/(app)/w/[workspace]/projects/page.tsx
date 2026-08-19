import Link from 'next/link';
import { listProjects } from '@/lib/projects/queries';
import { requireMembership } from '@/lib/auth/require-membership';

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
  const { workspace } = await requireMembership(params.workspace);

  const [projects] = await Promise.all([
    listProjects(workspace.id),
  ]);

  return (
    <div className="p-4 md:p-8">
      <div className="hidden md:flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex text-xs font-mono font-bold tracking-[0.2em] text-orange-d uppercase items-center gap-3 mb-4">
            <span className="w-8 h-8 bg-orange text-white rounded-full inline-flex items-center justify-center font-black text-sm">
              {projects.length}
            </span>
            Projects
          </div>
          <h1 className="text-display-lg mb-4">
            The <span className="font-serif italic text-orange-d">build,</span> end to end.
          </h1>
          <p className="text-base text-ink-70 max-w-xl">
            Each project is a budget, a schedule, and a series of pay apps. Click a project to manage
            its schedule of values and generate the next draw.
          </p>
        </div>
        <Link
          href={`/w/${params.workspace}/projects/new`}
          className="shrink-0 px-4 h-10 inline-flex items-center gap-1.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d hover:border-orange-d"
        >
          + New project
        </Link>
      </div>

      {/* Mobile header bar with title + new project button */}
      <div className="md:hidden flex items-center justify-between mb-4">
        <h1 className="font-extrabold text-[18px]">Projects</h1>
        <Link
          href={`/w/${params.workspace}/projects/new`}
          className="px-3 h-9 inline-flex items-center bg-orange text-paper border-2 border-orange text-[10px] font-extrabold uppercase tracking-[0.1em]"
        >
          + New
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
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
              className="bg-paper border-2 border-line p-4 md:p-5 hover:border-ink active:bg-cream-2 transition-colors"
            >
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-mono text-ink-50 tracking-[0.1em] uppercase mb-1 truncate">
                    {p.code ?? p.id.slice(0, 6).toUpperCase()}
                  </div>
                  <div className="font-extrabold text-base leading-tight">{p.name}</div>
                </div>
                <span
                  className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] flex-shrink-0 ${
                    STATUS_COLOR[p.status] ?? 'bg-cream-2 text-ink-50'
                  }`}
                >
                  {STATUS_LABELS[p.status]}
                </span>
              </div>
              <div className="text-[12px] text-ink-50 mb-3 truncate">
                {p.client?.name ?? 'No client'}
              </div>
              {p.contractValue ? (
                <div className="font-black text-xl md:text-2xl mb-3">
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
