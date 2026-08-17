import { prisma } from '@/lib/db/client';
import { requireRole } from '@/lib/auth/require-role';
import { requireMembership } from '@/lib/auth/require-membership';
import { listWorkspaceActivity } from '@/lib/activity/queries';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { WorkspaceSettingsForm, InviteMemberForm, DeleteWorkspaceSection, BackupSection } from './SettingsClient';

const ROLE_DESCRIPTIONS: Record<string, string> = {
  OWNER: 'Full access including billing and member management.',
  ADMIN: 'Everything except billing.',
  PM: 'Manage projects, pay apps, and team work.',
  ESTIMATOR: 'Create and edit estimates and deals.',
  FIELD: 'Read-only on most things; can update tasks and upload photos.',
};

const ROLE_COLOR: Record<string, string> = {
  OWNER: 'bg-orange text-paper',
  ADMIN: 'bg-ink text-cream',
  PM: 'bg-orange-l text-ink',
  ESTIMATOR: 'bg-cream-2 text-ink',
  FIELD: 'bg-paper text-ink-50 border border-line',
};

export default async function SettingsPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  // Check the user's role for permissioned actions
  let isAdmin = false;
  let isOwner = false;
  try {
    await requireRole(workspace.id, ['OWNER', 'ADMIN']);
    isAdmin = true;
    isOwner = false;
  } catch {
    /* not admin */
  }
  try {
    await requireRole(workspace.id, ['OWNER']);
    isOwner = true;
  } catch {
    /* not owner */
  }

  const [members, activity] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      include: { user: true },
    }),
    listWorkspaceActivity(workspace.id, 25),
  ]);

  return (
    <div className="p-8 max-w-4xl">
      <div className="text-xs font-mono font-bold tracking-[0.2em] text-orange-d uppercase mb-5 flex items-center gap-3">
        <span className="w-8 h-8 bg-orange text-white rounded-full inline-flex items-center justify-center font-black text-sm">
          9
        </span>
        Settings
      </div>
      <h1 className="text-display-lg mb-7">
        <span className="font-serif italic text-orange-d">Workspace</span> & team
      </h1>

      {/* Workspace info */}
      <div className="bg-paper border-2 border-line p-6 mb-6">
        <div className="label-eyebrow mb-3">{'// Workspace'}</div>
        {isAdmin ? (
          <WorkspaceSettingsForm
            workspaceSlug={workspace.slug}
            initialName={workspace.name}
            initialIndustry={workspace.industry}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="label-mono">Name</div>
              <div className="font-extrabold">{workspace.name}</div>
            </div>
            <div>
              <div className="label-mono">Slug</div>
              <div className="font-mono text-ink-70">{workspace.slug}</div>
            </div>
            <div>
              <div className="label-mono">Industry</div>
              <div className="text-ink-70">{workspace.industry ?? '—'}</div>
            </div>
            <div>
              <div className="label-mono">Created</div>
              <div className="text-ink-70">{workspace.createdAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            </div>
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-line-soft text-[11px] font-mono text-ink-50 flex items-center gap-4">
          <span>slug: <span className="text-ink-70">{workspace.slug}</span></span>
          <span>created: <span className="text-ink-70">{workspace.createdAt.toLocaleDateString('en-US')}</span></span>
        </div>
      </div>

      {/* Members */}
      <div className="bg-paper border-2 border-line mb-6">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Team</h2>
            <p className="text-[11px] text-ink-50 mt-0.5">{members.length} member{members.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        {isAdmin ? (
          <div className="px-6 py-3 border-b border-line-soft bg-cream-2">
            <InviteMemberForm workspaceSlug={workspace.slug} />
          </div>
        ) : null}
        <div>
          {members.map((m) => (
            <div
              key={m.id}
              className="px-6 py-4 border-b border-line-soft last:border-0 flex items-center gap-4 hover:bg-cream-2"
            >
              <div className="w-10 h-10 rounded-full bg-ink text-cream flex items-center justify-center font-black text-sm">
                {(m.user.name ?? m.user.email).split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-extrabold text-[14px]">{m.user.name ?? '—'}</div>
                <div className="text-[11px] text-ink-50 font-mono">{m.user.email}</div>
              </div>
              <span
                className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${
                  ROLE_COLOR[m.role] ?? 'bg-cream-2 text-ink-50'
                }`}
              >
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Role legend */}
      <div className="bg-paper border-2 border-line p-6 mb-6">
        <div className="label-eyebrow mb-3">{'// Role permissions'}</div>
        <div className="space-y-2">
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
            <div key={role} className="flex items-center gap-4 py-2 border-b border-line-soft last:border-0">
              <span
                className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] min-w-[90px] text-center ${
                  ROLE_COLOR[role] ?? 'bg-cream-2 text-ink-50'
                }`}
              >
                {role}
              </span>
              <div className="text-[12px] text-ink-70">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Workspace activity log */}
      <div className="bg-paper border-2 border-line p-6 mb-6">
        <div className="label-eyebrow mb-4">{'// Activity'}</div>
        <ActivityFeed entries={activity} />
      </div>

      {/* Backup / Restore (owner only) */}
      {isOwner ? <BackupSection workspaceSlug={workspace.slug} /> : null}

      {/* Danger zone (owner only) */}
      {isOwner ? (
        <DeleteWorkspaceSection workspaceSlug={workspace.slug} workspaceName={workspace.name} />
      ) : null}
    </div>
  );
}
