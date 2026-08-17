import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { PLAN_INFO } from '@/lib/workspace/tier';
import { listMasterAdminEmails } from '@/lib/admin/permissions';
import { WorkspacePlanForm } from './WorkspacePlanForm';
import { ForceAddMemberForm } from './ForceAddMemberForm';
import { relativeTime } from '@/lib/format/relative-time';

export const dynamic = 'force-dynamic';

export default async function AdminWorkspaceDetail({ params }: { params: { id: string } }) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: params.id },
    include: {
      members: {
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        include: { user: true },
      },
      _count: {
        select: { members: true, projects: true, clients: true, files: true, messages: true },
      },
    },
  });
  if (!workspace) notFound();

  const masters = listMasterAdminEmails().map((e) => e.toLowerCase());
  const planInfo = PLAN_INFO[workspace.plan];

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/workspaces" className="text-[11px] font-mono uppercase tracking-[0.1em] text-orange-d hover:underline">
          ← All workspaces
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black">{workspace.name}</h1>
          <p className="text-ink-70 text-sm mt-1">
            <code className="px-1.5 py-0.5 bg-cream-2 text-[11px] font-mono">{workspace.slug}</code>
            {workspace.industry ? <span> · {workspace.industry}</span> : null}
          </p>
        </div>
        <a
          href={`/w/${workspace.slug}/dashboard`}
          target="_blank"
          rel="noopener"
          className="text-[10px] font-extrabold uppercase tracking-[0.1em] px-3 py-2 border-2 border-ink hover:bg-ink hover:text-cream"
        >
          Open as user ↗
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Members" value={workspace._count.members} />
        <KpiCard label="Projects" value={workspace._count.projects} />
        <KpiCard label="Clients" value={workspace._count.clients} />
        <KpiCard label="Files" value={workspace._count.files} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan management */}
        <div className="bg-paper border-2 border-line p-5">
          <h2 className="text-[14px] font-extrabold uppercase tracking-[0.05em] mb-3">Plan & billing</h2>
          <div className="mb-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Current plan
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black">{planInfo.label}</span>
              <span className={`text-[10px] font-extrabold uppercase tracking-[0.1em] px-2 py-0.5 ${planInfo.color}`}>
                {planInfo.label}
              </span>
            </div>
            <div className="text-[12px] text-ink-70 mt-1">{planInfo.tagline} · {planInfo.price}</div>
          </div>
          <WorkspacePlanForm workspaceId={workspace.id} currentPlan={workspace.plan} />
        </div>

        {/* Members */}
        <div className="bg-paper border-2 border-line p-5">
          <h2 className="text-[14px] font-extrabold uppercase tracking-[0.05em] mb-3">
            Members ({workspace.members.length})
          </h2>
          <ul className="divide-y divide-line-soft -mx-1">
            {workspace.members.map((m) => {
              const isMaster = masters.includes(m.user.email.toLowerCase());
              return (
                <li key={m.id} className="px-1 py-2 flex items-center gap-3">
                  {m.user.avatarUrl ? (
                    <img src={m.user.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-ink text-cream flex items-center justify-center text-[10px] font-black">
                      {m.user.name?.[0]?.toUpperCase() || m.user.email[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-[12px] truncate flex items-center gap-2">
                      {m.user.name || m.user.email}
                      {isMaster ? (
                        <span className="text-[8px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 bg-orange text-paper">
                          👑
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[10px] font-mono text-ink-50">
                      {m.user.email} · joined {relativeTime(m.joinedAt.toISOString())}
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-extrabold uppercase tracking-[0.1em] px-2 py-0.5 ${
                      m.role === 'OWNER'
                        ? 'bg-orange text-paper'
                        : m.role === 'ADMIN'
                        ? 'bg-ink text-cream'
                        : 'bg-cream-2 text-ink-50'
                    }`}
                  >
                    {m.role}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 pt-4 border-t border-line-soft">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.05em] mb-2">Force-add member</h3>
            <ForceAddMemberForm workspaceId={workspace.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-paper border-2 border-line p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">{label}</div>
      <div className="font-black text-2xl mt-1">{value}</div>
    </div>
  );
}
