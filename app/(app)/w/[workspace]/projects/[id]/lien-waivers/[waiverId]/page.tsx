/**
 * Single lien waiver detail page. Shows:
 *   - The full waiver document (exactly what the sub will see)
 *   - Send-to-sub action with share link + email status
 *   - Signature block (if signed)
 *   - History / event log
 *
 * Matches the change-orders/[coId] pattern: breadcrumb, status
 * badge, share-with-X sidebar, history sidebar.
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { requireMembership } from '@/lib/auth/require-membership';
import { getLienWaiver } from '@/lib/lien-waivers/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader';
import { fmtUsdFromCents as fmtUsd, fmtDate, fmtDateTimeUtc } from '@/lib/format/currency';
import { SendToSubButton } from './SendToSubButton';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-ink-30 text-ink',
  SENT: 'bg-warning text-ink',
  VIEWED: 'bg-warning text-ink',
  SIGNED: 'bg-success text-paper',
  REFUSED: 'bg-error text-paper',
  VOIDED: 'bg-ink-30 text-ink',
};

const TYPE_LABEL: Record<string, string> = {
  CONDITIONAL_PROGRESS: 'Conditional progress',
  UNCONDITIONAL_PROGRESS: 'Unconditional progress',
  CONDITIONAL_FINAL: 'Conditional final',
  UNCONDITIONAL_FINAL: 'Unconditional final',
};

const TYPE_LONG_LABEL: Record<string, string> = {
  CONDITIONAL_PROGRESS: 'Conditional Waiver and Release on Progress Payment',
  UNCONDITIONAL_PROGRESS: 'Unconditional Waiver and Release on Progress Payment',
  CONDITIONAL_FINAL: 'Conditional Waiver and Release on Final Payment',
  UNCONDITIONAL_FINAL: 'Unconditional Waiver and Release on Final Payment',
};

const EVENT_LABEL: Record<string, string> = {
  CREATED: 'Created',
  SENT: 'Sent for signature',
  VIEWED: 'Viewed by sub',
  SIGNED: 'Signed',
  VOIDED: 'Voided',
  REFUSED: 'Refused',
  DOWNLOADED: 'Downloaded',
  EMAIL_SENT: 'Email sent',
};

export default async function LienWaiverDetailPage({
  params,
}: {
  params: { workspace: string; id: string; waiverId: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const w = await getLienWaiver(params.waiverId, workspace.id);
  if (!w || w.id !== params.waiverId) notFound();

  // Need the shareToken + the sub's contactEmail + the project's
  // name for the email. The getLienWaiver query intentionally
  // doesn't return shareToken for security (it's only needed
  // here, and we trust authenticated workspace members).
  const wRaw = await prisma.lienWaiver.findUnique({
    where: { id: w.id },
    select: {
      shareToken: true,
      subcontractor: { select: { name: true, contactEmail: true } },
      project: { select: { name: true } },
    },
  });
  const shareUrl = wRaw?.shareToken
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://cms.udgok.com'}/lw/${wRaw.shareToken}`
    : null;
  const subEmail = wRaw?.subcontractor?.contactEmail ?? null;
  const subName = wRaw?.subcontractor?.name ?? w.subcontractorName ?? null;

  const isSigned = w.status === 'SIGNED';
  const isVoided = w.status === 'VOIDED';
  const isDraft = w.status === 'DRAFT';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Lien Waiver ${w.number}`}
        subtitle={subName ? `For ${subName}` : TYPE_LABEL[w.type]}
        breadcrumbs={[
          { label: 'Lien waivers', href: `/w/${params.workspace}/projects/${params.id}/lien-waivers` },
          { label: w.number },
        ]}
        actions={
          isDraft ? (
            <SendToSubButton
              workspaceSlug={params.workspace}
              projectId={params.id}
              waiverId={w.id}
              subName={subName}
              subEmail={subEmail}
            />
          ) : null
        }
      />
      <MobilePageHeader title={w.number} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* === Main column: the document itself === */}
        <div className="bg-paper border-2 border-line p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] uppercase font-mono px-2 py-1 ${STATUS_COLOR[w.status] ?? 'bg-ink-30 text-ink'}`}>
              {w.status}
            </span>
            <span className="text-[10px] uppercase font-mono px-2 py-1 border-2 border-line">
              {TYPE_LABEL[w.type]}
            </span>
            {w.payAppNumber != null ? (
              <span className="text-[10px] uppercase font-mono px-2 py-1 border-2 border-line">
                Pay App #{w.payAppNumber}
              </span>
            ) : (
              <span className="text-[10px] uppercase font-mono px-2 py-1 border-2 border-line">
                Project-level
              </span>
            )}
            {w.signatureMethod ? (
              <span className="text-[10px] uppercase font-mono px-2 py-1 border-2 border-line">
                Signed via {w.signatureMethod}
              </span>
            ) : null}
          </div>

          <div>
            <h2 className="text-[15px] font-extrabold uppercase tracking-[0.05em] mb-2">
              {TYPE_LONG_LABEL[w.type]}
            </h2>
            <p className="text-sm leading-relaxed text-ink">
              Upon receipt by the undersigned of the sum stated below, the undersigned
              {subName ? (
                <> (<strong>{subName}</strong>)</>
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
          </div>

          <dl className="text-sm space-y-1.5 pt-3 border-t border-line">
            <div className="flex gap-3">
              <dt className="font-mono text-ink-70 w-44">Amount</dt>
              <dd className="font-mono font-bold text-base">{fmtUsd(w.amountCents)}</dd>
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
            {subName ? (
              <div className="flex gap-3">
                <dt className="font-mono text-ink-70 w-44">Subcontractor</dt>
                <dd>{subName}{subEmail ? ` · ${subEmail}` : ''}</dd>
              </div>
            ) : null}
            {w.exceptionText ? (
              <div className="flex gap-3 pt-2 border-t border-line">
                <dt className="font-mono text-ink-70 w-44">Exceptions</dt>
                <dd className="whitespace-pre-wrap text-sm flex-1">{w.exceptionText}</dd>
              </div>
            ) : null}
          </dl>

          {/* Signature block */}
          {isSigned ? (
            <div className="bg-success/10 border-2 border-success p-4 mt-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-success mb-2">Signature</h3>
              <dl className="text-sm space-y-1">
                <div className="flex gap-3">
                  <dt className="font-mono text-ink-70 w-32">Signer</dt>
                  <dd className="font-semibold">{w.signerName ?? '—'}</dd>
                </div>
                {w.signerTitle ? (
                  <div className="flex gap-3">
                    <dt className="font-mono text-ink-70 w-32">Title</dt>
                    <dd>{w.signerTitle}</dd>
                  </div>
                ) : null}
                {w.signerEmail ? (
                  <div className="flex gap-3">
                    <dt className="font-mono text-ink-70 w-32">Email</dt>
                    <dd className="font-mono text-xs">{w.signerEmail}</dd>
                  </div>
                ) : null}
                <div className="flex gap-3">
                  <dt className="font-mono text-ink-70 w-32">Signed</dt>
                  <dd>{fmtDate(w.signedAt)}</dd>
                </div>
                {w.signatureMethod ? (
                  <div className="flex gap-3">
                    <dt className="font-mono text-ink-70 w-32">Method</dt>
                    <dd className="uppercase text-[11px] font-mono">{w.signatureMethod}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : isVoided ? (
            <div className="bg-error/10 border-2 border-error p-4 mt-3">
              <h3 className="font-bold text-error mb-1">Voided</h3>
              <p className="text-sm">This waiver is no longer in effect. Generate a replacement if needed.</p>
            </div>
          ) : null}
        </div>

        {/* === Sidebar: share + history === */}
        <div className="space-y-4">
          {shareUrl ? (
            <div className="bg-paper border-2 border-line p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-70 mb-2">
                {isDraft ? 'Public signing link' : 'Signing link'}
              </h3>
              {isDraft ? (
                <p className="text-xs text-ink-70 mb-2">
                  Send this link to the subcontractor. They can sign from any
                  device — no login required. Use the &ldquo;Send to subcontractor&rdquo;
                  button to email it automatically.
                </p>
              ) : (
                <p className="text-xs text-ink-70 mb-2">
                  The sub can use this link to sign. Already-signed waivers
                  show a read-only view of the document.
                </p>
              )}
              <input
                readOnly
                value={shareUrl}
                className="w-full px-2 py-1 border-2 border-line bg-paper text-xs font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2 text-center px-3 py-1.5 bg-ink text-paper text-xs uppercase tracking-wider font-bold"
              >
                Open public link
              </a>
            </div>
          ) : null}

          {w.pdfUrl ? (
            <div className="bg-paper border-2 border-line p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-70 mb-2">PDF</h3>
              <a
                href={w.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center px-3 py-1.5 border-2 border-ink text-ink text-xs uppercase tracking-wider font-bold hover:bg-ink hover:text-paper"
              >
                Download signed PDF
              </a>
            </div>
          ) : null}

          <div className="bg-paper border-2 border-line p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-70 mb-2">History</h3>
            {w.events.length === 0 ? (
              <p className="text-xs text-ink-60">No activity yet.</p>
            ) : (
              <ol className="space-y-2 text-xs">
                {w.events.map((h) => (
                  <li key={h.id} className="border-l-2 border-ink-30 pl-2">
                    <div className="font-semibold">{EVENT_LABEL[h.type] ?? h.type}</div>
                    <div className="text-ink-60">
                      {h.actor} · {fmtDateTimeUtc(h.createdAt)}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
