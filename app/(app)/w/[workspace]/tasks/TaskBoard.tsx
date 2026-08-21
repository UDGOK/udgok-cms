'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { TASK_STATUS_LABELS, TASK_STATUSES, type TaskStatus } from '@/lib/tasks/queries';
import { setTaskStatus } from '@/lib/tasks/actions';
import { NewTaskModal } from './NewTaskModal';
import { EditTaskModal } from './EditTaskModal';

export interface TaskCard {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueDate: Date | null;
  assignee: { id: string; name: string | null } | null;
  project: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
}

const PRIORITY_COLOR: Record<TaskCard['priority'], string> = {
  URGENT: 'bg-error text-paper',
  HIGH: 'bg-orange text-paper',
  NORMAL: 'bg-ink text-cream',
  LOW: 'bg-cream-2 text-ink-50',
};

export function TaskBoard({
  workspaceSlug,
  tasks,
  team,
  projects,
  clients,
}: {
  workspaceSlug: string;
  tasks: TaskCard[];
  team: { id: string; name: string | null }[];
  projects: { id: string; name: string }[];
  clients: { id: string; name: string }[];
}) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<TaskCard | null>(null);
  const grouped = TASK_STATUSES.reduce<Record<TaskStatus, TaskCard[]>>(
    (acc, s) => {
      acc[s] = tasks.filter((t) => t.status === s);
      return acc;
    },
    { TODO: [], IN_PROGRESS: [], BLOCKED: [], DONE: [], CANCELLED: [] },
  );

  async function handleSetStatus(taskId: string, status: string) {
    await setTaskStatus(taskId, status);
  }

  return (
    <>
      <div className="overflow-x-auto pb-4">
        <div className="grid grid-cols-5 gap-3 min-w-[1100px]">
          {TASK_STATUSES.map((status) => {
            const list = grouped[status];
            return (
              <div key={status} className="bg-cream-2 border border-line min-h-[600px] flex flex-col">
                <div className="p-3 border-b border-line bg-paper">
                  <div className="font-extrabold uppercase text-[10px] tracking-[0.12em]">
                    {TASK_STATUS_LABELS[status]}
                  </div>
                  <div className="text-[10px] text-ink-50 font-mono mt-1">{list.length}</div>
                </div>
                <div className="p-2 space-y-2 flex-1">
                  {list.length === 0 ? (
                    <div className="text-center text-ink-50 text-[10px] py-8 border border-dashed border-line">
                      Empty
                    </div>
                  ) : (
                    list.map((t) => (
                      <div key={t.id} className="bg-paper border border-line p-3 group">
                        <div className="flex items-start gap-2 mb-2">
                          <span className={`inline-block px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] ${PRIORITY_COLOR[t.priority]}`}>
                            {t.priority}
                          </span>
                          {t.dueDate ? (
                            <span className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em]">
                              {t.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setEditing(t)}
                            className="ml-auto text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink underline-offset-2 hover:text-orange-d hover:underline"
                            title="Edit task"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-extrabold text-[13px] leading-snug mb-2">
                          {t.title}
                        </div>
                        {t.client ? (
                          <div className="text-[10px] text-ink-50 font-mono uppercase tracking-[0.1em]">
                            {t.client.name}
                          </div>
                        ) : null}
                        {t.assignee ? (
                          <div className="text-[10px] text-ink-50 mt-1">@ {t.assignee.name ?? 'Unnamed'}</div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {TASK_STATUSES.filter((s) => s !== t.status).map((s) => (
                            <button
                              key={s}
                              onClick={() => handleSetStatus(t.id, s)}
                              className="text-[9px] font-mono uppercase tracking-[0.08em] px-1.5 py-0.5 border border-line hover:bg-ink hover:text-cream transition-colors"
                            >
                              → {TASK_STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Button variant="copper" onClick={() => setShowNew(true)}>
        + New task
      </Button>

      {showNew ? (
        <NewTaskModal
          workspaceSlug={workspaceSlug}
          team={team}
          projects={projects}
          clients={clients}
          onClose={() => setShowNew(false)}
        />
      ) : null}

      {editing ? (
        <EditTaskModal
          workspaceSlug={workspaceSlug}
          task={{
            id: editing.id,
            title: editing.title,
            description: editing.description,
            priority: editing.priority,
            dueDate: editing.dueDate ? editing.dueDate.toISOString() : null,
            assigneeId: editing.assignee?.id ?? null,
            projectId: editing.project?.id ?? null,
            clientId: editing.client?.id ?? null,
          }}
          team={team}
          projects={projects}
          clients={clients}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
