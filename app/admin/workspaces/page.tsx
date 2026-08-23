import { prisma } from '@/lib/db/client';
import Link from 'next/link';
import { Plan } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { fmtDate } from '@/lib/format/currency';

export const dynamic = 'force-dynamic';

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: { plan?: string; q?: string };
}) {
  const where: Prisma.WorkspaceWhereInput = {};
  if (searchParams.plan && ['STARTER', 'PRO', 'ENTERPRISE'].includes(searchParams.plan)) {
    where.plan = searchParams.plan as Plan;
  }
  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q, mode: 'insensitive' } },
      { slug: { contains: searchParams.q, mode: 'insensitive' } },
    ];
  }

  const workspaces = await prisma.workspace.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { members: true, projects: true, clients: true, files: true } },
      members: {
        orderBy: { role: 'asc' },
        include: { user: { select: { email: true, name: true, avatarUrl: true } } },
      },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black">Workspaces</h1>
          <p className="text-ink-70 text-sm">{workspaces.length} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-paper border-2 border-line p-4 mb-4 flex items-center gap-3 flex-wrap">
        <form className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="Search by name or slug…"
            className="flex-1 px-3 py-2 bg-cream border border-line text-[13px]"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.1em]"
          >
            Search
          </button>
        </form>
        <div className="flex gap-1">
          <FilterPill href="/admin/workspaces" label="All" active={!searchParams.plan} />
          <FilterPill href="/admin/workspaces?plan=STARTER" label="Starter" active={searchParams.plan === 'STARTER'} />
          <FilterPill href="/admin/workspaces?plan=PRO" label="Pro" active={searchParams.plan === 'PRO'} />
          <FilterPill href="/admin/workspaces?plan=ENTERPRISE" label="Enterprise" active={searchParams.plan === 'ENTERPRISE'} />
        </div>
      </div>

      <div className="bg-paper border-2 border-line">
        <table className="w-full text-[12px]">
          <thead className="bg-cream border-b border-line-soft">
            <tr className="text-left text-[9px] font-mono uppercase tracking-[0.15em] text-ink-50">
              <th className="px-4 py-3">Workspace</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3 hidden md:table-cell">Slug</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3 hidden md:table-cell">Stats</th>
              <th className="px-4 py-3 hidden lg:table-cell">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {workspaces.map((w) => {
              const owner = w.members.find((m) => m.role === 'OWNER');
              return (
                <tr key={w.id} className="hover:bg-cream-2">
                  <td className="px-4 py-3">
                    <div className="font-extrabold text-[13px]">{w.name}</div>
                    {w.industry ? (
                      <div className="text-[10px] text-ink-50 mt-0.5">{w.industry}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {owner ? (
                      <div>
                        <div className="text-[12px] font-semibold">{owner.user.name || owner.user.email}</div>
                        <div className="text-[10px] font-mono text-ink-50">{owner.user.email}</div>
                      </div>
                    ) : (
                      <span className="text-ink-30">No owner</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <code className="text-[10px] font-mono text-ink-70">{w.slug}</code>
                  </td>
                  <td className="px-4 py-3">
                    <PlanPill plan={w.plan} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-[10px] font-mono text-ink-70">
                    {w._count.members}m · {w._count.projects}p · {w._count.clients}c
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-[10px] font-mono text-ink-50">
                    {fmtDate(w.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/workspaces/${w.id}`}
                      className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-orange-d hover:underline"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {workspaces.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-ink-50">
                  No workspaces found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.1em] border-2 ${
        active
          ? 'bg-ink text-cream border-ink'
          : 'bg-paper text-ink-50 border-line hover:border-ink hover:text-ink'
      }`}
    >
      {label}
    </Link>
  );
}

function PlanPill({ plan }: { plan: Plan }) {
  const colors: Record<Plan, string> = {
    STARTER: 'bg-ink-30 text-ink',
    PRO: 'bg-orange text-paper',
    ENTERPRISE: 'bg-ink text-cream',
  };
  return (
    <span className={`text-[9px] font-extrabold uppercase tracking-[0.1em] px-2 py-0.5 ${colors[plan]}`}>
      {plan}
    </span>
  );
}
