import Link from 'next/link';
import { listOpenCheckInsForProject } from '@/lib/checkins/queries';

/**
 * Compact "who is on site now" panel for embedding into
 * other project pages (overview, inventory, pay-apps).
 *
 * Server-rendered for fast initial paint. Renders nothing
 * (returns null) when the project has no open check-ins,
 * so the parent page can drop it in without an empty-
 * state cost.
 */
export async function OnSitePanel({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const open = await listOpenCheckInsForProject(projectId);
  if (open.length === 0) return null;

  return (
    <div className="border-2 border-ink bg-paper">
      <div className="flex items-baseline justify-between p-3 border-b-2 border-ink">
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-50">
          {'// On site now'}
        </div>
        <Link
          href={`/w/${workspaceSlug}/projects/${projectId}/checkins`}
          className="text-[10px] font-mono uppercase tracking-[0.12em] text-orange-d hover:underline"
        >
          See all →
        </Link>
      </div>
      <ul className="divide-y divide-line">
        {open.map((c) => (
          <li key={c.id} className="flex items-baseline justify-between gap-3 p-3 text-[12px]">
            <div className="min-w-0">
              <div className="font-extrabold">
                {c.who.name}
                <span className="ml-2 text-[9px] font-mono uppercase tracking-[0.12em] text-ink-50">
                  {c.who.kind === 'user' ? 'emp' : 'sub'}
                </span>
              </div>
              <div className="text-[10px] text-ink-70">at {c.codeLabel}</div>
            </div>
            <div className="text-right shrink-0 text-ink-70">
              <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50">
                IN
              </div>
              <div className="text-[11px] font-extrabold">{timeAgo(c.checkedInAt)}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function timeAgo(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
