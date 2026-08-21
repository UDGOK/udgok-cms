'use client';

import Link from 'next/link';
import type { VendorListItem } from '@/lib/procurement/queries';

export function VendorsList({
  items,
  workspaceSlug,
}: {
  items: VendorListItem[];
  workspaceSlug: string;
}) {
  if (items.length === 0) {
    return (
      <div className="bg-cream-2 border-2 border-line p-6 text-center">
        <div className="text-[13px] text-ink-50 mb-3">No vendors yet.</div>
        <Link
          href={`/w/${workspaceSlug}/procurement/vendors/new`}
          className="inline-block px-3 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d"
        >
          + Add your first vendor
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-paper border-2 border-ink overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-ink text-cream">
            <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
              Name
            </th>
            <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
              Capability
            </th>
            <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
              Status
            </th>
            <th className="text-right px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
              Contacts
            </th>
            <th className="text-right px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
              Quotes
            </th>
            <th className="text-right px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
              POs
            </th>
            <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
              Pay methods
            </th>
            <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">
              Last quoted
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr
              key={v.id}
              className="border-b border-line last:border-b-0 hover:bg-cream-2 transition-colors"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/w/${workspaceSlug}/procurement/vendors/${v.id}`}
                  className="font-extrabold text-ink hover:text-orange-d"
                >
                  {v.name}
                </Link>
                {v.legalName && v.legalName !== v.name ? (
                  <div className="text-[10px] text-ink-50">{v.legalName}</div>
                ) : null}
              </td>
              <td className="px-3 py-2 text-[11px] font-mono text-ink-70">{v.capability}</td>
              <td className="px-3 py-2">
                <span
                  className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                    v.status === 'ACTIVE'
                      ? 'bg-success/15 text-success'
                      : 'bg-ink-50/15 text-ink-50'
                  }`}
                >
                  {v.status}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono">{v.contactCount}</td>
              <td className="px-3 py-2 text-right font-mono">{v.quoteCount}</td>
              <td className="px-3 py-2 text-right font-mono">{v.poCount}</td>
              <td className="px-3 py-2 text-[10px]">
                <Link
                  href={`/w/${workspaceSlug}/procurement/vendors/${v.id}/payment-methods`}
                  className="text-ink-50 hover:text-orange-d font-mono"
                >
                  {(v as { paymentMethodCount?: number }).paymentMethodCount
                    ? `${(v as { paymentMethodCount?: number }).paymentMethodCount} on file`
                    : '+ add'}
                </Link>
              </td>
              <td className="px-3 py-2 text-[10px] text-ink-50">
                {v.lastQuotedAt
                  ? new Date(v.lastQuotedAt).toLocaleDateString()
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
