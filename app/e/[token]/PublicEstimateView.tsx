'use client';

/**
 * PublicEstimateView — the public approval page.
 *
 * Renders for a non-UDGOK user (the client). Shows
 * the estimate header, line items, totals, and the
 * Approve / Reject form (when status is SENT or
 * VIEWED). After approve / reject, shows the
 * terminal state with the audit line.
 *
 * The Approve / Reject form requires the user to
 * type their name + email — that's the audit
 * trail of "who clicked what" since we have no
 * auth on this route.
 */

import { useState, useTransition } from 'react';
import {
  publicApproveEstimateAction,
  publicRejectEstimateAction,
} from './actions';

interface LineItem {
  id: string;
  position: number;
  divisionCode: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

interface Estimate {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
  validUntil: string | null;
  subtotal: number;
  taxRate: number | null;
  taxAmount: number | null;
  total: number;
  createdByName: string;
  createdAt: string;
  sentAt: string | null;
  firstViewedAt: string | null;
  approvedAt: string | null;
  approvedByEmail: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  rejectedByEmail: string | null;
  rejectedByName: string | null;
  rejectNote: string | null;
  convertedAt: string | null;
  convertedProjectName: string | null;
  client: { name: string; email: string | null; phone: string | null };
  project: { name: string; code: string | null } | null;
  lineItems: LineItem[];
}

export function PublicEstimateView({
  token,
  estimate,
  workspaceName,
}: {
  token: string;
  estimate: Estimate;
  workspaceName: string;
}) {
  // Terminal states first.
  if (estimate.status === 'APPROVED' || estimate.status === 'CONVERTED' || estimate.status === 'REJECTED') {
    return <TerminalState estimate={estimate} workspaceName={workspaceName} />;
  }

  // SENT or VIEWED — show the form.
  return <ActionableView token={token} estimate={estimate} workspaceName={workspaceName} />;
}

function ActionableView({
  token,
  estimate,
  workspaceName,
}: {
  token: string;
  estimate: Estimate;
  workspaceName: string;
}) {
  const [showReject, setShowReject] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(estimate.client.email ?? '');
  const [rejectNote, setRejectNote] = useState('');
  const [result, setResult] = useState<'approved' | 'rejected' | null>(null);

  function approve(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required to approve');
      return;
    }
    const fd = new FormData();
    fd.set('token', token);
    fd.set('name', name);
    fd.set('email', email);
    startTransition(async () => {
      const res = await publicApproveEstimateAction(undefined, fd);
      if (res.ok) {
        setResult('approved');
      } else {
        setError(res.error);
      }
    });
  }

  function reject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !rejectNote.trim()) {
      setError('Name, email, and a reason are required to reject');
      return;
    }
    const fd = new FormData();
    fd.set('token', token);
    fd.set('name', name);
    fd.set('email', email);
    fd.set('note', rejectNote);
    startTransition(async () => {
      const res = await publicRejectEstimateAction(undefined, fd);
      if (res.ok) {
        setResult('rejected');
        setShowReject(false);
      } else {
        setError(res.error);
      }
    });
  }

  if (result === 'approved') {
    return <TerminalState estimate={{ ...estimate, status: 'APPROVED', approvedAt: new Date().toISOString(), approvedByName: name, approvedByEmail: email }} workspaceName={workspaceName} />;
  }
  if (result === 'rejected') {
    return <TerminalState estimate={{ ...estimate, status: 'REJECTED', rejectedAt: new Date().toISOString(), rejectedByName: name, rejectedByEmail: email, rejectNote: rejectNote }} workspaceName={workspaceName} />;
  }

  return (
    <div className="max-w-3xl mx-auto p-5 sm:p-8">
      <header className="border-b-2 border-ink pb-4 mb-6 flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
            {workspaceName}
          </div>
          <h1 className="text-2xl font-black mt-0.5">Estimate {estimate.number}</h1>
        </div>
        <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-ink-50">
          {estimate.status === 'VIEWED' ? '👁 Viewed' : 'Sent'}
        </div>
      </header>

      <h2 className="text-[20px] font-extrabold mb-1">{estimate.title}</h2>
      <div className="text-[12px] text-ink-70 mb-3">
        Prepared for {estimate.client.name}
        {estimate.project ? ` · ${estimate.project.name}` : ''}
      </div>
      {estimate.description ? (
        <p className="text-[13px] text-ink-70 mb-4 whitespace-pre-wrap">{estimate.description}</p>
      ) : null}

      <EstimateLineItems estimate={estimate} />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Approve form */}
        <form
          onSubmit={approve}
          className="bg-paper border-2 border-ink p-4"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-2">
            Approve this estimate
          </div>
          <div className="text-[12px] text-ink-70 mb-3">
            By approving, you agree to the scope and total above. The contractor will be notified and can convert this into a project.
          </div>
          <div className="space-y-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              className="w-full px-3 py-2 bg-cream border border-line text-[13px] text-ink focus:outline-none focus:border-ink"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              className="w-full px-3 py-2 bg-cream border border-line text-[13px] text-ink focus:outline-none focus:border-ink"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full min-h-[48px] bg-success text-paper text-[12px] font-extrabold uppercase tracking-[0.12em] hover:bg-success/90 disabled:opacity-50"
            >
              {pending ? 'Recording…' : `✓ Approve — $${estimate.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </button>
          </div>
        </form>

        {/* Reject form (collapsible) */}
        <div className="bg-paper border-2 border-ink p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-2">
            Request changes
          </div>
          {!showReject ? (
            <>
              <div className="text-[12px] text-ink-70 mb-3">
                Not ready? Tell the contractor what to change.
              </div>
              <button
                type="button"
                onClick={() => setShowReject(true)}
                className="w-full min-h-[48px] border-2 border-ink text-ink text-[12px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-paper"
              >
                Request changes
              </button>
            </>
          ) : (
            <form onSubmit={reject} className="space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full px-3 py-2 bg-cream border border-line text-[13px] text-ink focus:outline-none focus:border-ink"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                className="w-full px-3 py-2 bg-cream border border-line text-[13px] text-ink focus:outline-none focus:border-ink"
              />
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="What needs to change? (required)"
                rows={3}
                required
                className="w-full px-3 py-2 bg-cream border border-line text-[12px] text-ink resize-none focus:outline-none focus:border-ink"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReject(false);
                    setRejectNote('');
                  }}
                  className="flex-1 min-h-[44px] text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-70 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 min-h-[44px] border-2 border-error text-error text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-error/10 disabled:opacity-50"
                >
                  Send feedback
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {error ? (
        <div className="text-[11px] text-error font-mono bg-error/10 border border-error px-2 py-1.5 mt-3">
          {error}
        </div>
      ) : null}

      <footer className="mt-8 pt-4 border-t border-line text-[10px] font-mono text-ink-50 text-center">
        This estimate was prepared by {workspaceName}. It is valid through{' '}
        {estimate.validUntil ? new Date(estimate.validUntil).toLocaleDateString() : 'further notice'}.
      </footer>
    </div>
  );
}

function TerminalState({
  estimate,
  workspaceName,
}: {
  estimate: Estimate;
  workspaceName: string;
}) {
  return (
    <div className="max-w-3xl mx-auto p-5 sm:p-8">
      <header className="border-b-2 border-ink pb-4 mb-6 flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
            {workspaceName}
          </div>
          <h1 className="text-2xl font-black mt-0.5">Estimate {estimate.number}</h1>
        </div>
        <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-ink-50">
          {estimate.status === 'APPROVED' ? '✓ Approved' : estimate.status === 'CONVERTED' ? '→ Project' : '✗ Rejected'}
        </div>
      </header>

      {estimate.status === 'APPROVED' ? (
        <div className="bg-success/10 border-2 border-success p-5 text-center mb-6">
          <div className="text-3xl mb-2" aria-hidden="true">✓</div>
          <div className="text-[16px] font-extrabold text-success">
            Estimate approved
          </div>
          {estimate.approvedAt ? (
            <div className="text-[12px] text-ink-70 mt-1">
              Approved by {estimate.approvedByName ?? 'client'}
              {estimate.approvedByEmail ? ` (${estimate.approvedByEmail})` : ''}
              {' · '}
              {new Date(estimate.approvedAt).toLocaleString()}
            </div>
          ) : null}
          <div className="text-[11px] text-ink-50 mt-2">
            {workspaceName} has been notified. They&apos;ll be in touch to kick off the project.
          </div>
        </div>
      ) : null}

      {estimate.status === 'CONVERTED' ? (
        <div className="bg-orange/10 border-2 border-orange p-5 text-center mb-6">
          <div className="text-3xl mb-2" aria-hidden="true">→</div>
          <div className="text-[16px] font-extrabold text-orange">
            Project started
          </div>
          {estimate.convertedAt ? (
            <div className="text-[12px] text-ink-70 mt-1">
              Converted to project on {new Date(estimate.convertedAt).toLocaleDateString()}
            </div>
          ) : null}
        </div>
      ) : null}

      {estimate.status === 'REJECTED' ? (
        <div className="bg-error/10 border-2 border-error p-5 text-center mb-6">
          <div className="text-3xl mb-2" aria-hidden="true">✗</div>
          <div className="text-[16px] font-extrabold text-error">
            Changes requested
          </div>
          {estimate.rejectedAt ? (
            <div className="text-[12px] text-ink-70 mt-1">
              By {estimate.rejectedByName ?? 'client'}
              {estimate.rejectedByEmail ? ` (${estimate.rejectedByEmail})` : ''}
              {' · '}
              {new Date(estimate.rejectedAt).toLocaleString()}
            </div>
          ) : null}
          {estimate.rejectNote ? (
            <div className="text-[12px] text-ink-70 mt-2 italic">
              &ldquo;{estimate.rejectNote}&rdquo;
            </div>
          ) : null}
        </div>
      ) : null}

      <h2 className="text-[20px] font-extrabold mb-1">{estimate.title}</h2>
      <div className="text-[12px] text-ink-70 mb-3">
        Prepared for {estimate.client.name}
        {estimate.project ? ` · ${estimate.project.name}` : ''}
      </div>
      {estimate.description ? (
        <p className="text-[13px] text-ink-70 mb-4 whitespace-pre-wrap">{estimate.description}</p>
      ) : null}

      <EstimateLineItems estimate={estimate} />
    </div>
  );
}

function EstimateLineItems({ estimate }: { estimate: Estimate }) {
  return (
    <div className="bg-paper border-2 border-ink overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-cream border-b-2 border-ink">
            <th className="text-left px-2 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-24">
              CSI
            </th>
            <th className="text-left px-2 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50">
              Description
            </th>
            <th className="text-right px-2 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-20">
              Qty
            </th>
            <th className="text-left px-2 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-16">
              Unit
            </th>
            <th className="text-right px-2 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-28">
              Unit price
            </th>
            <th className="text-right px-2 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-28">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {estimate.lineItems.map((li) => (
            <tr key={li.id} className="border-b border-line last:border-b-0">
              <td className="px-2 py-1.5 font-mono text-ink-50 text-[11px]">
                {li.divisionCode ?? '—'}
              </td>
              <td className="px-2 py-1.5 text-ink">{li.description}</td>
              <td className="px-2 py-1.5 text-right font-mono text-ink-70">
                {li.quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </td>
              <td className="px-2 py-1.5 font-mono text-ink-50 text-[11px]">{li.unit}</td>
              <td className="px-2 py-1.5 text-right font-mono text-ink-70">
                ${li.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-ink font-extrabold">
                ${li.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-cream">
            <td colSpan={5} className="px-2 py-2 text-right text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
              Subtotal
            </td>
            <td className="px-2 py-2 text-right font-extrabold text-ink">
              ${estimate.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </td>
          </tr>
          {estimate.taxAmount ? (
            <tr className="bg-cream">
              <td colSpan={5} className="px-2 py-1.5 text-right text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                Tax{estimate.taxRate ? ` (${(estimate.taxRate * 100).toFixed(2)}%)` : ''}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-ink-70">
                ${estimate.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ) : null}
          <tr className="bg-cream border-t border-line">
            <td colSpan={5} className="px-2 py-2 text-right text-[10px] font-mono uppercase tracking-[0.12em] text-ink font-extrabold">
              Total
            </td>
            <td className="px-2 py-2 text-right font-extrabold text-[16px] text-orange">
              ${estimate.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
