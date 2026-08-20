import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireMembership } from '@/lib/auth/require-membership';
import {
  listOpenCheckInsForProject,
  listRecentCheckInsForProject,
} from '@/lib/checkins/queries';
import { listCheckInCodesForProject } from '@/lib/checkins/queries';

/**
 * Embedded "who is on site now" panel for a project.
 *
 * Server-rendered via requireMembership for a fast
 * initial paint — no client JS, no useEffect flicker.
 * Shown as a dedicated /projects/[id]/checkins route
 * so the project tab bar can link to it (badge is
 * the open check-in count).
 *
 * The full per-project check-in admin (with QR codes
 * + history) lives at /checkin/[projectId]. This page
 * is the read-only "today" view.
 */
export default async function ProjectCheckInsPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  // Reuse the per-project detail query to confirm the
  // project is in this workspace, then load the
  // check-in panels in parallel.
  const project = await (
    await import('@/lib/db/client')
  ).prisma.project.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    select: { id: true, name: true, code: true },
  });
  if (!project) notFound();

  const [open, recent, codes] = await Promise.all([
    listOpenCheckInsForProject(project.id),
    listRecentCheckInsForProject(project.id, 10),
    listCheckInCodesForProject(project.id),
  ]);

  const activeCodes = codes.filter((c) => c.isActive);

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-50">
            {'// '}{project.name}
          </div>
          <h1 className="text-2xl font-black mt-0.5">Who&apos;s on site</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/w/${workspace.slug}/checkin/${project.id}`}
            className="px-3 py-2 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-ink hover:bg-orange"
          >
            Manage QR codes
          </Link>
          {activeCodes.length > 0 ? (
            <Link
              href={`/w/${workspace.slug}/checkin/${project.id}/print`}
              className="px-3 py-2 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-orange hover:bg-orange-d"
              target="_blank"
              rel="noopener noreferrer"
            >
              Print sheet
            </Link>
          ) : null}
        </div>
      </div>

      {/* On site now */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-50">
            {'// On site right now'}
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
            {open.length} open
          </span>
        </div>
        {open.length === 0 ? (
          <div className="border-2 border-dashed border-line bg-cream-2 p-5 text-center text-[12px] text-ink-50">
            Nobody is checked in right now.
          </div>
        ) : (
          <ul className="border-2 border-ink bg-paper divide-y divide-line">
            {open.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-3 p-3 text-[12px]">
                <div className="min-w-0">
                  <div className="font-extrabold text-[13px]">
                    {c.who.name}
                    <span className="ml-2 text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                      {c.who.kind === 'user' ? 'employee' : 'sub'}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-70">at {c.codeLabel}</div>
                </div>
                <div className="text-right shrink-0 text-ink-70">
                  <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
                    IN
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

      {/* History */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-50">
            {'// Last 10 check-outs'}
          </h2>
        </div>
        {recent.length === 0 ? (
          <div className="border-2 border-dashed border-line bg-cream-2 p-5 text-center text-[12px] text-ink-50">
            No check-out history yet.
          </div>
        ) : (
          <ul className="border-2 border-ink bg-paper divide-y divide-line">
            {recent.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-3 p-3 text-[12px]">
                <div className="min-w-0">
                  <div className="font-extrabold">
                    {c.who.name}
                    <span className="ml-2 text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                      {c.who.kind === 'user' ? 'employee' : 'sub'}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-70">at {c.codeLabel}</div>
                </div>
                <div className="text-right shrink-0 text-ink-70">
                  <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
                    DURATION
                  </div>
                  <div className="text-[11px] font-extrabold text-ink">
                    {formatDuration(c.durationMs)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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
