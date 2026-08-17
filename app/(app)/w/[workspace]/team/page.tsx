import { requireMembership } from '@/lib/auth/require-membership';
import { requireRole } from '@/lib/auth/require-role';
import { listTeams } from '@/lib/team/queries';
import { TeamPageClient } from './TeamPageClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function TeamPage({
  params,
}: {
  params: { workspace: string };
}) {
  const ctx = await requireMembership(params.workspace);
  const isAdmin = await isAdminOrOwner(ctx.workspace.id);

  const teams = await listTeams(ctx.workspace.id);

  return (
    <div className="px-10 py-8">
      <PageHeader
        title="Team"
        subtitle="Who's on this workspace and where they are right now."
        breadcrumbs={[{ label: ctx.workspace.name, href: `/w/${ctx.workspace.slug}/dashboard` }, { label: 'Team' }]}
      />

      <TeamPageClient
        workspaceSlug={ctx.workspace.slug}
        workspaceId={ctx.workspace.id}
        isAdmin={isAdmin}
        initialTeams={teams}
      />
    </div>
  );
}

async function isAdminOrOwner(workspaceId: string) {
  try {
    await requireRole(workspaceId, ['OWNER', 'ADMIN']);
    return true;
  } catch {
    return false;
  }
}
