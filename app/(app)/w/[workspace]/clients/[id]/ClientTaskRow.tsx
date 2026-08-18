'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface ClientTask {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueDate: Date | null;
}

const STATUS_BG: Record<ClientTask['status'], string> = {
  TODO: 'bg-ink-30 text-ink',
  IN_PROGRESS: 'bg-orange text-paper',
  BLOCKED: 'bg-error text-paper',
  DONE: 'bg-success text-paper',
  CANCELLED: 'bg-ink-30 text-ink-50 line-through',
};

const PRIORITY_BAR: Record<ClientTask['priority'], string> = {
  LOW: 'bg-ink-30',
  NORMAL: 'bg-ink',
  HIGH: 'bg-warning',
  URGENT: 'bg-error',
};

export function ClientTaskRow({
  clientId,
  task,
}: {
  clientId: string;
  task: ClientTask;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
      await fetch(`/api/clients/${clientId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    });
  }

  const overdue = task.dueDate && task.dueDate.getTime() < Date.now() && task.status !== 'DONE';

  return (
    <li className="px-5 py-3 flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="flex-shrink-0 w-5 h-5 border-2 border-ink flex items-center justify-center bg-paper hover:bg-cream-2 disabled:opacity-50"
        title={task.status === 'DONE' ? 'Mark as not done' : 'Mark as done'}
      >
        {task.status === 'DONE' ? (
          <span className="text-ink text-[14px] font-black leading-none">✓</span>
        ) : null}
      </button>
      <div className={`w-1 h-8 flex-shrink-0 ${PRIORITY_BAR[task.priority]}`} title={task.priority} />
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-extrabold ${task.status === 'DONE' ? 'line-through text-ink-50' : 'text-ink'} truncate`}>
          {task.title}
        </div>
        <div className="font-mono text-[10px] text-ink-50 tracking-[0.1em] uppercase mt-0.5 flex items-center gap-2">
          <span className={`px-1.5 py-0.5 ${STATUS_BG[task.status]}`}>{task.status}</span>
          {task.dueDate ? (
            <span className={overdue ? 'text-error font-extrabold' : ''}>
              Due {new Date(task.dueDate).toLocaleDateString()}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
