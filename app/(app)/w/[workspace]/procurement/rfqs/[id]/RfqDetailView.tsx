'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  resendRfqAction,
  revokeRfqAction,
  updateRfqAction,
  reviseRfqAction,
  extendRfqDeadlineAction,
  softDeleteRfqAction,
} from '@/lib/procurement/rfq-actions';
import type { RfqDetail } from '@/lib/procurement/rfq-queries';

/** Human-friendly number: strips the "-R{n}" storage suffix
 *  that the revise action appends to satisfy the
 *  (workspaceId, number) unique constraint. Display is
 *  "{baseNumber} rev {revision}", not the raw DB number. */
function displayNumber(rfq: RfqDetail): string {
  return rfq.number.replace(/-R\d+$/, '');
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-ink-50/15 text-ink-50',
  SENT: 'bg-info/15 text-info',
  VIEWED: 'bg-info/15 text-info',
  RESPONDED: 'bg-orange/15 text-orange',
  ACCEPTED: 'bg-success/15 text-success',
  DECLINED: 'bg-error/15 text-error',
  CANCELLED: 'bg-ink-50/15 text-ink-50',
  EXPIRED: 'bg-error/15 text-error',
  SUPERSEDED: 'bg-ink-50/15 text-ink-50',
  REVOKED: 'bg-ink-50/15 text-ink-50',
};

export function RfqDetailView({
  rfq,
  workspaceId,
  workspaceSlug,
  baseUrl,
  showMagicLinkCopy,
}: {
  rfq: RfqDetail;
  workspaceId: string;
  workspaceSlug: string;
  baseUrl: string;
  showMagicLinkCopy: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ kind: 'sent' | 'copied'; text: string } | null>(null);
  const [editingDraft, setEditingDraft] = useState(false);

  // For "Copy link" the token hash is in the DB; the plaintext
  // is only in the email we sent. We can't reconstruct it.
  // We DO show the link IF status is DRAFT and there's no
  // sentAt (meaning the email failed and we're showing the
  // magic link as a fallback so the buyer can copy it).
  // Otherwise the buyer should refer to the email.
  const canShowLink = showMagicLinkCopy;

  function resend() {
    if (
      !confirm(
        `Resend the RFQ to ${rfq.vendor.name}? This rotates the link — any previous link will stop working.`,
      )
    )
      return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await resendRfqAction(workspaceId, rfq.id);
      if (res.ok) {
        if (res.sent) {
          setInfo({ kind: 'sent', text: res.message });
        } else {
          setInfo({ kind: 'sent', text: res.message });
        }
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function revoke() {
    if (!confirm(`Revoke ${displayNumber(rfq)}? The link will stop working and the vendor can no longer submit.`))
      return;
    setError(null);
    startTransition(async () => {
      const res = await revokeRfqAction(workspaceId, rfq.id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const latestQuote = rfq.quotes[0] ?? null;
  const isClosed = ['ACCEPTED', 'CANCELLED', 'DECLINED', 'EXPIRED', 'SUPERSEDED', 'REVOKED'].includes(rfq.status);
  const isExpired = rfq.expiresAt < new Date() && !isClosed;
  const isDraft = rfq.status === 'DRAFT';
  const isLive = ['SENT', 'VIEWED', 'RESPONDED'].includes(rfq.status);

  // Edit: DRAFT only. Free edit, no email.
  // Revise: SENT/VIEWED. Creates a new Rfq row (parent/child),
  //   marks this one SUPERSEDED, sends fresh email. Use this
  //   when line items or contact changed.
  // Resend: any non-closed. Same link, fresh email. Use for
  //   "I lost the email".
  // Extend: SENT/VIEWED. Pushes expiresAt, sends "deadline
  //   extended" email. No new revision (content unchanged).
  // Revoke: SENT/VIEWED/RESPONDED. Permanent. Vendor's link
  //   shows a "revoked" page.
  // Delete: DRAFT only. Soft delete.
  function editDraft() {
    setEditingDraft(true);
  }
  function cancelEditDraft() {
    setEditingDraft(false);
  }
  async function saveDraft(patch: { message?: string | null; neededBy?: Date | null; contactId?: string | null }) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('payload', JSON.stringify({ rfqId: rfq.id, ...patch }));
      const res = await updateRfqAction(workspaceId, undefined, fd);
      if (res.ok) {
        setEditingDraft(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }
  function revise() {
    const ok = confirm(
      `Revise ${displayNumber(rfq)}? This creates rev ${(rfq.revision ?? 1) + 1} with a new link, and the old link will show "this RFQ has been revised". The vendor gets a fresh email.`,
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await reviseRfqAction(workspaceId, rfq.id);
      if (res.ok) {
        // Navigate to the new revision so the buyer sees it.
        router.push(`/w/${workspaceSlug}/procurement/rfqs/${res.newRfqId}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }
  function extendDeadline() {
    const input = window.prompt('Extend deadline by how many days? (1-90)', '7');
    if (!input) return;
    const days = Number(input);
    if (!Number.isFinite(days) || days < 1 || days > 90) {
      setError('Days must be a number between 1 and 90');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await extendRfqDeadlineAction(workspaceId, rfq.id, days);
      if (res.ok) {
        setInfo({ kind: 'sent', text: `Deadline extended by ${days} day${days === 1 ? '' : 's'}` });
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }
  function deleteRfq() {
    if (
      !confirm(
        `Delete draft ${displayNumber(rfq)}? The audit trail is preserved but the row is removed from lists. This is reversible only by an admin.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await softDeleteRfqAction(workspaceId, rfq.id);
      if (res.ok) {
        router.push(`/w/${workspaceSlug}/procurement/lists/${rfq.listId}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mt-2 mb-4">
        <div>
          <h1 className="text-2xl font-black">
            {displayNumber(rfq)}
            {rfq.revision > 1 ? (
              <span className="text-ink-50 font-mono text-[14px] font-normal ml-2">
                rev {rfq.revision}
              </span>
            ) : null}
          </h1>
          {rfq.parentRfqId ? (
            <div className="text-[10px] text-ink-50 font-mono mt-1">
              ←{' '}
              <Link
                href={`/w/${workspaceSlug}/procurement/rfqs/${rfq.parentRfqId}`}
                className="hover:text-ink underline"
              >
                view predecessor (rev {rfq.revision - 1})
              </Link>
            </div>
          ) : null}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                STATUS_COLOR[rfq.status] ?? 'bg-ink-50/15 text-ink-50'
              }`}
            >
              {rfq.status}
            </span>
            <span className="text-[11px] text-ink-70">→ {rfq.vendor.name}</span>
            {rfq.contact ? (
              <span className="text-[10px] text-ink-50 font-mono">{rfq.contact.email}</span>
            ) : null}
          </div>
          <div className="text-[10px] text-ink-50 font-mono mt-1">
            expires {rfq.expiresAt.toLocaleString()}
            {isExpired ? ' (EXPIRED)' : ''}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* DRAFT-ONLY actions */}
          {isDraft ? (
            <>
              <button
                type="button"
                onClick={editingDraft ? cancelEditDraft : editDraft}
                disabled={pending}
                className="px-3 py-2 border-2 border-ink text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-paper disabled:opacity-50"
              >
                {editingDraft ? 'Close editor' : 'Edit'}
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={pending}
                className="px-3 py-2 bg-orange text-paper border-2 border-orange text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
              >
                {pending ? 'Working…' : rfq.sentAt ? 'Resend' : 'Send'}
              </button>
              <button
                type="button"
                onClick={deleteRfq}
                disabled={pending}
                className="px-3 py-2 border-2 border-error text-error text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-error/10 disabled:opacity-50"
                title="Delete this DRAFT. Sent RFQs must be revoked, not deleted."
              >
                Delete
              </button>
            </>
          ) : null}
          {/* LIVE RFQ actions (SENT / VIEWED / RESPONDED) */}
          {isLive ? (
            <>
              <button
                type="button"
                onClick={revise}
                disabled={pending}
                className="px-3 py-2 bg-orange text-paper border-2 border-orange text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
                title="Create a new revision. Old link shows 'revised', vendor gets a fresh link."
              >
                {pending ? 'Working…' : 'Revise + resend'}
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={pending}
                className="px-3 py-2 border-2 border-ink text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-paper disabled:opacity-50"
                title="Re-send the same link (no new revision). Use for 'I lost the email'."
              >
                Resend same link
              </button>
              <button
                type="button"
                onClick={extendDeadline}
                disabled={pending}
                className="px-3 py-2 border-2 border-info text-info text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-info/10 disabled:opacity-50"
                title="Push the deadline out by N days. Vendor gets an 'extended' email."
              >
                Extend deadline
              </button>
              <button
                type="button"
                onClick={revoke}
                disabled={pending}
                className="px-3 py-2 border-2 border-error text-error text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-error/10 disabled:opacity-50"
                title="Pull the RFQ back. Vendor's link shows 'revoked'."
              >
                Revoke
              </button>
            </>
          ) : null}
          {/* ACCEPTED / DECLINED / EXPIRED: no actions */}
        </div>
      </div>

      {info ? (
        <div className="bg-info/10 border border-info p-2 mb-3 text-[12px] text-info">
          {info.text}
        </div>
      ) : null}
      {error ? (
        <div className="bg-error/10 border border-error p-2 mb-3 text-[12px] text-error font-semibold">
          ⚠ {error}
        </div>
      ) : null}

      {editingDraft ? (
        <DraftEditForm
          rfq={rfq}
          contacts={rfq.vendorContacts}
          pending={pending}
          onSave={saveDraft}
          onCancel={cancelEditDraft}
        />
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Sent" value={rfq.sentAt ? rfq.sentAt.toLocaleString() : '—'} />
        <Stat
          label="First viewed"
          value={rfq.firstViewedAt ? rfq.firstViewedAt.toLocaleString() : '—'}
        />
        <Stat
          label="Responded"
          value={rfq.respondedAt ? rfq.respondedAt.toLocaleString() : '—'}
        />
        <Stat
          label="Latest total"
          value={latestQuote ? `$${latestQuote.total.toLocaleString()}` : '—'}
        />
      </div>

      {rfq.message ? (
        <div className="bg-cream-2 border border-line p-3 mb-4 text-[12px] text-ink-70 whitespace-pre-wrap">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Message to vendor
          </div>
          {rfq.message}
        </div>
      ) : null}

      {canShowLink ? (
        <div className="bg-warning/10 border-2 border-warning p-3 mb-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-warning font-extrabold mb-1">
            Email not sent — copy the link manually
          </div>
          <div className="text-[12px] text-ink-70 mb-2">
            The vendor needs this URL. The token is the credential — anyone with this link
            can submit a quote. Send it through your own channel (text, call, etc.) and
            then revoke once they have it.
          </div>
          <CopyableLink url={`${baseUrl}/q/__token__`} tokenHash={rfq.tokenHash} />
        </div>
      ) : null}

      {latestQuote ? (
        <div className="bg-paper border-2 border-ink mb-4 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
              {'// Latest quote — revision '}{latestQuote.revision}{' ('}{latestQuote.status}{')'}
            </div>
            <div className="text-[10px] text-ink-50 font-mono">
              {latestQuote.submittedAt.toLocaleString()}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px] mb-3">
            <Field label="Respondent" value={latestQuote.respondentName ?? '—'} />
            <Field label="Email" value={latestQuote.respondentEmail ?? '—'} mono />
            <Field label="Reference #" value={latestQuote.vendorReference ?? '—'} mono />
            <Field label="Lead time" value={latestQuote.leadTimeDays != null ? `${latestQuote.leadTimeDays} days` : '—'} />
            <Field label="Terms" value={latestQuote.terms ?? '—'} />
            <Field label="Attachment" value={latestQuote.attachmentName ?? '—'} mono />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-ink text-cream">
                  <th className="text-left px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em]">
                    Line
                  </th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em]">
                    Qty
                  </th>
                  <th className="text-left px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em]">
                    UoM
                  </th>
                  <th className="text-left px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em]">
                    SKU
                  </th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em]">
                    Unit
                  </th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em]">
                    Total
                  </th>
                  <th className="text-left px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {latestQuote.lines.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-b-0">
                    <td className="px-2 py-1.5">
                      <div className="font-extrabold">{l.description}</div>
                      {l.isSubstitute ? (
                        <div className="text-[10px] text-warning">
                          ↪ substitute: {l.substituteNote ?? '(no note)'}
                        </div>
                      ) : null}
                      {l.notes ? (
                        <div className="text-[10px] text-ink-50">{l.notes}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{l.quantity.toLocaleString()}</td>
                    <td className="px-2 py-1.5 font-mono text-[10px]">{l.uom}</td>
                    <td className="px-2 py-1.5 font-mono text-[10px]">{l.vendorSku ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {l.unitPrice != null ? `$${l.unitPrice.toFixed(4)}` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-extrabold">
                      {l.lineTotal != null ? `$${l.lineTotal.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-[10px]">
                      {l.available ? (
                        <span className="text-success">✓ avail</span>
                      ) : (
                        <span className="text-error">unavailable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="px-2 py-1.5 text-right text-[10px] font-mono uppercase text-ink-50">
                    Subtotal
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">${latestQuote.subtotal.toFixed(2)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={5} className="px-2 py-1.5 text-right text-[10px] font-mono uppercase text-ink-50">
                    Freight
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">${latestQuote.freightAmount.toFixed(2)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={5} className="px-2 py-1.5 text-right text-[10px] font-mono uppercase text-ink-50">
                    Tax
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">${latestQuote.taxAmount.toFixed(2)}</td>
                  <td></td>
                </tr>
                <tr className="bg-cream-2">
                  <td colSpan={5} className="px-2 py-1.5 text-right text-[11px] font-extrabold uppercase tracking-[0.1em]">
                    Total
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono font-extrabold text-[14px]">
                    ${latestQuote.total.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          {rfq.status === 'RESPONDED' && !rfq.po ? (
            <div className="flex justify-end mt-3">
              <Link
                href={`/w/${workspaceSlug}/procurement/compare?list=${rfq.listId}&accept=${rfq.id}`}
                className="px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d"
              >
                Compare & accept →
              </Link>
            </div>
          ) : null}
          {rfq.po ? (
            <div className="mt-3 text-[12px]">
              <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mr-1">
                PO
              </span>
              <Link
                href={`/w/${workspaceSlug}/procurement/pos/${rfq.po.id}`}
                className="font-mono font-extrabold text-orange-d hover:underline"
              >
                {rfq.po.number}
              </Link>
              <span className="ml-2 text-[10px] text-ink-50 font-mono">${rfq.po.total.toLocaleString()}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="bg-cream-2 border-2 border-line p-6 text-center text-[12px] text-ink-50 mb-4">
          {rfq.status === 'SENT' || rfq.status === 'VIEWED'
            ? 'Waiting for vendor to submit. You\'ll get a notification when they do.'
            : rfq.status === 'DRAFT'
            ? 'Not sent yet. Click "Send" to email the vendor.'
            : 'No quote submitted.'}
        </div>
      )}

      {rfq.events.length > 0 ? (
        <div className="bg-paper border-2 border-ink p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-2">
            Audit trail
          </div>
          <ul className="divide-y divide-line">
            {rfq.events.map((e) => (
              <li key={e.id} className="py-1.5 first:pt-0 last:pb-0 flex items-center gap-2 text-[12px]">
                <span className="font-mono text-[10px] text-ink-50 w-32">
                  {e.createdAt.toLocaleString()}
                </span>
                <span className="px-1.5 py-0.5 bg-cream-2 text-ink-50 text-[9px] font-extrabold uppercase tracking-[0.1em] w-24 text-center">
                  {e.type}
                </span>
                <span className="text-ink-50 text-[10px] font-mono">
                  {e.actor ?? 'system'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CopyableLink({ url }: { url: string; tokenHash: string }) {
  // We can't reconstruct the plaintext token from the hash.
  // The real flow: when the buyer resends, we generate a new
  // token and the resendRfqAction returns its URL. We display
  // a placeholder here as a reminder.
  const [copied, setCopied] = useState(false);
  const display = `${url.replace('/q/__token__', `/q/[token — see email]`)}`;
  return (
    <div className="flex gap-2 items-center">
      <code className="flex-1 px-2 py-1.5 bg-paper border border-line text-[11px] font-mono text-ink-50 overflow-x-auto">
        {display}
      </code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(display).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="px-3 py-1.5 bg-ink text-paper text-[11px] font-extrabold uppercase tracking-[0.12em]"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper border-2 border-ink p-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
        {`// ${label}`}
      </div>
      <div className="text-[12px] mt-1 font-mono truncate">{value}</div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">{label}</div>
      <div className={mono ? 'font-mono' : ''}>{value}</div>
    </div>
  );
}

/**
 * DraftEditForm — inline editor for DRAFT RFQs. Lets the
 * buyer fix the message, the needed-by date, and the
 * contact (which rep gets the email). Line items are NOT
 * editable from this view — to change line items, the
 * buyer goes to the source MaterialList.
 */
function DraftEditForm({
  rfq,
  contacts,
  pending,
  onSave,
  onCancel,
}: {
  rfq: RfqDetail;
  contacts: Array<{ id: string; name: string; email: string; isPrimary: boolean }>;
  pending: boolean;
  onSave: (patch: { message?: string | null; neededBy?: Date | null; contactId?: string | null }) => void;
  onCancel: () => void;
}) {
  const [message, setMessage] = useState(rfq.message ?? '');
  const [neededBy, setNeededBy] = useState(
    rfq.neededBy ? rfq.neededBy.toISOString().slice(0, 10) : '',
  );
  const [contactId, setContactId] = useState(rfq.contact?.id ?? '');

  return (
    <div className="bg-paper border-2 border-ink p-4 mb-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-3">
        {'// Edit DRAFT — changes apply before you send'}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <label className="block">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Send to (contact)
          </div>
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px]"
          >
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email}){c.isPrimary ? ' — primary' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
            Needed by
          </div>
          <input
            type="date"
            value={neededBy}
            onChange={(e) => setNeededBy(e.target.value)}
            className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px]"
          />
        </label>
      </div>
      <label className="block mb-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
          Message to vendor (optional)
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={4000}
          className="w-full px-2 py-1.5 bg-cream border border-line text-ink text-[12px] resize-y"
        />
      </label>
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-3 py-2 border-2 border-line text-[11px] font-extrabold uppercase tracking-[0.12em] hover:border-ink disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              message: message || null,
              neededBy: neededBy ? new Date(neededBy) : null,
              contactId: contactId || null,
            })
          }
          disabled={pending}
          className="px-3 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
