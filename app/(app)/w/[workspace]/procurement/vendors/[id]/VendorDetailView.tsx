'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { archiveVendorAction } from '@/lib/procurement/actions';
import { NewContactForm } from './NewContactForm';
import { EditVendorForm, type EditableVendor } from './EditVendorForm';
import { EditContactForm, type EditableContact } from './EditContactForm';
import { DeleteContactButton } from './DeleteContactButton';
import type { VendorDetail } from '@/lib/procurement/queries';

export function VendorDetailView({
  vendor,
  workspaceId,
  workspaceSlug,
}: {
  vendor: VendorDetail;
  workspaceId: string;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingVendor, setEditingVendor] = useState(false);
  const [editingContact, setEditingContact] = useState<EditableContact | null>(null);

  function archive() {
    if (
      !confirm(
        `Archive ${vendor.name}? Existing RFQs and POs are preserved, but the vendor will be hidden from new pickers.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await archiveVendorAction(workspaceId, vendor.id);
      if (res.ok) {
        router.push(`/w/${workspaceSlug}/procurement/vendors`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mt-2 mb-4">
        <div>
          <h1 className="text-2xl font-black">{vendor.name}</h1>
          {vendor.legalName && vendor.legalName !== vendor.name ? (
            <div className="text-[12px] text-ink-50 font-mono">{vendor.legalName}</div>
          ) : null}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                vendor.status === 'ACTIVE'
                  ? 'bg-success/15 text-success'
                  : 'bg-ink-50/15 text-ink-50'
              }`}
            >
              {vendor.status}
            </span>
            <span className="px-1.5 py-0.5 bg-cream-2 text-ink-50 text-[9px] font-extrabold uppercase tracking-[0.1em]">
              {vendor.capability}
            </span>
            {vendor.taxExempt ? (
              <span className="px-1.5 py-0.5 bg-info/15 text-info text-[9px] font-extrabold uppercase tracking-[0.1em]">
                Tax-exempt
              </span>
            ) : null}
            {vendor.defaultTerms ? (
              <span className="px-1.5 py-0.5 bg-cream-2 text-ink-50 text-[9px] font-extrabold uppercase tracking-[0.1em] font-mono">
                {vendor.defaultTerms}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditingVendor(true)}
            className="px-3 py-2 bg-ink text-cream border-2 border-ink text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d hover:border-orange-d"
          >
            Edit vendor
          </button>
          {vendor.status === 'ACTIVE' ? (
            <button
              type="button"
              onClick={archive}
              disabled={pending}
              className="px-3 py-2 border-2 border-error text-error text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-error/10 disabled:opacity-50"
            >
              {pending ? 'Archiving…' : 'Archive'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <Stat label="Contacts" value={vendor.contacts.length} />
        <Stat label="Quotes (last 10)" value={vendor.recentQuotes.length} />
        <Stat label="POs (last 10)" value={vendor.recentPos.length} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-paper border-2 border-ink p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-2">
            Contact info
          </div>
          {vendor.phone ? (
            <div className="text-[12px] mb-1">
              <span className="text-ink-50 font-mono text-[10px] uppercase tracking-[0.1em] mr-1">Phone</span>
              <span className="font-mono">{vendor.phone}</span>
            </div>
          ) : null}
          {vendor.website ? (
            <div className="text-[12px] mb-1">
              <span className="text-ink-50 font-mono text-[10px] uppercase tracking-[0.1em] mr-1">Web</span>
              <a
                href={vendor.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-d underline truncate inline-block max-w-full align-bottom"
              >
                {vendor.website}
              </a>
            </div>
          ) : null}
          {vendor.addressLine1 || vendor.city ? (
            <div className="text-[12px] mb-1">
              <span className="text-ink-50 font-mono text-[10px] uppercase tracking-[0.1em] mr-1">Addr</span>
              <div className="font-mono">
                {vendor.addressLine1}
                {vendor.addressLine2 ? <>, {vendor.addressLine2}</> : null}
                {(vendor.city || vendor.state) ? (
                  <div>
                    {vendor.city}
                    {vendor.state ? `, ${vendor.state}` : null} {vendor.postalCode ?? ''}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {vendor.accountNumber ? (
            <div className="text-[12px] mb-1">
              <span className="text-ink-50 font-mono text-[10px] uppercase tracking-[0.1em] mr-1">Acct</span>
              <span className="font-mono">{vendor.accountNumber}</span>
            </div>
          ) : null}
          {!vendor.phone && !vendor.website && !vendor.addressLine1 ? (
            <div className="text-[11px] text-ink-50">No contact info yet — edit the vendor to add it.</div>
          ) : null}
        </div>

        <div className="bg-paper border-2 border-ink p-4 md:col-span-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-2">
            Contacts
          </div>
          {vendor.contacts.length === 0 ? (
            <div className="text-[11px] text-ink-50 mb-3">
              No contacts. Add at least one — RFQs are sent to a contact&apos;s email.
            </div>
          ) : (
            <ul className="mb-3 divide-y divide-line">
              {vendor.contacts.map((c) => (
                <li key={c.id} className="py-2 first:pt-0 last:pb-0 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-extrabold flex items-center gap-2">
                      {c.name}
                      {c.isPrimary ? (
                        <span className="px-1.5 py-0.5 bg-orange/15 text-orange text-[9px] font-extrabold uppercase tracking-[0.1em]">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-ink-70 font-mono truncate">{c.email}</div>
                    {(c.role || c.phone) && (
                      <div className="text-[10px] text-ink-50">
                        {[c.role, c.phone].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingContact({
                          id: c.id,
                          name: c.name,
                          email: c.email,
                          phone: c.phone,
                          role: c.role,
                          isPrimary: c.isPrimary,
                        })
                      }
                      className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink underline-offset-2 hover:text-orange-d hover:underline"
                    >
                      Edit
                    </button>
                    <DeleteContactButton
                      workspaceId={workspaceId}
                      contactId={c.id}
                      contactName={c.name}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <NewContactForm
            workspaceId={workspaceId}
            vendorId={vendor.id}
            existingCount={vendor.contacts.length}
          />
        </div>
      </div>

      {vendor.notes ? (
        <div className="bg-cream-2 border border-line p-3 mb-6 text-[12px] text-ink-70 whitespace-pre-wrap">
          {vendor.notes}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-paper border-2 border-ink p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-2">
            Recent quotes
          </div>
          {vendor.recentQuotes.length === 0 ? (
            <div className="text-[11px] text-ink-50">No quotes yet.</div>
          ) : (
            <ul className="divide-y divide-line">
              {vendor.recentQuotes.map((q) => (
                <li key={q.id} className="py-1.5 first:pt-0 last:pb-0 flex items-center gap-2 text-[12px]">
                  <span className="font-mono text-[10px] text-ink-50">{q.rfqNumber}</span>
                  <span className="px-1.5 py-0.5 bg-cream-2 text-ink-50 text-[9px] font-extrabold uppercase tracking-[0.1em]">
                    {q.status}
                  </span>
                  <span className="ml-auto font-mono">${q.total.toLocaleString()}</span>
                  <span className="text-[10px] text-ink-50 w-20 text-right">
                    {new Date(q.submittedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-paper border-2 border-ink p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-2">
            Recent POs
          </div>
          {vendor.recentPos.length === 0 ? (
            <div className="text-[11px] text-ink-50">No POs yet.</div>
          ) : (
            <ul className="divide-y divide-line">
              {vendor.recentPos.map((p) => (
                <li key={p.id} className="py-1.5 first:pt-0 last:pb-0 flex items-center gap-2 text-[12px]">
                  <span className="font-mono text-[10px] text-ink-50">{p.number}</span>
                  <span className="px-1.5 py-0.5 bg-cream-2 text-ink-50 text-[9px] font-extrabold uppercase tracking-[0.1em]">
                    {p.status}
                  </span>
                  <span className="ml-auto font-mono">${p.total.toLocaleString()}</span>
                  <span className="text-[10px] text-ink-50 w-20 text-right">
                    {p.issuedAt ? new Date(p.issuedAt).toLocaleDateString() : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error ? (
        <div className="mt-3 text-[12px] text-error font-semibold">⚠ {error}</div>
      ) : null}

      {editingVendor ? (
        <EditVendorForm
          workspaceId={workspaceId}
          vendor={vendorToEditable(vendor)}
          onClose={() => setEditingVendor(false)}
        />
      ) : null}

      {editingContact ? (
        <EditContactForm
          workspaceId={workspaceId}
          contact={editingContact}
          onClose={() => setEditingContact(null)}
        />
      ) : null}
    </div>
  );
}

function vendorToEditable(v: VendorDetail): EditableVendor {
  return {
    id: v.id,
    name: v.name,
    legalName: v.legalName,
    accountNumber: v.accountNumber,
    capability: v.capability,
    status: v.status,
    defaultTerms: v.defaultTerms,
    phone: v.phone,
    website: v.website,
    addressLine1: v.addressLine1,
    addressLine2: v.addressLine2,
    city: v.city,
    state: v.state,
    postalCode: v.postalCode,
    taxExempt: v.taxExempt,
    notes: v.notes,
  };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-paper border-2 border-ink p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
        {`// ${label}`}
      </div>
      <div className="text-3xl font-black mt-1">{value}</div>
    </div>
  );
}
