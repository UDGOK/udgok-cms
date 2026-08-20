'use client';

/**
 * PersonDetailView — shared layout for the
 * per-employee and per-sub detail pages.
 *
 * Renders the week header + daily breakdown + a
 * list of events for the week. The "Edit" button
 * on each event row opens the EditEventModal.
 *
 * The "Download PDF" button links to the API
 * route. The "View project" links go to the
 * project's check-ins panel.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { dayLabel, formatHours } from '@/lib/timesheets/hours';
import { closeCheckInEventAction } from '@/lib/timesheets/actions';
import { EditEventModal } from './EditEventModal';
import { TimesheetActions } from './TimesheetActions';
import type { WeeklyTimesheetStatus } from '@prisma/client';

interface EventDto {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string | null;
  siteLabel: string | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  note: string | null;
  hours: number | null;
  isOpen: boolean;
  isEdited: boolean;
  editedByName: string | null;
  editedAt: string | null;
  editNote: string | null;
  computedHours: number | null;
  editedHours: number | null;
}

interface TimesheetStatusDto {
  status: WeeklyTimesheetStatus;
  submittedByName: string | null;
  submittedAt: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
  rejectNote: string | null;
  totalHoursAtApproval: number | null;
  isLocked: boolean;
}

interface PersonDetailViewProps {
  workspaceSlug: string;
  personId: string;
  kind: 'employee' | 'sub';
  name: string;
  secondaryLabel: string | null;
  weekStart: string;
  days: string[];
  events: EventDto[];
  totalHours: number;
  openCount: number;
  totalEvents: number;
  canEdit: boolean;
  // Approval workflow data. Null when no
  // WeeklyTimesheet row exists yet (treated as
  // DRAFT in the UI).
  timesheet: TimesheetStatusDto | null;
  canSubmit: boolean;
  canApprove: boolean;
}

export function PersonDetailView({
  workspaceSlug,
  personId,
  kind,
  name,
  secondaryLabel,
  weekStart,
  days,
  events,
  totalHours,
  openCount,
  totalEvents,
  canEdit,
  timesheet,
  canSubmit,
  canApprove,
}: PersonDetailViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<EventDto | null>(null);

  function buildHref(week: string) {
    return kind === 'employee'
      ? `/w/${workspaceSlug}/timesheets/employee/${personId}?week=${week}`
      : `/w/${workspaceSlug}/timesheets/sub/${personId}?week=${week}`;
  }

  function shiftWeek(days: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + days);
    startTransition(() => {
      router.push(buildHref(d.toISOString().slice(0, 10)));
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
      <div className="mb-4">
        <Link
          href={`/w/${workspaceSlug}/timesheets?week=${weekStart}`}
          className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
        >
          ← Back to all timesheets
        </Link>
      </div>

      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
            {kind === 'employee' ? 'Employee timesheet' : 'Subcontractor timesheet'}
          </div>
          <h1 className="text-2xl font-black mt-0.5">{name}</h1>
          {secondaryLabel ? (
            <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-0.5">
              {secondaryLabel}
            </div>
          ) : null}
          <div className="text-[12px] text-ink-70 mt-1">
            Week of {new Date(weekStart).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={
              kind === 'employee'
                ? `/api/timesheets/employee/${personId}/pdf?week=${weekStart}&slug=${workspaceSlug}`
                : `/api/timesheets/sub/${personId}/pdf?week=${weekStart}&slug=${workspaceSlug}`
            }
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-ink text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-ink hover:bg-orange hover:border-orange inline-flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download PDF
          </a>
          <a
            href={
              kind === 'employee'
                ? `/api/timesheets/employee/${personId}/csv?week=${weekStart}&slug=${workspaceSlug}`
                : `/api/timesheets/sub/${personId}/csv?week=${weekStart}&slug=${workspaceSlug}`
            }
            className="px-3 py-1.5 border-2 border-ink text-ink text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-paper inline-flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            CSV
          </a>
          <button
            type="button"
            onClick={() => shiftWeek(-7)}
            disabled={pending}
            className="px-2.5 py-1.5 border border-line text-ink-70 hover:border-ink hover:text-ink text-[11px] font-extrabold uppercase tracking-[0.1em] disabled:opacity-50"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(7)}
            disabled={pending}
            className="px-2.5 py-1.5 border border-line text-ink-70 hover:border-ink hover:text-ink text-[11px] font-extrabold uppercase tracking-[0.1em] disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Status + actions */}
      <div className="mb-4 bg-cream-2 border-2 border-line p-3 flex items-start gap-3 flex-wrap">
        <StatusBadge timesheet={timesheet} />
        <ApprovalAudit timesheet={timesheet} totalHours={totalHours} />
        <div className="ml-auto">
          <TimesheetActions
            workspaceSlug={workspaceSlug}
            personKind={kind}
            personId={personId}
            weekStart={weekStart}
            status={timesheet?.status ?? null}
            canSubmit={canSubmit}
            canApprove={canApprove}
          />
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <Chip label="Total" value={formatHours(totalHours)} accent />
        <Chip label="Events" value={String(totalEvents)} />
        {openCount > 0 ? (
          <Chip label="Open" value={String(openCount)} warning />
        ) : null}
      </div>

      {/* Day summary */}
      <div className="bg-paper border-2 border-ink mb-4 overflow-x-auto">
        <div className="grid grid-cols-7 divide-x divide-line">
          {days.map((d) => {
            const dayEvents = events.filter(
              (e) =>
                new Date(e.checkedInAt).toDateString() === new Date(d).toDateString(),
            );
            const dayHours = dayEvents.reduce(
              (sum, e) => sum + (e.hours ?? 0),
              0,
            );
            return (
              <div key={d} className="px-2 py-2.5 min-w-0">
                <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-ink-50">
                  {dayLabel(new Date(d), 'short')}
                </div>
                <div className="text-[10px] text-ink-50 font-mono">
                  {dayLabel(new Date(d), 'date')}
                </div>
                <div className="text-[14px] font-extrabold text-ink mt-0.5">
                  {dayHours > 0 ? formatHours(Math.round(dayHours * 100) / 100) : '—'}
                </div>
                <div className="text-[9px] font-mono text-ink-50 mt-0.5">
                  {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Events list */}
      {events.length === 0 ? (
        <div className="bg-cream-2 border border-line p-8 text-center">
          <div className="text-[12px] text-ink-50 font-mono uppercase tracking-[0.1em]">
            No check-ins this week
          </div>
        </div>
      ) : (
        <div className="bg-paper border-2 border-ink divide-y divide-line">
          {events.map((e) => (
            <EventRow
              key={e.id}
              event={e}
              workspaceSlug={workspaceSlug}
              canEdit={canEdit && !timesheet?.isLocked}
              onEdit={() => setEditing(e)}
            />
          ))}
        </div>
      )}

      {editing ? (
        <EditEventModal
          workspaceSlug={workspaceSlug}
          event={{
            id: editing.id,
            checkedInAt: editing.checkedInAt,
            checkedOutAt: editing.checkedOutAt,
            editedHours: editing.editedHours,
            editedByName: editing.editedByName,
            editedAt: editing.editedAt,
            editNote: editing.editNote,
            computedHours: editing.computedHours,
          }}
          readOnly={timesheet?.isLocked ?? false}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function EventRow({
  event,
  workspaceSlug,
  canEdit,
  onEdit,
}: {
  event: EventDto;
  workspaceSlug: string;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const [pending] = useTransition();
  return (
    <div className="px-3 py-2.5 flex items-center gap-3 hover:bg-cream-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Link
            href={`/w/${workspaceSlug}/projects/${event.projectId}/checkins`}
            className="font-extrabold text-ink text-[12px] hover:underline"
          >
            {event.projectName}
          </Link>
          {event.projectCode ? (
            <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
              {event.projectCode}
            </span>
          ) : null}
          {event.siteLabel ? (
            <span className="text-[10px] font-mono text-ink-50">
              · {event.siteLabel}
            </span>
          ) : null}
          {event.isOpen ? (
            <span className="px-1.5 py-0.5 bg-warning/15 text-warning text-[9px] font-extrabold uppercase tracking-[0.1em]">
              open
            </span>
          ) : null}
          {event.isEdited ? (
            <span className="px-1.5 py-0.5 bg-info/15 text-info text-[9px] font-extrabold uppercase tracking-[0.1em]">
              edited
            </span>
          ) : null}
        </div>
        <div className="text-[10px] font-mono text-ink-50 mt-0.5">
          {new Date(event.checkedInAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          {' → '}
          {event.checkedOutAt
            ? new Date(event.checkedOutAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
            : 'still on site'}
        </div>
        {event.note ? (
          <div className="text-[11px] text-ink-70 mt-1">{event.note}</div>
        ) : null}
        {event.editNote && event.isEdited ? (
          <div className="text-[10px] text-ink-50 mt-1 italic">
            Note from {event.editedByName ?? 'admin'}: &ldquo;{event.editNote}&rdquo;
          </div>
        ) : null}
      </div>
      <div className="text-right shrink-0">
        <div className="text-[14px] font-extrabold text-ink">
          {formatHours(event.hours)}
        </div>
        {event.isEdited && event.computedHours !== null ? (
          <div className="text-[9px] font-mono text-ink-50 line-through">
            {formatHours(event.computedHours)}
          </div>
        ) : null}
      </div>
      {canEdit ? (
        <div className="flex items-center gap-1.5 shrink-0">
          {event.isOpen ? (
            <form
              action={async (fd) => {
                await closeCheckInEventAction(workspaceSlug, undefined, fd);
              }}
            >
              <input type="hidden" name="eventId" value={event.id} />
              <button
                type="submit"
                disabled={pending}
                className="px-2 py-1 bg-warning text-paper text-[9px] font-extrabold uppercase tracking-[0.12em] hover:bg-warning/90 disabled:opacity-50"
              >
                Close
              </button>
            </form>
          ) : null}
          <button
            type="button"
            onClick={onEdit}
            className="px-2 py-1 bg-cream border border-line text-ink-70 text-[9px] font-extrabold uppercase tracking-[0.12em] hover:border-ink hover:text-ink"
          >
            Edit
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Chip({
  label,
  value,
  accent,
  warning,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`
        inline-flex items-baseline gap-1.5 px-2.5 py-1 border
        ${accent ? 'border-ink bg-ink text-paper' : ''}
        ${warning ? 'border-warning bg-warning/10 text-warning' : ''}
        ${!accent && !warning ? 'border-line bg-cream text-ink' : ''}
      `}
    >
      <span className="text-[9px] font-mono uppercase tracking-[0.15em] opacity-70">
        {label}
      </span>
      <span className="text-[14px] font-extrabold">{value}</span>
    </div>
  );
}

function StatusBadge({ timesheet }: { timesheet: TimesheetStatusDto | null }) {
  const status = timesheet?.status ?? 'DRAFT';
  const palette: Record<string, { bg: string; fg: string; label: string }> = {
    DRAFT: { bg: 'bg-cream', fg: 'text-ink-70 border-line', label: 'Draft' },
    SUBMITTED: { bg: 'bg-info/10', fg: 'text-info border-info/40', label: 'Submitted' },
    APPROVED: { bg: 'bg-success/15', fg: 'text-success border-success/40', label: '✓ Approved' },
    REJECTED: { bg: 'bg-error/10', fg: 'text-error border-error/40', label: '✗ Rejected' },
  };
  const p = palette[status];
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-ink-50">
        Status
      </div>
      <span
        className={`inline-flex items-center px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] border-2 ${p.bg} ${p.fg}`}
      >
        {p.label}
      </span>
    </div>
  );
}

function ApprovalAudit({
  timesheet,
  totalHours,
}: {
  timesheet: TimesheetStatusDto | null;
  totalHours: number;
}) {
  if (!timesheet) return null;
  return (
    <div className="flex-1 min-w-0 text-[11px] font-mono text-ink-50 leading-relaxed">
      {timesheet.status === 'SUBMITTED' && timesheet.submittedByName ? (
        <div>
          Submitted by <span className="text-ink">{timesheet.submittedByName}</span>
          {timesheet.submittedAt ? ` on ${new Date(timesheet.submittedAt).toLocaleString()}` : ''}
        </div>
      ) : null}
      {timesheet.status === 'APPROVED' && timesheet.approvedByName ? (
        <div>
          Approved by <span className="text-success font-extrabold">{timesheet.approvedByName}</span>
          {timesheet.approvedAt ? ` on ${new Date(timesheet.approvedAt).toLocaleString()}` : ''}
          {timesheet.totalHoursAtApproval !== null ? (
            <span className="ml-1">
              ({timesheet.totalHoursAtApproval}h
              {Math.abs(timesheet.totalHoursAtApproval - totalHours) > 0.01 ? (
                <span className="text-ink-70"> — now {totalHours}h</span>
              ) : null}
              )
            </span>
          ) : null}
        </div>
      ) : null}
      {timesheet.status === 'REJECTED' && timesheet.rejectedByName ? (
        <div>
          <div>
            Rejected by <span className="text-error font-extrabold">{timesheet.rejectedByName}</span>
            {timesheet.rejectedAt ? ` on ${new Date(timesheet.rejectedAt).toLocaleString()}` : ''}
          </div>
          {timesheet.rejectNote ? (
            <div className="text-ink-70 mt-0.5">&ldquo;{timesheet.rejectNote}&rdquo;</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
