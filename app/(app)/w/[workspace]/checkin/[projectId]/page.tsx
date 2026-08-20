import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMembership } from '@/lib/auth/require-membership';
import { prisma } from '@/lib/db/client';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  listCheckInCodesForProject,
  listOpenCheckInsForProject,
  listRecentCheckInsForProject,
} from '@/lib/checkins/queries';
import { deactivateCheckInCodeAction } from '@/lib/checkins/actions';
import { buildCheckInUrl, buildQrImageUrl } from '@/lib/checkins/qr';
import { DeactivateCodeButton } from './DeactivateCodeButton';

export const dynamic = 'force-dynamic';

/**
 * Per-project check-in detail. Three sections:
 *   1. QR codes for this project (label, token, image,
 *      retire button, print button)
 *   2. Currently on site at this project
 *   3. Recent check-in history for this project
 */
export default async function ProjectCheckInPage({
  params,
}: {
  params: { workspace: string; projectId: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  // Verify the project belongs to this workspace before
  // rendering — defense in depth on top of the parent
  // layout's auth check.
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, workspaceId: workspace.id },
    select: { id: true, name: true, code: true, address: true, city: true, state: true, zip: true },
  });
  if (!project) notFound();

  const [codes, openCheckIns, recentHistory] = await Promise.all([
    listCheckInCodesForProject(project.id),
    listOpenCheckInsForProject(project.id),
    listRecentCheckInsForProject(project.id, 50),
  ]);

  const activeCodes = codes.filter((c) => c.isActive);

  return (
    <div>
      <PageHeader
        title={`${project.name} — check-in`}
        subtitle={
          project.address
            ? `${project.address}${project.city ? `, ${project.city}` : ''}${project.state ? `, ${project.state}` : ''}`
            : 'Print QR stickers for each check-in point on this site.'
        }
        breadcrumbs={[
          { label: workspace.name, href: `/w/${workspace.slug}` },
          { label: 'Check-in', href: `/w/${workspace.slug}/checkin` },
          { label: project.name },
        ]}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Link
              href={`/w/${workspace.slug}/checkin/${project.id}/codes/new`}
              className="px-3 py-2 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-orange hover:bg-orange-d"
            >
              + Generate code
            </Link>
            {activeCodes.length > 0 ? (
              <Link
                href={`/w/${workspace.slug}/checkin/${project.id}/print`}
                className="px-3 py-2 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-ink hover:bg-orange"
                target="_blank"
                rel="noopener noreferrer"
              >
                Print sheet
              </Link>
            ) : null}
          </div>
        }
      />

      {/* Section 1: codes */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-50">
            {'// QR codes'}
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
            {activeCodes.length} active · {codes.length - activeCodes.length} retired
          </span>
        </div>

        {codes.length === 0 ? (
          <div className="border-2 border-dashed border-line bg-cream-2 p-8 text-center">
            <div className="text-3xl mb-2">📍</div>
            <div className="font-extrabold text-[15px] mb-1">No check-in points yet</div>
            <p className="text-[12px] text-ink-70 max-w-md mx-auto mb-4">
              Generate a QR code for each check-in point on this
              site — main gate, shop entrance, north laydown, etc.
              Print the sticker, stick it at the location, and
              anyone with a phone can scan to check in.
            </p>
            <Link
              href={`/w/${workspace.slug}/checkin/${project.id}/codes/new`}
              className="inline-block px-4 py-2 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-orange hover:bg-orange-d"
            >
              + Generate the first code
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {codes.map((c) => {
              const url = buildCheckInUrl(c.token);
              return (
                <div
                  key={c.id}
                  className={`bg-paper border-2 p-4 ${c.isActive ? 'border-ink' : 'border-line opacity-60'}`}
                >
                  <div className="flex gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={buildQrImageUrl(url, 200)}
                      alt={`QR for ${c.label}`}
                      width={120}
                      height={120}
                      className="shrink-0 border border-line"
                      crossOrigin="anonymous"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <div className="font-extrabold text-[15px] break-words">{c.label}</div>
                        {!c.isActive ? (
                          <span className="bg-ink text-cream text-[9px] font-mono uppercase tracking-[0.12em] px-1.5 py-0.5">
                            Retired
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-0.5">
                        Created {c.createdAt.toLocaleDateString()} · {c.createdByName ?? 'admin'}
                      </div>
                      <div className="text-[10px] font-mono break-all text-ink-70 mt-2 leading-tight">
                        {url}
                      </div>
                      <div className="mt-3 flex gap-2 flex-wrap">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange border-2 border-ink"
                        >
                          Open
                        </a>
                        <a
                          href={buildQrImageUrl(url, 600)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 bg-paper text-ink text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-cream-2 border-2 border-ink"
                        >
                          ↓ Big QR
                        </a>
                        {c.isActive ? (
                          <DeactivateCodeButton
                            workspaceSlug={workspace.slug}
                            codeId={c.id}
                            action={deactivateCheckInCodeAction}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: open */}
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
            No one is currently checked in at this project.
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
                  <div className="text-[11px] text-ink-70">at {c.codeLabel}</div>
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

      {/* Section 3: history */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-50">
            {'// History'}
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
            last 50
          </span>
        </div>
        {recentHistory.length === 0 ? (
          <div className="border-2 border-dashed border-line bg-cream-2 p-6 text-center text-[12px] text-ink-50">
            No completed check-outs yet.
          </div>
        ) : (
          <div className="border-2 border-ink bg-paper overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-ink text-cream text-[10px] font-mono uppercase tracking-[0.12em]">
                <tr>
                  <th className="px-3 py-2">Who</th>
                  <th className="px-3 py-2">Point</th>
                  <th className="px-3 py-2 hidden sm:table-cell">In</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Out</th>
                  <th className="px-3 py-2 text-right">Duration</th>
                </tr>
              </thead>
              <tbody>
                {recentHistory.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-3 py-2 font-extrabold">
                      {c.who.name}
                      <span className="ml-1.5 text-[9px] font-mono uppercase tracking-[0.12em] text-ink-50">
                        {c.who.kind === 'user' ? 'emp' : 'sub'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-ink-70">{c.codeLabel}</td>
                    <td className="px-3 py-2 hidden sm:table-cell text-ink-70 font-mono text-[11px]">
                      {c.checkedInAt.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-ink-70 font-mono text-[11px]">
                      {c.checkedOutAt.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] font-extrabold">
                      {formatDuration(c.durationMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
