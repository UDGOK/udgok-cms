/**
 * Admin / Leads — list of MarketingLead rows.
 *
 * Master admin only. Shows the most recent leads first, with status
 * badges and a quick view. Click a row to see the full message.
 */

import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isMasterAdmin } from '@/lib/admin/permissions';
import { prisma } from '@/lib/db/client';
import { relativeTime } from '@/lib/format/relative-time';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-orange text-paper',
  contacted: 'bg-warning text-ink',
  qualified: 'bg-info text-paper',
  won: 'bg-success text-paper',
  lost: 'bg-ink-30 text-ink',
};

export default async function AdminLeadsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/admin/leads');
  if (!(await isMasterAdmin(userId))) {
    return (
      <div className="max-w-md text-center py-12">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-black mb-2">Master admin only</h1>
        <p className="text-ink-70 text-sm">This page is restricted to platform owners.</p>
      </div>
    );
  }

  const [leads, totals] = await Promise.all([
    prisma.marketingLead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.marketingLead.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ]);

  const totalCount = leads.length;
  const newCount = totals.find((t) => t.status === 'new')?._count._all ?? 0;
  const qualifiedCount = totals.find((t) => t.status === 'qualified')?._count._all ?? 0;
  const wonCount = totals.find((t) => t.status === 'won')?._count._all ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Leads</h1>
          <p className="text-ink-70 text-sm mt-1">
            Inbound from /contact, enterprise inquiry, and the marketing site.
          </p>
        </div>
        <div className="flex gap-3 text-[11px] font-mono">
          <Stat label="Total" value={totalCount} />
          <Stat label="New" value={newCount} highlight />
          <Stat label="Qualified" value={qualifiedCount} />
          <Stat label="Won" value={wonCount} />
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="bg-paper border-2 border-line p-12 text-center">
          <div className="text-4xl mb-3">📥</div>
          <p className="text-ink-70">No leads yet. Submit a test from <Link href="/contact" className="text-orange-d underline">/contact</Link>.</p>
        </div>
      ) : (
        <div className="bg-paper border-2 border-line">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-ink text-cream">
                  <th className="text-left px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.12em]">Email</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.12em]">Name</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.12em]">Company</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.12em]">Source</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.12em]">Plan</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.12em]">Status</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.12em]">When</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-b-0 hover:bg-cream-2">
                    <td className="px-4 py-2.5 font-mono">
                      <Link href={`/admin/leads/${l.id}`} className="text-ink hover:text-orange-d">
                        {l.email}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{l.name ?? '—'}</td>
                    <td className="px-4 py-2.5">{l.company ?? '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px]">{l.source}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px]">{l.plan ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                          STATUS_COLORS[l.status] ?? 'bg-ink-30 text-ink'
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-50 text-[11px] font-mono">
                      {relativeTime(l.createdAt.toISOString())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`px-3 py-1.5 border-2 ${highlight && value > 0 ? 'bg-orange text-paper border-orange' : 'border-line text-ink-70'}`}>
      <div className="text-[9px] uppercase tracking-[0.15em] opacity-80">{label}</div>
      <div className="font-black text-lg leading-none">{value}</div>
    </div>
  );
}
