'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { acceptQuoteAndCreatePoAction } from '@/lib/procurement/po-actions';
import type { CompareData } from '@/lib/procurement/compare-queries';

export function CompareView({
  data,
  workspaceId,
  workspaceSlug,
}: {
  data: CompareData;
  workspaceId: string;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // For each row, the chosen vendorId (default = lowest price).
  // Per spec §11: "Mixed award generates one PO per vendor."
  const [picks, setPicks] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const row of data.rows) {
      const priced = row.vendors.filter((v) => v.unitPrice != null && v.available);
      if (priced.length === 0) continue;
      const cheapest = priced.reduce((a, b) =>
        (a.unitPrice ?? Infinity) <= (b.unitPrice ?? Infinity) ? a : b,
      );
      out[row.listLineId] = cheapest.vendorId;
    }
    return out;
  });

  // Per-vendor total across picks.
  const vendorTotals = useMemo(() => {
    const totals = new Map<string, { total: number; lineCount: number; name: string }>();
    for (const row of data.rows) {
      const vendorId = picks[row.listLineId];
      if (!vendorId) continue;
      const v = row.vendors.find((vv) => vv.vendorId === vendorId);
      if (!v || v.lineTotal == null) continue;
      const cur = totals.get(vendorId) ?? { total: 0, lineCount: 0, name: v.vendorName };
      cur.total += v.lineTotal;
      cur.lineCount += 1;
      totals.set(vendorId, cur);
    }
    return Array.from(totals.entries()).map(([vendorId, v]) => ({
      vendorId,
      ...v,
    }));
  }, [picks, data.rows]);

  function pickLine(listLineId: string, vendorId: string) {
    setPicks((prev) => ({ ...prev, [listLineId]: vendorId }));
  }

  function awardAll() {
    if (vendorTotals.length === 0) return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      // Find each vendor's RFQ that we need to accept.
      const rfqIdsByVendor = new Map<string, string>();
      for (const row of data.rows) {
        const vendorId = picks[row.listLineId];
        if (!vendorId) continue;
        const v = row.vendors.find((vv) => vv.vendorId === vendorId);
        if (!v?.rfqId) continue;
        rfqIdsByVendor.set(vendorId, v.rfqId);
      }
      // Process one at a time. Per spec, one PO per vendor.
      const results: string[] = [];
      for (const [vendorId, rfqId] of rfqIdsByVendor.entries()) {
        const fd = new FormData();
        fd.set('rfqId', rfqId);
        const res = await acceptQuoteAndCreatePoAction(workspaceId, undefined, fd);
        if (res.ok) {
          results.push(`${vendorId}: ${res.poNumber} ($${res.total.toLocaleString()})`);
        } else {
          setError(`Failed to create PO for vendor ${vendorId}: ${res.error}`);
          return;
        }
      }
      setInfo(`Created ${results.length} PO${results.length === 1 ? '' : 's'}: ${results.join(', ')}`);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="bg-paper border-2 border-ink overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-ink text-cream">
              <th className="text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] sticky left-0 bg-ink z-10 min-w-[260px]">
                Line item
              </th>
              {data.vendors.map((v) => (
                <th
                  key={v.id}
                  className="text-right px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] min-w-[140px]"
                >
                  {v.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => {
              // Find cheapest non-substitute available.
              const candidates = row.vendors.filter(
                (v) => v.unitPrice != null && v.available && !v.isSubstitute,
              );
              const cheapest = candidates.length
                ? candidates.reduce((a, b) =>
                    (a.unitPrice ?? Infinity) <= (b.unitPrice ?? Infinity) ? a : b,
                  )
                : null;
              return (
                <tr key={row.listLineId} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-2 sticky left-0 bg-paper z-10">
                    <div className="font-extrabold">{row.description}</div>
                    <div className="text-[10px] text-ink-50 font-mono">
                      {row.quantity.toLocaleString()} {row.uom}
                    </div>
                  </td>
                  {row.vendors.map((v) => {
                    const isCheapest = cheapest?.vendorId === v.vendorId;
                    const isPicked = picks[row.listLineId] === v.vendorId;
                    return (
                      <td
                        key={v.vendorId}
                        className={`px-3 py-2 text-right font-mono ${
                          isPicked ? 'bg-orange/10' : ''
                        }`}
                      >
                        {v.unitPrice == null ? (
                          <span className="text-ink-50">—</span>
                        ) : !v.available ? (
                          <span className="text-error">unavailable</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => pickLine(row.listLineId, v.vendorId)}
                            className="w-full text-right hover:text-orange-d disabled:opacity-50"
                          >
                            <div className="flex items-center justify-end gap-1">
                              {isCheapest ? (
                                <span className="text-success text-[10px]" title="Lowest">
                                  ★
                                </span>
                              ) : null}
                              <span>${v.unitPrice.toFixed(4)}</span>
                            </div>
                            <div className="text-[10px] text-ink-50 font-mono">
                              ${v.lineTotal?.toFixed(2) ?? '—'}
                            </div>
                            {v.leadTimeDays != null ? (
                              <div className="text-[10px] text-ink-50 font-mono">
                                {v.leadTimeDays}d lead
                              </div>
                            ) : null}
                            {v.isSubstitute ? (
                              <div className="text-[9px] text-warning font-mono uppercase tracking-[0.1em]">
                                sub
                              </div>
                            ) : null}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-paper border-2 border-ink mt-3 p-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-2">
          Award summary
        </div>
        {vendorTotals.length === 0 ? (
          <div className="text-[12px] text-ink-50">No lines selected.</div>
        ) : (
          <ul className="space-y-1">
            {vendorTotals.map((v) => (
              <li key={v.vendorId} className="text-[12px] flex items-center gap-2">
                <span className="font-extrabold flex-1">{v.name}</span>
                <span className="text-[10px] text-ink-50 font-mono">
                  {v.lineCount} line{v.lineCount === 1 ? '' : 's'}
                </span>
                <span className="font-mono font-extrabold">${v.total.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <div className="mt-3 bg-error/10 border border-error p-2 text-[12px] text-error font-semibold">
          ⚠ {error}
        </div>
      ) : null}
      {info ? (
        <div className="mt-3 bg-success/10 border border-success p-2 text-[12px] text-success">
          {info}
        </div>
      ) : null}

      <div className="flex justify-end mt-3 gap-2">
        <Link
          href={`/w/${workspaceSlug}/procurement/lists/${data.list.id}`}
          className="px-3 py-2 border border-line text-[11px] font-extrabold uppercase tracking-[0.12em]"
        >
          Back to list
        </Link>
        <button
          type="button"
          onClick={awardAll}
          disabled={pending || vendorTotals.length === 0}
          className="px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
        >
          {pending
            ? 'Creating POs…'
            : `Award ${vendorTotals.length} PO${vendorTotals.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
