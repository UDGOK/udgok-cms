'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createMaterialAction, createEquipmentAction } from '@/lib/inventory/actions';

export interface ProjectOption {
  id: string;
  name: string;
  code: string | null;
}

export interface CreateInventoryFromScanProps {
  workspaceSlug: string;
  scannedCode: string;
  projects: ProjectOption[];
  /**
   * Optional pre-fill values. Used by the product-catalog flow:
   * if we found a product in UPCitemdb / the local cache, the
   * scan page passes its name + description here so the user
   * doesn't have to retype what we already know.
   */
  prefilled?: { name?: string; description?: string };
  /**
   * Which tab (material/equipment) the form should start on.
   * The InventoryTab's "+ Material" and "+ Equipment" buttons
   * pass this so the user doesn't have to click the toggle.
   */
  initialKind?: 'material' | 'equipment';
  /**
   * The project that should be pre-selected in the dropdown.
   * Comes from the "?projectId=…" search param the InventoryTab
   * adds so the user adds the inventory to the right project
   * without scrolling through the list.
   */
  initialProjectId?: string;
}

type FormState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; kind: 'material' | 'equipment'; id: string };

/**
 * Shown on the scan page when a code is "not found". The user
 * picks a project, picks material vs equipment, fills in the
 * basics, and we create the row. The code is locked in (it
 * came from the scan, no point letting the user mistype it).
 *
 * Why a single component for both material and equipment?
 *  - The fields are 90% the same (code, name, project, cost).
 *  - A toggle for "material / equipment" lets us add
 *    equipment-specific fields (serialNumber, condition) only
 *    when needed, without two near-duplicate forms.
 *  - The user sees one decision: "what kind of thing is this?"
 *
 * Implementation note: we call the server action directly via
 * useTransition instead of useFormState. useFormState + bound
 * actions + the project's zod-based error shape gets gnarly
 * with TypeScript; the manual form approach is just as clean
 * and a third the code.
 */
export function CreateInventoryFromScan({
  workspaceSlug,
  scannedCode,
  projects,
  prefilled,
  initialKind,
  initialProjectId,
}: CreateInventoryFromScanProps) {
  const router = useRouter();
  const [kind, setKind] = useState<'material' | 'equipment'>(initialKind ?? 'material');
  const [state, setState] = useState<FormState>({ status: 'idle' });
  const [pending, startTransition] = useTransition();

  // Pre-select the project the user came from. Falls back to
  // the first active project if the hinted one isn't in the
  // list (could happen if the project became completed/cancelled
  // between the link render and the form render).
  const initialProject = initialProjectId && projects.some((p) => p.id === initialProjectId)
    ? initialProjectId
    : projects[0]?.id ?? '';

  function onSubmit(form: HTMLFormElement) {
    const fd = new FormData(form);
    setState({ status: 'idle' });
    startTransition(async () => {
      const res =
        kind === 'material'
          ? await createMaterialAction(workspaceSlug, undefined, fd)
          : await createEquipmentAction(workspaceSlug, undefined, fd);
      if (res.ok) {
        setState({ status: 'ok', kind: res.kind, id: res.id });
        // Refresh server data so the project's INVENTORY tab
        // (if the user navigates there) shows the new row.
        router.refresh();
      } else {
        setState({ status: 'error', message: res.error });
      }
    });
  }

  if (state.status === 'ok') {
    return (
      <div className="bg-success/10 border border-success p-3 text-sm">
        <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-success font-extrabold mb-1">
          ✓ Created
        </div>
        <p className="text-ink-70">
          Added to the project&apos;s inventory. The new {state.kind} shows up in
          the project&apos;s INVENTORY tab.
        </p>
        <button
          type="button"
          onClick={() => setState({ status: 'idle' })}
          className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-orange-d hover:underline"
        >
          Add another →
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-2">
        {'// Create from this code'}
      </div>
      <div className="bg-paper border-2 border-line p-4">
        <div className="flex items-center gap-2 mb-3 text-[10px] font-mono">
          <span className="uppercase tracking-[0.1em] text-ink-50">code</span>
          <span className="px-2 py-0.5 bg-cream-2 border border-line font-mono">
            {scannedCode}
          </span>
        </div>

        {/* Kind toggle — material vs equipment */}
        <div className="flex gap-1 mb-3">
          {(['material', 'equipment'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`flex-1 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.1em] border-2 ${
                kind === k
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-paper text-ink-50 border-line hover:border-ink'
              }`}
            >
              {k === 'material' ? '🧱 Material' : '🔧 Equipment'}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(e.currentTarget);
          }}
          className="space-y-3"
        >
          <input type="hidden" name="code" value={scannedCode} />

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Project
            </label>
            <select
              name="projectId"
              required
              className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px]"
              defaultValue={initialProject}
            >
              {projects.length === 0 ? (
                <option value="" disabled>
                  No active projects — create one first
                </option>
              ) : null}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.code} · ` : ''}
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              {kind === 'material' ? 'Material name' : 'Equipment name'}
            </label>
            <input
              name="name"
              required
              maxLength={200}
              defaultValue={prefilled?.name ?? ''}
              placeholder={kind === 'material' ? 'e.g. 2x4 stud, 8ft' : 'e.g. Cordless drill, Makita XPH07'}
              className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Description (optional)
            </label>
            <textarea
              name="description"
              maxLength={2000}
              rows={2}
              defaultValue={prefilled?.description ?? ''}
              placeholder="What is this product? (auto-filled from product catalog when available)"
              className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[12px]"
            />
          </div>

          {kind === 'equipment' ? (
            <div className="grid grid-cols-2 gap-2" key="equipment-fields">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Serial #
                </label>
                <input
                  name="serialNumber"
                  maxLength={200}
                  className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px] font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Condition
                </label>
                <select
                  name="condition"
                  defaultValue="GOOD"
                  className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px]"
                >
                  <option value="NEW">New</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2" key="material-fields">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Unit
                </label>
                <input
                  name="unit"
                  defaultValue="each"
                  maxLength={40}
                  className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px] font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Qty on hand
                </label>
                <input
                  name="quantity"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                  className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px] font-mono"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Unit cost (optional)
            </label>
            <input
              name="unitCost"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px] font-mono"
            />
          </div>

          {kind === 'equipment' ? (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                Quantity
              </label>
              <input
                name="quantity"
                type="number"
                min="0"
                defaultValue="1"
                className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px] font-mono"
              />
            </div>
          ) : null}

          {state.status === 'error' ? (
            <div className="bg-error/10 border border-error px-3 py-2 text-[12px] text-error">
              {state.message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full px-4 py-2.5 bg-orange text-paper text-[12px] font-extrabold uppercase tracking-[0.1em] hover:bg-orange-d transition-colors disabled:opacity-50"
          >
            {pending
              ? '⟳ Creating…'
              : kind === 'material'
              ? '+ Add to material inventory'
              : '+ Add to equipment inventory'}
          </button>
        </form>
      </div>
    </div>
  );
}
