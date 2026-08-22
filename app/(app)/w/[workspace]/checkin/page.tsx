import Link from 'next/link';
import { requireMembership } from '@/lib/auth/require-membership';
import { prisma } from '@/lib/db/client';
import { PageHeader } from '@/components/ui/PageHeader';
import { listOpenCheckInsForWorkspace, listRecentCheckInsForWorkspace } from '@/lib/checkins/queries';
import { formatInUserTz, userTimezone } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

/**
 * Admin dashboard for site check-in codes.
 *
 * Three sections:
 *   1. Projects + their QR codes (with a "Print" button per
 *      project and a "Generate" button)
 *   2. Who's on site right now (open check-ins, all projects)
 *   3. Recent activity (last 20 closed check-ins)
 *
 * Desktop-first layout. The print view is its own page
 * (printed via the project detail page) so the admin
 * doesn't have to leave this dashboard to print stickers.
 */
export default async function CheckInDashboardPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace, userId } = await requireMembership(params.workspace);

  // Fetch the viewer's timezone so check-in / check-out
  // timestamps render in their local time. Without this,
  // a CST admin would see UTC times (e.g. "Aug 22, 14:00"
  // when they checked in at 8 AM). See lib/timezone.ts.
  const viewer = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const viewerTz = userTimezone(viewer);

  // Pull projects, their QR codes, the open check-ins, and
  // recent history in parallel. Each query is small and
  // hits a (workspaceId, ...) index.
  const [projects, openCheckIns, recentHistory, codeTotals] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        siteCheckInCodes: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, label: true, isActive: true, createdAt: true },
        },
      },
    }),
    listOpenCheckInsForWorkspace(workspace.id),
    listRecentCheckInsForWorkspace(workspace.id, 20),
    prisma.siteCheckInCode.groupBy({
      by: ['projectId'],
      where: { workspaceId: workspace.id },
      _count: { _all: true },
    }),
  ]);

  // Map the per-project code totals to a quick lookup.
  const totalByProject = new Map(codeTotals.map((t) => [t.projectId, t._count._all]));

  // The user from the Clerk session — used for the empty
  // state copy ("ask an admin to add codes").
  const signedInUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  return (
    <div>
      <PageHeader
        title="Site check-in"
        subtitle="Print QR stickers for each check-in point. Employees and subs scan them to check in and out at the site."
        breadcrumbs={[
          { label: workspace.name, href: `/w/${workspace.slug}` },
          { label: 'Check-in' },
        ]}
      />

      {/* Section 1: Projects + their codes */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-50">
            {'// Projects & QR codes'}
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
            {projects.length} project{projects.length === 1 ? '' : 's'}
          </span>
        </div>

        {projects.length === 0 ? (
          <EmptyProjectsState workspaceSlug={workspace.slug} />
        ) : (
          <div className="border-2 border-ink bg-paper">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-ink text-cream text-[10px] font-mono uppercase tracking-[0.12em]">
                <tr>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Codes</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Latest</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const total = totalByProject.get(p.id) ?? 0;
                  const latest = p.siteCheckInCodes[0];
                  return (
                    <tr key={p.id} className="border-t border-line align-top">
                      <td className="px-3 py-3">
                        <div className="font-extrabold">{p.name}</div>
                        {p.code ? (
                          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
                            {p.code}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 font-mono">
                        {total}
                        {p.siteCheckInCodes.some((c) => !c.isActive) ? (
                          <span className="ml-1.5 text-[10px] text-ink-50">
                            ({p.siteCheckInCodes.filter((c) => !c.isActive).length} retired)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell text-ink-70">
                        {latest ? latest.label : <span className="text-ink-30">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex gap-2 justify-end flex-wrap">
                          <Link
                            href={`/w/${workspace.slug}/projects/${p.id}/checkins`}
                            className="px-2.5 py-1.5 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange border-2 border-ink"
                          >
                            Open
                          </Link>
                          <Link
                            href={`/w/${workspace.slug}/projects/${p.id}/checkins/codes/new`}
                            className="px-2.5 py-1.5 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d border-2 border-orange"
                          >
                            + Code
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 2: open check-ins */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-50">
            {'// On site right now'}
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
            {openCheckIns.length} open
          </span>
        </div>

        {openCheckIns.length === 0 ? (
          <div className="border-2 border-dashed border-line bg-cream-2 p-6 text-center text-[12px] text-ink-50">
            No one is currently checked in. The list fills in as
            employees and subs scan the QR stickers on site.
          </div>
        ) : (
          <ul className="border-2 border-ink bg-paper divide-y divide-line">
            {openCheckIns.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="font-extrabold text-[13px]">
                    {c.who.name}
                    <span className="ml-2 text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                      {c.who.kind === 'user' ? 'employee' : 'sub'}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-70">
                    {c.projectName} · {c.codeLabel}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
                    CHECKED IN
                  </div>
                  <div className="text-[11px] font-extrabold">
                    {timeAgo(c.checkedInAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section 3: recent history */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-50">
            {'// Recent check-ins'}
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
            last 20
          </span>
        </div>

        {recentHistory.length === 0 ? (
          <div className="border-2 border-dashed border-line bg-cream-2 p-6 text-center text-[12px] text-ink-50">
            No history yet. Once someone checks out, they show up here.
          </div>
        ) : (
          <ul className="border-2 border-ink bg-paper divide-y divide-line">
            {recentHistory.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-3 p-3 text-[12px]">
                <div className="min-w-0">
                  <div className="font-extrabold">
                    {c.who.name}
                    <span className="ml-2 text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                      {c.who.kind === 'user' ? 'employee' : 'sub'}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-70">
                    {c.projectName} · {c.codeLabel}
                  </div>
                </div>
                <div className="text-right shrink-0 text-ink-70">
                  <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
                    DURATION
                  </div>
                  <div className="text-[11px] font-extrabold text-ink">
                    {formatDuration(c.durationMs)}
                  </div>
                  <div className="text-[10px] font-mono text-ink-50 mt-0.5">
                    {c.checkedOutAt
                      ? formatInUserTz(c.checkedOutAt, viewer, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZone: viewerTz,
                        })
                      : '—'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Footer credit */}
      <div className="mt-10 text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
        {'// Signed in as '}
        {signedInUser?.name ?? signedInUser?.email ?? userId}
      </div>
    </div>
  );
}

function EmptyProjectsState({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <div className="border-2 border-dashed border-line bg-cream-2 p-8 text-center">
      <div className="text-3xl mb-2">📋</div>
      <div className="font-extrabold text-[15px] mb-1">No projects yet</div>
      <p className="text-[12px] text-ink-70 max-w-md mx-auto mb-4">
        Create a project first, then come back here to generate
        QR check-in codes for its check-in points.
      </p>
      <Link
        href={`/w/${workspaceSlug}/projects/new`}
        className="inline-block px-4 py-2 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-orange hover:bg-orange-d"
      >
        + Create a project
      </Link>
    </div>
  );
}

function timeAgo(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0m';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}
