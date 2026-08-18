'use client';

import { useTransition } from 'react';
import { updateProjectTaskStatusAction, deleteProjectTaskAction } from '@/lib/projects/actions';

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-ink-30 text-ink',
  IN_PROGRESS: 'bg-orange text-paper',
  BLOCKED: 'bg-error text-paper',
  DONE: 'bg-success text-paper',
  CANCELLED: 'bg-line text-ink-50',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-ink-50',
  NORMAL: 'text-ink',
  HIGH: 'text-orange-d',
  URGENT: 'text-error',
};

interface ProjectTaskRowProps {
  workspaceSlug: string;
  projectId: string;
  task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: Date | null;
    startDate: Date | null;
    endDate: Date | null;
    assignee: { id: string; name: string | null; imageUrl: string | null } | null;
  };
}

export function ProjectTaskRow({ workspaceSlug, projectId, task }: ProjectTaskRowProps) {
  const [pending, start] = useTransition();
  const overdue =
    task.dueDate &&
    task.dueDate.getTime() < Date.now() &&
    task.status !== 'DONE' &&
    task.status !== 'CANCELLED';

  function changeStatus(next: string) {
    start(async () => {
      await updateProjectTaskStatusAction(workspaceSlug, projectId, task.id, next);
    });
  }

  function onDelete() {
    if (!confirm(`Delete "${task.title}"?`)) return;
    start(async () => {
      await deleteProjectTaskAction(workspaceSlug, projectId, task.id);
    });
  }

  return (
    <div
      className={`bg-paper border border-line p-3 md:p-4 ${
        overdue ? 'border-l-4 border-l-error' : ''
      } ${pending ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <h4 className={`font-extrabold text-[14px] ${task.status === 'DONE' ? 'line-through text-ink-50' : ''}`}>
              {task.title}
            </h4>
            <span
              className={`px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.05em] ${
                PRIORITY_COLORS[task.priority] ?? 'text-ink'
              } border border-current`}
            >
              {task.priority}
            </span>
            {overdue ? (
              <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.05em] bg-error text-paper">
                overdue
              </span>
            ) : null}
          </div>
          {task.description ? (
            <p className="text-[12px] text-ink-70 mt-1 line-clamp-2">{task.description}</p>
          ) : null}
          <div className="flex items-center gap-3 mt-2 text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 flex-wrap">
            {task.dueDate ? (
              <span>Due {task.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            ) : null}
            {task.startDate && task.endDate ? (
              <span>
                {task.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' → '}
                {task.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            ) : null}
            {task.assignee ? (
              <span className="text-ink-70">→ {task.assignee.name || 'Unknown'}</span>
            ) : (
              <span className="text-ink-30">unassigned</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <select
            value={task.status}
            onChange={(e) => changeStatus(e.target.value)}
            disabled={pending}
            className={`text-[10px] font-extrabold uppercase tracking-[0.1em] px-2 py-1 ${
              STATUS_COLORS[task.status] ?? 'bg-ink text-paper'
            } border-0 focus:outline-none focus:ring-2 focus:ring-orange-d`}
          >
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-30 hover:text-error disabled:opacity-50"
          >
            delete
          </button>
        </div>
      </div>
    </div>
  );
}
