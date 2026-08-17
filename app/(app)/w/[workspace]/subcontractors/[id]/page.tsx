import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireMembership } from '@/lib/auth/require-membership';
import { getSubcontractor } from '@/lib/subs/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { CSI_MASTERFORMAT } from '@/lib/construction/csi-masterformat';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  PROPOSED: 'Proposed',
  CONTRACTED: 'Contracted',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  PROPOSED: 'bg-warning text-ink',
  CONTRACTED: 'bg-ink text-paper',
  ACTIVE: 'bg-success text-paper',
  COMPLETED: 'bg-ink-30 text-ink',
  CANCELLED: 'bg-line text-ink-50',
};

export default async function SubDetailPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const ctx = await requireMembership(params.workspace);
  const sub = await getSubcontractor(ctx.workspace.id, params.id);
  if (!sub) notFound();

  const csi = CSI_MASTERFORMAT.find((d) => d.number === sub.primaryTrade);

  return (
    <div className="px-10 py-8">
      <PageHeader
        title={sub.name}
        subtitle={csi ? `${csi.number} · ${csi.name}` : 'Subcontractor'}
        breadcrumbs={[
          { label: ctx.workspace.name, href: `/w/${ctx.workspace.slug}/dashboard` },
          { label: 'Subcontractors', href: `/w/${ctx.workspace.slug}/subcontractors` },
          { label: sub.name },
        ]}
      />

      <div className="mt-6 grid grid-cols-3 gap-6">
        {/* Left: contact details */}
        <div className="col-span-1 bg-paper border-2 border-ink p-5 space-y-4 h-fit">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50 mb-2">Contact</h2>
          <Field label="Contact name" value={sub.contactName} />
          <Field label="Email" value={sub.contactEmail} mono />
          <Field label="Phone" value={sub.contactPhone} mono />
          <Field label="Address" value={sub.address} />

          <div className="border-t-2 border-line pt-4 mt-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50 mb-2">Compliance</h2>
            <Field label="License #" value={sub.licenseNumber} mono />
            <Field
              label="Insurance expires"
              value={sub.insuranceExpiry ? sub.insuranceExpiry.toISOString().slice(0, 10) : null}
              mono
            />
            <div className="flex items-center justify-between py-1.5 border-b border-line-soft">
              <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">W-9 on file</span>
              <span className={`text-[11px] font-extrabold ${sub.w9OnFile ? 'text-success' : 'text-ink-50'}`}>
                {sub.w9OnFile ? 'YES' : 'NO'}
              </span>
            </div>
            {sub.hourlyRate ? <Field label="Hourly rate" value={`$${sub.hourlyRate.toFixed(2)}`} mono /> : null}
            {sub.rating ? <Field label="Quality" value={'★'.repeat(sub.rating) + '☆'.repeat(5 - sub.rating)} /> : null}
          </div>

          {sub.notes ? (
            <div className="border-t-2 border-line pt-4 mt-4">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50 mb-2">Notes</h2>
              <p className="text-[12px] whitespace-pre-wrap">{sub.notes}</p>
            </div>
          ) : null}
        </div>

        {/* Right: project assignments */}
        <div className="col-span-2 space-y-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50">
            Project assignments · {sub.assignments.length}
          </h2>
          {sub.assignments.length === 0 ? (
            <div className="bg-paper border-2 border-dashed border-line p-8 text-center">
              <p className="text-[13px] text-ink-50">
                Not assigned to any project yet. Open a project and assign this sub to one or more divisions.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sub.assignments.map((a) => (
                <div key={a.id} className="bg-paper border-2 border-line p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <Link
                        href={`/w/${ctx.workspace.slug}/projects/${a.projectId}`}
                        className="font-extrabold text-[15px] hover:text-orange-d"
                      >
                        {a.projectName}
                      </Link>
                      {a.notes ? <p className="text-[11px] text-ink-50 mt-1">{a.notes}</p> : null}
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.05em] ${STATUS_COLOR[a.status] ?? 'bg-line text-ink'}`}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                      <div className="text-[14px] font-extrabold mt-1">${a.contractAmount.toLocaleString()}</div>
                    </div>
                  </div>
                  {a.divisions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {a.divisions.map((d) => (
                        <span key={d.divisionId} className="inline-flex items-center gap-1.5 px-2 py-1 bg-cream-2 border border-line text-[11px]">
                          <span className="font-mono text-orange-d font-extrabold">{d.code}</span>
                          <span className="font-extrabold">{d.trade}</span>
                          {d.amount > 0 ? <span className="font-mono text-ink-50">${d.amount.toLocaleString()}</span> : null}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-line-soft">
      <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">{label}</span>
      <span className={`text-[12px] font-extrabold text-right ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}
