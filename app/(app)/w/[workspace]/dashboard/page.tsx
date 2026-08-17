import Link from 'next/link';
import { requireMembership } from '@/lib/auth/require-membership';
import { workspaceDashboard, recentActivity } from '@/lib/dashboard/queries';

export default async function DashboardPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const [stats, activity] = await Promise.all([
    workspaceDashboard(workspace.id),
    recentActivity(workspace.id, 10),
  ]);

  const isFresh = stats.activeClients + stats.openDeals + stats.activeProjects === 0;

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="hidden md:flex text-xs font-mono font-bold tracking-[0.2em] text-orange-d uppercase mb-5 items-center gap-3">
        <span className="w-8 h-8 bg-orange text-white rounded-full inline-flex items-center justify-center font-black text-sm">
          2
        </span>
        Dashboard
      </div>
      <h1 className="hidden md:block text-display-lg mb-2">
        The <span className="font-serif italic text-orange-d">pulse,</span> today.
      </h1>
      <p className="text-sm md:text-base text-ink-70 max-w-xl mb-5 md:mb-7">
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {stats.openTasks} open tasks across {stats.activeProjects} active project{stats.activeProjects === 1 ? '' : 's'}.
      </p>

      {/* 4-cell KPI row — 2x2 on mobile, 1x4 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-line bg-paper mb-5 md:mb-7">
        <div className="p-4 md:p-5 border-r border-b md:border-b-0 border-line">
          <div className="label-mono">Active clients</div>
          <div className="font-black text-2xl md:text-3xl">{stats.activeClients}</div>
          <div className="text-[10px] md:text-[11px] text-ink-50 mt-1">in your book</div>
        </div>
        <div className="p-4 md:p-5 border-b md:border-b-0 border-line">
          <div className="label-mono">Open deals</div>
          <div className="font-black text-2xl md:text-3xl">{stats.openDeals}</div>
          <div className="text-[10px] md:text-[11px] text-ink-50 mt-1">in pipeline</div>
        </div>
        <div className="p-4 md:p-5 border-r border-line">
          <div className="label-mono">Won (all-time)</div>
          <div className="font-black text-2xl md:text-3xl text-success">${stats.wonValue.toLocaleString()}</div>
          <div className="text-[10px] md:text-[11px] text-ink-50 mt-1">{stats.wonCount} closed</div>
        </div>
        <div className="p-4 md:p-5">
          <div className="label-mono">Open tasks</div>
          <div className="font-black text-2xl md:text-3xl">{stats.openTasks}</div>
          <div className="text-[10px] md:text-[11px] text-ink-50 mt-1">across the team</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Quick actions */}
        <div className="md:col-span-1 bg-paper border border-line p-6">
          <div className="label-eyebrow mb-4">{'// Quick actions'}</div>
          <div className="space-y-2">
            <Link href={`/w/${params.workspace}/clients`} className="block w-full px-4 py-3 bg-ink text-cream text-xs font-extrabold uppercase tracking-[0.12em] text-center hover:bg-orange transition-colors">
              + Add client
            </Link>
            <Link href={`/w/${params.workspace}/deals`} className="block w-full px-4 py-3 bg-paper border-2 border-ink text-ink text-xs font-extrabold uppercase tracking-[0.12em] text-center hover:bg-ink hover:text-cream transition-colors">
              + New deal
            </Link>
            <Link href={`/w/${params.workspace}/projects`} className="block w-full px-4 py-3 bg-paper border-2 border-ink text-ink text-xs font-extrabold uppercase tracking-[0.12em] text-center hover:bg-ink hover:text-cream transition-colors">
              + New project
            </Link>
          </div>
        </div>

        {/* Recent activity (or getting-started guide for fresh workspaces) */}
        {isFresh ? (
          <div className="md:col-span-2 bg-paper border-2 border-line p-6">
            <div className="label-eyebrow mb-5">{'// Get started'}</div>
            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-orange text-paper font-black text-sm flex items-center justify-center">1</span>
                <div className="flex-1">
                  <div className="font-extrabold text-[14px] mb-0.5">Add your first client</div>
                  <p className="text-[12px] text-ink-50 mb-2">A client is who you bill. Each one gets a profile, deal history, and projects.</p>
                  <Link href={`/w/${params.workspace}/clients`} className="inline-block px-3 py-1.5 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange transition-colors">
                    Go to clients →
                  </Link>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-ink text-cream font-black text-sm flex items-center justify-center">2</span>
                <div className="flex-1">
                  <div className="font-extrabold text-[14px] mb-0.5">Create a project & build its schedule of values</div>
                  <p className="text-[12px] text-ink-50 mb-2">Each project gets a budget split by trade. The SOV drives the pay app math.</p>
                  <Link href={`/w/${params.workspace}/projects`} className="inline-block px-3 py-1.5 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange transition-colors">
                    Go to projects →
                  </Link>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-ink text-cream font-black text-sm flex items-center justify-center">3</span>
                <div className="flex-1">
                  <div className="font-extrabold text-[14px] mb-0.5">Generate your first pay app</div>
                  <p className="text-[12px] text-ink-50 mb-2">Pick the SOV lines, enter this-draw amounts, send the link, get paid.</p>
                  <Link href={`/w/${params.workspace}/projects`} className="inline-block px-3 py-1.5 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange transition-colors">
                    Open a project →
                  </Link>
                </div>
              </li>
            </ol>
          </div>
        ) : activity.length === 0 ? (
          <div className="md:col-span-2 bg-paper border border-line p-6">
            <div className="label-eyebrow mb-4">{'// Recent activity'}</div>
            <p className="text-ink-50 text-sm">No activity yet. Add a client or deal to get started.</p>
          </div>
        ) : (
          <div className="md:col-span-2 bg-paper border border-line p-6">
            <div className="label-eyebrow mb-4">{'// Recent activity'}</div>
            <div className="space-y-3">
              {activity.map((a) => (
                <Link
                  key={`${a.kind}-${a.id}`}
                  href={a.kind === 'deal' ? `/w/${params.workspace}/deals/${a.id}` : `/w/${params.workspace}/clients/${a.id}`}
                  className="flex items-center gap-3 py-2.5 border-b border-line-soft last:border-0 hover:bg-cream-2 -mx-2 px-2"
                >
                  <div className="w-9 h-9 rounded-full bg-cream-2 border border-line flex items-center justify-center text-[10px] font-mono tracking-[0.1em] uppercase text-ink-50">
                    {a.kind === 'deal' ? 'DEAL' : 'CLI'}
                  </div>
                  <div className="flex-1">
                    <div className="font-extrabold text-[13px]">{a.title}</div>
                    <div className="text-[11px] text-ink-50">{a.meta}</div>
                  </div>
                  <div className="text-[10px] text-ink-50 font-mono uppercase tracking-[0.1em]">
                    {a.at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
