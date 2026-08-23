/**
 * Public RFI response portal.
 *
 * Route: /rfi/[token]
 * Auth:   none — the token IS the credential.
 *
 * Architect/engineer answers the RFI directly here. If the answer
 * flags a cost or schedule impact, the form captures the amount
 * so the GC can build a Change Order off this RFI.
 */

import { notFound } from 'next/navigation';
import { getRfiByToken, trackRfiView } from '@/lib/submittals/queries';
import { PublicRfiActions } from './PublicRfiActions';
import { fmtDate } from '@/lib/format/currency';

export const dynamic = 'force-dynamic';


export default async function PublicRfiPage({
  params,
}: {
  params: { token: string };
}) {
  const r = await getRfiByToken(params.token);
  if (!r) notFound();
  await trackRfiView(r.id);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-60 font-mono">
            {r.workspaceName} — {r.projectName}
          </div>
          <h1 className="text-3xl font-extrabold mt-2">RFI {r.number}</h1>
          <p className="text-ink-70 mt-1">{r.subject}</p>
          {r.dueDate ? (
            <p className="text-sm text-ink-60 mt-2">Response requested by <strong>{fmtDate(r.dueDate)}</strong></p>
          ) : null}
        </div>

        <div className="bg-paper border-2 border-line p-5 mb-6">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-70 mb-2">Question</h2>
          <p className="text-sm whitespace-pre-wrap">{r.question}</p>
        </div>

        {r.answer ? (
          <div className="bg-success/10 border-2 border-success p-5 mb-6">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-success mb-2">Response</h2>
            <p className="text-sm whitespace-pre-wrap">{r.answer}</p>
            {r.costImpact || r.scheduleImpact ? (
              <div className="mt-3 pt-3 border-t border-success/30 text-xs space-y-0.5">
                {r.costImpact ? (
                  <div>
                    <strong>Cost impact:</strong> {r.costImpactAmount ? `$${r.costImpactAmount.toLocaleString()}` : 'flagged'}
                  </div>
                ) : null}
                {r.scheduleImpact ? (
                  <div>
                    <strong>Schedule impact:</strong> {r.scheduleImpactDays} day{r.scheduleImpactDays === 1 ? '' : 's'}
                  </div>
                ) : null}
              </div>
            ) : null}
            <p className="text-xs text-ink-60 mt-3">Answered on {fmtDate(r.answeredAt)}</p>
          </div>
        ) : (
          <PublicRfiActions token={params.token} />
        )}

        <p className="text-[11px] text-ink-60 mt-8 text-center">
          Your typed name + answer is the official response. Flag any
          cost or schedule impact so the GC can prepare a Change Order.
        </p>
      </div>
    </div>
  );
}
