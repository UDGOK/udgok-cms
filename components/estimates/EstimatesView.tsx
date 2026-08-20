'use client';

/**
 * EstimatesView — workspace list + filters.
 *
 * Mirrors the timesheets grid pattern: a header
 * with the "New estimate" CTA, two filter dropdowns
 * (status + client), and a table of estimates with
 * status badges. Each row links to the detail page.
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { EstimateStatus } from '@prisma/client';

interface EstimateRow {
  id: string;
  number: string;
  title: string;
  status: EstimateStatus;
  clientId: string;
  clientName: string;
  projectId: string | null;
  projectName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  total: number;
  validUntil: string | null;
  createdAt: string;
  sentAt: string | null;
  approvedAt: string | null;
  convertedProjectId: string | null;
  convertedProjectName: string | null;
}

export function EstimatesView({
  workspaceSlug,
  canEdit,
  estimates,
  clients,
  status,
  clientId,
}: {
  workspaceSlug: string;
  canEdit: boolean;
  estimates: EstimateRow[];
  clients: { id: string; name: string }[];
  status: EstimateStatus | null;
  clientId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const search = useSearchParams();

  function setFilter(key: 'status' | 'clientId', value: string | null) {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`/w/${workspaceSlug}/estimates?${params.toString()}`);
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
            Estimates
          </div>
          <h1 className="text-2xl font-black mt-0.5">Client proposals</h1>
        </div>
        {canEdit ? (
          <Link
            href={`/w/${workspaceSlug}/estimates/new${clientId ? `?clientId=${clientId}` : ''}`}
            className="px-4 py-2 bg-orange text-paper text-[11px] font-extrabold uppercase tracking-[0.12em] border-2 border-orange hover:bg-orange-d"
          >
            + New estimate
          </Link>
        ) : null}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterSelect
          label="Status"
          value={status ?? ''}
          onChange={(v) => setFilter('status', v || null)}
          options={[
            { value: '', label: 'All' },
            { value: 'DRAFT', label: 'Draft' },
            { value: 'SENT', label: 'Sent' },
            { value: 'VIEWED', label: 'Viewed' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' },
            { value: 'CONVERTED', label: 'Converted' },
          ]}
        />
        <FilterSelect
          label="Client"
          value={clientId ?? ''}
          onChange={(v) => setFilter('clientId', v || null)}
          options={[
            { value: '', label: 'All clients' },
            ...clients.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        {(status || clientId) ? (
          <Link
            href={`/w/${workspaceSlug}/estimates`}
            className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink underline"
          >
            Clear filters
          </Link>
        ) : null}
        {pending ? (
          <span className="text-[10px] font-mono text-ink-50">…</span>
        ) : null}
      </div>

      {/* Empty state */}
      {estimates.length === 0 ? (
        <div className="bg-cream-2 border-2 border-line p-8 text-center">
          <div className="text-3xl mb-2" aria-hidden="true">📄</div>
          <div className="text-[14px] font-extrabold text-ink">No estimates yet</div>
          <div className="text-[11px] text-ink-50 mt-1">
            Click <span className="font-extrabold">+ New estimate</span> to draft a proposal for a client.
          </div>
        </div>
      ) : (
        <div className="bg-paper border-2 border-ink overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-cream border-b-2 border-ink">
                <th className="text-left px-3 py-2 font-extrabold uppercase tracking-[0.1em] text-[10px] text-ink-50">
                  #
                </th>
                <th className="text-left px-3 py-2 font-extrabold uppercase tracking-[0.1em] text-[10px] text-ink-50">
                  Title
                </th>
                <th className="text-left px-3 py-2 font-extrabold uppercase tracking-[0.1em] text-[10px] text-ink-50">
                  Client
                </th>
                <th className="text-left px-3 py-2 font-extrabold uppercase tracking-[0.1em] text-[10px] text-ink-50">
                  Project
                </th>
                <th className="text-right px-3 py-2 font-extrabold uppercase tracking-[0.1em] text-[10px] text-ink-50">
                  Total
                </th>
                <th className="text-right px-3 py-2 font-extrabold uppercase tracking-[0.1em] text-[10px] text-ink-50">
                  Status
                </th>
                <th className="text-right px-3 py-2 font-extrabold uppercase tracking-[0.1em] text-[10px] text-ink-50">
                  Sent
                </th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-line last:border-b-0 hover:bg-cream-2"
                >
                  <td className="px-3 py-2 font-mono text-ink-50 text-[10px]">
                    {e.number}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/w/${workspaceSlug}/estimates/${e.id}`}
                      className="font-extrabold text-ink hover:underline"
                    >
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-ink-70">
                    {e.clientName}
                  </td>
                  <td className="px-3 py-2 text-ink-70">
                    {e.projectName ? (
                      <span className="text-[11px]">{e.projectName}</span>
                    ) : (
                      <span className="text-ink-30">—</span>
                    )}
                  </td>
                  <td className="text-right px-3 py-2 font-extrabold text-ink">
                    ${e.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="text-right px-3 py-2">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="text-right px-3 py-2 text-[10px] font-mono text-ink-50">
                    {e.sentAt ? new Date(e.sentAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 bg-cream border border-line text-[12px] text-ink focus:outline-none focus:border-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusBadge({ status }: { status: EstimateStatus }) {
  const palette: Record<EstimateStatus, { bg: string; fg: string; label: string }> = {
    DRAFT: { bg: 'bg-cream', fg: 'text-ink-70 border-line', label: 'Draft' },
    SENT: { bg: 'bg-info/10', fg: 'text-info border-info/40', label: 'Sent' },
    VIEWED: { bg: 'bg-info/15', fg: 'text-info border-info/50', label: '👁 Viewed' },
    APPROVED: { bg: 'bg-success/15', fg: 'text-success border-success/40', label: '✓ Approved' },
    REJECTED: { bg: 'bg-error/10', fg: 'text-error border-error/40', label: '✗ Rejected' },
    CONVERTED: { bg: 'bg-orange/15', fg: 'text-orange border-orange/40', label: 'Converted' },
  };
  const p = palette[status];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] border ${p.bg} ${p.fg}`}
    >
      {p.label}
    </span>
  );
}
