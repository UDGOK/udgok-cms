import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { getProject } from '@/lib/projects/queries';
import { NewDivisionForm } from './NewDivisionForm';
import { GeneratePayAppButton } from './GeneratePayAppButton';

export default async function ProjectDetailPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const workspace = await prisma.workspace.findUnique({ where: { slug: params.workspace } });
  if (!workspace) notFound();
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
  });
  if (!membership) notFound();

  const project = await getProject(workspace.id, params.id);
  if (!project) notFound();

  // Compute the SOV totals and remaining to bill
  const totalBudget = project.divisions.reduce((acc, d) => acc + Number(d.budget), 0);

  // Cumulative billed so far across all pay apps
  const totalBilled = project.payApps
    .filter((p) => p.status === 'PAID' || p.status === 'ACKNOWLEDGED' || p.status === 'VIEWED' || p.status === 'SENT')
    .reduce((acc, p) => acc + Number(p.totalThisDraw), 0);

  const remaining = (project.contractValue ? Number(project.contractValue) : totalBudget) - totalBilled;

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 flex-wrap pb-7 border-b border-line bg-paper p-7 -m-7 mb-7">
        <div>
          <div className="text-[10px] font-mono tracking-[0.12em] uppercase text-ink-50 mb-1">
            {project.code ?? 'PROJECT'} · {project.client?.name ?? 'NO CLIENT'}
          </div>
          <h2 className="text-3xl font-black tracking-tight leading-tight">{project.name}</h2>
          {project.description ? (
            <p className="text-[13px] text-ink-70 mt-2 max-w-2xl">{project.description}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="px-3 py-1 bg-success text-paper text-[10px] font-extrabold uppercase tracking-[0.12em]">
            {project.status}
          </span>
          {project.contractValue ? (
            <div className="font-black text-2xl">${Number(project.contractValue).toLocaleString()}</div>
          ) : null}
        </div>
      </div>

      {/* 4-cell KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 border border-line bg-paper mb-6">
        <div className="p-5 border-r border-line">
          <div className="label-mono">Contract</div>
          <div className="font-black text-2xl">${(project.contractValue ? Number(project.contractValue) : 0).toLocaleString()}</div>
        </div>
        <div className="p-5 border-r border-line">
          <div className="label-mono">Billed to date</div>
          <div className="font-black text-2xl">${totalBilled.toLocaleString()}</div>
        </div>
        <div className="p-5 border-r border-line">
          <div className="label-mono">Remaining</div>
          <div className="font-black text-2xl text-orange-d">${remaining.toLocaleString()}</div>
        </div>
        <div className="p-5">
          <div className="label-mono">Pay apps</div>
          <div className="font-black text-2xl">{project.payApps.length}</div>
        </div>
      </div>

      {/* SOV Section */}
      <div className="bg-paper border-2 border-line mb-6">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
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
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Code', 'Trade', 'Subcontractor', 'Budget', 'Billed', 'Remaining'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 bg-cream-2 border-b border-line text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {project.divisions.map((d) => {
                const billed = project.payApps
                  .flatMap((p) => p.divisions)
                  .filter((line) => line.projectDivisionId === d.id)
                  .reduce((acc, l) => acc + Number(l.thisDrawAmount), 0);
                const rem = Number(d.budget) - billed;
                return (
                  <tr key={d.id} className="hover:bg-cream-2">
                    <td className="px-5 py-3 border-b border-line-soft font-mono text-[12px]">{d.code}</td>
                    <td className="px-5 py-3 border-b border-line-soft font-extrabold text-[13px]">{d.trade}</td>
                    <td className="px-5 py-3 border-b border-line-soft text-[12px] text-ink-70">{d.subcontractorName ?? '—'}</td>
                    <td className="px-5 py-3 border-b border-line-soft font-black">${Number(d.budget).toLocaleString()}</td>
                    <td className="px-5 py-3 border-b border-line-soft font-black text-success">${billed.toLocaleString()}</td>
                    <td className="px-5 py-3 border-b border-line-soft font-black text-orange-d">${rem.toLocaleString()}</td>
                  </tr>
                );
              })}
              <tr className="bg-ink text-cream">
                <td colSpan={3} className="px-5 py-3 font-extrabold uppercase text-[11px] tracking-[0.12em]">Totals</td>
                <td className="px-5 py-3 font-black text-lg">${totalBudget.toLocaleString()}</td>
                <td className="px-5 py-3 font-black text-lg">${totalBilled.toLocaleString()}</td>
                <td className="px-5 py-3 font-black text-lg">${(totalBudget - totalBilled).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        )}
        <div className="p-6 border-t border-line">
          <NewDivisionForm workspaceSlug={params.workspace} projectId={project.id} />
        </div>
      </div>

      {/* Pay Apps Section */}
      <div className="bg-paper border-2 border-line">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <div>
            <div className="label-eyebrow">{'// Pay applications'}</div>
            <div className="text-[11px] text-ink-50 mt-0.5">
              {project.payApps.length} draw{project.payApps.length === 1 ? '' : 's'} issued
            </div>
          </div>
          <GeneratePayAppButton
            workspaceSlug={params.workspace}
            projectId={project.id}
            hasDivisions={project.divisions.length > 0}
          />
        </div>
        {project.payApps.length === 0 ? (
          <div className="px-6 py-12 text-center text-ink-50">
            No pay apps yet. Generate the first draw once you have at least one division.
          </div>
        ) : (
          <div>
            {project.payApps.map((p) => (
              <Link
                key={p.id}
                href={`/w/${params.workspace}/projects/${project.id}/pay-apps/${p.id}`}
                className="grid grid-cols-[80px_1fr_140px_140px_140px_140px_40px] gap-3 px-5 py-3.5 border-b border-line-soft last:border-0 items-center hover:bg-cream-2"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-50">#{p.drawNumber}</div>
                <div>
                  <div className="font-extrabold text-[13px]">
                    {p.periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {p.periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                <div className="text-right text-ink-50">→</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
