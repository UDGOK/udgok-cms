'use client';

/**
 * NewEstimateView — the editor.
 *
 * A table of line items the admin fills in. Each
 * row has division code (optional CSI), description,
 * quantity, unit, unit price. The subtotal + tax +
 * total update live as the user types.
 *
 * On submit, posts the form data to createEstimateAction.
 * The action returns the new id; we router.push to the
 * detail page so the user can review before sending.
 */

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createEstimateAction } from '@/lib/estimates/actions';

interface Client {
  id: string;
  name: string;
}
interface Project {
  id: string;
  name: string;
  code: string | null;
  clientId: string | null;
}
interface Deal {
  id: string;
  title: string;
  clientId: string;
}

interface LineItem {
  divisionCode: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

const EMPTY_LINE: LineItem = {
  divisionCode: '',
  description: '',
  quantity: '1',
  unit: 'EA',
  unitPrice: '0',
};

const UNITS = ['EA', 'SF', 'LF', 'SY', 'CY', 'HR', 'LS', 'TON', 'GAL'];

export function NewEstimateView({
  workspaceSlug,
  clients,
  projects,
  deals,
  prefill,
}: {
  workspaceSlug: string;
  clients: Client[];
  projects: Project[];
  deals: Deal[];
  prefill: { clientId: string | null; projectId: string | null; dealId: string | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState(prefill.clientId ?? '');
  const [projectId, setProjectId] = useState(prefill.projectId ?? '');
  const [dealId, setDealId] = useState(prefill.dealId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validUntil, setValidUntil] = useState(() => {
    // Default: 30 days from today
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [taxRate, setTaxRate] = useState(''); // percent
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...EMPTY_LINE }]);
  const formRef = useRef<HTMLFormElement | null>(null);
  // Project source: 'none' (no project link at all),
  // 'existing' (link to a project that already exists),
  // or 'new' (capture a name + code now so the convert
  // action can create the project with that name on
  // approval). The form shows one of three different
  // UIs based on this state. We default to 'none' so
  // the legacy "convert-to-project creates a new one
  // with the estimate title" flow still works.
  const [projectSource, setProjectSource] = useState<'none' | 'existing' | 'new'>(
    prefill.projectId ? 'existing' : 'none',
  );
  const [pendingProjectName, setPendingProjectName] = useState('');
  const [pendingProjectCode, setPendingProjectCode] = useState('');

  // Filter the project / deal dropdowns by the
  // selected client so the user can't pick a
  // project belonging to a different client.
  const filteredProjects = useMemo(
    () => (clientId ? projects.filter((p) => p.clientId === clientId) : projects),
    [clientId, projects],
  );
  const filteredDeals = useMemo(
    () => (clientId ? deals.filter((d) => d.clientId === clientId) : deals),
    [clientId, deals],
  );

  // Live totals (read-only; the action recomputes too
  // but the UI shows the preview so the user knows
  // what they're sending).
  const totals = useMemo(() => {
    let subtotal = 0;
    for (const li of lineItems) {
      const qty = parseFloat(li.quantity) || 0;
      const price = parseFloat(li.unitPrice) || 0;
      subtotal += qty * price;
    }
    subtotal = Math.round(subtotal * 100) / 100;
    const rate = parseFloat(taxRate) || 0;
    const tax = rate > 0 ? Math.round(subtotal * (rate / 100) * 100) / 100 : 0;
    const total = Math.round((subtotal + tax) * 100) / 100;
    return { subtotal, tax, total };
  }, [lineItems, taxRate]);

  function updateLine(idx: number, patch: Partial<LineItem>) {
    setLineItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addLine() {
    setLineItems((rows) => [...rows, { ...EMPTY_LINE }]);
  }
  function removeLine(idx: number) {
    setLineItems((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError('Pick a client');
      return;
    }
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (projectSource === 'new' && !pendingProjectName.trim()) {
      setError('Project name is required when "Create new project" is selected');
      return;
    }
    if (projectSource === 'existing' && !projectId) {
      setError('Pick an existing project, or switch to a different option');
      return;
    }
    if (lineItems.length === 0) {
      setError('Add at least one line item');
      return;
    }
    // Validate each line item.
    for (let i = 0; i < lineItems.length; i++) {
      const li = lineItems[i];
      if (!li.description.trim()) {
        setError(`Line ${i + 1}: description is required`);
        return;
      }
      const qty = parseFloat(li.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`Line ${i + 1}: quantity must be a positive number`);
        return;
      }
      const price = parseFloat(li.unitPrice);
      if (!Number.isFinite(price) || price < 0) {
        setError(`Line ${i + 1}: unit price must be ≥ 0`);
        return;
      }
    }

    const fd = new FormData();
    fd.set('clientId', clientId);
    if (projectSource === 'existing' && projectId) fd.set('projectId', projectId);
    if (projectSource === 'new' && pendingProjectName.trim()) {
      fd.set('pendingProjectName', pendingProjectName.trim());
      if (pendingProjectCode.trim()) fd.set('pendingProjectCode', pendingProjectCode.trim());
    }
    if (dealId) fd.set('dealId', dealId);
    fd.set('title', title);
    if (description) fd.set('description', description);
    if (validUntil) fd.set('validUntil', new Date(validUntil).toISOString());
    if (taxRate && parseFloat(taxRate) > 0) {
      fd.set('taxRate', String(parseFloat(taxRate) / 100));
    }
    fd.set(
      'lineItems',
      JSON.stringify(
        lineItems.map((li) => ({
          divisionCode: li.divisionCode || undefined,
          description: li.description,
          quantity: parseFloat(li.quantity),
          unit: li.unit,
          unitPrice: parseFloat(li.unitPrice),
        })),
      ),
    );

    startTransition(async () => {
      const res = await createEstimateAction(workspaceSlug, undefined, fd);
      if (res.ok) {
        router.push(`/w/${workspaceSlug}/estimates/${res.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto">
      <div className="mb-4">
        <a
          href={`/w/${workspaceSlug}/estimates`}
          className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
        >
          ← Back to estimates
        </a>
      </div>
      <div className="mb-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
          New estimate
        </div>
        <h1 className="text-2xl font-black mt-0.5">Draft proposal</h1>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="bg-paper border-2 border-ink p-5 space-y-4">
        {/* Top metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Client *">
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setProjectId('');
                setPendingProjectName('');
                setPendingProjectCode('');
                setDealId('');
              }}
              className="w-full px-3 py-2 bg-cream border border-line text-[13px] text-ink"
            >
              <option value="">— Pick a client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title *">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Build-out for Coldstone Creamery"
              className="w-full px-3 py-2 bg-cream border border-line text-[13px] text-ink"
            />
          </Field>
          {/* Project source — three options. The "new"
              branch lets the admin name the future
              project up front so the convert action
              uses their wording instead of the estimate
              title. We use a radio group (not a select)
              because the three options need very
              different follow-up UIs. */}
          <Field label="Project">
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <label className="flex-1 flex items-start gap-2 px-2 py-1.5 bg-cream border border-line cursor-pointer hover:border-ink">
                  <input
                    type="radio"
                    name="projectSource"
                    value="none"
                    checked={projectSource === 'none'}
                    onChange={() => {
                      setProjectSource('none');
                      setProjectId('');
                      setPendingProjectName('');
                      setPendingProjectCode('');
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-ink">None</div>
                    <div className="text-[10px] text-ink-50 font-mono">
                      Standalone estimate. On approval, convert creates a new project using the estimate title.
                    </div>
                  </div>
                </label>
                <label className="flex-1 flex items-start gap-2 px-2 py-1.5 bg-cream border border-line cursor-pointer hover:border-ink">
                  <input
                    type="radio"
                    name="projectSource"
                    value="existing"
                    checked={projectSource === 'existing'}
                    onChange={() => {
                      setProjectSource('existing');
                      setPendingProjectName('');
                      setPendingProjectCode('');
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-ink">Existing project</div>
                    <div className="text-[10px] text-ink-50 font-mono">
                      Tie this estimate to a project (e.g. change-order scope).
                    </div>
                  </div>
                </label>
                <label className="flex-1 flex items-start gap-2 px-2 py-1.5 bg-cream border border-line cursor-pointer hover:border-ink">
                  <input
                    type="radio"
                    name="projectSource"
                    value="new"
                    checked={projectSource === 'new'}
                    onChange={() => {
                      setProjectSource('new');
                      setProjectId('');
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-ink">Create new project</div>
                    <div className="text-[10px] text-ink-50 font-mono">
                      Capture the project name now. On approval, the new project uses this name.
                    </div>
                  </div>
                </label>
              </div>
              {projectSource === 'existing' ? (
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-cream border border-line text-[13px] text-ink"
                >
                  <option value="">— Pick an existing project —</option>
                  {filteredProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.code ? ` (${p.code})` : ''}
                    </option>
                  ))}
                </select>
              ) : null}
              {projectSource === 'new' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={pendingProjectName}
                      onChange={(e) => setPendingProjectName(e.target.value)}
                      placeholder="Project name (e.g. Coldstone Creamery — Wetzel's build-out)"
                      className="w-full px-3 py-2 bg-cream border border-line text-[13px] text-ink"
                    />
                  </div>
                  <input
                    type="text"
                    value={pendingProjectCode}
                    onChange={(e) => setPendingProjectCode(e.target.value)}
                    placeholder="Code (optional)"
                    className="w-full px-3 py-2 bg-cream border border-line text-[13px] text-ink font-mono"
                  />
                </div>
              ) : null}
            </div>
          </Field>
          <Field label="Deal (optional)">
            <select
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              className="w-full px-3 py-2 bg-cream border border-line text-[13px] text-ink"
            >
              <option value="">— None —</option>
              {filteredDeals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Valid until">
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full px-3 py-2 bg-cream border border-line text-[13px] text-ink"
            />
          </Field>
          <Field label="Tax rate (%, optional)">
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-cream border border-line text-[13px] text-ink"
            />
          </Field>
        </div>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Scope summary, exclusions, terms, payment schedule…"
            className="w-full px-3 py-2 bg-cream border border-line text-[12px] text-ink resize-none"
          />
        </Field>

        {/* Line items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
              Line items
            </div>
            <button
              type="button"
              onClick={addLine}
              className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-orange hover:text-orange-d"
            >
              + Add line
            </button>
          </div>
          <div className="bg-cream-2 border border-line overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-line bg-cream">
                  <th className="text-left px-2 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-24">
                    CSI
                  </th>
                  <th className="text-left px-2 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50">
                    Description
                  </th>
                  <th className="text-right px-2 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-20">
                    Qty
                  </th>
                  <th className="text-left px-2 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-16">
                    Unit
                  </th>
                  <th className="text-right px-2 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-28">
                    Unit price
                  </th>
                  <th className="text-right px-2 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-50 w-28">
                    Total
                  </th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li, idx) => {
                  const qty = parseFloat(li.quantity) || 0;
                  const price = parseFloat(li.unitPrice) || 0;
                  const lineTotal = Math.round(qty * price * 100) / 100;
                  return (
                    <tr key={idx} className="border-b border-line last:border-b-0">
                      <td className="px-1.5 py-1">
                        <input
                          type="text"
                          value={li.divisionCode}
                          onChange={(e) => updateLine(idx, { divisionCode: e.target.value })}
                          placeholder="09 30 00"
                          className="w-full px-2 py-1 bg-paper border border-line text-[11px] font-mono text-ink"
                        />
                      </td>
                      <td className="px-1.5 py-1">
                        <input
                          type="text"
                          value={li.description}
                          onChange={(e) => updateLine(idx, { description: e.target.value })}
                          placeholder="Tile installation, master bath"
                          className="w-full px-2 py-1 bg-paper border border-line text-[12px] text-ink"
                        />
                      </td>
                      <td className="px-1.5 py-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={li.quantity}
                          onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                          className="w-full px-2 py-1 bg-paper border border-line text-[12px] text-right text-ink font-mono"
                        />
                      </td>
                      <td className="px-1.5 py-1">
                        <select
                          value={li.unit}
                          onChange={(e) => updateLine(idx, { unit: e.target.value })}
                          className="w-full px-1 py-1 bg-paper border border-line text-[11px] font-mono text-ink"
                        >
                          {UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1.5 py-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={li.unitPrice}
                          onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                          className="w-full px-2 py-1 bg-paper border border-line text-[12px] text-right text-ink font-mono"
                        />
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-ink-70">
                        ${lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          disabled={lineItems.length === 1}
                          className="text-ink-50 hover:text-error disabled:opacity-30 text-[14px]"
                          aria-label="Remove line"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-cream">
                  <td colSpan={5} className="px-2 py-2 text-right text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                    Subtotal
                  </td>
                  <td className="px-2 py-2 text-right font-extrabold text-ink">
                    ${totals.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
                {totals.tax > 0 ? (
                  <tr className="bg-cream">
                    <td colSpan={5} className="px-2 py-1.5 text-right text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                      Tax
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-ink-70">
                      ${totals.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                ) : null}
                <tr className="bg-cream border-t border-line">
                  <td colSpan={5} className="px-2 py-2 text-right text-[10px] font-mono uppercase tracking-[0.12em] text-ink font-extrabold">
                    Total
                  </td>
                  <td className="px-2 py-2 text-right font-extrabold text-[14px] text-orange">
                    ${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {error ? (
          <div className="text-[11px] text-error font-mono bg-error/10 border border-error px-2 py-1.5">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <a
            href={`/w/${workspaceSlug}/estimates`}
            className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-70 hover:text-ink"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-1.5 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-orange hover:bg-orange-d disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save as draft'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}
