import { relativeTime } from '@/lib/format/relative-time';
import type { ActivityEntry } from '@/lib/activity/queries';

const ACTION_LABEL: Record<string, string> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  sent: 'sent',
  viewed: 'viewed',
  acknowledged: 'acknowledged',
  paid: 'marked paid',
  disputed: 'flagged disputed',
  assigned: 'assigned',
  unassigned: 'unassigned',
  invited: 'invited',
  joined: 'joined',
  left: 'left',
  imported: 'imported',
  exported: 'exported',
  regenerated: 'regenerated',
};

const ACTION_COLOR: Record<string, string> = {
  created: 'text-success',
  updated: 'text-ink-70',
  deleted: 'text-error',
  sent: 'text-info',
  viewed: 'text-ink-50',
  acknowledged: 'text-success',
  paid: 'text-success',
  disputed: 'text-error',
  assigned: 'text-orange-d',
  unassigned: 'text-warning',
  invited: 'text-orange-d',
  joined: 'text-success',
  imported: 'text-ink-70',
  exported: 'text-ink-70',
  regenerated: 'text-warning',
};

const ENTITY_ICON: Record<string, string> = {
  client: '👤',
  project: '🏗️',
  pay_app: '📄',
  subcontractor: '🔨',
  task: '✅',
  team: '👥',
  workspace: '🏢',
  member: '👤',
  note: '📝',
  file: '📁',
  division: '🧾',
  comment: '💬',
};

export function ActivityFeed({
  entries,
  emptyMessage = 'No activity yet.',
  showEntityName = true,
}: {
  entries: ActivityEntry[];
  emptyMessage?: string;
  showEntityName?: boolean;
}) {
  if (entries.length === 0) {
    return <div className="text-center text-ink-50 text-[12px] py-6">{emptyMessage}</div>;
  }

  return (
    <ul className="divide-y divide-line-soft">
      {entries.map((e) => (
        <li key={e.id} className="flex items-start gap-3 py-3">
          <span className="text-lg leading-none mt-0.5">{ENTITY_ICON[e.entityType] ?? '•'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] leading-snug">
              <span className="font-extrabold">
                {e.actor?.name || e.actor?.email || 'Someone'}
              </span>{' '}
              <span className={`${ACTION_COLOR[e.action] ?? 'text-ink-70'} font-extrabold`}>
                {ACTION_LABEL[e.action] ?? e.action}
              </span>
              {showEntityName && e.entityName ? (
                <>
                  {' '}
                  <span className="text-ink-70">{e.entityName}</span>
                </>
              ) : null}
              <span className="text-ink-50"> · {e.entityType.replace('_', ' ')}</span>
            </div>
            {e.details ? (
              <p className="text-[11px] text-ink-70 mt-0.5">{e.details}</p>
            ) : null}
          </div>
          <time
            className="text-[10px] font-mono text-ink-50 whitespace-nowrap"
            dateTime={e.createdAt.toISOString()}
            title={e.createdAt.toISOString()}
          >
            {relativeTime(e.createdAt.toISOString())}
          </time>
        </li>
      ))}
    </ul>
  );
}
