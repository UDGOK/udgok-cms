import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { relativeTime } from '@/lib/format/relative-time';
import { DeleteProjectButton } from './DeleteProjectButton';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-success text-paper',
  ON_HOLD: 'bg-warning text-ink',
  COMPLETED: 'bg-ink text-cream',
  CANCELLED: 'bg-ink-30 text-ink',
};

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const where: Prisma.ProjectWhereInput = {};
  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q, mode: 'insensitive' } },
      { code: { contains: searchParams.q, mode: 'insensitive' } },
    ];
  }
  if (searchParams.status && ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].includes(searchParams.status)) {
    where.status = searchParams.status as 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  }

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        client: { select: { id: true, name: true } },
        _count: { select: { payApps: true, tasks: true, photos: true } },
      },
    }),
    prisma.project.count(),
  ]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-black">All projects</h1>
        <p className="text-ink-70 text-sm">
          {projects.length} of {total} total
        </p>
      </div>

      <form className="bg-paper border-2 border-line p-4 mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Search by name or code…"
          className="flex-1 min-w-[200px] px-3 py-2 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
        />
        <select
          name="status"
          defaultValue={searchParams.status ?? ''}
          className="px-3 py-2 bg-cream border-2 border-ink text-[14px]"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_HOLD">On hold</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-ink text-paper border-2 border-ink text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange hover:border-orange"
        >
          Search
        </button>
      </form>

      <div className="bg-paper border-2 border-line overflow-x-auto">
        <table className="w-full">
          <thead className="bg-cream border-b border-line-soft">
            <tr>
              <th className="px-4 py-3 text-left">Project</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Workspace</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Client</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right hidden md:table-cell">Contract</th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">Pay apps</th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-line-soft hover:bg-cream-2">
                <td className="px-4 py-3">
                  <div className="font-extrabold text-[13px]">{p.name}</div>
                  <div className="text-[10px] font-mono text-ink-50">
                    {p.code ? `${p.code} · ` : ''}
                    {p.city ? p.city : p.address ? p.address : '—'}
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <Link
                    href={`/admin/workspaces/${p.workspaceId}`}
                    className="text-[12px] font-extrabold text-orange-d hover:underline"
                  >
                    {p.workspace.name}
                  </Link>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-[12px] text-ink-70">
                  {p.client?.name ?? <span className="text-ink-30">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.05em] ${STATUS_COLOR[p.status] ?? 'bg-ink-30 text-ink'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell text-[12px] font-extrabold">
                  {p.contractValue ? `$${Number(p.contractValue).toLocaleString()}` : <span className="text-ink-30">—</span>}
                </td>
                <td className="px-4 py-3 text-right hidden lg:table-cell text-[12px] font-mono">
                  {p._count.payApps}
                </td>
                <td className="px-4 py-3 text-right hidden lg:table-cell text-[10px] font-mono text-ink-50">
                  {relativeTime(p.createdAt.toISOString())}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/w/${p.workspace.slug}/projects/${p.id}`}
                      target="_blank"
                      rel="noopener"
                      className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 hover:text-ink underline"
                    >
                      open
                    </Link>
                    <DeleteProjectButton
                      workspaceId={p.workspaceId}
                      projectId={p.id}
                      projectName={p.name}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {projects.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-ink-50">
                  No projects found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
