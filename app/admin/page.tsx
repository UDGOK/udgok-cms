import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { Plan } from '@prisma/client';
import { listMasterAdminEmails } from '@/lib/admin/permissions';
import { PLAN_INFO } from '@/lib/workspace/tier';
import { fmtDate, fmtDateTimeUtc } from '@/lib/format/currency';

export const dynamic = 'force-dynamic';

export default async function AdminOverview() {
  const [users, workspaces, recentActivity, newLeads, recentLeads] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { memberships: { include: { workspace: { select: { name: true, slug: true } } } } },
    }),
    prisma.workspace.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { members: true, projects: true, clients: true } },
        members: {
          take: 1,
          orderBy: { role: 'asc' }, // OWNER comes first alphabetically
          include: { user: { select: { email: true, name: true } } },
        },
      },
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { actor: { select: { email: true, name: true } } },
    }),
    prisma.marketingLead.count({ where: { status: 'new' } }),
    prisma.marketingLead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const planCounts: Record<Plan, number> = { STARTER: 0, PRO: 0, ENTERPRISE: 0 };
  for (const w of workspaces) planCounts[w.plan]++;

  const masters = listMasterAdminEmails();

  return (
    <div>
      <h1 className="text-3xl font-black mb-1">Master admin</h1>
      <p className="text-ink-70 text-sm mb-6">
        Platform owner view. You have absolute rights across all workspaces.
      </p>

      {/* Sales alerts — new leads, hot prospects */}
      {newLeads > 0 || recentLeads.length > 0 ? (
        <Link
          href="/admin/leads"
          className="block bg-orange text-paper border-2 border-orange-d p-4 mb-6 hover:bg-orange-d transition-colors"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-paper/80 font-bold">
                {'// Inbound'}
              </div>
              <div className="font-extrabold text-lg mt-0.5">
                {newLeads > 0
                  ? `${newLeads} new lead${newLeads === 1 ? '' : 's'} waiting for follow-up`
                  : `${recentLeads.length} recent lead${recentLeads.length === 1 ? '' : 's'}`}
              </div>
              <div className="text-[12px] text-paper/80 mt-0.5">
                {recentLeads[0]
                  ? `Latest: ${recentLeads[0].email}${recentLeads[0].company ? ` (${recentLeads[0].company})` : ''}`
                  : 'No recent leads yet.'}
              </div>
            </div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]">
              View all →
            </div>
          </div>
        </Link>
      ) : null}

      {/* Master admin notice */}
      <div className="bg-ink text-cream border-2 border-orange p-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="text-3xl">👑</div>
          <div>
            <div className="font-extrabold text-lg">You have master access</div>
            <div className="text-[12px] text-cream/70 mt-0.5">
              As a master admin, you bypass all plan gates and can modify any workspace
              or user. Your email is hardcoded as a platform owner:{' '}
              <code className="px-1.5 py-0.5 bg-cream/10 text-orange-d">
                {masters.join(', ')}
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KpiCard label="Total users" value={users.length} />
        <KpiCard label="Total workspaces" value={workspaces.length} />
        <KpiCard label="Starter plans" value={planCounts.STARTER} />
        <KpiCard label="Pro + Enterprise" value={planCounts.PRO + planCounts.ENTERPRISE} />
      </div>

      {/* Plan breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        {(['STARTER', 'PRO', 'ENTERPRISE'] as const).map((plan) => {
          const info = PLAN_INFO[plan];
          const count = planCounts[plan];
          return (
            <div key={plan} className="bg-paper border-2 border-line p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
                  {info.label}
                </span>
                <span className="font-black text-2xl">{count}</span>
              </div>
              <div className="text-[12px] text-ink-70">{info.tagline}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent workspaces */}
        <div className="bg-paper border-2 border-line">
          <div className="px-5 py-3 border-b border-line-soft flex items-center justify-between">
            <h2 className="text-[14px] font-extrabold uppercase tracking-[0.05em]">Workspaces</h2>
            <Link
              href="/admin/workspaces"
              className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d hover:underline"
            >
              See all →
            </Link>
          </div>
          <ul className="divide-y divide-line-soft">
            {workspaces.slice(0, 5).map((w) => {
              return (
                <li key={w.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-[13px] truncate">{w.name}</div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.05em] text-ink-50 mt-0.5">
                      {w.slug} · {w._count.members} members · {w._count.projects} projects
                    </div>
                  </div>
                  <PlanPill plan={w.plan} />
                  <Link
                    href={`/admin/workspaces/${w.id}`}
                    className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-orange-d hover:underline"
                  >
                    Manage →
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Recent users */}
        <div className="bg-paper border-2 border-line">
          <div className="px-5 py-3 border-b border-line-soft flex items-center justify-between">
            <h2 className="text-[14px] font-extrabold uppercase tracking-[0.05em]">Recent users</h2>
            <Link
              href="/admin/users"
              className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d hover:underline"
            >
              See all →
            </Link>
          </div>
          <ul className="divide-y divide-line-soft">
            {users.slice(0, 5).map((u) => {
              const isMaster = masters.includes(u.email);
              return (
                <li key={u.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-[13px] truncate flex items-center gap-2">
                      {u.name || u.email}
                      {isMaster ? (
                        <span className="text-[8px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 bg-orange text-paper">
                          👑 Master
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.05em] text-ink-50 mt-0.5">
                      {u.email} · {u.memberships.length} ws
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-ink-50">
                    {fmtDate(u.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-6 bg-paper border-2 border-line">
        <div className="px-5 py-3 border-b border-line-soft">
          <h2 className="text-[14px] font-extrabold uppercase tracking-[0.05em]">Activity across all workspaces</h2>
        </div>
        <ul className="divide-y divide-line-soft">
          {recentActivity.map((a) => (
            <li key={a.id} className="px-5 py-3 flex items-center gap-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d flex-shrink-0 w-16">
                {a.action}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold truncate">{a.details || a.entityName || a.entityType}</div>
                <div className="text-[10px] font-mono text-ink-50">
                  {a.actor?.email || 'system'} · {a.entityType} · {a.workspaceId.slice(0, 6)}
                </div>
              </div>
              <span className="text-[10px] font-mono text-ink-50 flex-shrink-0">
                {fmtDateTimeUtc(a.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-paper border-2 border-line p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">{label}</div>
      <div className="font-black text-3xl mt-1">{value}</div>
    </div>
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
