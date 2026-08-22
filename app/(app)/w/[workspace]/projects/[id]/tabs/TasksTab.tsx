/**
 * TasksTab — project tasks grouped by status (TODO, IN_PROGRESS,
 * BLOCKED, DONE). Cancelled tasks are excluded from the visible
 * groups but still counted in the totals line.
 *
 * Extracted from page.tsx as part of the Aug 2026
 * project-page refactor. Pure server component.
 */

import { AddProjectTaskForm } from '../AddProjectTaskForm';
import { ProjectTaskRow } from '../ProjectTaskRow';
import type { ProjectData, ProjectUser } from '../page-types';

export function TasksTab({
  projectId,
  workspace,
  project,
  workspaceMembers,
}: {
  projectId: string;
  workspace: string;
  project: ProjectData;
  workspaceMembers: ProjectUser[];
}) {
  const tasks = project.tasks ?? [];
  const grouped = {
    TODO: tasks.filter((t) => t.status === 'TODO'),
    IN_PROGRESS: tasks.filter((t) => t.status === 'IN_PROGRESS'),
    BLOCKED: tasks.filter((t) => t.status === 'BLOCKED'),
    DONE: tasks.filter((t) => t.status === 'DONE'),
    CANCELLED: tasks.filter((t) => t.status === 'CANCELLED'),
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-black text-xl md:text-2xl tracking-tight">Project tasks</h2>
          <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {tasks.length} total · {grouped.DONE.length} done · {grouped.IN_PROGRESS.length} in progress
          </p>
        </div>
        <AddProjectTaskForm
          workspaceSlug={workspace}
          projectId={projectId}
          members={workspaceMembers}
        />
      </div>

      {tasks.length === 0 ? (
        <div className="bg-paper border-2 border-line p-12 text-center text-ink-50">
          No tasks yet. Click &ldquo;+ New task&rdquo; to add the first one.
        </div>
      ) : (
        <div className="space-y-5">
          {(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const).map((status) => {
            const list = grouped[status];
            if (list.length === 0) return null;
            const sectionLabels: Record<typeof status, string> = {
              TODO: 'To Do',
              IN_PROGRESS: 'In Progress',
              BLOCKED: 'Blocked',
              DONE: 'Done',
            };
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                    {sectionLabels[status]}
                  </h3>
                  <span className="text-[10px] font-mono text-ink-30">· {list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.map((t) => (
                    <ProjectTaskRow
                      key={t.id}
                      workspaceSlug={workspace}
                      projectId={projectId}
                      task={t}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
