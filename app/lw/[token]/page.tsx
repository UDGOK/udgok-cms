/**
 * Public Lien Waiver signing portal.
 *
 * Route: /lw/[token]
 * Auth:   none — the token IS the credential.
 *
 * The sub foreman or sub owner comes here from a link in their
 * email, reviews the waiver, and signs. The form takes their
 * name, title, email, and optional exception text. On submit,
 * the status flips from SENT/VIEWED → SIGNED.
 */

import { notFound } from 'next/navigation';
import { getLienWaiverByToken, trackLienWaiverView } from '@/lib/lien-waivers/queries';
import { PublicLienWaiverActions } from './PublicLienWaiverActions';
import { fmtDate } from '@/lib/format/currency';

export const dynamic = 'force-dynamic';

const fmtUsd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(cents / 100);

const TYPE_LABEL: Record<string, string> = {
  CONDITIONAL_PROGRESS: 'Conditional Waiver and Release on Progress Payment',
  UNCONDITIONAL_PROGRESS: 'Unconditional Waiver and Release on Progress Payment',
  CONDITIONAL_FINAL: 'Conditional Waiver and Release on Final Payment',
  UNCONDITIONAL_FINAL: 'Unconditional Waiver and Release on Final Payment',
};

export default async function PublicLienWaiverPage({
  params,
}: {
  params: { token: string };
}) {
  const w = await getLienWaiverByToken(params.token);
  if (!w) notFound();

  await trackLienWaiverView(w.id);

  const isSigned = w.status === 'SIGNED';
  const isVoided = w.status === 'VOIDED';

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-60 font-mono">
            {w.workspaceName} — {w.projectName}
          </div>
          <h1 className="text-3xl font-extrabold mt-2">{TYPE_LABEL[w.type] ?? w.type}</h1>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 border-2 border-line">
              {w.number}
            </span>
            {isSigned ? (
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 bg-success text-paper">
                Signed
              </span>
            ) : isVoided ? (
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 bg-error text-paper">
                Voided
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 bg-warning text-ink">
                Awaiting signature
              </span>
            )}
          </div>
        </div>

        <div className="bg-paper border-2 border-line p-6 mb-6 space-y-3">
          <h2 className="text-[15px] font-extrabold uppercase tracking-[0.05em] mb-3">Waiver terms</h2>
          <p className="text-sm">
            Upon receipt by the undersigned of the sum stated below, the undersigned
            {w.subcontractorName ? (
              <> (<strong>{w.subcontractorName}</strong>)</>
            ) : null}
            {w.type.includes('PROGRESS') ? (
              <> waives and releases any mechanic&apos;s lien, any state or federal statutory lien,</>
            ) : (
              <> waives and releases any mechanic&apos;s lien, any state or federal statutory lien, AND any common law or other lien for work performed through the date below,</>
            )}
            {w.type.startsWith('CONDITIONAL') ? (
              <> to the following extent. <strong>This waiver is conditioned on the undersigned&apos;s actual receipt of payment.</strong></>
            ) : (
              <> unconditionally.</>
            )}
          </p>

          <dl className="text-sm space-y-1.5 pt-3 border-t border-line">
            <div className="flex gap-3">
              <dt className="font-mono text-ink-70 w-44">Amount</dt>
              <dd className="font-mono font-bold">{fmtUsd(w.amountCents)}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="font-mono text-ink-70 w-44">Through date</dt>
              <dd>{fmtDate(w.throughDate)}</dd>
            </div>
            {w.payAppNumber != null ? (
              <div className="flex gap-3">
                <dt className="font-mono text-ink-70 w-44">Pay application</dt>
                <dd>#{w.payAppNumber}</dd>
              </div>
            ) : null}
            {w.exceptionText ? (
              <div className="flex gap-3 pt-2 border-t border-line">
                <dt className="font-mono text-ink-70 w-44">Exceptions</dt>
                <dd className="whitespace-pre-wrap text-sm flex-1">{w.exceptionText}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {isSigned ? (
          <div className="bg-success/10 border-2 border-success p-5">
            <h2 className="font-bold mb-2">This waiver has been signed.</h2>
            <p className="text-sm">Signed on {fmtDate(w.signedAt)}.</p>
          </div>
        ) : isVoided ? (
          <div className="bg-error/10 border-2 border-error p-5">
            <h2 className="font-bold mb-2">This waiver has been voided.</h2>
            <p className="text-sm">
              The general contractor voided this document. Contact them for a
              replacement if you still need to release your lien rights.
            </p>
          </div>
        ) : (
          <PublicLienWaiverActions token={params.token} />
        )}

        <p className="text-[11px] text-ink-60 mt-8 text-center">
          Oklahoma Title 42 governs mechanic&apos;s lien waivers in this state. The
          typed name on this form is your electronic signature.
        </p>
      </div>
    </div>
  );
}
