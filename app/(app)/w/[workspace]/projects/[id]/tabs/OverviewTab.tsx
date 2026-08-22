/**
 * OverviewTab — the default tab on the project page.
 *
 * Shows the financial pulse (4-cell KPI), the completion
 * breakdown (4-cell percentage), quick-action cards, weather
 * + jurisdiction, the seed-from-estimate banner (only for
 * old converted projects), recent photos strip, the 3D
 * completion ring, and the SOV summary table.
 *
 * Extracted from page.tsx as part of the Aug 2026
 * project-page refactor. Pure server component, owns no
 * state — receives everything from the page.
 */

import Link from 'next/link';
import { NewDivisionForm } from '../NewDivisionForm';
import { DivisionRow } from '../DivisionRow';
import { WeatherWidget } from '../WeatherWidget';
import { JurisdictionCard } from '../JurisdictionCard';
import { SeedFromEstimateButton } from '../SeedFromEstimateButton';
import { RecentPhotosStrip } from '../RecentPhotosStrip';
import { ProgressRing3DViewer } from '@/components/3d/ProgressRing3DViewer';
import { computeBilledByDivision, computeTotalBudget, computeTotalBilled } from '@/lib/projects/sov-totals';
import type { listProjectPhotos } from '@/lib/photos/queries';
import type { computeProjectCompletion } from '@/lib/projects/insights';
import { CompletionCell } from './CompletionCell';
import type { ProjectData } from '../page-types';

export function OverviewTab({
  projectId,
  workspace,
  project,
  photoCounts,
  recentPhotos,
  totalPhotoCount,
  completion,
}: {
  projectId: string;
  workspace: string;
  project: ProjectData;
  photoCounts: { ROUGH_IN: number; FINAL: number };
  recentPhotos: Awaited<ReturnType<typeof listProjectPhotos>>;
  totalPhotoCount: number;
  completion: ReturnType<typeof computeProjectCompletion>;
}) {
  // Sum each division's billed amount from pay-app LINES (not
  // the parent pay app's `totalThisDraw`). This matches the
  // per-row calculation below so the TOTALS row always adds up.
  // We exclude DRAFT (not yet requested) and SUPERSEDED (replaced
  // by a newer draw) — those shouldn't count as "billed" against
  // the client yet.
  //
  // SOV math — see lib/projects/sov-totals.ts. The previous
  // version used `payApp.status` filter on the parent pay
  // app and summed `totalThisDraw`, which didn't match the
  // per-row aggregation and produced the TOTALS=0 bug when
  // the only pay app was DRAFT.
  const billedByDivision = computeBilledByDivision(
    project.divisions,
    project.payApps,
  );
  const totalBudget = computeTotalBudget(project.divisions);
  const totalBilled = computeTotalBilled(billedByDivision);
  const totalPhotos = photoCounts.ROUGH_IN + photoCounts.FINAL;
  const base = `/w/${workspace}/projects/${projectId}`;

  return (
    <div>
      {/* 4-cell KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-line bg-paper mb-6">
        <div className="p-4 md:p-5 border-r border-b md:border-b-0 border-line">
          <div className="label-mono">Contract</div>
          <div className="font-black text-xl md:text-2xl">${completion.contractValue.toLocaleString()}</div>
        </div>
        <div className="p-4 md:p-5 border-b md:border-b-0 border-line">
          <div className="label-mono">Billed</div>
          <div className="font-black text-xl md:text-2xl text-success">${completion.totalBilled.toLocaleString()}</div>
          <div className="text-[10px] font-mono text-ink-50 mt-1">
            {completion.financial}% of contract
          </div>
        </div>
        <div className="p-4 md:p-5 border-r border-line">
          <div className="label-mono">Remaining</div>
          <div className="font-black text-xl md:text-2xl text-orange-d">${completion.remaining.toLocaleString()}</div>
        </div>
        <div className="p-4 md:p-5">
          <div className="label-mono">Days left</div>
          <div className="font-black text-xl md:text-2xl">
            {completion.daysRemaining !== null ? completion.daysRemaining : '—'}
          </div>
          {completion.daysTotal !== null ? (
            <div className="text-[10px] font-mono text-ink-50 mt-1">
              of {completion.daysTotal} day timeline
            </div>
          ) : null}
        </div>
      </div>

      {/* Completion breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <CompletionCell
          label="Financial"
          value={completion.financial}
          sub={`$${completion.totalBilled.toLocaleString()} billed`}
        />
        <CompletionCell
          label="Tasks"
          value={completion.tasks}
          sub={`${completion.tasksDone} of ${completion.tasksTotal} done`}
        />
        <CompletionCell
          label="Schedule"
          value={completion.schedule}
          sub={
            completion.daysElapsed !== null
              ? `Day ${completion.daysElapsed} of ${completion.daysTotal ?? '?'}`
              : 'no dates set'
          }
          warn={completion.onTrack === false}
        />
        <CompletionCell
          label="Subs"
          value={completion.subs}
          sub={`${completion.subsActive} of ${completion.subsTotal} active`}
        />
      </div>

      {/* Quick-action cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Link
          href={`${base}/photos`}
          className="bg-paper border-2 border-line hover:border-ink p-4 transition-colors"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {'// Photos'}
          </div>
          <div className="text-[13px] font-extrabold mt-1">
            {totalPhotos} photo{totalPhotos === 1 ? '' : 's'}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d mt-2">
            View gallery →
          </div>
        </Link>
        <Link
          href={`${base}?tab=tasks`}
          className="bg-paper border-2 border-line hover:border-ink p-4 transition-colors"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {'// Tasks'}
          </div>
          <div className="text-[13px] font-extrabold mt-1">
            {project.tasks.length} task{project.tasks.length === 1 ? '' : 's'}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d mt-2">
            Manage tasks →
          </div>
        </Link>
        <Link
          href={`${base}?tab=permits`}
          className="bg-paper border-2 border-line hover:border-ink p-4 transition-colors"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {'// Permits'}
          </div>
          <div className="text-[13px] font-extrabold mt-1">
            {project.address ? 'Track permits' : 'Add address'}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d mt-2">
            View permits →
          </div>
        </Link>
        <Link
          href={`${base}?tab=ai`}
          className="bg-paper border-2 border-line hover:border-ink p-4 transition-colors"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {'// AI insights'}
          </div>
          <div className="text-[13px] font-extrabold mt-1">
            Smart analysis
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d mt-2">
            Open AI board →
          </div>
        </Link>
      </div>

      {/* Weather + Permit office (location-aware) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mb-6">
        <WeatherWidget project={project} />
        <JurisdictionCard project={project} />
      </div>

      {/* Seed-from-estimate banner — only for projects
          that were converted from an estimate before
          the convert action learned to seed
          ProjectDivision + Task rows from the line
          items. The user can click the button to
          retroactively populate the schedule of
          values and tasks. */}
      {project.sourceEstimate && project.sourceEstimate.lineItems.length > 0 && project.divisions.length === 0 ? (
        <div className="mb-6">
          <SeedFromEstimateButton
            workspaceSlug={workspace}
            projectId={projectId}
            hasSourceEstimate
          />
        </div>
      ) : null}

      {/* Recent photos — strip with click-to-enlarge */}
      <div className="mb-6">
        <RecentPhotosStrip
          workspaceSlug={workspace}
          projectId={projectId}
          photos={recentPhotos}
          totalCount={totalPhotoCount}
        />
      </div>

      {/* 3D Progress Ring — overall completion with sub-metric strip */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h3 className="font-black text-lg tracking-tight flex items-center gap-2">
              <span aria-hidden>⭕</span> Completion
            </h3>
            <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
              Overall % and the four sub-metrics that drive it
            </p>
          </div>
        </div>
        <ProgressRing3DViewer
          percent={completion.overall}
          financial={completion.financial}
          tasks={completion.tasks}
          subs={completion.subs}
          schedule={completion.schedule}
          status={project.status}
          height={380}
          title={project.name}
        />
      </div>

      {/* SOV summary */}
      <div className="bg-paper border-2 border-line mb-6">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-line flex items-center justify-between">
          <div>
            <div className="label-eyebrow">{'// Schedule of values'}</div>
            <div className="text-[11px] text-ink-50 mt-0.5">
              ${totalBudget.toLocaleString()} across {project.divisions.length} division{project.divisions.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        {project.divisions.length === 0 ? (
          <div className="px-6 py-12 text-center text-ink-50">
            No divisions yet. Add your first line item below.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr>
                  {['Code', 'Trade', 'Subcontractor', 'Budget', 'Billed', 'Remaining', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-3 md:px-5 py-3 bg-cream-2 border-b border-line text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {project.divisions.map((d) => {
                  // billedByDivision is computed above so this
                  // matches the TOTALS row exactly. Same set of
                  // pay-app statuses is included.
                  const billed = billedByDivision[d.id] ?? 0;
                  const linkedSub = d.subLinks?.[0]?.assignment?.subcontractor;
                  return (
                    <DivisionRow
                      key={d.id}
                      workspaceSlug={workspace}
                      projectId={projectId}
                      division={{
                        id: d.id,
                        code: d.code,
                        trade: d.trade,
                        budget: Number(d.budget),
                        subcontractorName: d.subcontractorName,
                        linkedSub: linkedSub ?? null,
                      }}
                      billed={billed}
                    />
                  );
                })}
                <tr className="bg-ink text-cream">
                  <td colSpan={3} className="px-3 md:px-5 py-3 font-extrabold uppercase text-[11px] tracking-[0.12em]">Totals</td>
                  <td className="px-3 md:px-5 py-3 font-black text-lg">${totalBudget.toLocaleString()}</td>
                  <td className="px-3 md:px-5 py-3 font-black text-lg">${totalBilled.toLocaleString()}</td>
                  <td className="px-3 md:px-5 py-3 font-black text-lg">${(totalBudget - totalBilled).toLocaleString()}</td>
                  <td className="px-3 md:px-5 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 md:p-6 border-t border-line">
          <NewDivisionForm workspaceSlug={workspace} projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
