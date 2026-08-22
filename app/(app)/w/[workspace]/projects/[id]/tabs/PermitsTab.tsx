/**
 * PermitsTab — permits and inspections for the project.
 *
 * Two-column layout: permit cards on the left, jurisdiction
 * + weather pinned on the right. Each permit has full
 * inspection history via PermitCard.
 *
 * Extracted from page.tsx as part of the Aug 2026
 * project-page refactor. Pure server component.
 */

import { AddPermitForm } from '../AddPermitForm';
import { PermitCard } from '../PermitCard';
import { JurisdictionCard } from '../JurisdictionCard';
import { WeatherWidget } from '../WeatherWidget';
import type { summarizePermits } from '@/lib/permits/queries';
import type { ProjectData, PermitWithInspections } from '../page-types';

export function PermitsTab({
  projectId,
  workspace,
  project,
  permits,
  summary,
}: {
  projectId: string;
  workspace: string;
  project: ProjectData;
  permits: PermitWithInspections[];
  summary: ReturnType<typeof summarizePermits>;
}) {
  const suggestedJurisdiction = project.city ? `City of ${project.city}` : null;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-black text-xl md:text-2xl tracking-tight">Permits & inspections</h2>
          <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {permits.length} permit{permits.length === 1 ? '' : 's'}
            {summary.issued > 0 ? ` · ${summary.issued} issued` : ''}
            {summary.upcomingInspections > 0 ? ` · ${summary.upcomingInspections} upcoming` : ''}
            {summary.overdueInspections > 0 ? ` · ${summary.overdueInspections} OVERDUE` : ''}
          </p>
        </div>
        <AddPermitForm
          workspaceSlug={workspace}
          projectId={projectId}
          suggestedJurisdiction={suggestedJurisdiction}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 md:gap-4">
        <div>
          {permits.length === 0 ? (
            <div className="bg-paper border-2 border-line p-12 text-center text-ink-50">
              <p className="mb-2">No permits yet.</p>
              <p className="text-[12px]">
                Click &ldquo;+ Add permit&rdquo; to track building, electrical, plumbing, mechanical, or any other permit for this project.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {permits.map((p) => (
                <PermitCard
                  key={p.id}
                  workspaceSlug={workspace}
                  projectId={projectId}
                  permit={p as unknown as {
                    id: string;
                    permitNumber: string | null;
                    type: string;
                    status: string;
                    jurisdiction: string | null;
                    appliedDate: Date | null;
                    issuedDate: Date | null;
                    expirationDate: Date | null;
                    fee: number | null;
                    notes: string | null;
                    inspections: {
                      id: string;
                      type: string;
                      result: string;
                      scheduledDate: Date | null;
                      completedDate: Date | null;
                      inspectorName: string | null;
                      scheduledBy: string | null;
                      notes: string | null;
                    }[];
                  }}
                  canEdit={true}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 lg:sticky lg:top-32 self-start">
          <JurisdictionCard project={project} />
          <WeatherWidget project={project} />
        </div>
      </div>
    </div>
  );
}
