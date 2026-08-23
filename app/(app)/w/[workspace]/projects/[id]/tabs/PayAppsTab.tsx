/**
 * PayAppsTab — pay applications / draws for the project.
 *
 * Shows the 3D pay app flow (each draw is a glowing plate
 * stacked up to the contract total) and the list of pay apps
 * with summary fields. When no pay apps exist, prompts to
 * generate the first draw.
 *
 * The contract total is taken from `project.contractValue`
 * (the user-entered contract amount) when set, falling back
 * to the sum of division budgets. Both numbers should match
 * the project's header "$X contract" — division budgets are
 * not always the full contract (contingency, allowances,
 * unallocated portions).
 *
 * Extracted from page.tsx as part of the Aug 2026
 * project-page refactor. Pure server component.
 */

import Link from 'next/link';
import { GeneratePayAppButton } from '../GeneratePayAppButton';
import { PayAppFlow3DViewer } from '@/components/3d/PayAppFlow3DViewer';
import type { ProjectData } from '../page-types';
import { fmtDate } from '@/lib/format/currency';

export function PayAppsTab({
  projectId,
  workspace,
  project,
}: {
  projectId: string;
  workspace: string;
  project: ProjectData;
}) {
  // The 3D chart's "Contract" total needs to match the project
  // header's "$X contract" exactly. Both should show the
  // contractValue (the user-entered contract amount) when set,
  // not the sum of division budgets — because division budgets
  // can be a subset of the contract (contingency, allowances,
  // unallocated portions). If contractValue isn't set, fall
  // back to the sum of division budgets.
  const contractTotal =
    project.contractValue != null ? Number(project.contractValue) :
    project.divisions.reduce((acc, d) => acc + Number(d.budget), 0);
  const payAppFlowItems = project.payApps
    .map((p) => ({
      id: p.id,
      number: p.drawNumber,
      status: p.status as 'DRAFT' | 'SENT' | 'VIEWED' | 'ACKNOWLEDGED' | 'PAID' | 'OVERDUE',
      amount: Number(p.totalThisDraw),
      date: p.periodEnd,
      paidAt: null,
    }));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-black text-xl md:text-2xl tracking-tight">Pay applications</h2>
          <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {project.payApps.length} draw{project.payApps.length === 1 ? '' : 's'} issued
          </p>
        </div>
        <GeneratePayAppButton
          workspaceSlug={workspace}
          projectId={projectId}
          hasDivisions={project.divisions.length > 0}
        />
      </div>

      {/* 3D money tower — each pay app is a glowing plate stacked up to the contract total */}
      {project.payApps.length > 0 && contractTotal > 0 ? (
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div>
              <h3 className="font-black text-lg tracking-tight flex items-center gap-2">
                <span aria-hidden>💸</span> Pay app flow
              </h3>
              <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
                Each plate is one draw · status color · height = amount
              </p>
            </div>
          </div>
          <PayAppFlow3DViewer
            contractTotal={contractTotal}
            payApps={payAppFlowItems}
            height={520}
          />
        </div>
      ) : null}
      {project.payApps.length === 0 ? (
        <div className="bg-paper border-2 border-line p-12 text-center text-ink-50">
          <p className="mb-4">No pay apps yet. Generate the first draw once you have at least one division.</p>
          {project.divisions.length > 0 ? (
            <Link
              href={`/w/${workspace}/projects/${projectId}/pay-apps/new`}
              className="inline-block px-5 py-3 bg-orange text-paper border-2 border-orange font-extrabold uppercase tracking-[0.12em] text-xs"
            >
              + Generate the first pay app
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="bg-paper border-2 border-line">
          {project.payApps.map((p) => (
            <Link
              key={p.id}
              href={`/w/${workspace}/projects/${projectId}/pay-apps/${p.id}`}
              className="grid grid-cols-1 sm:grid-cols-[80px_1fr_140px_140px_140px_140px_40px] gap-3 px-5 py-3.5 border-b border-line-soft last:border-0 items-center hover:bg-cream-2"
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-50">#{p.drawNumber}</div>
              <div>
                <div className="font-extrabold text-[13px]">
                  {fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}
                </div>
                <div className="text-[10px] text-ink-50 font-mono uppercase tracking-[0.1em]">
                  {p.status} {p.viewCount > 0 ? `· ${p.viewCount} view${p.viewCount === 1 ? '' : 's'}` : ''}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em]">CONTRACT</div>
                <div className="font-extrabold text-[13px]">${Number(p.totalContract).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em]">PREVIOUS</div>
                <div className="font-extrabold text-[13px]">${Number(p.totalPrevious).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em]">THIS DRAW</div>
                <div className="font-black text-[15px] text-orange-d">${Number(p.totalThisDraw).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[9px] font-mono text-ink-50 uppercase tracking-[0.1em]">BALANCE</div>
                <div className="font-extrabold text-[13px]">${Number(p.totalBalance).toLocaleString()}</div>
              </div>
              <div className="text-right text-ink-50 hidden sm:block">→</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
