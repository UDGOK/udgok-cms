/**
 * ScheduleTab — the project schedule / Gantt view.
 *
 * Shows: schedule progress bar (with off-track warning), the
 * 2D Gantt chart, and (when there are scheduled tasks) the
 * 3D timeline visualization. Tasks without any date info are
 * filtered out of the Gantt.
 *
 * Extracted from page.tsx as part of the Aug 2026
 * project-page refactor. Pure server component.
 */

import { GanttChart, type GanttTask } from '@/components/workspace/GanttChart';
import { ThreeDGanttViewer } from '@/components/3d/ThreeDGanttViewer';
import type { computeProjectCompletion } from '@/lib/projects/insights';
import type { ProjectData } from '../page-types';
import { fmtDate } from '@/lib/format/currency';

export function ScheduleTab({
  project,
  workspace,
  completion,
}: {
  project: ProjectData;
  workspace: string;
  completion: ReturnType<typeof computeProjectCompletion>;
}) {
  // Only show tasks that have any date info on the Gantt
  const ganttTasks = project.tasks
    .filter((t) => t.startDate || t.endDate || t.dueDate)
    .map<GanttTask>((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as GanttTask['status'],
      priority: t.priority as GanttTask['priority'],
      startDate: t.startDate,
      endDate: t.endDate,
      dueDate: t.dueDate,
    }));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-black text-xl md:text-2xl tracking-tight">Schedule</h2>
          <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {ganttTasks.length} scheduled task{ganttTasks.length === 1 ? '' : 's'}
            {completion.daysTotal ? ` · ${completion.daysElapsed ?? 0} of ${completion.daysTotal} days elapsed` : ''}
          </p>
        </div>
      </div>

      {/* Schedule progress bar */}
      {completion.daysTotal ? (
        <div className="bg-paper border-2 border-line p-5 mb-5">
          <div className="flex items-center justify-between text-[12px] font-extrabold mb-2">
            <span>Schedule progress</span>
            <span>
              Day {completion.daysElapsed} of {completion.daysTotal} ({completion.schedule}%)
            </span>
          </div>
          <div className="h-2 bg-cream-2">
            <div
              className={`h-full ${
                completion.onTrack === false ? 'bg-error' : 'bg-success'
              }`}
              style={{ width: `${Math.min(100, completion.schedule)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-2">
            <span>{project.startDate ? fmtDate(project.startDate) : '—'}</span>
            <span>{project.endDate ? fmtDate(project.endDate) : '—'}</span>
          </div>
        </div>
      ) : (
        <div className="bg-paper border-2 border-line p-5 mb-5 text-[13px] text-ink-50">
          No start/end dates set. Edit project details to add them.
        </div>
      )}

      <GanttChart
        workspaceSlug={workspace}
        projectName={project.name}
        projectStart={project.startDate}
        projectEnd={project.endDate}
        tasks={ganttTasks}
      />

      {/* 3D timeline — drag to orbit, scroll to zoom */}
      {ganttTasks.length > 0 ? (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div>
              <h2 className="font-black text-lg tracking-tight flex items-center gap-2">
                <span aria-hidden>🧊</span> Timeline
              </h2>
              <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
                Tasks along the project window · orange line marks today
              </p>
            </div>
          </div>
          <ThreeDGanttViewer
            projectName={project.name}
            projectStart={project.startDate}
            projectEnd={project.endDate}
            tasks={ganttTasks}
            height={520}
          />
        </div>
      ) : null}
    </div>
  );
}
