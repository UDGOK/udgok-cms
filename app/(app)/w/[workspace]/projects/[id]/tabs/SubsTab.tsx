/**
 * SubsTab — subcontractor assignments on this project.
 *
 * When no subs are assigned: shows the assignment form.
 * When subs exist: shows the list with status pills, division
 * chips, contract amounts, and a Draft Sub Message button per
 * sub. The assignment form stays at the bottom of the list
 * for adding additional subs.
 *
 * Extracted from page.tsx as part of the Aug 2026
 * project-page refactor. Pure server component.
 */

import Link from 'next/link';
import { AssignSubForm } from '../AssignSubForm';
import { DraftSubMessageButton } from '../DraftSubMessageButton';
import type { ProjectData } from '../page-types';

const SUB_STATUS_LABEL: Record<string, string> = {
  PROPOSED: 'Proposed',
  CONTRACTED: 'Contracted',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const SUB_STATUS_COLOR: Record<string, string> = {
  PROPOSED: 'bg-warning text-ink',
  CONTRACTED: 'bg-ink text-paper',
  ACTIVE: 'bg-success text-paper',
  COMPLETED: 'bg-ink-30 text-ink',
  CANCELLED: 'bg-line text-ink-50',
};

export function SubsTab({
  projectId,
  workspace,
  project,
  subs,
}: {
  projectId: string;
  workspace: string;
  project: ProjectData;
  subs: { id: string; name: string; primaryTrade: string | null }[];
}) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-black text-xl md:text-2xl tracking-tight">Subcontractors</h2>
        <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
          {project.subAssignments.length} assignment{project.subAssignments.length === 1 ? '' : 's'}
          {project.subAssignments.length > 0 ? (
            <>
              {' · '}
              <b className="text-ink">
                ${project.subAssignments.reduce((acc, a) => acc + Number(a.contractAmount), 0).toLocaleString()}
              </b>
              {' '}contracted
            </>
          ) : null}
        </p>
      </div>

      {project.subAssignments.length === 0 ? (
        <div className="bg-paper border-2 border-line p-6">
          <AssignSubForm
            workspaceSlug={workspace}
            projectId={projectId}
            subs={subs}
            divisions={project.divisions.map((d) => ({
              id: d.id,
              code: d.code,
              trade: d.trade,
              budget: Number(d.budget),
            }))}
          />
        </div>
      ) : (
        <div className="bg-paper border-2 border-line">
          <div className="divide-y divide-line-soft">
            {project.subAssignments.map((a) => (
              <div key={a.id} className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <Link
                      href={`/w/${workspace}/subcontractors/${a.subcontractor.id}`}
                      className="font-extrabold text-[14px] hover:text-orange-d"
                    >
                      {a.subcontractor.name}
                    </Link>
                    <span className={`px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.05em] ${SUB_STATUS_COLOR[a.status] ?? 'bg-line text-ink'}`}>
                      {SUB_STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    {a.subcontractor.primaryTrade ? (
                      <span className="text-[10px] font-mono text-ink-50">primary: {a.subcontractor.primaryTrade}</span>
                    ) : null}
                  </div>
                  {a.divisionLinks.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {a.divisionLinks.map((dl) => (
                        <span
                          key={dl.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-cream-2 border border-line-soft text-[11px]"
                        >
                          <span className="font-mono text-orange-d font-extrabold">{dl.division.code}</span>
                          <span>{dl.division.trade}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {a.notes ? <p className="text-[11px] text-ink-50 mt-1.5">{a.notes}</p> : null}
                </div>
                <div className="text-right flex flex-col items-end gap-1.5 flex-shrink-0">
                  <div className="font-black text-[15px]">${Number(a.contractAmount).toLocaleString()}</div>
                  <DraftSubMessageButton
                    workspaceSlug={workspace}
                    projectId={projectId}
                    sub={{ id: a.subcontractor.id, name: a.subcontractor.name, primaryTrade: a.subcontractor.primaryTrade }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-line">
            <AssignSubForm
              workspaceSlug={workspace}
              projectId={projectId}
              subs={subs}
              divisions={project.divisions.map((d) => ({
                id: d.id,
                code: d.code,
                trade: d.trade,
                budget: Number(d.budget),
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
