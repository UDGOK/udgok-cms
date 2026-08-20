'use client';

/**
 * TimesheetsView — the workspace-wide weekly grid.
 *
 * Client component for the week navigation. The
 * initial grid is rendered server-side and hydrated;
 * week changes re-fetch the page (we use a hard
 * navigation with `router.push` + the new `week`
 * query param).
 *
 * Sections:
 *   - Open check-ins banner (red, with quick close)
 *   - Employees (rows)
 *   - Subs (rows)
 *
 * Each cell: hours for that day, click to drill
 * down to the per-person detail for that day.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { dayLabel, formatHours } from '@/lib/timesheets/hours';
import { closeCheckInEventAction } from '@/lib/timesheets/actions';
import type { WeeklyGrid } from '@/lib/timesheets/queries';
import type { OpenCheckIn } from './types';

interface TimesheetsViewProps {
  workspaceSlug: string;
  weekStart: string; // ISO
  days: string[]; // ISO x 7
  employees: WeeklyGrid['employees'];
  subs: WeeklyGrid['subs'];
  employeeTotalHours: number;
  subTotalHours: number;
  openCheckIns: OpenCheckIn[];
  canEdit: boolean;
}

export function TimesheetsView({
  workspaceSlug,
  weekStart,
  days,
  employees,
  subs,
  employeeTotalHours,
  subTotalHours,
  openCheckIns,
  canEdit,
}: TimesheetsViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(iso: string) {
    startTransition(() => {
      router.push(`/w/${workspaceSlug}/timesheets?week=${iso}`);
    });
  }

  function shiftWeek(days: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + days);
    navigate(d.toISOString().slice(0, 10));
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header / week nav */}
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
            Timesheets
          </div>
          <h1 className="text-2xl font-black mt-0.5">
            Week of {new Date(weekStart).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
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
            onClick={() => navigate(new Date().toISOString().slice(0, 10))}
            disabled={pending}
            className="px-2.5 py-1.5 border border-line text-ink-70 hover:border-ink hover:text-ink text-[10px] font-extrabold uppercase tracking-[0.1em] disabled:opacity-50"
          >
            This week
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

      {/* Open check-ins banner */}
      {openCheckIns.length > 0 ? (
        <OpenCheckInsBanner
          workspaceSlug={workspaceSlug}
          entries={openCheckIns}
          canEdit={canEdit}
        />
      ) : null}

      {/* Employees section */}
      <Section
        title="Employees"
        rows={employees}
        totalLabel={formatHours(employeeTotalHours)}
        workspaceSlug={workspaceSlug}
        days={days}
        kind="employee"
      />

      {/* Subs section */}
      <Section
        title="Subcontractors"
        rows={subs}
        totalLabel={formatHours(subTotalHours)}
        workspaceSlug={workspaceSlug}
        days={days}
        kind="sub"
      />
    </div>
  );
}

function Section({
  title,
  rows,
  totalLabel,
  workspaceSlug,
  days,
  kind,
}: {
  title: string;
  rows: WeeklyGrid['employees'];
  totalLabel: string;
  workspaceSlug: string;
  days: string[];
  kind: 'employee' | 'sub';
}) {
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[14px] font-extrabold uppercase tracking-[0.1em]">
          {title}
        </h2>
        <div className="text-[11px] font-mono text-ink-50">
          {rows.length} {rows.length === 1 ? 'person' : 'people'} · {totalLabel}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="bg-cream-2 border border-line p-6 text-center">
          <div className="text-[12px] text-ink-50 font-mono uppercase tracking-[0.1em]">
            No {kind === 'employee' ? 'employee' : 'sub'} check-ins this week
          </div>
        </div>
      ) : (
        <div className="bg-paper border-2 border-ink overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-cream border-b-2 border-ink">
                <th className="text-left px-3 py-2 font-extrabold uppercase tracking-[0.1em] text-[10px] text-ink-50">
                  {kind === 'employee' ? 'Employee' : 'Sub'}
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className="text-right px-2 py-2 font-extrabold uppercase tracking-[0.1em] text-[10px] text-ink-50"
                  >
                    {dayLabel(new Date(d), 'short')}
                    <div className="text-[9px] text-ink-30 font-mono">
                      {dayLabel(new Date(d), 'date')}
                    </div>
                  </th>
                ))}
                <th className="text-right px-3 py-2 font-extrabold uppercase tracking-[0.1em] text-[10px] text-ink-50">
                  Total
                </th>
                <th className="text-right px-3 py-2 font-extrabold uppercase tracking-[0.1em] text-[10px] text-ink-50 w-16">
                  Open
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.kind}-${row.id}`}
                  className="border-b border-line last:border-b-0 hover:bg-cream-2"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={
                        row.kind === 'employee'
                          ? `/w/${workspaceSlug}/timesheets/employee/${row.id}`
                          : `/w/${workspaceSlug}/timesheets/sub/${row.id}`
                      }
                      className="block"
                    >
                      <div className="font-extrabold text-ink">{row.name}</div>
                      {row.secondaryLabel ? (
                        <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
                          {row.secondaryLabel}
                        </div>
                      ) : null}
                    </Link>
                  </td>
                  {row.dailyHours.map((h, i) => (
                    <td key={i} className="text-right px-2 py-2 font-mono">
                      {h === null ? (
                        <span className="text-ink-30">·</span>
                      ) : (
                        <span className={h > 0 ? 'text-ink' : 'text-ink-30'}>
                          {formatHours(h)}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="text-right px-3 py-2 font-extrabold text-ink">
                    {formatHours(row.totalHours)}
                  </td>
                  <td className="text-right px-3 py-2 font-mono">
                    {row.openCount > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 bg-warning/15 text-warning text-[10px] font-extrabold">
                        {row.openCount}
                      </span>
                    ) : (
                      <span className="text-ink-30">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OpenCheckInsBanner({
  workspaceSlug,
  entries,
  canEdit,
}: {
  workspaceSlug: string;
  entries: OpenCheckIn[];
  canEdit: boolean;
}) {
  return (
    <div className="mb-5 border-2 border-warning bg-warning/10">
      <div className="px-3 py-2 border-b-2 border-warning/30 flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-warning font-extrabold">
          ⚠ {entries.length} open check-in{entries.length === 1 ? '' : 's'} need{entries.length === 1 ? 's' : ''} action
        </div>
        <span className="text-[10px] text-ink-50 font-mono">
          Forgot to clock out? Close manually below.
        </span>
      </div>
      <ul className="divide-y divide-warning/30">
        {entries.map((e) => (
          <li
            key={e.id}
            className="px-3 py-2 flex items-center justify-between gap-2"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-extrabold text-ink truncate">
                {e.whoName}
              </div>
              <div className="text-[10px] font-mono text-ink-50">
                {e.projectName}
                {e.siteLabel ? ` · ${e.siteLabel}` : ''}
                {' · '}
                Open for {e.hoursOpen}h
              </div>
            </div>
            {canEdit ? (
              <form
                action={async (fd) => {
                  await closeCheckInEventAction(workspaceSlug, undefined, fd);
                }}
              >
                <input type="hidden" name="eventId" value={e.id} />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-warning text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-warning hover:bg-warning/90"
                >
                  Close now
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
