/**
 * Admin / Lead detail — view a single lead with full message + metadata,
 * update status, and add an internal note (notes are stored in
 * MarketingLead.metadata.notes for now).
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { isMasterAdmin } from '@/lib/admin/permissions';
import { prisma } from '@/lib/db/client';
import { relativeTime } from '@/lib/format/relative-time';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'] as const;
type LeadStatus = (typeof STATUSES)[number];

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-orange text-paper',
  contacted: 'bg-warning text-ink',
  qualified: 'bg-info text-paper',
  won: 'bg-success text-paper',
  lost: 'bg-ink-30 text-ink',
};

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/admin/leads');
  if (!(await isMasterAdmin(userId))) {
    return (
      <div className="max-w-md text-center py-12">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-black mb-2">Master admin only</h1>
      </div>
    );
  }

  const lead = await prisma.marketingLead.findUnique({ where: { id: params.id } });
  if (!lead) notFound();

  async function updateStatus(formData: FormData) {
    'use server';
    const { userId: caller } = await auth();
    if (!caller || !(await isMasterAdmin(caller))) return;
    const id = String(formData.get('id') ?? '');
    const status = String(formData.get('status') ?? '') as LeadStatus;
    if (!STATUSES.includes(status)) return;
    await prisma.marketingLead.update({
      where: { id },
      data: { status },
    });
    revalidatePath(`/admin/leads/${id}`);
    revalidatePath('/admin/leads');
  }

  const meta = (lead.metadata ?? {}) as Record<string, unknown>;
  const notes = typeof meta.notes === 'string' ? meta.notes : '';

  return (
    <div>
      <Link href="/admin/leads" className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink">
        ← All leads
      </Link>

      <div className="mt-2 mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{lead.name ?? lead.email}</h1>
          <p className="text-ink-70 text-sm mt-1 font-mono">
            {lead.email}
            {lead.company ? ` · ${lead.company}` : ''}
            {lead.phone ? ` · ${lead.phone}` : ''}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span
              className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] ${
                STATUS_COLORS[lead.status] ?? 'bg-ink-30 text-ink'
              }`}
            >
              {lead.status}
            </span>
            <span className="px-2 py-0.5 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.1em]">
              {lead.source}
            </span>
            {lead.plan ? (
              <span className="px-2 py-0.5 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.1em]">
                {lead.plan}
              </span>
            ) : null}
            <span className="text-[11px] text-ink-50 font-mono">
              {relativeTime(lead.createdAt.toISOString())}
            </span>
          </div>
        </div>
        <a
          href={`mailto:${lead.email}?subject=Re: UDGOK CMS — ${encodeURIComponent(lead.source)}`}
          className="px-4 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d"
        >
          Reply via email →
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-4">
          {/* Message */}
          <div className="bg-paper border-2 border-ink p-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 font-bold mb-2">
              {'// Message'}
            </div>
            <div className="text-[14px] text-ink leading-relaxed whitespace-pre-wrap">
              {lead.message ?? '—'}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-paper border-2 border-line p-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 font-bold mb-2">
              {'// Internal notes'}
            </div>
            <div className="text-[12px] text-ink-70 whitespace-pre-wrap">
              {notes || <em>No notes yet.</em>}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Status updater */}
          <form action={updateStatus} className="bg-paper border-2 border-line p-4">
            <input type="hidden" name="id" value={lead.id} />
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 font-bold mb-2">
              {'// Update status'}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="submit"
                  name="status"
                  value={s}
                  className={`px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.1em] border-2 transition-colors ${
                    lead.status === s
                      ? 'border-ink bg-ink text-cream'
                      : 'border-line text-ink-70 hover:border-ink'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </form>

          {/* Metadata */}
          <div className="bg-paper border-2 border-line p-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 font-bold mb-2">
              {'// Source data'}
            </div>
            <table className="w-full text-[12px]">
              <tbody>
                <Row label="Source" value={lead.source} />
                <Row label="Plan" value={lead.plan} />
                <Row label="Page" value={lead.page} />
                <Row label="Created" value={new Date(lead.createdAt).toLocaleString()} />
                <Row label="Referer" value={typeof meta.referer === 'string' ? meta.referer : null} />
                <Row label="User agent" value={typeof meta.userAgent === 'string' ? meta.userAgent.slice(0, 80) : null} />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <tr>
      <td className="text-ink-50 font-mono py-1 pr-3 align-top text-[11px]">{label}</td>
      <td className="py-1 break-words text-[11px] font-mono">{value ?? '—'}</td>
    </tr>
  );
}
