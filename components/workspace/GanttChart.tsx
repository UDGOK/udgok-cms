'use client';

import Link from 'next/link';
import { useMemo } from 'react';

export interface GanttTask {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  startDate: Date | null;
  endDate: Date | null;
  dueDate: Date | null;
}

export interface GanttProps {
  workspaceSlug: string;
  projectName: string;
  projectStart: Date | null;
  projectEnd: Date | null;
  tasks: GanttTask[];
}

const STATUS_FILL: Record<GanttTask['status'], string> = {
  TODO: 'bg-ink/40',
  IN_PROGRESS: 'bg-orange',
  BLOCKED: 'bg-error',
  DONE: 'bg-success',
  CANCELLED: 'bg-ink/20 line-through',
};

const STATUS_LABEL: Record<GanttTask['status'], string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const DAY = 24 * 60 * 60 * 1000;

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay()); // back to Sunday
  return r;
}

function fmtShort(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function GanttChart({
  workspaceSlug,
  projectName,
  projectStart,
  projectEnd,
  tasks,
}: GanttProps) {
  // Compute timeline: project start/end if set, otherwise derive from tasks
  // (min of task starts, max of task ends/dueDates), otherwise fall back
  // to today ± 2 weeks.
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const timeline = useMemo(() => {
    let min: Date | null = projectStart ? new Date(projectStart) : null;
    let max: Date | null = projectEnd ? new Date(projectEnd) : null;
    for (const t of tasks) {
      const s = t.startDate ? new Date(t.startDate) : t.dueDate ? new Date(t.dueDate) : null;
      const e = t.endDate ? new Date(t.endDate) : t.dueDate ? new Date(t.dueDate) : null;
      if (s && (!min || s < min)) min = s;
      if (e && (!max || e > max)) max = e;
    }
    if (!min) min = new Date(today.getTime() - 14 * DAY);
    if (!max) max = new Date(today.getTime() + 28 * DAY);
    // Pad 3 days either side
    min = new Date(min.getTime() - 3 * DAY);
    max = new Date(max.getTime() + 3 * DAY);
    return { start: startOfWeek(min), end: startOfWeek(new Date(max.getTime() + 7 * DAY)) };
  }, [projectStart, projectEnd, tasks, today]);

  const totalDays = Math.max(1, Math.round((timeline.end.getTime() - timeline.start.getTime()) / DAY));
  const dayWidth = Math.max(20, Math.min(56, Math.floor(900 / totalDays))); // px per day
  const weeks: Date[] = [];
  {
    const cur = new Date(timeline.start);
    while (cur <= timeline.end) {
      weeks.push(new Date(cur));
      cur.setDate(cur.getDate() + 7);
    }
  }

  function leftFor(d: Date): number {
    return Math.round(((d.getTime() - timeline.start.getTime()) / DAY) * dayWidth);
  }
  function widthFor(a: Date, b: Date): number {
    return Math.max(dayWidth / 2, Math.round(((b.getTime() - a.getTime()) / DAY) * dayWidth));
  }

  const tasksWithRange = tasks.map((t) => {
    const start = t.startDate ? new Date(t.startDate) : t.dueDate ? new Date(t.dueDate) : null;
    const end = t.endDate
      ? new Date(t.endDate)
      : t.dueDate
        ? new Date(t.dueDate)
        : start
          ? new Date(start.getTime() + DAY)
          : null;
    return { task: t, start, end };
  });

  // Compute a "today" marker
  const todayX = leftFor(today);

  return (
    <div className="bg-paper border-2 border-line">
      <div className="px-6 py-4 border-b border-line flex items-center justify-between">
        <div>
          <div className="label-eyebrow">{'// Schedule'}</div>
          <div className="text-[11px] text-ink-50 mt-0.5">
            {projectStart || projectEnd
              ? `Project: ${projectStart ? fmtShort(new Date(projectStart)) : '?'} → ${projectEnd ? fmtShort(new Date(projectEnd)) : '?'}`
              : 'Set project start/end to anchor the timeline'}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-orange" /> In Progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-success" /> Done
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-error" /> Blocked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-ink/40" /> To Do
          </span>
        </div>
      </div>

      {tasksWithRange.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-ink-50 mb-4">No tasks scheduled yet.</p>
          <Link
            href={`/w/${workspaceSlug}/tasks`}
            className="inline-block px-5 py-3 bg-ink text-cream text-xs font-extrabold uppercase tracking-[0.12em] hover:bg-orange transition-colors"
          >
            + Add tasks to build the schedule
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Week header */}
            <div className="flex border-b border-line bg-cream-2 sticky top-0 z-10">
              <div className="w-[240px] flex-shrink-0 px-5 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50 border-r border-line">
                Task
              </div>
              <div className="flex" style={{ width: totalDays * dayWidth }}>
                {weeks.map((w) => (
                  <div
                    key={w.toISOString()}
                    style={{ width: 7 * dayWidth }}
                    className="px-2 py-2 text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 border-r border-line/50"
                  >
                    {w.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                ))}
              </div>
            </div>

            {/* Project header bar */}
            {projectStart || projectEnd ? (
              <div className="flex border-b border-line bg-ink/5">
                <div className="w-[240px] flex-shrink-0 px-5 py-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50 border-r border-line">
                  {projectName}
                </div>
                <div className="relative" style={{ width: totalDays * dayWidth, height: 40 }}>
                  {projectStart && projectEnd ? (
                    <div
                      style={{
                        left: leftFor(new Date(projectStart)),
                        width: widthFor(new Date(projectStart), new Date(projectEnd)),
                      }}
                      className="absolute top-2 h-6 bg-ink"
                      title={`${projectName} • ${fmtShort(new Date(projectStart))} → ${fmtShort(new Date(projectEnd))}`}
                    >
                      <div className="px-2 py-1 text-cream text-[9px] font-extrabold uppercase tracking-[0.1em] truncate">
                        Project span
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Task rows */}
            {tasksWithRange.map(({ task, start, end }) => {
              if (!start || !end) return null;
              const left = leftFor(start);
              const width = widthFor(start, end);
              const isOverdue =
                end < today && task.status !== 'DONE' && task.status !== 'CANCELLED';
              return (
                <div
                  key={task.id}
                  className="flex border-b border-line-soft last:border-0 hover:bg-cream-2/50 group"
                >
                  <div className="w-[240px] flex-shrink-0 px-5 py-3 border-r border-line">
                    <div className="font-extrabold text-[13px] truncate">{task.title}</div>
                    <div className="text-[10px] text-ink-50 font-mono uppercase tracking-[0.1em] mt-0.5">
                      {STATUS_LABEL[task.status]}
                      {task.priority === 'URGENT' ? ' • URGENT' : task.priority === 'HIGH' ? ' • HIGH' : ''}
                      {isOverdue ? ' • OVERDUE' : ''}
                    </div>
                  </div>
                  <div className="relative" style={{ width: totalDays * dayWidth, height: 40 }}>
                    <div
                      style={{ left, width }}
                      className={`absolute top-2 h-6 ${STATUS_FILL[task.status]} flex items-center px-2 cursor-pointer`}
                      title={`${task.title} • ${fmtShort(start)} → ${fmtShort(end)}`}
                    >
                      <span className="text-paper text-[9px] font-extrabold uppercase tracking-[0.1em] truncate">
                        {STATUS_LABEL[task.status]}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Today marker */}
            {todayX >= 0 && todayX <= totalDays * dayWidth ? (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: 240 + todayX,
                  width: 2,
                  height: '100%',
                  background: 'repeating-linear-gradient(to bottom, #f06a2d 0 4px, transparent 4px 8px)',
                }}
              >
                <span
                  className="absolute -top-5 -left-6 text-[9px] font-mono uppercase tracking-[0.1em] text-orange font-black"
                >
                  Today
                </span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
