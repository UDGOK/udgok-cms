/**
 * TeamTab — project members. Shows the add-member form (only
 * if canEdit) and a list of current members with role pills
 * and a remove button.
 *
 * Extracted from page.tsx as part of the Aug 2026
 * project-page refactor. Pure server component.
 */

import { AddProjectMemberForm } from '../AddProjectMemberForm';
import { RemoveProjectMemberButton } from '../RemoveProjectMemberButton';
import type { ProjectUser } from '../page-types';

export function TeamTab({
  projectId,
  workspace,
  projectMembers,
  projectMemberRoles,
  workspaceMembers,
  canEdit,
}: {
  projectId: string;
  workspace: string;
  projectMembers: ProjectUser[];
  projectMemberRoles: { userId: string; role: string | null }[];
  workspaceMembers: ProjectUser[];
  canEdit: boolean;
}) {
  const existingIds = projectMembers.map((u) => u.id);
  const roleMap = new Map(projectMemberRoles.map((r) => [r.userId, r.role]));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-black text-xl md:text-2xl tracking-tight">Project team</h2>
          <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {projectMembers.length} member{projectMembers.length === 1 ? '' : 's'} on this project
          </p>
        </div>
        {canEdit ? (
          <AddProjectMemberForm
            workspaceSlug={workspace}
            projectId={projectId}
            members={workspaceMembers}
            existingUserIds={existingIds}
          />
        ) : null}
      </div>

      {projectMembers.length === 0 ? (
        <div className="bg-paper border-2 border-line p-12 text-center text-ink-50">
          No teammates added yet. {canEdit ? 'Click "+ Add teammate" to assign someone to this project.' : 'Ask a project manager to add team members.'}
        </div>
      ) : (
        <div className="bg-paper border-2 border-line divide-y divide-line-soft">
          {projectMembers.map((m) => {
            const role = roleMap.get(m.id);
            return (
              <div key={m.id} className="p-4 md:p-5 flex items-center gap-4">
                {m.imageUrl ? (
                  <img src={m.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-ink text-cream flex items-center justify-center font-black text-sm flex-shrink-0">
                    {(m.name || m.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-[14px] truncate">{m.name || 'Unknown'}</div>
                  <div className="text-[12px] text-ink-50 truncate">{m.email}</div>
                  {role ? (
                    <div className="mt-1">
                      <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.05em] bg-cream-2 border border-line">
                        {role}
                      </span>
                    </div>
                  ) : null}
                </div>
                {canEdit ? (
                  <RemoveProjectMemberButton
                    workspaceSlug={workspace}
                    projectId={projectId}
                    userId={m.id}
                    userName={m.name || m.email || 'Unknown'}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
