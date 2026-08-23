/**
 * Public Submittal review portal.
 *
 * Route: /sub/[token]
 * Auth:   none — the token IS the credential.
 *
 * Architect/engineer sees the submittal with attached files,
 * picks APPROVED / APPROVED_AS_NOTED / REVISE_AND_RESUBMIT /
 * REJECTED, types their name, and submits.
 */

import { notFound } from 'next/navigation';
import { getSubmittalByToken, trackSubmittalView } from '@/lib/submittals/queries';
import { PublicSubmittalActions } from './PublicSubmittalActions';
import { fmtDate } from '@/lib/format/currency';

export const dynamic = 'force-dynamic';


const DISPOSITION_COLOR: Record<string, string> = {
  APPROVED: 'bg-success text-paper',
  APPROVED_AS_NOTED: 'bg-success text-paper',
  REVISE_AND_RESUBMIT: 'bg-warning text-ink',
  REJECTED: 'bg-error text-paper',
};

export default async function PublicSubmittalPage({
  params,
}: {
  params: { token: string };
}) {
  const s = await getSubmittalByToken(params.token);
  if (!s) notFound();
  await trackSubmittalView(s.id);

  const isFinal = s.status === 'APPROVED' || s.status === 'APPROVED_AS_NOTED' || s.status === 'REJECTED';

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-60 font-mono">
            {s.workspaceName} — {s.projectName}
          </div>
          <h1 className="text-3xl font-extrabold mt-2">{s.title}</h1>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase font-mono px-2 py-1 border-2 border-line">
              {s.number}
            </span>
            <span className="text-[10px] uppercase font-mono px-2 py-1 bg-ink-10">
              CSI {s.specSection}-{String(s.specSequence).padStart(3, '0')}
            </span>
            {s.revision > 1 ? (
              <span className="text-[10px] uppercase font-mono px-2 py-1 bg-ink-10">
                Rev {s.revision}
              </span>
            ) : null}
            {s.disposition ? (
              <span className={`text-[10px] uppercase font-mono px-2 py-1 ${DISPOSITION_COLOR[s.disposition] ?? 'bg-ink-30 text-ink'}`}>
                {s.disposition.replace(/_/g, ' ')}
              </span>
            ) : (
              <span className="text-[10px] uppercase font-mono px-2 py-1 bg-warning text-ink">
                Awaiting review
              </span>
            )}
          </div>
        </div>

        {s.subcontractorName ? (
          <p className="text-sm text-ink-70 mb-4">
            Submitted by <strong>{s.subcontractorName}</strong> on {fmtDate(s.submittedAt)}
          </p>
        ) : null}

        {s.description ? (
          <div className="bg-paper border-2 border-line p-5 mb-6">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-70 mb-2">Description</h2>
            <p className="text-sm whitespace-pre-wrap">{s.description}</p>
          </div>
        ) : null}

        {s.files.length > 0 ? (
          <div className="bg-paper border-2 border-line p-5 mb-6">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-70 mb-3">Attached files</h2>
            <ul className="space-y-1.5 text-sm">
              {s.files.map((f) => (
                <li key={f.id}>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink underline"
                  >
                    {f.filename}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {s.reviewNotes ? (
          <div className="bg-ink-10 border-2 border-line p-5 mb-6">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-70 mb-2">Reviewer notes</h2>
            <p className="text-sm whitespace-pre-wrap">{s.reviewNotes}</p>
          </div>
        ) : null}

        {isFinal ? (
          <div className="bg-success/10 border-2 border-success p-5">
            <h2 className="font-bold mb-1">Review complete</h2>
            <p className="text-sm">
              Disposition: <strong>{s.disposition?.replace(/_/g, ' ')}</strong>
              {s.reviewedAt ? <> · Reviewed on {fmtDate(s.reviewedAt)}</> : null}
            </p>
          </div>
        ) : (
          <PublicSubmittalActions token={params.token} />
        )}

        <p className="text-[11px] text-ink-60 mt-8 text-center">
          Your typed name and the disposition you select constitute the
          official architect/engineer review record.
        </p>
      </div>
    </div>
  );
}
