'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { Button, Input, Field } from '@/components/ui';
import { CodePicker } from '@/components/construction/CodePicker';
import { createSubcontractorAction } from '@/lib/subs/actions';

interface SubItem {
  id: string;
  name: string;
  primaryTrade: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  licenseNumber: string | null;
  insuranceExpiry: string | null;
  w9OnFile: boolean;
  rating: number | null;
  projectCount: number;
  totalContract: number;
}

function CreateSubForm({ workspaceSlug, onDone }: { workspaceSlug: string; onDone: () => void }) {
  const [trade, setTrade] = useState('');
  const [code, setCode] = useState('');
  const [state, formAction] = useFormState(
    createSubcontractorAction.bind(null, workspaceSlug),
    undefined as { error?: string; fieldErrors?: Record<string, string>; id?: string } | undefined,
  );

  return (
    <form
      action={async (fd) => {
        fd.set('primaryTrade', code);
        const result = (await formAction(fd)) as { id?: string; error?: string; fieldErrors?: Record<string, string> } | undefined;
        if (result?.id) onDone();
      }}
      className="bg-paper border-2 border-ink p-6 space-y-4"
    >
      <h2 className="font-extrabold text-[16px]">Add a subcontractor</h2>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-6">
          <Field label="Company name" htmlFor="s-name" error={state?.fieldErrors?.name}>
            <Input id="s-name" name="name" required autoFocus placeholder="Acme Concrete LLC" />
          </Field>
        </div>
        <div className="col-span-3">
          <CodePicker
            code={code}
            trade={trade}
            onChange={(next) => {
              setCode(next.code);
              setTrade(next.trade);
            }}
            codeError={state?.fieldErrors?.primaryTrade}
          />
        </div>
        <div className="col-span-3">
          <Field label="Contact name" htmlFor="s-contact">
            <Input id="s-contact" name="contactName" placeholder="Bob Smith" />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Email" htmlFor="s-email" error={state?.fieldErrors?.contactEmail}>
          <Input id="s-email" name="contactEmail" type="email" placeholder="bob@acme.com" />
        </Field>
        <Field label="Phone" htmlFor="s-phone">
          <Input id="s-phone" name="contactPhone" placeholder="(918) 555-0100" />
        </Field>
        <Field label="Hourly rate" htmlFor="s-rate" error={state?.fieldErrors?.hourlyRate}>
          <Input id="s-rate" name="hourlyRate" type="number" step="0.01" min="0" placeholder="85.00" />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="License #" htmlFor="s-lic">
          <Input id="s-lic" name="licenseNumber" placeholder="OK-12345" />
        </Field>
        <Field label="Insurance expiry" htmlFor="s-ins">
          <Input id="s-ins" name="insuranceExpiry" type="date" />
        </Field>
        <Field label="Quality rating" htmlFor="s-rating">
          <select id="s-rating" name="rating" className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink">
            <option value="">—</option>
            <option value="5">★★★★★ (5)</option>
            <option value="4">★★★★☆ (4)</option>
            <option value="3">★★★☆☆ (3)</option>
            <option value="2">★★☆☆☆ (2)</option>
            <option value="1">★☆☆☆☆ (1)</option>
          </select>
        </Field>
      </div>

      <Field label="Address" htmlFor="s-addr">
        <Input id="s-addr" name="address" placeholder="123 Industrial Way, Tulsa OK 74103" />
      </Field>

      <Field label="Notes" htmlFor="s-notes">
        <textarea id="s-notes" name="notes" rows={2} className="block w-full px-3.5 py-3 bg-paper border border-line text-ink text-sm outline-none focus:border-ink" />
      </Field>

      <label className="flex items-center gap-2 text-[12px] cursor-pointer">
        <input type="checkbox" name="w9OnFile" className="w-4 h-4 accent-orange" />
        W-9 on file
      </label>

      {state?.error && !state.fieldErrors ? <p className="text-sm text-error font-semibold">{state.error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <ButtonSubmit />
      </div>
    </form>
  );
}

function ButtonSubmit() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="copper" disabled={pending}>{pending ? 'Adding…' : '+ Add sub'}</Button>;
}

export function SubsListClient({
  workspaceSlug,
  initialSubs,
  csiLookup,
}: {
  workspaceSlug: string;
  initialSubs: SubItem[];
  csiLookup: Record<string, string>;
}) {
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('');
  const [subs] = useState(initialSubs);

  const filtered = filter
    ? subs.filter(
        (s) =>
          s.name.toLowerCase().includes(filter.toLowerCase()) ||
          (s.contactName ?? '').toLowerCase().includes(filter.toLowerCase()) ||
          (s.primaryTrade && csiLookup[s.primaryTrade]?.toLowerCase().includes(filter.toLowerCase())),
      )
    : subs;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <input
          type="search"
          placeholder="Filter by name, contact, or trade…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 max-w-md px-4 py-2.5 bg-paper border-2 border-line text-sm outline-none focus:border-ink"
        />
        {creating ? null : (
          <Button variant="copper" onClick={() => setCreating(true)}>
            + Add subcontractor
          </Button>
        )}
      </div>

      {creating ? (
        <CreateSubForm workspaceSlug={workspaceSlug} onDone={() => { setCreating(false); if (typeof window !== 'undefined') window.location.reload(); }} />
      ) : null}

      {subs.length === 0 ? (
        <div className="bg-paper border-2 border-dashed border-line p-10 text-center">
          <div className="text-5xl mb-3">🔨</div>
          <h3 className="font-extrabold text-[18px] mb-1">No subcontractors yet</h3>
          <p className="text-[13px] text-ink-50 max-w-md mx-auto">
            Build your vendor library. Add the subs you trust, what trade they specialize in,
            and their contact info. Then assign them to projects and pick which divisions they cover.
          </p>
        </div>
      ) : (
        <div className="bg-paper border-2 border-ink divide-y divide-line-soft">
          {filtered.map((s) => {
            const tradeName = s.primaryTrade ? csiLookup[s.primaryTrade] : null;
            return (
              <Link
                key={s.id}
                href={`/w/${workspaceSlug}/subcontractors/${s.id}`}
                className="block px-5 py-4 hover:bg-cream-2 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <h3 className="font-extrabold text-[15px] truncate">{s.name}</h3>
                      {s.rating ? (
                        <span className="text-[10px] text-warning font-mono">{'★'.repeat(s.rating)}{'☆'.repeat(5 - s.rating)}</span>
                      ) : null}
                      {s.w9OnFile ? (
                        <span className="px-1.5 py-0.5 bg-success text-paper text-[9px] font-mono uppercase tracking-[0.05em]">W-9</span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-ink-50">
                      {tradeName ? <span><span className="font-mono text-orange-d mr-1">{s.primaryTrade}</span>{tradeName}</span> : null}
                      {s.contactName ? <span>{s.contactName}</span> : null}
                      {s.contactPhone ? <span className="font-mono">{s.contactPhone}</span> : null}
                      {s.contactEmail ? <span className="font-mono">{s.contactEmail}</span> : null}
                    </div>
                  </div>
                  <div className="text-right text-[11px] font-mono text-ink-50">
                    {s.projectCount > 0 ? (
                      <div className="font-extrabold text-ink">
                        {s.projectCount} {s.projectCount === 1 ? 'project' : 'projects'}
                      </div>
                    ) : null}
                    {s.totalContract > 0 ? (
                      <div>${s.totalContract.toLocaleString()} contracted</div>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
